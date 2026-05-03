import type { Middleware, Context } from "heming-bun-boot";
import type { LoggerService } from "./logger.service";

/**
 * Middleware that logs each request and its response status.
 */
export function createLoggerMiddleware(logger: LoggerService): Middleware {
  return async (ctx: Context, next: () => Promise<Response>) => {
    const start = Date.now();
    const traceId = (ctx as any)._traceId as string;
    const method = ctx.request.method;
    const url = ctx.request.url;

    logger.info(`${method} ${url}`, { traceId });

    const response = await next();

    const elapsed = Date.now() - start;
    logger.info(`${method} ${url} → ${response.status} (${elapsed}ms)`, {
      traceId,
      status: response.status,
      elapsed,
    });

    return response;
  };
}
