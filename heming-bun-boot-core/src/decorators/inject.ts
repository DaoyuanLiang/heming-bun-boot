import { AUTO_REGISTRY } from "../di/registry";

export const INJECTABLE_SCOPE = Symbol("bun-boot:injectable-scope");
export const INJECT_PARAMS = Symbol("bun-boot:inject-params");
export const INJECT_DEPS = Symbol("bun-boot:inject-deps");

export type ScopeType = "singleton" | "request" | "transient";

export interface InjectableOptions {
  scope?: ScopeType;
  /** Explicit constructor dependency tokens (required for Bun Stage 3). */
  deps?: (string | Function)[];
}

/**
 * Marks a class as injectable by the DI container.
 *
 * Bun Stage 3 does not support parameter decorators, so
 * `@Inject()` on constructor params has no effect. Use `deps` instead:
 * @example
 *   @Injectable({ deps: [ProductRepository] })
 *   class ProductService { constructor(private repo: ProductRepository) {} }
 */
export function Injectable(scope?: ScopeType | InjectableOptions): ClassDecorator {
  let opts: InjectableOptions;
  if (typeof scope === "object" && scope !== null) {
    opts = scope;
  } else {
    opts = { scope: scope as ScopeType };
  }

  return (target: any) => {
    const s = opts.scope ?? "singleton";
    Reflect.defineMetadata(INJECTABLE_SCOPE, s, target);
    if (opts.deps) {
      Reflect.defineMetadata(INJECT_DEPS, opts.deps, target);
    }
    AUTO_REGISTRY.providers.add(target);
  };
}

/**
 * Specifies an injection token for a constructor parameter.
 * Required when using Bun's native Stage 3 decorators (which don't emit design:paramtypes).
 * Optional for tsc with emitDecoratorMetadata — design:paramtypes provides fallback.
 * @param token - The class or string token to inject. Pass the class itself for class-based DI.
 *
 * @example
 * constructor(@Inject(ProductService) private service: ProductService) {}
 */
export function Inject(token?: string | Function): ParameterDecorator {
  return (
    target: Object,
    _propertyKey: string | symbol | undefined,
    parameterIndex: number
  ) => {
    const params: (string | Function | undefined)[] =
      Reflect.getMetadata(INJECT_PARAMS, target) || [];
    params[parameterIndex] = token;
    Reflect.defineMetadata(INJECT_PARAMS, params, target);
  };
}
