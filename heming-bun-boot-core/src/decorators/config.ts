import { AUTO_REGISTRY } from "../di/registry";
import { createMetadataBridge } from "./metadata-bridge";

export const CONFIGURATION_MARKER = Symbol("bun-boot:configuration");
export const VALUE_METADATA = Symbol("bun-boot:value-metadata");

export interface ValueMetadata {
  key: string;
  defaultValue: any;
  propertyKey: string;
}

const valueBridge = createMetadataBridge<ValueMetadata>();

/**
 * Marks a class as a configuration holder.
 * Properties decorated with @Value are resolved from env vars.
 * Compatible with both Stage 3 (Bun) and experimental (tsc) decorators.
 */
export function Configuration(): ClassDecorator {
  return (target: any, context?: any) => {
    // Stage 3: consume @Value metadata accumulated during field processing
    if (context?.kind === "class") {
      valueBridge.consume(VALUE_METADATA, target);
    }
    Reflect.defineMetadata(CONFIGURATION_MARKER, true, target);
    AUTO_REGISTRY.configurations.add(target);
  };
}

/**
 * Binds a property to an environment variable with optional default.
 * The property type is inferred via design:type for automatic coercion.
 * Compatible with both Stage 3 (Bun) and experimental (tsc) decorators.
 * @param key - Environment variable name
 * @param defaultValue - Fallback value if env var is not set
 */
export function Value(key: string, defaultValue?: any): PropertyDecorator {
  return (target: any, propertyKey: any) => {
    // Stage 3 decorator (Bun): target is undefined for field decorators,
    // propertyKey is actually DecoratorContext with context.metadata
    if (propertyKey?.kind) {
      valueBridge.add({ key, defaultValue, propertyKey: propertyKey.name as string });
      return;
    }

    // Legacy experimental decorator (tsc)
    const ctor = target?.constructor;
    if (!ctor) return;
    const values: ValueMetadata[] =
      Reflect.getMetadata(VALUE_METADATA, ctor) || [];
    values.push({ key, defaultValue, propertyKey: propertyKey as string });
    Reflect.defineMetadata(VALUE_METADATA, values, ctor);
  };
}
