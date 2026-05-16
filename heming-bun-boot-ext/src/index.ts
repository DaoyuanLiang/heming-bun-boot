// Application
export { ExtApplication } from "./application";
export type { ExtApplicationOptions } from "./application";

// Result & Exceptions
export { Result } from "./result/result";
export {
  HttpException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from "./result/exceptions";
export { createExceptionFilter } from "./result/exception.filter";

// Logging
export { LoggerService } from "./logging/logger.service";
export { Log, setLoggerForDecorator } from "./logging/logger.decorator";
export type { LogOptions } from "./logging/logger.decorator";
export { createLoggerMiddleware } from "./logging/logger.middleware";

// Middleware
export { createRequestIdMiddleware } from "./middleware/request-id";

// Auth
export { JwtService, normalizeUserPayload } from "./auth/jwt.service";
export type { JwtPayload, UserPayload, JwtSignOptions } from "./auth/jwt.service";
export { JwtAuthGuard, createAuthMiddleware } from "./auth/auth.guard";
export type { AuthGuard } from "./auth/auth.guard";
export {
  UseGuard,
  Public,
  CurrentUser,
  AUTH_GUARD,
  AUTH_GUARD_METHOD,
  PUBLIC_ROUTE,
  CURRENT_USER_INDEX,
} from "./auth/auth.decorators";
