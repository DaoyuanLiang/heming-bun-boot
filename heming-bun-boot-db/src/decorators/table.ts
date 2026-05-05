import "reflect-metadata";

export const TABLE_METADATA = Symbol("bun-db:table");

export interface TableOptions {
  schema?: string;
  comment?: string;
  engine?: string;
  charset?: string;
}

/**
 * Marks a class as a database entity and maps it to a table.
 * @param name - Table name
 * @param options - Optional table configuration (schema, comment, engine, charset)
 */
export function Table(name: string, options?: TableOptions): ClassDecorator {
  return (target: any) => {
    Reflect.defineMetadata(TABLE_METADATA, { name, ...options }, target);
  };
}
