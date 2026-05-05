import type { ColumnMetadata, EntityMetadata } from "../core/entity-metadata";
import type { Connection, ExecuteResult } from "../core/connection";
import type { DBConfig } from "../config/db-config";
import type { DatabaseDialect, DDLDialect, ColumnInfo, PageInfo } from "./dialect";

// ---------------------------------------------------------------------------
// PGConnection — wraps a `pg` Pool
// ---------------------------------------------------------------------------

class PGConnection implements Connection {
  private pool: any;
  private transactionConn: any = null;

  constructor(pool: any) {
    this.pool = pool;
  }

  /**
   * Convert `?` placeholders to `$1`, `$2`, … for pg.
   * Only replaces `?` that are not inside single-quoted strings.
   */
  private convertPlaceholders(sql: string): string {
    let index = 0;
    let inString = false;
    let result = "";
    for (let i = 0; i < sql.length; i++) {
      const ch = sql[i];
      if (ch === "'" && sql[i - 1] !== "\\") {
        inString = !inString;
        result += ch;
      } else if (ch === "?" && !inString) {
        result += `$${++index}`;
      } else {
        result += ch;
      }
    }
    return result;
  }

  async execute(sql: string, params?: any[]): Promise<ExecuteResult> {
    const conn = this.transactionConn ?? this.pool;
    const converted = this.convertPlaceholders(sql);
    const result = await conn.query(converted, params);
    // If the SQL contains RETURNING, extract the generated value as insertId
    let insertId: number | bigint = 0;
    if (result.rows && result.rows.length > 0 && /returning\b/i.test(sql)) {
      const row = result.rows[0];
      const keys = Object.keys(row);
      if (keys.length > 0) {
        insertId = row[keys[0]];
      }
    }
    return {
      affectedRows: result.rowCount ?? 0,
      insertId,
      changedRows: result.rowCount ?? 0,
    };
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const conn = this.transactionConn ?? this.pool;
    const converted = this.convertPlaceholders(sql);
    const result = await conn.query(converted, params);
    return result.rows as T[];
  }

  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async beginTransaction(): Promise<void> {
    this.transactionConn = await this.pool.connect();
    await this.transactionConn.query("BEGIN");
  }

  async commit(): Promise<void> {
    if (!this.transactionConn) return;
    await this.transactionConn.query("COMMIT");
    this.transactionConn.release();
    this.transactionConn = null;
  }

  async rollback(): Promise<void> {
    if (!this.transactionConn) return;
    await this.transactionConn.query("ROLLBACK");
    this.transactionConn.release();
    this.transactionConn = null;
  }

  isTransactional(): boolean {
    return this.transactionConn !== null;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  getNativeConnection(): any {
    return this.transactionConn ?? this.pool;
  }
}

// ---------------------------------------------------------------------------
// PG DDL dialect
// ---------------------------------------------------------------------------

class PGDDLDialect implements DDLDialect {
  async tableExists(connection: Connection, tableName: string): Promise<boolean> {
    const rows = await connection.query<any>(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = $1 LIMIT 1`,
      [tableName],
    );
    return rows.length > 0;
  }

  async getExistingColumns(connection: Connection, tableName: string): Promise<Map<string, ColumnInfo>> {
    // Get column definitions
    const cols = await connection.query<any>(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = $1
       ORDER BY ordinal_position`,
      [tableName],
    );

    // Get primary key columns
    const pks = await connection.query<any>(
      `SELECT a.attname AS column_name
       FROM pg_index i
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
       WHERE i.indrelid = $1::regclass AND i.indisprimary`,
      [tableName],
    );
    const pkSet = new Set<string>(pks.map((r: any) => r.column_name));

    const map = new Map<string, ColumnInfo>();
    for (const row of cols) {
      map.set(row.column_name, {
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === "YES",
        key: pkSet.has(row.column_name) ? "PRI" : "",
        default: row.column_default,
        extra: "",
      });
    }
    return map;
  }

  buildCreateTable(metadata: EntityMetadata): string {
    const fields = [...metadata.columns.values()];
    const parts: string[] = [];
    const pkColumns: string[] = [];
    const uniques: string[] = [];

    for (const col of fields) {
      const def = this.buildColumnDef(col);
      parts.push(def);
      if (col.isPrimary) {
        pkColumns.push(`"${col.columnName}"`);
      }
      if (col.unique && !col.isPrimary) {
        uniques.push(`CONSTRAINT "uq_${col.columnName}" UNIQUE ("${col.columnName}")`);
      }
    }

    if (pkColumns.length > 0) {
      parts.push(`PRIMARY KEY (${pkColumns.join(", ")})`);
    }
    parts.push(...uniques);

    const table = `"${metadata.schema ? metadata.schema + '"."' : ""}${metadata.tableName}"`;
    let sql = `CREATE TABLE IF NOT EXISTS ${table} (\n  ${parts.join(",\n  ")}\n)`;
    // PG ignores ENGINE / CHARSET — skip them
    if (metadata.comment) {
      // Use COMMENT ON TABLE for PG (done separately), or inline comment via SQL comment
      sql += `;\nCOMMENT ON TABLE ${table} IS '${metadata.comment.replace(/'/g, "''")}'`;
    }
    return sql;
  }

