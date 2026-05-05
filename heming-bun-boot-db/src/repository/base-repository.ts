import { EntityMetadataStorage, type EntityMetadata } from "../core/entity-metadata";
import type { Connection, ExecuteResult } from "../core/connection";
import type { DatabaseDialect, PageInfo, PageResult } from "../dialect/dialect";
import { QueryWrapper } from "./query-wrapper";

export type Constructor<T> = new (...args: any[]) => T;

/**
 * Provides single-table CRUD and batch operations for an entity type.
 * Inspired by MyBatis-Plus BaseMapper API.
 */
export class BaseRepository<T extends object> {
  protected readonly metadata: EntityMetadata;

  constructor(
    protected readonly entityClass: Constructor<T>,
    protected readonly dialect: DatabaseDialect,
    protected readonly connection: Connection,
  ) {
    this.metadata = EntityMetadataStorage.getOrRegister(entityClass);
  }

  getMetadata(): EntityMetadata {
    return this.metadata;
  }

  queryBuilder(): QueryWrapper<T> {
    return new QueryWrapper<T>(this.dialect.escapeIdentifier.bind(this.dialect));
  }

  // ==================== INSERT ====================

  async insert(entity: T): Promise<number> {
    this.fillDates(entity, true);
    const { sql, params } = this.dialect.buildInsert(this.metadata, entity as Record<string, any>);
    const result = await this.connection.execute(sql, params);
    if (this.metadata.generatedColumn && this.metadata.generatedColumn.generationType === "identity" as any) {
      (entity as any)[this.metadata.generatedColumn.propertyKey] = result.insertId;
    }
    return result.affectedRows;
  }

  async insertBatch(entities: T[], batchSize = 100): Promise<number> {
    if (entities.length === 0) return 0;
    let total = 0;
    for (const e of entities) this.fillDates(e, true);
    for (let i = 0; i < entities.length; i += batchSize) {
      const batch = entities.slice(i, i + batchSize);
      const { sql, params } = this.dialect.buildBatchInsert(
        this.metadata,
        batch as Record<string, any>[],
      );
      const result = await this.connection.execute(sql, params);
      total += result.affectedRows;
    }
    return total;
  }

  // ==================== DELETE ====================

  async deleteById(id: any): Promise<number> {
    EntityMetadataStorage.requirePrimaryKey(this.metadata);
    const { sql, params } = this.dialect.buildDeleteById(this.metadata, id);
    const result = await this.connection.execute(sql, params);
    return result.affectedRows;
  }

  async deleteBatchIds(ids: any[]): Promise<number> {
    if (ids.length === 0) return 0;
    if (ids.length === 1) return this.deleteById(ids[0]);

    const pkCol = EntityMetadataStorage.requirePrimaryKey(this.metadata).columnName;
    const qb = new QueryWrapper<T>(this.dialect.escapeIdentifier.bind(this.dialect));
    qb.in(pkCol as keyof T & string, ids);
    const { sql: whereSql, params } = qb.buildWhere();
    const { sql, params: allParams } = this.dialect.buildDeleteByCondition(this.metadata, whereSql, params);
    const result = await this.connection.execute(sql, allParams);
    return result.affectedRows;
  }

  async delete(query: QueryWrapper<T>): Promise<number> {
    const { sql: whereSql, params } = query.buildWhere();
    const { sql, params: allParams } = this.dialect.buildDeleteByCondition(this.metadata, whereSql, params);
    const result = await this.connection.execute(sql, allParams);
    return result.affectedRows;
  }

  // ==================== UPDATE ====================

  async updateById(entity: T): Promise<number> {
    EntityMetadataStorage.requirePrimaryKey(this.metadata);
    this.fillDates(entity, false);
    if (this.metadata.versionColumn) {
      const vc = this.metadata.versionColumn;
      const oldVersion = (entity as any)[vc.propertyKey];
      const { sql, params } = this.dialect.buildUpdateById(this.metadata, entity as Record<string, any>);
      const result = await this.connection.execute(sql, params);
      if (result.affectedRows === 0) {
        throw new Error(`Optimistic lock failed for ${this.metadata.target.name} id=${this.getIdValue(entity)}`);
      }
      (entity as any)[vc.propertyKey] = oldVersion + 1;
      return result.affectedRows;
    }
    const { sql, params } = this.dialect.buildUpdateById(this.metadata, entity as Record<string, any>);
    const result = await this.connection.execute(sql, params);
    return result.affectedRows;
  }

  async updateBatchById(entities: T[]): Promise<number> {
    let total = 0;
    for (const entity of entities) {
      total += await this.updateById(entity);
    }
    return total;
  }

  async update(entity: Partial<T>, query: QueryWrapper<T>): Promise<number> {
    const { sql: whereSql, params: whereParams } = query.buildWhere();
    const setPairs: string[] = [];
    const setParams: any[] = [];
    for (const [key, value] of Object.entries(entity)) {
      const col = this.metadata.columns.get(key);
      if (col && col.updatable && !col.isPrimary) {
        setPairs.push(`${this.dialect.escapeIdentifier(col.columnName)} = ?`);
        setParams.push(value);
      }
    }
    if (setPairs.length === 0) return 0;
    const { sql, params } = this.dialect.buildUpdateByCondition(
      this.metadata, setPairs.join(", "), setParams, whereSql, whereParams,
    );
    const result = await this.connection.execute(sql, params);
    return result.affectedRows;
  }

  // ==================== SELECT ====================

  async selectById(id: any): Promise<T | null> {
    EntityMetadataStorage.requirePrimaryKey(this.metadata);
    const { sql, params } = this.dialect.buildSelectById(this.metadata, id);
    const row = await this.connection.queryOne<Record<string, any>>(sql, params);
    return row ? this.mapRow(row) : null;
  }

