import type { Middleware, Context } from "@heming/bun-boot";
import { Result } from "./result";
import { HttpException } from "./exceptions";

/**
 * Creates a middleware that catches any unhandled exception,
 * converts HttpException to Result.fail, and unknown errors to 500.
 */
export function createExceptionFilter(logger?: {
  error(message: string, meta?: any): void;
}): Middleware {
  return async (ctx: Context, next: () => Promise<Response>) => {
    try {
      return await next();
    } catch (err: any) {
      const traceId = (ctx as any)._traceId as string | undefined;

      if (err instanceof HttpException) {
        return ctx.json(
          new Result(err.code, err.message, null, traceId)
        );
      }

      // Unknown error — log and return 500
      if (logger) {
        logger.error("Unhandled exception", { error: err.message, stack: err.stack, traceId });
      } else {
        console.error("[bun-boot-ext] Unhandled exception:", err);
      }

      return ctx.json(
        new Result(500, "Internal Server Error", null, traceId)
      );
    }
  };
}
