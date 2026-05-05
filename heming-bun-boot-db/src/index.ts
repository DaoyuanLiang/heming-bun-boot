// Starter
export { createDbHooks, CONNECTION_TOKEN, DIALECT_TOKEN } from "./db-application";
export type { DbStarterOptions } from "./db-application";

// Decorators
export { Table, TABLE_METADATA } from "./decorators/table";
export type { TableOptions } from "./decorators/table";
export {
  Column,
  Id,
  GeneratedValue,
  Version,
  CreatedDate,
  UpdatedDate,
  Transient,
  Enumerated,
  GenerationType,
  EnumType,
  COLUMNS_METADATA,
} from "./decorators/column";
export type { ColumnOptions } from "./decorators/column";

// Entity Metadata
export { EntityMetadataStorage } from "./core/entity-metadata";
export type { EntityMetadata, ColumnMetadata } from "./core/entity-metadata";

// Connection
export type { Connection, ExecuteResult } from "./core/connection";

// Config
export { DDLAuto, DEFAULT_DB_CONFIG } from "./config/db-config";
export type { DBConfig } from "./config/db-config";

// Dialect
export { MySQLDialect } from "./dialect/mysql-dialect";
export { PgDialect } from "./dialect/pg-dialect";
export type { DatabaseDialect, DDLDialect, ColumnInfo, PageInfo, PageResult } from "./dialect/dialect";

// Repository
export { BaseRepository } from "./repository/base-repository";
export { QueryWrapper } from "./repository/query-wrapper";

// DDL
export { DDLGenerator } from "./ddl/ddl-generator";

// GeoJSON types (PostGIS geometry columns return these)
export type {
  Position,
  GeoJsonCrs,
  Point,
  MultiPoint,
  LineString,
  MultiLineString,
  Polygon,
  MultiPolygon,
  GeometryCollection,
  Geometry,
} from "./types/geojson";
