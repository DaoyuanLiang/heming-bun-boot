import type { ApplicationHooks } from "heming-bun-boot";

import { MySQLDialect } from "./dialect/mysql-dialect";
import type { DatabaseDialect } from "./dialect/dialect";
import type { Connection } from "./core/connection";
import { EntityMetadataStorage } from "./core/entity-metadata";
import { DDLGenerator } from "./ddl/ddl-generator";
import { DDLAuto, DEFAULT_DB_CONFIG, type DBConfig } from "./config/db-config";

export const CONNECTION_TOKEN = "bun-db:connection";
export const DIALECT_TOKEN = "bun-db:dialect";

export interface DbStarterOptions {
  /** Entity classes decorated with @Table. Scanned on startup for DDL generation. */
  entities?: Function[];
  /** Database configuration. Falls back to env vars (DB_*). */
  db?: Partial<DBConfig>;
  /** Custom dialect. Defaults to MySQLDialect. */
  dialect?: DatabaseDialect;
}

function resolveDBConfig(userConfig?: Partial<DBConfig>): DBConfig {
  const fromEnv: Partial<DBConfig> = {};
  if (process.env.DB_TYPE) fromEnv.type = process.env.DB_TYPE;
  if (process.env.DB_HOST) fromEnv.host = process.env.DB_HOST;
  if (process.env.DB_PORT) fromEnv.port = parseInt(process.env.DB_PORT, 10);
  if (process.env.DB_USERNAME) fromEnv.username = process.env.DB_USERNAME;
  if (process.env.DB_PASSWORD) fromEnv.password = process.env.DB_PASSWORD;
  if (process.env.DB_DATABASE) fromEnv.database = process.env.DB_DATABASE;
  if (process.env.DB_POOL_SIZE) fromEnv.poolSize = parseInt(process.env.DB_POOL_SIZE, 10);
  if (process.env.DB_DDL_AUTO) fromEnv.ddlAuto = process.env.DB_DDL_AUTO as DDLAuto;
  if (process.env.DB_CHARSET) fromEnv.charset = process.env.DB_CHARSET;
  if (process.env.DB_TIMEZONE) fromEnv.timezone = process.env.DB_TIMEZONE;

  return { ...DEFAULT_DB_CONFIG, ...fromEnv, ...userConfig } as DBConfig;
}

/**
 * Creates ApplicationHooks that add database support to any heming-bun-boot application.
 *
 * Works with both core Application and ExtApplication:
 *
 * @example
 * // Core only
 * Application.run(appOptions, createDbHooks({ entities: [User] }));
 *
 * @example
 * // With ext (logging + JWT + DB)
 * ExtApplication.run(appOptions, createDbHooks({ entities: [User] }));
 */
export function createDbHooks(options: DbStarterOptions = {}): ApplicationHooks {
  const dialect = options.dialect ?? new MySQLDialect();
  const entityClasses = options.entities || [];
  let connection: Connection;

  return {
    builtinProviders: [],
    // @ts-ignore
    onInit: ({ container }) => {
      const config = resolveDBConfig(options.db);
      connection = dialect.createConnection(config);
      container.registerValue(DIALECT_TOKEN, dialect);
      container.registerValue(CONNECTION_TOKEN, connection);

      for (const cls of entityClasses) {
        EntityMetadataStorage.getOrRegister(cls);
      }

      const entities = EntityMetadataStorage.getAll();
      if (entities.length > 0 && config.ddlAuto !== DDLAuto.NONE) {
        const ddlGen = new DDLGenerator(connection, dialect);
        ddlGen.run(entities, config.ddlAuto).catch((err) => {
          console.error("[bun-db] DDL generation failed:", err);
        });
      }
    },
  };
}
