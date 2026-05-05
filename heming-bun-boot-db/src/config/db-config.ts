export enum DDLAuto {
  NONE = "none",
  CREATE = "create",
  UPDATE = "update",
  VALIDATE = "validate",
  CREATE_DROP = "create-drop",
}

export interface DBConfig {
  type: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  poolSize: number;
  ddlAuto: DDLAuto;
  showSql?: boolean;
  charset?: string;
  timezone?: string;
}

export const DEFAULT_DB_CONFIG: Partial<DBConfig> = {
  type: "mysql",
  host: "localhost",
  port: 3306,
  username: "root",
  password: "",
  database: "test",
  poolSize: 10,
  ddlAuto: DDLAuto.NONE,
  showSql: false,
  charset: "utf8mb4",
  timezone: "+00:00",
};
