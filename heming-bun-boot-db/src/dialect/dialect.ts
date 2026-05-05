import type { EntityMetadata, ColumnMetadata } from "../core/entity-metadata";
import type { Connection, ExecuteResult } from "../core/connection";
import type { DBConfig } from "../config/db-config";

export interface DDLDialect {
  buildCreateTable(metadata: EntityMetadata): string;
  buildDropTable(tableName: string, ifExists?: boolean): string;
  buildAlterTable(metadata: EntityMetadata, existingColumns: Map<string, ColumnInfo>): string[];

  /** Check whether a table exists in the current database/schema. */
  tableExists(connection: Connection, tableName: string): Promise<boolean>;
  /** Retrieve column metadata for an existing table. */
  getExistingColumns(connection: Connection, tableName: string): Promise<Map<string, ColumnInfo>>;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  key: string;
  default: string | null;
  extra: string;
}

export interface PageInfo {
  page: number;
  size: number;
}

export interface PageResult<T> {
  records: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface DatabaseDialect {
  createConnection(config: DBConfig): Connection;

  mapColumnType(column: ColumnMetadata): string;

  escapeIdentifier(name: string): string;

  buildInsert(metadata: EntityMetadata, entity: Record<string, any>): { sql: string; params: any[] };
  buildBatchInsert(metadata: EntityMetadata, entities: Record<string, any>[]): { sql: string; params: any[] };
  buildUpdateById(metadata: EntityMetadata, entity: Record<string, any>): { sql: string; params: any[] };
  buildDeleteById(metadata: EntityMetadata, id: any): { sql: string; params: any[] };
  buildDeleteByCondition(metadata: EntityMetadata, whereSql: string, params: any[]): { sql: string; params: any[] };
  buildSelectById(metadata: EntityMetadata, id: any): { sql: string; params: any[] };
  buildSelectByIds(metadata: EntityMetadata, ids: any[]): { sql: string; params: any[] };
  buildSelectList(metadata: EntityMetadata, selectColumns: string, whereSql: string, orderBy: string, limit: number, offset: number, params: any[]): { sql: string; params: any[] };
  buildSelectCount(metadata: EntityMetadata, whereSql: string, params: any[]): { sql: string; params: any[] };
  buildSelectPage(metadata: EntityMetadata, selectColumns: string, whereSql: string, orderBy: string, page: PageInfo, params: any[]): { sql: string; params: any[] };
  buildUpdateByCondition(metadata: EntityMetadata, setPairs: string, setParams: any[], whereSql: string, whereParams: any[]): { sql: string; params: any[] };

  getDDLGenerator(): DDLDialect;
}
