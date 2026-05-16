import { AUTO_REGISTRY } from "../di/registry";

export const CONFIGURATION_MARKER = Symbol("bun-boot:configuration");
export const VALUE_METADATA = Symbol("bun-boot:value-metadata");

export interface ValueMetadata {
  key: string;
  defaultValue: any;
  propertyKey: string;
}

/**
 * Marks a class as a configuration holder.
 * Properties decorated with @Value are resolved from env vars.
 */
export function Configuration(): ClassDecorator {
  return (target: any) => {
    Reflect.defineMetadata(CONFIGURATION_MARKER, true, target);
    AUTO_REGISTRY.configurations.add(target);
  };
}

/**
 * Binds a property to an environment variable with optional default.
 * The property type is inferred via design:type for automatic coercion.
 * @param key - Environment variable name
 * @param defaultValue - Fallback value if env var is not set
 */
export function Value(key: string, defaultValue?: any): PropertyDecorator {
  return (target: Object, propertyKey: string | symbol) => {
    const values: ValueMetadata[] =
      Reflect.getMetadata(VALUE_METADATA, target.constructor) || [];
    values.push({ key, defaultValue, propertyKey: propertyKey as string });
    Reflect.defineMetadata(VALUE_METADATA, values, target.constructor);
  };
}
