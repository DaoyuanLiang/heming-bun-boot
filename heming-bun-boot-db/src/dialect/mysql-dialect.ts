import type { ColumnMetadata, EntityMetadata } from "../core/entity-metadata";
import type { Connection, ExecuteResult } from "../core/connection";
import type { DBConfig } from "../config/db-config";
import type { DatabaseDialect, DDLDialect, ColumnInfo, PageInfo } from "./dialect";

class MySQLConnection implements Connection {
  private pool: any;
  private transactionConn: any = null;

  constructor(pool: any) {
    this.pool = pool;
  }

  async execute(sql: string, params?: any[]): Promise<ExecuteResult> {
    const conn = this.transactionConn ?? this.pool;
    const [result] = await conn.execute(sql, params);
    return {
      affectedRows: result.affectedRows,
      insertId: result.insertId,
      changedRows: result.changedRows,
    };
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const conn = this.transactionConn ?? this.pool;
    const [rows] = await conn.query(sql, params);
    return rows as T[];
  }

  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async beginTransaction(): Promise<void> {
    this.transactionConn = await this.pool.getConnection();
    await this.transactionConn.beginTransaction();
  }

  async commit(): Promise<void> {
    if (!this.transactionConn) return;
    await this.transactionConn.commit();
    this.transactionConn.release();
    this.transactionConn = null;
  }