  buildDropTable(tableName: string, ifExists = true): string {
    const maybe = ifExists ? "IF EXISTS " : "";
    return `DROP TABLE ${maybe}"${tableName}"`;
  }

  buildAlterTable(metadata: EntityMetadata, existingColumns: Map<string, ColumnInfo>): string[] {
    const statements: string[] = [];
    const table = `"${metadata.tableName}"`;

    for (const col of metadata.columns.values()) {
      const existing = existingColumns.get(col.columnName);
      if (!existing) {
        const def = this.buildColumnDef(col);
        statements.push(`ALTER TABLE ${table} ADD COLUMN ${def}`);
      }
    }
    return statements;
  }

  private buildColumnDef(col: ColumnMetadata): string {
    const parts: string[] = [];
    parts.push(`"${col.columnName}"`);
    parts.push(col.databaseType);

    if (!col.nullable) parts.push("NOT NULL");
    if (col.isGenerated && col.generationType === "identity" as any) {
      parts.push("GENERATED BY DEFAULT AS IDENTITY");
    }
    if (col.defaultValue !== undefined) {
      const dv = typeof col.defaultValue === "string"
        ? `'${col.defaultValue.replace(/'/g, "''")}'`
        : col.defaultValue;
      parts.push(`DEFAULT ${dv}`);
    }
    return parts.join(" ");
  }
}

// ---------------------------------------------------------------------------
// PostgreSQL Dialect
// ---------------------------------------------------------------------------

export class PgDialect implements DatabaseDialect {
  createConnection(config: DBConfig): Connection {
    const { Pool } = require("pg");
    const pool = new Pool({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
      max: config.poolSize,
      // Force UTC to match MySQL behaviour
      // (pg-types defaults to local time for timestamptz)
    });
    return new PGConnection(pool);
  }

  /**
   * Translate MySQL-centric column types produced by entity-metadata
   * into PostgreSQL equivalents.
   */
  mapColumnType(col: ColumnMetadata): string {
    const t = col.databaseType.toUpperCase();
    // TINYINT(1) → BOOLEAN
    if (t === "TINYINT(1)") return "BOOLEAN";
    if (t.startsWith("TINYINT")) return "SMALLINT";
    // INT → INTEGER
    if (t === "INT" || t.startsWith("INT(")) return "INTEGER";
    // DATETIME → TIMESTAMP
    if (t.startsWith("DATETIME")) return t.replace("DATETIME", "TIMESTAMP");
    // JSON → JSONB
    if (t === "JSON") return "JSONB";
    // BLOB → BYTEA
    if (t === "BLOB") return "BYTEA";
    // FLOAT → REAL
    if (t === "FLOAT") return "REAL";
    // DOUBLE → DOUBLE PRECISION
    if (t === "DOUBLE") return "DOUBLE PRECISION";
    // Pass-through: VARCHAR, TEXT, BIGINT, INTEGER, TIMESTAMP, BOOLEAN, etc.
    return col.databaseType;
  }

  escapeIdentifier(name: string): string {
    return `"${name}"`;
  }

  // ------------------------------------------------------------------
  // SQL Builders (use `"` quoting and `?` placeholders — placeholders
  // are converted to `$N` by PGConnection at execution time)
  // ------------------------------------------------------------------

  buildInsert(metadata: EntityMetadata, entity: Record<string, any>): { sql: string; params: any[] } {
    const insertable = [...metadata.columns.values()].filter(c => c.insertable && !c.isGenerated);
    const names = insertable.map(c => `"${c.columnName}"`);
    const params = insertable.map(c => entity[c.propertyKey]);
    const placeholders = names.map(() => "?");
    let sql = `INSERT INTO "${metadata.tableName}" (${names.join(", ")}) VALUES (${placeholders.join(", ")})`;
    // RETURNING for identity columns
    if (metadata.generatedColumn && metadata.generatedColumn.generationType === ("identity" as any)) {
      sql += ` RETURNING "${metadata.generatedColumn.columnName}"`;
    }
    return { sql, params };
  }

  buildBatchInsert(metadata: EntityMetadata, entities: Record<string, any>[]): { sql: string; params: any[] } {
    const insertable = [...metadata.columns.values()].filter(c => c.insertable && !c.isGenerated);
    const names = insertable.map(c => `"${c.columnName}"`);
    const params: any[] = [];
    const rows: string[] = [];
    for (const entity of entities) {
      const vals = insertable.map(c => entity[c.propertyKey]);
      params.push(...vals);
      rows.push(`(${vals.map(() => "?").join(", ")})`);
    }
    let sql = `INSERT INTO "${metadata.tableName}" (${names.join(", ")}) VALUES ${rows.join(", ")}`;
    if (metadata.generatedColumn && metadata.generatedColumn.generationType === ("identity" as any)) {
      sql += ` RETURNING "${metadata.generatedColumn.columnName}"`;
    }
    return { sql, params };
  }

