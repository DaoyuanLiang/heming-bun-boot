import { readFileSync } from "fs";
import { resolve } from "path";
import { VALUE_METADATA, type ValueMetadata } from "../decorators/config";
import { DIContainer } from "../di/container";

/**
 * Resolves @Value-decorated properties from environment variables,
 * applying defaults and type coercion.
 */
export class ConfigLoader {
  constructor(private container: DIContainer) {}

  /**
   * Load a .env file and merge its values into process.env.
   * Values already set in process.env take precedence (no override).
   * Call this before load() to enable file-based config.
   *
   * @param filePath - Path to .env file, defaults to ".env" in cwd
   */
  static loadEnvFile(filePath?: string): void {
    const envPath = resolve(process.cwd(), filePath ?? ".env");

    let content: string;
    try {
      content = readFileSync(envPath, "utf-8");
    } catch {
      return; // .env file is optional, silently skip
    }

    for (const rawLine of content.split("\n")) {
      const line = rawLine.trim();
      if (line === "" || line.startsWith("#")) continue;

      const eqIdx = line.indexOf("=");
      if (eqIdx === -1) continue;

      const key = line.slice(0, eqIdx).trim();
      let value = line.slice(eqIdx + 1).trim();

      // Strip surrounding quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      // Don't override env vars that are already set
      if (key && !(key in process.env)) {
        process.env[key] = value;
      }
    }
  }

  load(configClasses: Function[]): void {
    for (const cls of configClasses) {
      const instance = this.container.resolve(cls);
      const metadata: ValueMetadata[] =
        Reflect.getMetadata(VALUE_METADATA, cls) || [];

      for (const { key, defaultValue, propertyKey } of metadata) {
        const envValue = process.env[key];
        const designType = Reflect.getMetadata(
          "design:type",
          cls.prototype,
          propertyKey
        );
        (instance as any)[propertyKey] = this.coerce(
          envValue,
          defaultValue,
          designType
        );
      }
    }
  }

  private coerce(
    raw: string | undefined,
    defaultVal: any,
    type: Function
  ): any {
    if (raw === undefined) {
      // When design:type is unavailable (Bun Stage 3 drops emitDecoratorMetadata),
      // infer type from the default value.
      const inferredType = type ?? (defaultVal != null ? defaultVal.constructor : String);
      return this.coerce(String(defaultVal), undefined, inferredType);
    }

    const t = type ?? (defaultVal != null ? defaultVal.constructor : undefined);
    switch (t) {
      case Number:
        return Number(raw);
      case Boolean:
        return raw === "true" || raw === "1";
      case String:
        return raw;
      default:
        return Number(raw) || raw;
    }
  }
}
