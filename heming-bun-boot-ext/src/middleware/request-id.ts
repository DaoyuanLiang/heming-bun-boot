import type { Middleware, Context } from "@heming/bun-boot";

/**
 * Generates a traceId (UUID v4) for each request,
 * stores it on context, and returns it in the X-Trace-Id response header.
 */
export function createRequestIdMiddleware(): Middleware {
  return async (ctx: Context, next: () => Promise<Response>) => {
    const traceId = crypto.randomUUID();
    (ctx as any)._traceId = traceId;

    const response = await next();

    // Attach traceId to response header
    const headers = new Headers(response.headers);
    headers.set("X-Trace-Id", traceId);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
