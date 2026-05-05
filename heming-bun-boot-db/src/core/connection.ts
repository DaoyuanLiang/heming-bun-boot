import type { DBConfig } from "../config/db-config";

export interface ExecuteResult {
  affectedRows: number;
  insertId: number | bigint;
  changedRows: number;
}

export interface Connection {
  execute(sql: string, params?: any[]): Promise<ExecuteResult>;
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T = any>(sql: string, params?: any[]): Promise<T | null>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  isTransactional(): boolean;
  close(): Promise<void>;
  getNativeConnection(): any;
}
