import type { LoggerService } from "./logger.service";

let _logger: LoggerService | null = null;

/** Called by ExtApplication after LoggerService is created. */
export function setLoggerForDecorator(logger: LoggerService): void {
  _logger = logger;
}

export interface LogOptions {
  level?: "info" | "warn" | "error" | "debug";
  message?: string;
}

/**
 * Method decorator that auto-logs method invocations.
 *
 * @example
 * @Log()
 * getUser(id: string) { ... }
 *
 * @Log({ level: "debug", message: "Fetching user" })
 * getUser(id: string) { ... }
 */
export function Log(options: LogOptions = {}): MethodDecorator {
  const { level = "info", message } = options;

  return (
    _target: Object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) => {
    const original = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const logger = _logger;
      const label = message || String(propertyKey);

      if (logger) {
        logger[level](`→ ${label}`, { args });
      }

      const result = original.apply(this, args);

      if (result instanceof Promise) {
        return result.then((r) => {
          if (logger) logger[level](`← ${label}`, { result: r });
          return r;
        });
      }

      if (logger) logger[level](`← ${label}`, { result });
      return result;
    };
  };
}
