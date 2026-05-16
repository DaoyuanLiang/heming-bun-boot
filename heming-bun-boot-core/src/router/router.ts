import { RouteMatcher, type MatchResult } from "./matcher";
import { CONTROLLER_PREFIX, CONTROLLER_ROUTES } from "../decorators/controller";
import type { RouteDefinition } from "../decorators/http";

/**
 * Aggregates route definitions from scanned controllers and builds
 * the two-tier route matcher (static Map + param-based).
 */
export class Router {
  private matcher = new RouteMatcher();
  private built = false;

  /**
   * Register routes from a controller class.
   */
  registerController(ControllerClass: Function): void {
    const prefix: string = Reflect.getMetadata(CONTROLLER_PREFIX, ControllerClass) || "";
    const routes: RouteDefinition[] = Reflect.getMetadata(CONTROLLER_ROUTES, ControllerClass) || [];

    for (const route of routes) {
      const fullPath = this.normalizePath(prefix, route.path);

      if (fullPath.includes(":")) {
        this.matcher.addParamRoute(route.method, fullPath, ControllerClass, route.handlerName);
      } else {
        this.matcher.addStaticRoute(route.method, fullPath, ControllerClass, route.handlerName);
      }
    }
  }

  /**
   * Finalize the route table. Must be called before match().
   */
  build(): void {
    this.built = true;
  }

  /**
   * Match a request against the route table.
   */
  match(method: string, pathname: string): MatchResult | null {
    if (!this.built) {
      throw new Error("Router.build() must be called before match()");
    }
    return this.matcher.match(method, pathname);
  }

  private normalizePath(prefix: string, path: string): string {
    let result = prefix + path;

    // Ensure leading slash
    if (!result.startsWith("/")) {
      result = "/" + result;
    }

    // Normalize double slashes
    result = result.replace(/\/+/g, "/");

    // Root path
    if (result === "") {
      result = "/";
    }

    // Match matcher.ts: strip trailing slash, but keep root "/"
    if (result.length > 1 && result.endsWith("/")) {
      result = result.slice(0, -1);
    }

    return result;
  }
}
