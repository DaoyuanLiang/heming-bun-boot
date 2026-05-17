import "reflect-metadata";
import { createMetadataBridge } from "heming-bun-boot";

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

export interface StoredColumn {
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

const columnBridge = createMetadataBridge<StoredColumn>();

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

/** @internal Consume pending columns (called by @Table class decorator). */
export function consumePendingColumns(symbol: symbol, target: Function): number {
  return columnBridge.consume(symbol, target);
}

/** @internal Stage 3 helper: get or create a StoredColumn from the bridge. */
function stage3Column(context: any): StoredColumn {
  return columnBridge.upsert(
    c => c.propertyKey === context.name,
    () => ({
      propertyKey: context.name as string,
      isPrimary: false,
      isVersion: false,
      isCreatedDate: false,
      isUpdatedDate: false,
      isTransient: false,
    }),
  );
}

/**
 * Marks a property as a database column.
 * Compatible with both Stage 3 (Bun) and experimental (tsc) decorators.
 */
export function Column(options?: ColumnOptions): PropertyDecorator {
  return (target: any, propertyKey: any) => {
    if (propertyKey?.kind) {
      stage3Column(propertyKey).options = options;
      return;
    }
    const col = findColumn(target.constructor, propertyKey as string);
    col.options = options;
  };
}

/**
 * Marks a property as the primary key.
 * Compatible with both Stage 3 (Bun) and experimental (tsc) decorators.
 */
export function Id(target: any, propertyKey: any): void;
export function Id(): PropertyDecorator;
export function Id(target?: any, propertyKey?: any): any {
  // Stage 3 (Bun): target is undefined for instance fields — check context first
  if (propertyKey?.kind) {
    stage3Column(propertyKey).isPrimary = true;
    return;
  }
  // Legacy experimental (tsc): target is the prototype
  if (target && propertyKey) {
    const col = findColumn(target.constructor, propertyKey as string);
    col.isPrimary = true;
    return;
  }
  return (t: any, pk: any) => {
    if (pk?.kind) {
      stage3Column(pk).isPrimary = true;
      return;
    }
    const col = findColumn(t.constructor, pk as string);
    col.isPrimary = true;
  };
}

/**
 * Specifies the generation strategy for a primary key value.
 * Compatible with both Stage 3 (Bun) and experimental (tsc) decorators.
 */
export function GeneratedValue(strategy: GenerationType): PropertyDecorator {
  return (target: any, propertyKey: any) => {
    if (propertyKey?.kind) {
      stage3Column(propertyKey).generationType = strategy;
      return;
    }
    const col = findColumn(target.constructor, propertyKey as string);
    col.generationType = strategy;
  };
}

/** @internal shared Stage 3 + legacy decorator application */
function applyColumnSetter(
  target: any,
  propertyKey: any,
  setter: (col: StoredColumn) => void,
): void {
  if (propertyKey?.kind) {
    setter(stage3Column(propertyKey));
  } else {
    const col = findColumn(target.constructor, propertyKey as string);
    setter(col);
  }
}

function makePropertyDecorator(setter: (col: StoredColumn) => void) {
  return (target: any, propertyKey: any) => {
    applyColumnSetter(target, propertyKey, setter);
  };
}

/**
 * Marks a numeric property as the optimistic lock version.
 * Compatible with both Stage 3 (Bun) and experimental (tsc) decorators.
 */
export function Version(target: any, propertyKey: any): void;
export function Version(): PropertyDecorator;
export function Version(target?: any, propertyKey?: any): any {
  // Stage 3 (Bun): target is undefined for instance fields — check context first
  if (propertyKey?.kind) {
    stage3Column(propertyKey).isVersion = true;
    return;
  }
  if (target && propertyKey) {
    const col = findColumn(target.constructor, propertyKey as string);
    col.isVersion = true;
    return;
  }
  return makePropertyDecorator(c => { c.isVersion = true; });
}

/**
 * Automatically sets the property to the current timestamp on insert.
 * Compatible with both Stage 3 (Bun) and experimental (tsc) decorators.
 */
export function CreatedDate(target: any, propertyKey: any): void;
export function CreatedDate(): PropertyDecorator;
export function CreatedDate(target?: any, propertyKey?: any): any {
  if (propertyKey?.kind) {
    stage3Column(propertyKey).isCreatedDate = true;
    return;
  }
  if (target && propertyKey) {
    const col = findColumn(target.constructor, propertyKey as string);
    col.isCreatedDate = true;
    return;
  }
  return makePropertyDecorator(c => { c.isCreatedDate = true; });
}

/**
 * Automatically sets the property to the current timestamp on insert and update.
 * Compatible with both Stage 3 (Bun) and experimental (tsc) decorators.
 */
export function UpdatedDate(target: any, propertyKey: any): void;
export function UpdatedDate(): PropertyDecorator;
export function UpdatedDate(target?: any, propertyKey?: any): any {
  if (propertyKey?.kind) {
    stage3Column(propertyKey).isUpdatedDate = true;
    return;
  }
  if (target && propertyKey) {
    const col = findColumn(target.constructor, propertyKey as string);
    col.isUpdatedDate = true;
    return;
  }
  return makePropertyDecorator(c => { c.isUpdatedDate = true; });
}

/**
 * Excludes the property from persistence.
 * Compatible with both Stage 3 (Bun) and experimental (tsc) decorators.
 */
export function Transient(target: any, propertyKey: any): void;
export function Transient(): PropertyDecorator;
export function Transient(target?: any, propertyKey?: any): any {
  if (propertyKey?.kind) {
    stage3Column(propertyKey).isTransient = true;
    return;
  }
  if (target && propertyKey) {
    const col = findColumn(target.constructor, propertyKey as string);
    col.isTransient = true;
    return;
  }
  return makePropertyDecorator(c => { c.isTransient = true; });
}

/**
 * Specifies how an enum value is stored.
 * Compatible with both Stage 3 (Bun) and experimental (tsc) decorators.
 */
export function Enumerated(type: EnumType): PropertyDecorator {
  return (target: any, propertyKey: any) => {
    if (propertyKey?.kind) {
      stage3Column(propertyKey).enumType = type;
      return;
    }
    const col = findColumn(target.constructor, propertyKey as string);
    col.enumType = type;
  };
}
