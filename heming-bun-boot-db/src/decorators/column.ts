import "reflect-metadata";

export const COLUMNS_METADATA = Symbol("bun-db:columns");

export enum GenerationType {
  AUTO = "auto",
  IDENTITY = "identity",
  UUID = "uuid",
}

export enum EnumType {
  STRING = "string",
  ORDINAL = "ordinal",
}

export interface ColumnOptions {
  name?: string;
  type?: string;
  length?: number;
  precision?: number;
  scale?: number;
  nullable?: boolean;
  unique?: boolean;
  default?: any;
  comment?: string;
  insertable?: boolean;
  updatable?: boolean;
}

interface StoredColumn {
  propertyKey: string;
  options?: ColumnOptions;
  isPrimary: boolean;
  generationType?: GenerationType;
  isVersion: boolean;
  isCreatedDate: boolean;
  isUpdatedDate: boolean;
  isTransient: boolean;
  enumType?: EnumType;
}

function getOrCreateColumns(target: any): StoredColumn[] {
  const existing: StoredColumn[] = Reflect.getMetadata(COLUMNS_METADATA, target) || [];
  if (!Reflect.hasMetadata(COLUMNS_METADATA, target)) {
    Reflect.defineMetadata(COLUMNS_METADATA, existing, target);
  }
  return existing;
}

function findColumn(target: any, propertyKey: string): StoredColumn {
  const columns = getOrCreateColumns(target);
  let col = columns.find(c => c.propertyKey === propertyKey);
  if (!col) {
    col = {
      propertyKey,
      isPrimary: false,
      isVersion: false,
      isCreatedDate: false,
      isUpdatedDate: false,
      isTransient: false,
    };
    columns.push(col);
  }
  return col;
}

/**
 * Marks a property as a database column.
 */
export function Column(options?: ColumnOptions): PropertyDecorator {
  return (target: Object, propertyKey: string | symbol) => {
    const col = findColumn(target.constructor, propertyKey as string);
    col.options = options;
  };
}

/**
 * Marks a property as the primary key.
 * Can be applied to multiple properties for composite keys.
 */
export function Id(target: Object, propertyKey: string | symbol): void;
export function Id(): PropertyDecorator;
export function Id(target?: Object, propertyKey?: string | symbol): any {
  if (target && propertyKey) {
    const col = findColumn(target.constructor, propertyKey as string);
    col.isPrimary = true;
    return;
  }
  return (t: Object, pk: string | symbol) => {
    const col = findColumn(t.constructor, pk as string);
    col.isPrimary = true;
  };
}

/**
 * Specifies the generation strategy for a primary key value.
 * IDENTITY = database auto-increment, UUID = uuid v4, AUTO = auto-detect.
 */
export function GeneratedValue(strategy: GenerationType): PropertyDecorator {
  return (target: Object, propertyKey: string | symbol) => {
    const col = findColumn(target.constructor, propertyKey as string);
    col.generationType = strategy;
  };
}

function makePropertyDecorator(setter: (col: StoredColumn) => void) {
  return (target: Object, propertyKey: string | symbol) => {
    const col = findColumn(target.constructor, propertyKey as string);
    setter(col);
  };
}

/**
 * Marks a numeric property as the optimistic lock version.
 * Automatically incremented on update; stale updates are rejected.
 */
export function Version(target: Object, propertyKey: string | symbol): void;
export function Version(): PropertyDecorator;
export function Version(target?: Object, propertyKey?: string | symbol): any {
  if (target && propertyKey) {
    makePropertyDecorator(c => { c.isVersion = true; })(target, propertyKey);
    return;
  }
  return makePropertyDecorator(c => { c.isVersion = true; });
}

/**
 * Automatically sets the property to the current timestamp on insert.
 */
export function CreatedDate(target: Object, propertyKey: string | symbol): void;
export function CreatedDate(): PropertyDecorator;
export function CreatedDate(target?: Object, propertyKey?: string | symbol): any {
  if (target && propertyKey) {
    makePropertyDecorator(c => { c.isCreatedDate = true; })(target, propertyKey);
    return;
  }
  return makePropertyDecorator(c => { c.isCreatedDate = true; });
}

/**
 * Automatically sets the property to the current timestamp on insert and update.
 */
export function UpdatedDate(target: Object, propertyKey: string | symbol): void;
export function UpdatedDate(): PropertyDecorator;
export function UpdatedDate(target?: Object, propertyKey?: string | symbol): any {
  if (target && propertyKey) {
    makePropertyDecorator(c => { c.isUpdatedDate = true; })(target, propertyKey);
    return;
  }
  return makePropertyDecorator(c => { c.isUpdatedDate = true; });
}

/**
 * Excludes the property from persistence.
 */
export function Transient(target: Object, propertyKey: string | symbol): void;
export function Transient(): PropertyDecorator;
export function Transient(target?: Object, propertyKey?: string | symbol): any {
  if (target && propertyKey) {
    makePropertyDecorator(c => { c.isTransient = true; })(target, propertyKey);
    return;
  }
  return makePropertyDecorator(c => { c.isTransient = true; });
}

/**
 * Specifies how an enum value is stored.
 * STRING = enum value name, ORDINAL = enum index.
 */
export function Enumerated(type: EnumType): PropertyDecorator {
  return (target: Object, propertyKey: string | symbol) => {
    const col = findColumn(target.constructor, propertyKey as string);
    col.enumType = type;
  };
}

export type { StoredColumn };
