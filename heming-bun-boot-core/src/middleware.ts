import type { Context } from "./context";

/**
 * A middleware function receives the context and a `next` function
 * that calls the next middleware (or the final handler).
 *
 * Return a Response to short-circuit the chain (e.g. auth guard returns 401).
 * Call `await next()` to pass control to the next middleware.
 *
 * @example
 * const logger: Middleware = async (ctx, next) => {
 *   console.log(`-> ${ctx.request.method} ${ctx.request.url}`);
 *   const res = await next();
 *   console.log(`<- ${res.status}`);
 *   return res;
 * };
 */
export type Middleware = (
  ctx: Context,
  next: () => Promise<Response>
) => Promise<Response> | Response;

/**
 * Compose an array of middleware into a single function.
 * Middleware runs in array order: m[0] wraps m[1] wraps ... wraps handler.
 */
export function compose(
  middlewares: Middleware[],
  handler: (ctx: Context) => Promise<Response>
): (ctx: Context) => Promise<Response> {
  return (ctx: Context) => {
    let index = -1;

    const dispatch = (i: number): Promise<Response> => {
      if (i <= index) {
        return Promise.reject(new Error("next() called multiple times"));
      }
      index = i;

      if (i >= middlewares.length) {
        return Promise.resolve(handler(ctx));
      }

      const middleware = middlewares[i];
      return Promise.resolve(middleware(ctx, () => dispatch(i + 1)));
    };

    return dispatch(0);
  };
}