  async selectBatchIds(ids: any[]): Promise<T[]> {
    if (ids.length === 0) return [];
    if (ids.length === 1) {
      const r = await this.selectById(ids[0]);
      return r ? [r] : [];
    }
    EntityMetadataStorage.requirePrimaryKey(this.metadata);
    const { sql, params } = this.dialect.buildSelectByIds(this.metadata, ids);
    const rows = await this.connection.query<Record<string, any>>(sql, params);
    return rows.map(r => this.mapRow(r));
  }

  async selectOne(query: QueryWrapper<T>): Promise<T | null> {
    query.limit(1);
    return this.selectList(query).then(r => r[0] ?? null);
  }

  async selectList(query: QueryWrapper<T>): Promise<T[]> {
    const { sql: whereSql, params: whereParams } = query.buildWhere();
    const allParams = [...whereParams];

    // Handle groupBy/having
    const groupBy = query.getGroupBy();
    if (groupBy) {
      const having = query.getHaving();
      const table = this.dialect.escapeIdentifier(this.metadata.tableName);
      let sql = `SELECT ${query.buildSelectColumns("*")} FROM ${table}`;
      if (whereSql) { sql += ` WHERE ${whereSql}`; }
      sql += ` GROUP BY ${groupBy}`;
      if (having.sql) { sql += ` HAVING ${having.sql}`; allParams.push(...having.params); }
      const rows = await this.connection.query<Record<string, any>>(sql, allParams);
      return rows.map(r => this.mapRow(r));
    }

    const selectCols = query.buildSelectColumns(
      [...this.metadata.columns.values()].map(c => this.dialect.escapeIdentifier(c.columnName)).join(", "),
    );
    const orderBy = query.buildOrderBy();
    const { sql, params } = this.dialect.buildSelectList(
      this.metadata, selectCols, whereSql, orderBy,
      query.getLimit(), query.getOffset(), whereParams,
    );
    const rows = await this.connection.query<Record<string, any>>(sql, params);
    return rows.map(r => this.mapRow(r));
  }

  async selectCount(query: QueryWrapper<T>): Promise<number> {
    const { sql: whereSql, params } = query.buildWhere();
    const { sql, params: allParams } = this.dialect.buildSelectCount(this.metadata, whereSql, params);
    const rows = await this.connection.query<{ total: number }>(sql, allParams);
    return Number(rows[0]?.total ?? 0);
  }

  async selectPage(page: PageInfo, query: QueryWrapper<T>): Promise<PageResult<T>> {
    const { sql: whereSql, params: whereParams } = query.buildWhere();
    const orderBy = query.buildOrderBy();
    const selectCols = query.buildSelectColumns(
      [...this.metadata.columns.values()].map(c => this.dialect.escapeIdentifier(c.columnName)).join(", "),
    );

    const [countResult, recordsResult] = await Promise.all([
      this.dialect.buildSelectCount(this.metadata, whereSql, whereParams),
      this.dialect.buildSelectPage(this.metadata, selectCols, whereSql, orderBy, page, whereParams),
    ]);

    const [countRows, dataRows] = await Promise.all([
      this.connection.query<{ total: number }>(countResult.sql, countResult.params),
      this.connection.query<Record<string, any>>(recordsResult.sql, recordsResult.params),
    ]);

    const total = Number(countRows[0]?.total ?? 0);
    return {
      records: dataRows.map(r => this.mapRow(r)),
      total,
      page: page.page,
      size: page.size,
      pages: Math.ceil(total / page.size),
    };
  }

  async exists(query: QueryWrapper<T>): Promise<boolean> {
    const count = await this.selectCount(query);
    return count > 0;
  }

  // ==================== NATIVE SQL ====================

  /**
   * Execute a raw SQL query and return all rows.
   * Use `?` placeholders for parameters (converted to `$N` on PostgreSQL).
   */
  async queryRaw<T = any>(sql: string, params?: any[]): Promise<T[]> {
    return this.connection.query<T>(sql, params);
  }

  /**
   * Execute a raw SQL query and return the first row, or `null`.
   */
  async queryRawOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    return this.connection.queryOne<T>(sql, params);
  }

  /**
   * Execute a raw DML statement (INSERT / UPDATE / DELETE).
   * Returns affected rows, insertId, etc.
   */
  async executeRaw(sql: string, params?: any[]): Promise<ExecuteResult> {
    return this.connection.execute(sql, params);
  }

  /**
   * Get the underlying database connection for full native access
   * (transactions, native driver methods, etc.).
   */
  getConnection(): Connection {
    return this.connection;
  }

  // ==================== HELPERS ====================

  private fillDates(entity: T, isInsert: boolean): void {
    const now = new Date();
    const record = entity as Record<string, any>;
    if (isInsert && this.metadata.createdAtColumn) {
      record[this.metadata.createdAtColumn.propertyKey] = now;
    }
    if (this.metadata.updatedAtColumn) {
      record[this.metadata.updatedAtColumn.propertyKey] = now;
    }
  }

  private getIdValue(entity: T): any {
    const pk = EntityMetadataStorage.requirePrimaryKey(this.metadata);
    return (entity as any)[pk.propertyKey];
  }

  private mapRow(row: Record<string, any>): T {
    const entity = new (this.entityClass as any)() as Record<string, any>;
    for (const col of this.metadata.columns.values()) {
      if (row[col.columnName] !== undefined) {
        entity[col.propertyKey] = row[col.columnName];
      }
    }
    return entity as T;
  }
}
