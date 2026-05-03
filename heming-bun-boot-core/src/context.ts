import type { MatchResult } from "./router/matcher";

/**
 * Request context passed to every route handler.
 * Wraps the native Bun Request with parsed params, query, and response helpers.
 */
export class Context {
  public readonly params: Record<string, string>;
  public readonly query: URLSearchParams;

  /** Route metadata set by the framework after matching. Available to middleware. */
  public readonly route?: MatchResult;

  private _status: number = 200;
  private _headers: Headers;

  constructor(
    public readonly request: Request,
    params: Record<string, string>,
    query: URLSearchParams,
    route?: MatchResult
  ) {
    this.params = params;
    this.query = query;
    this.route = route;
    this._headers = new Headers();
  }

  get status(): number {
    return this._status;
  }

  set status(code: number) {
    this._status = code;
  }

  setHeader(key: string, value: string): void {
    this._headers.set(key, value);
  }

  /** Convenience: return a JSON response with the current status. */
  json(data: any): Response {
    this._headers.set("Content-Type", "application/json");
    return new Response(JSON.stringify(data), {
      status: this._status,
      headers: this._headers,
    });
  }

  /** Convenience: return a text response with the current status. */
  text(data: string): Response {
    this._headers.set("Content-Type", "text/plain");
    return new Response(data, {
      status: this._status,
      headers: this._headers,
    });
  }
}
