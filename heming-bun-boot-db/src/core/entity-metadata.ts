import { TABLE_METADATA, type TableOptions } from "../decorators/table";
import {
  COLUMNS_METADATA,
  GenerationType,
  EnumType,
  type ColumnOptions,
  type StoredColumn,
} from "../decorators/column";

export interface ColumnMetadata {
  propertyKey: string;
  columnName: string;
  databaseType: string;
  tsType: Function;
  options: ColumnOptions;

  isPrimary: boolean;
  isGenerated: boolean;
  generationType: GenerationType;
  isVersion: boolean;
  isCreatedDate: boolean;
  isUpdatedDate: boolean;
  isTransient: boolean;
  enumType?: EnumType;

  nullable: boolean;
  unique: boolean;
  defaultValue?: any;
  comment?: string;
  insertable: boolean;
  updatable: boolean;
}

export interface EntityMetadata {
  target: Function;
  tableName: string;
  schema?: string;
  comment?: string;
  engine?: string;
  charset?: string;
  columns: Map<string, ColumnMetadata>;
  primaryKeys: ColumnMetadata[];
  generatedColumn?: ColumnMetadata;
  versionColumn?: ColumnMetadata;
  createdAtColumn?: ColumnMetadata;
  updatedAtColumn?: ColumnMetadata;
}

function camelToSnake(name: string): string {
  return name.replace(/[A-Z]/g, (m, i) => (i > 0 ? "_" : "") + m.toLowerCase());
}

const DEFAULT_TYPE_MAP = new Map<string, string>([
  ["string", "VARCHAR(255)"],
  ["number", "BIGINT"],
  ["boolean", "TINYINT(1)"],
  ["bigint", "BIGINT"],
  ["date", "DATETIME(3)"],
  ["object", "JSON"],
]);

function resolveDatabaseType(stored: StoredColumn, tsType: Function): string {
  // 1. Explicit type in @Column options always wins
  if (stored.options?.type) return stored.options.type;

  // 2. Infer from specialized decorators (Bun Stage 3 has no design:type)
  if (stored.isCreatedDate || stored.isUpdatedDate) return DEFAULT_TYPE_MAP.get("date")!;
  if (stored.isPrimary && stored.generationType) return DEFAULT_TYPE_MAP.get("number")!;
  if (stored.isVersion) return DEFAULT_TYPE_MAP.get("number")!;

  // 3. design:type metadata (available with tsc emitDecoratorMetadata)
  if (tsType === String) {
    const length = stored.options?.length ?? 255;
    return length > 65535 ? "TEXT" : `VARCHAR(${length})`;
  }
  if (tsType === Number) return DEFAULT_TYPE_MAP.get("number")!;
  if (tsType === Boolean) {
    const length = stored.options?.length ?? 1;
    return `TINYINT(${length})`;
  }
  if (tsType === BigInt) return DEFAULT_TYPE_MAP.get("bigint")!;
  if (tsType === Date) return DEFAULT_TYPE_MAP.get("date")!;
  if (tsType === Buffer) return "BLOB";

  // 4. Fallback: when design:type is unavailable (Bun Stage 3), default to VARCHAR.
  //    Use @Column({ type: "json" }) explicitly for JSON columns.
  return "VARCHAR(255)";
}

export class EntityMetadataStorage {
  private static metadataMap = new Map<Function, EntityMetadata>();

  static register(target: Function): EntityMetadata {
    const existing = this.metadataMap.get(target);
    if (existing) return existing;

    const tableMeta: { name: string } & TableOptions =
      Reflect.getMetadata(TABLE_METADATA, target);
    if (!tableMeta) {
      throw new Error(`Class "${target.name}" is not decorated with @Table`);
    }

    const storedColumns: StoredColumn[] =
      Reflect.getMetadata(COLUMNS_METADATA, target) || [];

    const columns = new Map<string, ColumnMetadata>();
    const primaryKeys: ColumnMetadata[] = [];
    let generatedColumn: ColumnMetadata | undefined;
    let versionColumn: ColumnMetadata | undefined;
    let createdAtColumn: ColumnMetadata | undefined;
    let updatedAtColumn: ColumnMetadata | undefined;

    for (const stored of storedColumns) {
      if (stored.isTransient) continue;

      const tsType = Reflect.getMetadata("design:type", target.prototype, stored.propertyKey) || Object;
      const colName = stored.options?.name ?? camelToSnake(stored.propertyKey);
      const databaseType = resolveDatabaseType(stored, tsType);
      const nullable = stored.options?.nullable ?? true;
      const unique = stored.options?.unique ?? false;
      const insertable = stored.options?.insertable ?? true;
      const updatable = stored.options?.updatable ?? true;

      const col: ColumnMetadata = {
        propertyKey: stored.propertyKey,
        columnName: colName,
        databaseType,
        tsType,
        options: stored.options || {},
        isPrimary: stored.isPrimary,
        isGenerated: !!stored.generationType,
        generationType: stored.generationType ?? GenerationType.AUTO,
        isVersion: stored.isVersion,
        isCreatedDate: stored.isCreatedDate,
        isUpdatedDate: stored.isUpdatedDate,
        isTransient: false,
        enumType: stored.enumType,
        nullable,
        unique,
        defaultValue: stored.options?.default,
        comment: stored.options?.comment,
        insertable,
        updatable,
      };

      columns.set(stored.propertyKey, col);

      if (col.isPrimary) {
        primaryKeys.push(col);
        if (col.isGenerated) {
          generatedColumn = col;
        }
      }
      if (col.isVersion) versionColumn = col;
      if (col.isCreatedDate) createdAtColumn = col;
      if (col.isUpdatedDate) updatedAtColumn = col;
    }

    const metadata: EntityMetadata = {
      target,
      tableName: tableMeta.name,
      schema: tableMeta.schema,
      comment: tableMeta.comment,
      engine: tableMeta.engine,
      charset: tableMeta.charset,
      columns,
      primaryKeys,
      generatedColumn,
      versionColumn,
      createdAtColumn,
      updatedAtColumn,
    };

    this.metadataMap.set(target, metadata);
    return metadata;
  }

  static get(target: Function): EntityMetadata | undefined {
    return this.metadataMap.get(target);
  }

  static getOrRegister(target: Function): EntityMetadata {
    return this.metadataMap.get(target) ?? this.register(target);
  }

  static getAll(): EntityMetadata[] {
    return [...this.metadataMap.values()];
  }

  static has(target: Function): boolean {
    return this.metadataMap.has(target);
  }

  static requirePrimaryKey(metadata: EntityMetadata): ColumnMetadata {
    if (metadata.primaryKeys.length === 0) {
      throw new Error(
        `Entity "${metadata.target.name}" has no @Id column defined. ` +
        `Operations requiring a primary key (deleteById, updateById, selectById, selectBatchIds) are not supported on keyless entities.`,
      );
    }
    return metadata.primaryKeys[0];
  }

  static clear(): void {
    this.metadataMap.clear();
  }
}
