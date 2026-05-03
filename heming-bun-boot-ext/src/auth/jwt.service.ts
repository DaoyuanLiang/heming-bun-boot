import { Injectable } from "heming-bun-boot";
import jwt from "jsonwebtoken";

export interface JwtPayload {
  sub: string;   // subject (user id)
  iat?: number;  // issued at
  exp?: number;  // expiration
  [key: string]: any;
}

export interface JwtSignOptions {
  expiresIn?: string | number;
  algorithm?: jwt.Algorithm;
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
   * Sign a JWT token with the given payload.
   */
  sign(payload: Omit<JwtPayload, "iat" | "exp">, options?: JwtSignOptions): string {
    // @ts-ignore
    return jwt.sign(payload as object, this.secret, {
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
