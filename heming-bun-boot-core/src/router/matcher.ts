export interface MatchResult {
  controllerClass: Function;
  handlerName: string;
  params: Record<string, string>;
}

export interface ParsedRoute {
  segments: string[];
  paramIndices: number[];
  paramNames: string[];
  controllerClass: Function;
  handlerName: string;
}

/**
 * Two-tier route matcher: static Map for O(1) lookup,
 * segment-based comparison for parameterized routes (no regex).
 */
export class RouteMatcher {
  private staticRoutes = new Map<string, { controllerClass: Function; handlerName: string }>();
  private paramRoutes = new Map<string, ParsedRoute[]>();

  addStaticRoute(method: string, fullPath: string, controllerClass: Function, handlerName: string): void {
    const key = `${method}:${fullPath}`;
    if (this.staticRoutes.has(key)) {
      throw new Error(`Duplicate route: ${method} ${fullPath}`);
    }
    this.staticRoutes.set(key, { controllerClass, handlerName });
  }

  addParamRoute(method: string, fullPath: string, controllerClass: Function, handlerName: string): void {
    const segments = fullPath.split("/").filter(Boolean);
    const paramIndices: number[] = [];
    const paramNames: string[] = [];

    for (let i = 0; i < segments.length; i++) {
      if (segments[i].startsWith(":")) {
        paramIndices.push(i);
        paramNames.push(segments[i].slice(1));
      }
    }

    if (!this.paramRoutes.has(method)) {
      this.paramRoutes.set(method, []);
    }

    this.paramRoutes.get(method)!.push({
      segments,
      paramIndices,
      paramNames,
      controllerClass,
      handlerName,
    });
  }

  match(method: string, pathname: string): MatchResult | null {
    // Normalize: strip trailing slash (but keep root "/")
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }

    // Try static match first (O(1))
    const staticKey = `${method}:${pathname}`;
    const staticEntry = this.staticRoutes.get(staticKey);
    if (staticEntry) {
      return {
        controllerClass: staticEntry.controllerClass,
        handlerName: staticEntry.handlerName,
        params: {},
      };
    }

    // Try parameterized match
    const candidates = this.paramRoutes.get(method);
    if (!candidates || candidates.length === 0) {
      return null;
    }

    const segments = pathname === "/" ? [] : pathname.split("/").filter(Boolean);

    for (const route of candidates) {
      if (route.segments.length !== segments.length) {
        continue;
      }

      const params: Record<string, string> = {};
      let matched = true;

      for (let i = 0; i < segments.length; i++) {
        if (route.paramIndices.includes(i)) {
          params[route.segments[i].slice(1)] = segments[i];
        } else if (route.segments[i] !== segments[i]) {
          matched = false;
          break;
        }
      }

      if (matched) {
        return {
          controllerClass: route.controllerClass,
          handlerName: route.handlerName,
          params,
        };
      }
    }

    return null;
  }
}
