/**
 * Base HTTP exception. Throw these from controllers/services
 * and the GlobalExceptionFilter converts them to Result.fail().
 */
export class HttpException extends Error {
  public readonly status: number;
  public readonly code: number;

  constructor(message: string, status: number = 500, code: number = -1) {
    super(message);
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, HttpException.prototype);
  }
}

export class BadRequestException extends HttpException {
  constructor(message: string = "Bad Request", code: number = 400) {
    super(message, 400, code);
    Object.setPrototypeOf(this, BadRequestException.prototype);
  }
}

export class UnauthorizedException extends HttpException {
  constructor(message: string = "Unauthorized", code: number = 401) {
    super(message, 401, code);
    Object.setPrototypeOf(this, UnauthorizedException.prototype);
  }
}

export class ForbiddenException extends HttpException {
  constructor(message: string = "Forbidden", code: number = 403) {
    super(message, 403, code);
    Object.setPrototypeOf(this, ForbiddenException.prototype);
  }
}

export class NotFoundException extends HttpException {
  constructor(message: string = "Not Found", code: number = 404) {
    super(message, 404, code);
    Object.setPrototypeOf(this, NotFoundException.prototype);
  }
}

export class ConflictException extends HttpException {
  constructor(message: string = "Conflict", code: number = 409) {
    super(message, 409, code);
    Object.setPrototypeOf(this, ConflictException.prototype);
  }
}

export class InternalServerErrorException extends HttpException {
  constructor(message: string = "Internal Server Error", code: number = 500) {
    super(message, 500, code);
    Object.setPrototypeOf(this, InternalServerErrorException.prototype);
  }
}
