import "reflect-metadata";
import { DIContainer } from "./di/container";
import { RequestInjector } from "./di/injector";
import { Router } from "./router/router";
import { ConfigLoader } from "./config/config-loader";
import { Context } from "./context";
import { compose, type Middleware } from "./middleware";
import { CONFIGURATION_MARKER } from "./decorators/config";
import { CONTROLLER_PREFIX } from "./decorators/controller";
import { INJECTABLE_SCOPE } from "./decorators/inject";
import type { ScopeType } from "./decorators/inject";

export interface ApplicationOptions {
  controllers?: Function[];
  providers?: Function[];
  configurations?: Function[];
  middlewares?: Middleware[];
  port?: number;
  hostname?: string;
}

const NOT_FOUND = new Response("Not Found", { status: 404 });
const SERVER_ERROR = new Response("Internal Server Error", { status: 500 });

/**
 * Framework entry point. Orchestrates DI, config, routing, and Bun.serve().
 *
 * @example
 * Application.run({
 *   controllers: [UserController],
 *   providers: [UserService],
 *   configurations: [AppConfig],
 * });
 */
export class Application {
  static async run(options: ApplicationOptions): Promise<void> {
    const controllers = options.controllers || [];
    const providers = options.providers || [];
    const configurations = options.configurations || [];

    // 0. Load .env file (before everything, so env vars are available)
    ConfigLoader.loadEnvFile();

    // 1. Build DI container
    const container = new DIContainer();

    // Auto-detect scope from @Injectable metadata, default to singleton
    const registerClass = (cls: Function) => {
      const scope: ScopeType =
        Reflect.getMetadata(INJECTABLE_SCOPE, cls) || "singleton";
      container.registerClass(cls, cls, scope);
    };

    for (const cls of [...providers, ...controllers, ...configurations]) {
      registerClass(cls);
    }

    // 2. Load configuration
    if (configurations.length > 0) {
      const configLoader = new ConfigLoader(container);
      configLoader.load(configurations);
    }

    // 3. Build router
    const router = new Router();
    for (const ControllerClass of controllers) {
      router.registerController(ControllerClass);
    }
    router.build();

    // 4. Resolve port from options first, then from config (if available)
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

    const middlewares = options.middlewares || [];

    // 5. Build the core handler (controller invocation + result normalization)
    const routeHandler = async (ctx: Context): Promise<Response> => {
      const match = ctx.route!;
      const injector = new RequestInjector(container);
      const controller = injector.resolve(match.controllerClass);
      const result = await (controller as any)[match.handlerName](ctx);

      if (result instanceof Response) {
        return result;
      }
      if (result === null || result === undefined) {
        return new Response(null, { status: 204 });
      }
      return ctx.json(result);
    };

    // 6. Build the composed handler (middleware chain + route handler)
    const composedHandler = middlewares.length > 0
      ? compose(middlewares, routeHandler)
      : null;

    // 7. Start server
    Bun.serve({
      port,
      hostname,
      fetch: async (request: Request) => {
        const url = new URL(request.url);
        const match = router.match(request.method, url.pathname);

        if (!match) {
          return NOT_FOUND;
        }

        const ctx = new Context(request, match.params, url.searchParams, match);

        try {
          if (composedHandler) {
            return await composedHandler(ctx);
          }
          return await routeHandler(ctx);
        } catch (err) {
          console.error("[bun-boot]", err);
          return SERVER_ERROR;
        }
      },
    });

    console.log(`[bun-boot] Server running at http://localhost:${port}`);
  }
}
