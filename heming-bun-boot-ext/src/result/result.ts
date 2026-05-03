/**
 * Unified API response format.
 * All responses (success or error) follow this structure.
 */
export class Result<T = any> {
  /** Business status code. 0 = success, non-zero = error. */
  readonly code: number;
  /** Human-readable message. */
  readonly message: string;
  /** Response payload. Null on error. */
  readonly data: T | null;
  /** Unix timestamp in milliseconds. */
  readonly timestamp: number;
  /** Request trace ID (from RequestIdMiddleware). */
  readonly traceId?: string;

  constructor(
    code: number,
    message: string,
    data: T | null,
    traceId?: string
  ) {
    this.code = code;
    this.message = message;
    this.data = data;
    this.timestamp = Date.now();
    this.traceId = traceId;
  }

  /** Create a success result. code=0. */
  static ok<T = any>(data: T, message: string = "success"): Result<T> {
    return new Result<T>(0, message, data);
  }

  /** Create a failure result. */
  static fail(message: string, code: number = -1): Result<null> {
    return new Result<null>(code, message, null);
  }
}
