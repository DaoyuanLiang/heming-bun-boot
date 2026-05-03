import { readdirSync, statSync } from "fs";
import { join, extname, resolve } from "path";
import { CONTROLLER_PREFIX } from "../decorators/controller";
import { INJECTABLE_SCOPE } from "../decorators/inject";
import { CONFIGURATION_MARKER } from "../decorators/config";

export interface ScanResult {
  controllers: Function[];
  providers: Function[];
  configurations: Function[];
}

/**
 * Auto-discovers decorated classes from file system directories.
 * Class references pass through directly.
 */
export class ModuleScanner {
  static async scan(entries: {
    controllers?: (string | Function)[];
    providers?: (string | Function)[];
    configurations?: (string | Function)[];
  }): Promise<ScanResult> {
    const [controllers, providers, configurations] = await Promise.all([
      this.resolveEntries(entries.controllers || [], CONTROLLER_PREFIX),
      this.resolveEntries(entries.providers || [], INJECTABLE_SCOPE),
      this.resolveEntries(entries.configurations || [], CONFIGURATION_MARKER),
    ]);

    return { controllers, providers, configurations };
  }

  private static async resolveEntries(
    entries: (string | Function)[],
    metadataKey: symbol
  ): Promise<Function[]> {
    const result: Function[] = [];

    for (const entry of entries) {
      if (typeof entry === "function") {
        result.push(entry);
      } else {
        const scanned = await this.scanDirectory(entry, metadataKey);
        result.push(...scanned);
      }
    }

    return result;
  }

  private static async scanDirectory(
    dirPath: string,
    metadataKey: symbol
  ): Promise<Function[]> {
    const absolute = resolve(process.cwd(), dirPath);
    const classes: Function[] = [];

    const walk = (dir: string): void => {
      const entries = readdirSync(dir);

      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          if (!entry.startsWith(".") && entry !== "node_modules") {
            walk(fullPath);
          }
        } else if (extname(entry) === ".ts" || extname(entry) === ".tsx") {
          // Use Bun's native file import (converts path to file:// URL)
          const mod = require(fullPath);
          for (const exported of Object.values(mod)) {
            if (
              typeof exported === "function" &&
              Reflect.hasMetadata(metadataKey, exported)
            ) {
              classes.push(exported as Function);
            }
          }
        }
      }
    };

    walk(absolute);
    return classes;
  }
}
