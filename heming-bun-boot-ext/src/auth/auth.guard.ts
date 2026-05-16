import { Injectable } from "heming-bun-boot";
import type { Context } from "heming-bun-boot";
import { JwtService, normalizeUserPayload } from "./jwt.service";
import type { JwtPayload, UserPayload } from "./jwt.service";
import { AUTH_GUARD, AUTH_GUARD_METHOD, PUBLIC_ROUTE, type AuthGuardConstructor } from "./auth.decorators";
import { UnauthorizedException } from "../result/exceptions";

/**
 * Guard interface. Return true to allow, false or throw to deny.
 */
export interface AuthGuard {
  canActivate(ctx: Context): boolean | Promise<boolean>;
}

/**
 * Middleware factory: creates an auth middleware that enforces
 * @UseGuard and @Public decorators on the matched controller/route.
 */
export function createAuthMiddleware(
  guardResolver: (guardClass: AuthGuardConstructor) => AuthGuard
): import("heming-bun-boot").Middleware {
  return async (ctx: Context, next: () => Promise<Response>) => {
    const match = ctx.route;
    if (!match) return next();

    const classGuards: AuthGuardConstructor[] | undefined =
      Reflect.getMetadata(AUTH_GUARD, match.controllerClass);
    if (!classGuards || classGuards.length === 0) return next();

    // Check if this specific route is marked @Public
    const publicRoutes: (string | symbol)[] =
      Reflect.getMetadata(PUBLIC_ROUTE, match.controllerClass) || [];
    if (publicRoutes.includes(match.handlerName)) {
      return next();
    }

    // Merge class-level and method-level guards
    const methodGuards: Record<string | symbol, AuthGuardConstructor[]> | undefined =
      Reflect.getMetadata(AUTH_GUARD_METHOD, match.controllerClass);
    const methodGuardList = methodGuards?.[match.handlerName];
    const allGuards = methodGuardList ? [...classGuards, ...methodGuardList] : classGuards;

    // Run all guards sequentially
    for (const guardClass of allGuards) {
      const guard = guardResolver(guardClass);
      const allowed = await guard.canActivate(ctx);
      if (!allowed) {
        throw new UnauthorizedException();
      }
    }

    return next();
  };
}

/**
 * JWT-based auth guard. Extracts Bearer token from Authorization header,
 * verifies it, and attaches the payload to ctx.
 */
@Injectable()
export class JwtAuthGuard implements AuthGuard {
  constructor(private jwtService: JwtService) {}

  canActivate(ctx: Context): boolean {
    const header = ctx.request.headers.get("authorization");
    if (!header) return false;

    const parts = header.split(" ");
    if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
      return false;
    }

    const token = parts[1];
    const payload = this.jwtService.verify(token);
    if (!payload) return false;

    // Attach normalized user to context for @CurrentUser() and downstream use
    (ctx as any).user = normalizeUserPayload(payload);

    return true;
  }
}