  async rollback(): Promise<void> {
    if (!this.transactionConn) return;
    await this.transactionConn.rollback();
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

// ---------- DDL ----------

class MySQLDDLDialect implements DDLDialect {
  async tableExists(connection: Connection, tableName: string): Promise<boolean> {
    const rows = await connection.query<any>(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`,
      [tableName],
    );
    return rows.length > 0;
  }

  async getExistingColumns(connection: Connection, tableName: string): Promise<Map<string, ColumnInfo>> {
    const rows = await connection.query<any>(
      `SHOW COLUMNS FROM \`${tableName}\``,
    );
    const map = new Map<string, ColumnInfo>();
    for (const row of rows) {
      map.set(row.Field, {
        name: row.Field,
        type: row.Type,
        nullable: row.Null === "YES",
        key: row.Key || "",
        default: row.Default,
        extra: row.Extra || "",
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
        pkColumns.push(this.escape(col.columnName));
      }
      if (col.unique && !col.isPrimary) {
        uniques.push(`UNIQUE KEY \`uk_${col.columnName}\` (\`${col.columnName}\`)`);
      }
    }

    if (pkColumns.length > 0) {
      parts.push(`PRIMARY KEY (${pkColumns.join(", ")})`);
    }
    parts.push(...uniques);

    const table = this.escape(metadata.tableName);
    const engine = metadata.engine ?? "InnoDB";
    const charset = metadata.charset ?? "utf8mb4";
    let sql = `CREATE TABLE IF NOT EXISTS ${table} (\n  ${parts.join(",\n  ")}\n) ENGINE=${engine} DEFAULT CHARSET=${charset}`;
    if (metadata.comment) {
      sql += ` COMMENT='${metadata.comment.replace(/'/g, "\\'")}'`;
    }
    return sql;
  }

  buildDropTable(tableName: string, ifExists = true): string {
    const maybe = ifExists ? "IF EXISTS " : "";
    return `DROP TABLE ${maybe}\`${tableName}\``;
  }

  buildAlterTable(metadata: EntityMetadata, existingColumns: Map<string, ColumnInfo>): string[] {
    const statements: string[] = [];
    const table = this.escape(metadata.tableName);

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
    parts.push(`\`${col.columnName}\``);
    parts.push(col.databaseType);

    if (!col.nullable) parts.push("NOT NULL");
    if (col.isGenerated && col.generationType === "identity" as any) {
      parts.push("AUTO_INCREMENT");
    }
    if (col.defaultValue !== undefined) {
      const dv = typeof col.defaultValue === "string"
        ? `'${col.defaultValue.replace(/'/g, "\\'")}'`
        : col.defaultValue;
      parts.push(`DEFAULT ${dv}`);
    }
    if (col.comment) {
      parts.push(`COMMENT '${col.comment.replace(/'/g, "\\'")}'`);
    }
    return parts.join(" ");
  }

  private escape(name: string): string {
    return `\`${name}\``;
  }
}

// ---------- MySQL Dialect ----------

export class MySQLDialect implements DatabaseDialect {
  createConnection(config: DBConfig): Connection {
    const mysql = require("mysql2/promise");
    const pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
      connectionLimit: config.poolSize,
      charset: config.charset ?? "utf8mb4",
      timezone: config.timezone ?? "+00:00",
      namedPlaceholders: false,
    });
    return new MySQLConnection(pool);
  }

  mapColumnType(col: ColumnMetadata): string {
    return col.databaseType;
  }

  escapeIdentifier(name: string): string {
    return `\`${name}\``;
  }

  // ---------- SQL Builders ----------

  buildInsert(metadata: EntityMetadata, entity: Record<string, any>): { sql: string; params: any[] } {
    const insertable = [...metadata.columns.values()].filter(c => c.insertable && !c.isGenerated);
    const names = insertable.map(c => `\`${c.columnName}\``);
    const params = insertable.map(c => entity[c.propertyKey]);
    const placeholders = names.map(() => "?");
    const sql = `INSERT INTO \`${metadata.tableName}\` (${names.join(", ")}) VALUES (${placeholders.join(", ")})`;
    return { sql, params };
  }

  buildBatchInsert(metadata: EntityMetadata, entities: Record<string, any>[]): { sql: string; params: any[] } {
    const insertable = [...metadata.columns.values()].filter(c => c.insertable && !c.isGenerated);
    const names = insertable.map(c => `\`${c.columnName}\``);
    const params: any[] = [];
    const rows: string[] = [];
    for (const entity of entities) {
      const vals = insertable.map(c => entity[c.propertyKey]);
      params.push(...vals);
      rows.push(`(${vals.map(() => "?").join(", ")})`);
    }
    const sql = `INSERT INTO \`${metadata.tableName}\` (${names.join(", ")}) VALUES ${rows.join(", ")}`;
    return { sql, params };
  }

  buildUpdateById(metadata: EntityMetadata, entity: Record<string, any>): { sql: string; params: any[] } {
    const updatable = [...metadata.columns.values()].filter(c => c.updatable && !c.isPrimary && !c.isVersion);
    const setParts = updatable.map(c => `\`${c.columnName}\` = ?`);
    const params = updatable.map(c => entity[c.propertyKey]);

    for (const pk of metadata.primaryKeys) {
      params.push(entity[pk.propertyKey]);
    }
    const whereParts = metadata.primaryKeys.map(pk => `\`${pk.columnName}\` = ?`);

    let sql = `UPDATE \`${metadata.tableName}\` SET ${setParts.join(", ")}`;
    if (metadata.versionColumn) {
      const vc = metadata.versionColumn;
      sql += `, \`${vc.columnName}\` = \`${vc.columnName}\` + 1`;
      params.push(entity[vc.propertyKey]);
      sql += ` WHERE ${whereParts.join(" AND ")} AND \`${vc.columnName}\` = ?`;
    } else {
      sql += ` WHERE ${whereParts.join(" AND ")}`;
    }
    return { sql, params };
  }

  buildDeleteById(metadata: EntityMetadata, id: any): { sql: string; params: any[] } {
    const pkCol = metadata.primaryKeys[0].columnName;
    return { sql: `DELETE FROM \`${metadata.tableName}\` WHERE \`${pkCol}\` = ?`, params: [id] };
  }

  buildDeleteByCondition(metadata: EntityMetadata, whereSql: string, params: any[]): { sql: string; params: any[] } {
    const sql = `DELETE FROM \`${metadata.tableName}\`${whereSql ? ` WHERE ${whereSql}` : ""}`;
    return { sql, params };
  }

  buildSelectById(metadata: EntityMetadata, id: any): { sql: string; params: any[] } {
    const pkCol = metadata.primaryKeys[0].columnName;
    const cols = this.selectColumns(metadata);
    return { sql: `SELECT ${cols} FROM \`${metadata.tableName}\` WHERE \`${pkCol}\` = ?`, params: [id] };
  }

  buildSelectByIds(metadata: EntityMetadata, ids: any[]): { sql: string; params: any[] } {
    const pkCol = metadata.primaryKeys[0].columnName;
    const cols = this.selectColumns(metadata);
    const placeholders = ids.map(() => "?").join(", ");
    return { sql: `SELECT ${cols} FROM \`${metadata.tableName}\` WHERE \`${pkCol}\` IN (${placeholders})`, params: ids };
  }

  buildSelectList(metadata: EntityMetadata, selectColumns: string, whereSql: string, orderBy: string, limit: number, offset: number, params: any[]): { sql: string; params: any[] } {
    let sql = `SELECT ${selectColumns} FROM \`${metadata.tableName}\``;
    if (whereSql) sql += ` WHERE ${whereSql}`;
    if (orderBy) sql += ` ORDER BY ${orderBy}`;
    if (limit > 0) sql += ` LIMIT ${limit}`;
    if (offset > 0) sql += ` OFFSET ${offset}`;
    return { sql, params };
  }

  buildSelectCount(metadata: EntityMetadata, whereSql: string, params: any[]): { sql: string; params: any[] } {
    let sql = `SELECT COUNT(*) AS total FROM \`${metadata.tableName}\``;
    if (whereSql) sql += ` WHERE ${whereSql}`;
    return { sql, params };
  }

  buildSelectPage(metadata: EntityMetadata, selectColumns: string, whereSql: string, orderBy: string, page: PageInfo, params: any[]): { sql: string; params: any[] } {
    const offset = (page.page - 1) * page.size;
    let sql = `SELECT ${selectColumns} FROM \`${metadata.tableName}\``;
    if (whereSql) sql += ` WHERE ${whereSql}`;
    if (orderBy) sql += ` ORDER BY ${orderBy}`;
    sql += ` LIMIT ${page.size} OFFSET ${offset}`;
    return { sql, params };
  }

  buildUpdateByCondition(metadata: EntityMetadata, setPairs: string, setParams: any[], whereSql: string, whereParams: any[]): { sql: string; params: any[] } {
    let sql = `UPDATE \`${metadata.tableName}\` SET ${setPairs}`;
    if (metadata.versionColumn) {
      const vc = metadata.versionColumn;
      sql += `, \`${vc.columnName}\` = \`${vc.columnName}\` + 1`;
    }
    if (whereSql) sql += ` WHERE ${whereSql}`;
    return { sql, params: [...setParams, ...whereParams] };
  }

  getDDLGenerator(): DDLDialect {
    return new MySQLDDLDialect();
  }

  // ---------- Helpers ----------

  private selectColumns(metadata: EntityMetadata): string {
    return [...metadata.columns.values()]
      .map(c => `\`${c.columnName}\``)
      .join(", ");
  }
}
