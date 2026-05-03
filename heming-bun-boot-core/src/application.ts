import "reflect-metadata";
import { resolve } from "path";
import { DIContainer } from "./di/container";
import { RequestInjector } from "./di/injector";
import { Router } from "./router/router";
import { ConfigLoader } from "./config/config-loader";
import { Context } from "./context";
import { compose, type Middleware } from "./middleware";
import { serveStatic, type StaticOptions } from "./static";
import { INJECTABLE_SCOPE } from "./decorators/inject";
import type { ScopeType } from "./decorators/inject";

export interface ApplicationOptions {
  controllers?: Function[];
  providers?: Function[];
  configurations?: Function[];
  middlewares?: Middleware[];
  /** Serve static files from a directory. Route matching takes priority. */
  static?: StaticOptions;
  port?: number;
  hostname?: string;
}

/**
 * Extension hooks for library authors (e.g. @heming/bun-boot-ext).
 * End users should use ApplicationOptions, not these.
 */
export interface ApplicationHooks {
  /** Additional framework-level providers registered before user classes. */
  builtinProviders?: Function[];
  /** Called after container is built and config is loaded. Wire framework services here. */
  onInit?: (ctx: { container: DIContainer }) => void;
  /** Override the route handler (controller invocation + result normalization). */
  routeHandlerFactory?: (container: DIContainer) => (ctx: Context) => Promise<Response>;
  /** Framework-level middlewares composed before user middlewares. */
  builtinMiddlewares?: (container: DIContainer) => Middleware[];
  /** Custom 404 response. Default: pre-allocated "Not Found". */
  onNotFound?: (request: Request) => Response | Promise<Response>;
  /** Custom unhandled error response. Default: console.error + 500. */
  onError?: (error: any, request: Request) => Response | Promise<Response>;
}

const NOT_FOUND = new Response("Not Found", { status: 404 });
const SERVER_ERROR = new Response("Internal Server Error", { status: 500 });

/**
 * Framework entry point. Orchestrates DI, config, routing, and Bun.serve().
 *
 * @example
 * // Core usage
 * Application.run({
 *   controllers: [UserController],
 *   providers: [UserService],
 *   configurations: [AppConfig],
 * });
 *
 * @example
 * // With custom middleware
 * Application.run({
 *   controllers: [UserController],
 *   providers: [UserService],
 *   middlewares: [timingMiddleware, corsMiddleware],
 *   static: { assets: "public", prefix: "/" },
 * });
 */
export class Application {
  static async run(options: ApplicationOptions, hooks?: ApplicationHooks): Promise<void> {
    const controllers = options.controllers || [];
    const providers = options.providers || [];
    const configurations = options.configurations || [];
    const userMiddlewares = options.middlewares || [];

    // 0. Load .env file
    ConfigLoader.loadEnvFile();

    // 1. Build DI container
    const container = new DIContainer();

    const registerClass = (cls: Function) => {
      const scope: ScopeType =
        Reflect.getMetadata(INJECTABLE_SCOPE, cls) || "singleton";
      container.registerClass(cls, cls, scope);
    };

    // Register built-in framework providers (ext hooks into this)
    if (hooks?.builtinProviders) {
      for (const cls of hooks.builtinProviders) {
        registerClass(cls);
      }
    }

    // Register user classes
    for (const cls of [...providers, ...controllers, ...configurations]) {
      registerClass(cls);
    }

    // 2. Load configuration
    if (configurations.length > 0) {
      const configLoader = new ConfigLoader(container);
      configLoader.load(configurations);
    }

    // 3. Init hook — ext wires framework services here
    hooks?.onInit?.({ container });

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

    // 6. Build route handler (core uses simple handler, ext overrides via hook)
    const routeHandler = hooks?.routeHandlerFactory?.(container) ??
      (async (ctx: Context): Promise<Response> => {
        const match = ctx.route!;
        const injector = new RequestInjector(container);
        const controller = injector.resolve(match.controllerClass);
        const result = await (controller as any)[match.handlerName](ctx);

        if (result instanceof Response) return result;
        if (result === null || result === undefined) {
          return new Response(null, { status: 204 });
        }
        return ctx.json(result);
      });

    // 7. Build middleware chain
    const frameworkMiddlewares = hooks?.builtinMiddlewares?.(container) ?? [];
    const allMiddlewares = [...frameworkMiddlewares, ...userMiddlewares];
    const composedHandler = allMiddlewares.length > 0
      ? compose(allMiddlewares, routeHandler)
      : null;

    // 8. Static file serving
    const staticOpts = options.static;
    const assetsDir = staticOpts
      ? resolve(process.cwd(), staticOpts.assets)
      : null;

    // 9. Build fetch handler
    const notFoundFn = hooks?.onNotFound ?? (() => NOT_FOUND);
    const errorFn = hooks?.onError ?? ((err: any, _req: Request) => {
      console.error("[bun-boot]", err);
      return SERVER_ERROR;
    });

    // 10. Start server
    Bun.serve({
      port,
      hostname,
      fetch: async (request: Request) => {
        const url = new URL(request.url);

        // Route matching takes priority
        const match = router.match(request.method, url.pathname);

        if (match) {
          const ctx = new Context(request, match.params, url.searchParams, match);
          try {
            if (composedHandler) {
              return await composedHandler(ctx);
            }
            return await routeHandler(ctx);
          } catch (err: any) {
            return errorFn(err, request);
          }
        }

        // Fallback: serve static file if configured
        if (staticOpts && assetsDir) {
          const fileResponse = await serveStatic(url.pathname, staticOpts, assetsDir);
          if (fileResponse) return fileResponse;
        }

        return notFoundFn(request);
      },
    });

    console.log(`[bun-boot] Server running at http://localhost:${port}`);
  }
}
