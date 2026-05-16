import { Injectable } from "heming-bun-boot";
import jwt from "jsonwebtoken";

export interface JwtPayload {
  sub: string;   // subject (user id)
  iat?: number;  // issued at
  exp?: number;  // expiration
  [key: string]: any;
}

/**
 * Business-friendly user payload for signing JWT tokens.
 * Use this instead of raw JwtPayload in application code.
 *
 * @example
 * jwtService.sign({ id: "123", role: "admin" });
 */
export interface UserPayload {
  id: string;
  email?: string;
  role?: string;
  [key: string]: any;
}

export interface JwtSignOptions {
  expiresIn?: string | number;
  algorithm?: jwt.Algorithm;
}

/**
 * Normalize a decoded JWT payload so that `id` always exists.
 * If the token was signed with `sub`, it becomes `id`; if `id` was used directly, it stays.
 */
export function normalizeUserPayload(payload: Record<string, any>): UserPayload {
  return {
    ...payload,
    id: payload.id || payload.sub,
  };
}

/**
 * JWT service for signing and verifying tokens.
 * Reads JWT_SECRET and JWT_EXPIRES_IN from environment.
 */
@Injectable()
export class JwtService {
  private get secret(): string {
    return process.env.JWT_SECRET || "change-me-in-production";
  }

  private get expiresIn(): string {
    return process.env.JWT_EXPIRES_IN || "24h";
  }

  /**
   * Sign a JWT token with the given user payload.
   * `id` is automatically mapped to the standard JWT `sub` claim.
   */
  sign(payload: UserPayload, options?: JwtSignOptions): string {
    const jwtPayload: Record<string, any> = {
      ...payload,
      sub: payload.id,
    };
    delete jwtPayload.id;

    return jwt.sign(jwtPayload as object, this.secret, {
      expiresIn: options?.expiresIn ?? this.expiresIn,
      algorithm: options?.algorithm ?? "HS256",
    });
  }

  /**
   * Verify a JWT token. Returns the decoded payload or null if invalid.
   */
  verify(token: string): JwtPayload | null {
    try {
      return jwt.verify(token, this.secret) as JwtPayload;
    } catch {
      return null;
    }
  }

  /**
   * Decode a JWT token without verifying signature.
   */
  decode(token: string): JwtPayload | null {
    const decoded = jwt.decode(token);
    return decoded ? (decoded as JwtPayload) : null;
  }
}
