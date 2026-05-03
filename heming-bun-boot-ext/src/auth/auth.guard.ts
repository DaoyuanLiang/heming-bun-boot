import { Injectable } from "heming-bun-boot";
import type { Context } from "heming-bun-boot";
import { JwtService } from "./jwt.service";
import type { JwtPayload } from "./jwt.service";
import { AUTH_GUARD, PUBLIC_ROUTE } from "./auth.decorators";
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
  guardResolver: (guardClass: new (...args: any[]) => AuthGuard) => AuthGuard
): import("heming-bun-boot").Middleware {
  return async (ctx: Context, next: () => Promise<Response>) => {
    const match = ctx.route;
    if (!match) return next();

    const guardClass: new (...args: any[]) => AuthGuard | undefined =
      Reflect.getMetadata(AUTH_GUARD, match.controllerClass);
    if (!guardClass) return next();

    // Check if this specific route is marked @Public
    const publicRoutes: (string | symbol)[] =
      Reflect.getMetadata(PUBLIC_ROUTE, match.controllerClass) || [];
    if (publicRoutes.includes(match.handlerName)) {
      return next();
    }

    // Run the guard
    const guard = guardResolver(guardClass);
    const allowed = await guard.canActivate(ctx);
    if (!allowed) {
      throw new UnauthorizedException();
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

    // Attach user to context for @CurrentUser() and downstream use
    (ctx as any).user = payload;

    return true;
  }
}
