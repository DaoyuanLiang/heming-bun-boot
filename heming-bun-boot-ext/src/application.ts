import "reflect-metadata";
import {
  DIContainer,
  RequestInjector,
  Router,
  ConfigLoader,
  Context,
  compose,
  INJECTABLE_SCOPE,
} from "@heming/bun-boot";
import type { Middleware, ApplicationOptions } from "@heming/bun-boot";

import { LoggerService } from "./logging/logger.service";
import { setLoggerForDecorator } from "./logging/logger.decorator";
import { createLoggerMiddleware } from "./logging/logger.middleware";
import { JwtService } from "./auth/jwt.service";
import { createAuthMiddleware } from "./auth/auth.guard";
import { CURRENT_USER_INDEX } from "./auth/auth.decorators";
import { createRequestIdMiddleware } from "./middleware/request-id";
import { createExceptionFilter } from "./result/exception.filter";
import { Result } from "./result/result";

export interface ExtApplicationOptions extends ApplicationOptions {
  /** Additional user middlewares appended after the built-in chain. */
  middlewares?: Middleware[];
}

/**
 * Extended application bootstrap.
 * Provides logging, JWT auth, unified Result responses, and exception handling.
 */
export class ExtApplication {
  static async run(options: ExtApplicationOptions): Promise<void> {
    const controllers = options.controllers || [];
    const providers = options.providers || [];
    const configurations = options.configurations || [];
    const userMiddlewares = options.middlewares || [];

    // 0. Load .env file
    ConfigLoader.loadEnvFile();

    // 1. Build DI container
    const container = new DIContainer();

    const registerClass = (cls: Function) => {
      const scope: "singleton" | "request" =
        Reflect.getMetadata(INJECTABLE_SCOPE, cls) || "singleton";
      container.registerClass(cls, cls, scope);
    };

    // Register framework services
    registerClass(LoggerService);
    registerClass(JwtService);

    // Register user classes
    for (const cls of [...providers, ...controllers, ...configurations]) {
      registerClass(cls);
    }

    // 2. Resolve framework services (trigger instantiation)
    const logger = container.resolve<LoggerService>(LoggerService);
    setLoggerForDecorator(logger);

    const jwtService = container.resolve<JwtService>(JwtService);

    // 3. Load configuration
    if (configurations.length > 0) {
      const configLoader = new ConfigLoader(container);
      configLoader.load(configurations);
    }

    // 4. Build router
    const router = new Router();
    for (const ControllerClass of controllers) {
      router.registerController(ControllerClass);
    }
    router.build();

    // 5. Resolve port
    let port = options.port;
    if (port === undefined) {
      for (const configCls of configurations) {
        if (container.has(configCls)) {
          const config = container.resolve(configCls);
          if (typeof (config as any).port === "number") {
            port = (config as any).port;
            break;
          }
        }
      }
    }
    port = port ?? 3000;
    const hostname = options.hostname ?? "0.0.0.0";

    // 6. Build route handler (controller invocation + Result wrapping + @CurrentUser injection)
    const routeHandler = async (ctx: Context): Promise<Response> => {
      const match = ctx.route!;
      const injector = new RequestInjector(container);
      const controller = injector.resolve(match.controllerClass) as Record<string, any>;
      const handler = controller[match.handlerName];

      // Handle @CurrentUser() parameter injection
      const proto = match.controllerClass.prototype;
      const userIndexMap: Map<string | symbol, number[]> =
        Reflect.getMetadata(CURRENT_USER_INDEX, proto) || new Map();
      const userIndices = userIndexMap.get(match.handlerName) || [];

      // Build args: ctx is always first, inject user at marked positions
      const args: any[] = [ctx];
      if (userIndices.length > 0) {
        const user = (ctx as any).user;
        for (const idx of userIndices) {
          args[idx] = user;
        }
      }

      const result = await handler.apply(controller, args);

      // Result wrapping
      if (result instanceof Response) {
        return result;
      }
      if (result instanceof Result) {
        return ctx.json(result);
      }
      if (result === null || result === undefined) {
        return ctx.json(Result.ok(null));
      }
      return ctx.json(Result.ok(result));
    };

    // 7. Build middleware chain
    const builtinMiddlewares: Middleware[] = [
      createExceptionFilter(logger),
      createRequestIdMiddleware(),
      createLoggerMiddleware(logger),
      createAuthMiddleware((guardClass) => container.resolve(guardClass)),
      ...userMiddlewares,
    ];

    const composedHandler = compose(builtinMiddlewares, routeHandler);

    // 8. Start server
    Bun.serve({
      port,
      hostname,
      fetch: async (request: Request) => {
        const url = new URL(request.url);
        const match = router.match(request.method, url.pathname);

        if (!match) {
          const ctx = new Context(request, {}, url.searchParams);
          (ctx as any)._traceId = crypto.randomUUID();
          logger.warn(`404 ${request.method} ${url.pathname}`, {
            traceId: (ctx as any)._traceId,
          });
          return ctx.json(
            new Result(404, `Cannot ${request.method} ${url.pathname}`, null)
          );
        }

        const ctx = new Context(request, match.params, url.searchParams, match);

        try {
          return await composedHandler(ctx);
        } catch (err: any) {
          logger.error("Unhandled exception in fetch", {
            error: err.message,
            stack: err.stack,
          });
          return ctx.json(new Result(500, "Internal Server Error", null));
        }
      },
    });

    logger.info(`[bun-boot-ext] Server running at http://localhost:${port}`);
  }
}
