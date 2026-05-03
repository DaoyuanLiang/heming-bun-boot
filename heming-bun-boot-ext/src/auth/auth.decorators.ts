import type { AuthGuard } from "./auth.guard";

export const AUTH_GUARD = Symbol("bun-boot-ext:auth-guard");
export const PUBLIC_ROUTE = Symbol("bun-boot-ext:public-route");
export const CURRENT_USER_INDEX = Symbol("bun-boot-ext:current-user-index");

/**
 * Apply an AuthGuard to a controller. All routes require authentication
 * unless explicitly marked @Public().
 */
export function UseGuard(guard: new (...args: any[]) => AuthGuard): ClassDecorator {
  return (target: any) => {
    Reflect.defineMetadata(AUTH_GUARD, guard, target);
  };
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
 * Inject the current user (JWT payload) into a handler parameter.
 * The value is resolved from `ctx.user` before the handler is called.
 *
 * @example
 * @Get("/me")
 * getProfile(@CurrentUser() user: JwtPayload) { ... }
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
