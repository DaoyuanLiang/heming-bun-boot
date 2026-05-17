import "reflect-metadata";

export const TABLE_METADATA = Symbol("bun-db:table");

export interface TableOptions {
  schema?: string;
  comment?: string;
  engine?: string;
  charset?: string;
}

import { COLUMNS_METADATA, consumePendingColumns } from "./column";

/**
 * Marks a class as a database entity and maps it to a table.
 * Compatible with both Stage3 (Bun) and experimental (tsc) decorators.
 * @param name - Table name
 * @param options - Optional table configuration (schema, comment, engine, charset)
 */
export function Table(name: string, options?: TableOptions): ClassDecorator {
  return (target: any, context?: any) => {
    // Stage 3 (Bun): consume column metadata accumulated during field processing
    if (context?.kind === "class") {
      consumePendingColumns(COLUMNS_METADATA, target);
    }
    Reflect.defineMetadata(TABLE_METADATA, { name, ...options }, target);
  };
}
