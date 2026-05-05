import {
  Application,
  RequestInjector,
  Context,
} from "heming-bun-boot";
import type { ApplicationHooks, Middleware } from "heming-bun-boot";

import { LoggerService } from "./logging/logger.service";
import { setLoggerForDecorator } from "./logging/logger.decorator";
import { createLoggerMiddleware } from "./logging/logger.middleware";
import { JwtService } from "./auth/jwt.service";
import { createAuthMiddleware, JwtAuthGuard } from "./auth/auth.guard";
import { CURRENT_USER_INDEX } from "./auth/auth.decorators";
import { createRequestIdMiddleware } from "./middleware/request-id";
import { createExceptionFilter } from "./result/exception.filter";
import { Result } from "./result/result";
import type { ApplicationOptions } from "heming-bun-boot";

// Re-export for convenience
export type ExtApplicationOptions = ApplicationOptions;

/**
 * Extended application bootstrap.
 * Delegates to core Application.run() with framework hooks.
 *
 * Provides: logging, JWT auth, unified Result responses, exception handling.
 *
 * @param options - Application options
 * @param externalHooks - Optional hooks from other modules (e.g. DB starter).
 *   External builtinProviders are registered before ext's own.
 */
export class ExtApplication {
  static async run(options: ApplicationOptions, externalHooks?: ApplicationHooks): Promise<void> {
    let logger: LoggerService;

    const hooks: ApplicationHooks = {
      builtinProviders: [
        ...(externalHooks?.builtinProviders ?? []),
        LoggerService,
        JwtService,
        JwtAuthGuard,
      ],

      onInit: ({ container }) => {
        externalHooks?.onInit?.({ container });
        logger = container.resolve(LoggerService);
        setLoggerForDecorator(logger);
      },

      routeHandlerFactory: (container) => {
        const externalHandler = externalHooks?.routeHandlerFactory?.(container);

        return async (ctx: Context): Promise<Response> => {
          const match = ctx.route!;
          const injector = new RequestInjector(container);
          const controller = injector.resolve(match.controllerClass) as Record<string, any>;
          const handler = controller[match.handlerName];

          // @CurrentUser() parameter injection
          const proto = match.controllerClass.prototype;
          const userIndexMap: Map<string | symbol, number[]> =
            Reflect.getMetadata(CURRENT_USER_INDEX, proto) || new Map();
          const userIndices = userIndexMap.get(match.handlerName) || [];

          const args: any[] = [ctx];
          if (userIndices.length > 0) {
            const user = (ctx as any).user;
            for (const idx of userIndices) {
              args[idx] = user;
            }
          }

          const result = await handler.apply(controller, args);

          // If external handler wants to normalize (e.g. DB result wrapping), let it
          if (externalHandler) {
            return externalHandler(ctx);
          }

          // Default ext: Result wrapping
          if (result instanceof Response) return result;
          if (result instanceof Result) return ctx.json(result);
          if (result === null || result === undefined) {
            return ctx.json(Result.ok(null));
          }
          return ctx.json(Result.ok(result));
        };
      },

      builtinMiddlewares: (container): Middleware[] => [
        ...(externalHooks?.builtinMiddlewares?.(container) ?? []),
        createExceptionFilter(logger),
        createRequestIdMiddleware(),
        createLoggerMiddleware(logger),
        createAuthMiddleware((guardClass) => container.resolve(guardClass)),
      ],

      onNotFound: externalHooks?.onNotFound ?? ((request) => {
        const url = new URL(request.url);
        const ctx = new Context(request, {}, url.searchParams);
        (ctx as any)._traceId = crypto.randomUUID();
        logger.warn(`404 ${request.method} ${url.pathname}`, {
          traceId: (ctx as any)._traceId,
        });
        return ctx.json(
          new Result(404, `Cannot ${request.method} ${url.pathname}`, null)
        );
      }),

      onError: externalHooks?.onError ?? ((error, request) => {
        logger.error("Unhandled exception in fetch", {
          error: error.message,
          stack: error.stack,
        });
        const url = new URL(request.url);
        const ctx = new Context(request, {}, url.searchParams);
        return ctx.json(new Result(500, "Internal Server Error", null));
      }),
    };

    await Application.run(options, hooks);
  }
}
