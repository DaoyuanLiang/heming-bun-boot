import type { EntityMetadata } from "../core/entity-metadata";
import type { Connection } from "../core/connection";
import type { DatabaseDialect, DDLDialect, ColumnInfo } from "../dialect/dialect";
import { DDLAuto } from "../config/db-config";

export class DDLGenerator {
  constructor(
    private readonly connection: Connection,
    private readonly dialect: DatabaseDialect,
  ) {}

  async run(entities: EntityMetadata[], strategy: DDLAuto): Promise<void> {
    if (strategy === DDLAuto.NONE) return;

    const ddl = this.dialect.getDDLGenerator();

    switch (strategy) {
      case DDLAuto.CREATE:
        await this.doCreate(entities, ddl);
        break;
      case DDLAuto.CREATE_DROP:
        await this.doCreate(entities, ddl);
        break;
      case DDLAuto.UPDATE:
        await this.doUpdate(entities, ddl);
        break;
      case DDLAuto.VALIDATE:
        await this.doValidate(entities, ddl);
        break;
    }
  }

  async dropAll(entities: EntityMetadata[]): Promise<void> {
    const ddl = this.dialect.getDDLGenerator();
    for (const meta of entities) {
      const sql = ddl.buildDropTable(meta.tableName, true);
      await this.connection.execute(sql);
    }
  }

  private async doCreate(entities: EntityMetadata[], ddl: DDLDialect): Promise<void> {
    for (const meta of entities) {
      const sql = ddl.buildCreateTable(meta);
      await this.connection.execute(sql);
    }
  }

  private async doUpdate(entities: EntityMetadata[], ddl: DDLDialect): Promise<void> {
    for (const meta of entities) {
      const tableExists = await this.tableExists(meta.tableName);
      if (!tableExists) {
        const sql = ddl.buildCreateTable(meta);
        await this.connection.execute(sql);
        continue;
      }
      const existing = await this.getExistingColumns(meta.tableName);
      const alterStatements = ddl.buildAlterTable(meta, existing);
      for (const stmt of alterStatements) {
        await this.connection.execute(stmt);
      }
    }
  }

  private async doValidate(entities: EntityMetadata[], ddl: DDLDialect): Promise<void> {
    for (const meta of entities) {
      const tableExists = await this.tableExists(meta.tableName);
      if (!tableExists) {
        throw new Error(`[bun-db] Validation failed: table "${meta.tableName}" does not exist`);
      }
      const existing = await this.getExistingColumns(meta.tableName);
      for (const col of meta.columns.values()) {
        const dbCol = existing.get(col.columnName);
        if (!dbCol) {
          throw new Error(`[bun-db] Validation failed: column "${meta.tableName}.${col.columnName}" is missing`);
        }
      }
    }
  }

  private async tableExists(tableName: string): Promise<boolean> {
    const rows = await this.connection.query<any>(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`,
      [tableName],
    );
    return rows.length > 0;
  }

  private async getExistingColumns(tableName: string): Promise<Map<string, ColumnInfo>> {
    const rows = await this.connection.query<any>(
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
}