  buildUpdateById(metadata: EntityMetadata, entity: Record<string, any>): { sql: string; params: any[] } {
    const updatable = [...metadata.columns.values()].filter(c => c.updatable && !c.isPrimary && !c.isVersion);
    const setParts = updatable.map(c => `"${c.columnName}" = ?`);
    const params = updatable.map(c => entity[c.propertyKey]);

    for (const pk of metadata.primaryKeys) {
      params.push(entity[pk.propertyKey]);
    }
    const whereParts = metadata.primaryKeys.map(pk => `"${pk.columnName}" = ?`);

    let sql = `UPDATE "${metadata.tableName}" SET ${setParts.join(", ")}`;
    if (metadata.versionColumn) {
      const vc = metadata.versionColumn;
      sql += `, "${vc.columnName}" = "${vc.columnName}" + 1`;
      params.push(entity[vc.propertyKey]);
      sql += ` WHERE ${whereParts.join(" AND ")} AND "${vc.columnName}" = ?`;
    } else {
      sql += ` WHERE ${whereParts.join(" AND ")}`;
    }
    return { sql, params };
  }

  buildDeleteById(metadata: EntityMetadata, id: any): { sql: string; params: any[] } {
    const pkCol = metadata.primaryKeys[0].columnName;
    return { sql: `DELETE FROM "${metadata.tableName}" WHERE "${pkCol}" = ?`, params: [id] };
  }

  buildDeleteByCondition(metadata: EntityMetadata, whereSql: string, params: any[]): { sql: string; params: any[] } {
    const sql = `DELETE FROM "${metadata.tableName}"${whereSql ? ` WHERE ${whereSql}` : ""}`;
    return { sql, params };
  }

  buildSelectById(metadata: EntityMetadata, id: any): { sql: string; params: any[] } {
    const pkCol = metadata.primaryKeys[0].columnName;
    const cols = this.selectColumns(metadata);
    return { sql: `SELECT ${cols} FROM "${metadata.tableName}" WHERE "${pkCol}" = ?`, params: [id] };
  }

  buildSelectByIds(metadata: EntityMetadata, ids: any[]): { sql: string; params: any[] } {
    const pkCol = metadata.primaryKeys[0].columnName;
    const cols = this.selectColumns(metadata);
    const placeholders = ids.map(() => "?").join(", ");
    return { sql: `SELECT ${cols} FROM "${metadata.tableName}" WHERE "${pkCol}" IN (${placeholders})`, params: ids };
  }

  buildSelectList(
    metadata: EntityMetadata, selectColumns: string, whereSql: string,
    orderBy: string, limit: number, offset: number, params: any[],
  ): { sql: string; params: any[] } {
    let sql = `SELECT ${selectColumns} FROM "${metadata.tableName}"`;
    if (whereSql) sql += ` WHERE ${whereSql}`;
    if (orderBy) sql += ` ORDER BY ${orderBy}`;
    if (limit > 0) sql += ` LIMIT ${limit}`;
    if (offset > 0) sql += ` OFFSET ${offset}`;
    return { sql, params };
  }

  buildSelectCount(metadata: EntityMetadata, whereSql: string, params: any[]): { sql: string; params: any[] } {
    let sql = `SELECT COUNT(*) AS total FROM "${metadata.tableName}"`;
    if (whereSql) sql += ` WHERE ${whereSql}`;
    return { sql, params };
  }

  buildSelectPage(
    metadata: EntityMetadata, selectColumns: string, whereSql: string,
    orderBy: string, page: PageInfo, params: any[],
  ): { sql: string; params: any[] } {
    const offset = (page.page - 1) * page.size;
    let sql = `SELECT ${selectColumns} FROM "${metadata.tableName}"`;
    if (whereSql) sql += ` WHERE ${whereSql}`;
    if (orderBy) sql += ` ORDER BY ${orderBy}`;
    sql += ` LIMIT ${page.size} OFFSET ${offset}`;
    return { sql, params };
  }

  buildUpdateByCondition(
    metadata: EntityMetadata, setPairs: string, setParams: any[],
    whereSql: string, whereParams: any[],
  ): { sql: string; params: any[] } {
    let sql = `UPDATE "${metadata.tableName}" SET ${setPairs}`;
    if (metadata.versionColumn) {
      const vc = metadata.versionColumn;
      sql += `, "${vc.columnName}" = "${vc.columnName}" + 1`;
    }
    if (whereSql) sql += ` WHERE ${whereSql}`;
    return { sql, params: [...setParams, ...whereParams] };
  }

  getDDLGenerator(): DDLDialect {
    return new PGDDLDialect();
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  private selectColumns(metadata: EntityMetadata): string {
    return [...metadata.columns.values()]
      .map(c => `"${c.columnName}"`)
      .join(", ");
  }
}
