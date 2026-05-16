import type { AuthGuard } from "./auth.guard";

export const AUTH_GUARD = Symbol("bun-boot-ext:auth-guard");
export const AUTH_GUARD_METHOD = Symbol("bun-boot-ext:auth-guard-method");
export const PUBLIC_ROUTE = Symbol("bun-boot-ext:public-route");
export const CURRENT_USER_INDEX = Symbol("bun-boot-ext:current-user-index");

export type AuthGuardConstructor = new (...args: any[]) => AuthGuard;

/**
 * Apply one or more AuthGuards to a controller class or method.
 * All routes require authentication unless explicitly marked @Public().
 *
 * Multiple guards run in order; any guard that throws or returns false
 * denies the request.
 *
 * @example
 * // Class-level: all routes need JwtAuthGuard
 * @UseGuard(JwtAuthGuard)
 * @Controller("/admin")
 * class AdminController {
 *
 *   // Method-level: this route additionally needs RoleGuard
 *   @UseGuard(RoleGuard)
 *   @Delete("/:id")
 *   async remove() { ... }
 *
 *   // Inherits class-level guards only
 *   @Get("/")
 *   async list() { ... }
 * }
 */
export function UseGuard(...guards: AuthGuardConstructor[]): ClassDecorator & MethodDecorator {
  const decorator = (target: any, propertyKey?: string | symbol) => {
    if (propertyKey !== undefined) {
      const existing: Record<string | symbol, AuthGuardConstructor[]> =
        Reflect.getMetadata(AUTH_GUARD_METHOD, target.constructor) || {};
      existing[propertyKey] = guards;
      Reflect.defineMetadata(AUTH_GUARD_METHOD, existing, target.constructor);
    } else {
      Reflect.defineMetadata(AUTH_GUARD, guards, target);
    }
  };
  return decorator as ClassDecorator & MethodDecorator;
}

/**
 * Mark a specific route as public (skip authentication).
 * Only meaningful when the controller has @UseGuard().
 */
export function Public(): MethodDecorator {
  return (target: Object, propertyKey: string | symbol) => {
    const routes: (string | symbol)[] =
      Reflect.getMetadata(PUBLIC_ROUTE, target.constructor) || [];
    routes.push(propertyKey);
    Reflect.defineMetadata(PUBLIC_ROUTE, routes, target.constructor);
  };
}

/**
 * Inject the current user (normalized UserPayload) into a handler parameter.
 * The value is resolved from `ctx.user` before the handler is called.
 *
 * @example
 * @Get("/me")
 * getProfile(@CurrentUser() user: UserPayload) { ... }
 */
export function CurrentUser(): ParameterDecorator {
  return (
    target: Object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ) => {
    const map: Map<string | symbol, number[]> =
      Reflect.getMetadata(CURRENT_USER_INDEX, target) || new Map();
    const indices = map.get(propertyKey!) || [];
    indices.push(parameterIndex);
    map.set(propertyKey!, indices);
    Reflect.defineMetadata(CURRENT_USER_INDEX, map, target);
  };
}
