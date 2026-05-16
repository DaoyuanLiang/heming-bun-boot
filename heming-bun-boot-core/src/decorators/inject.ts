export const INJECTABLE_SCOPE = Symbol("bun-boot:injectable-scope");
export const INJECT_PARAMS = Symbol("bun-boot:inject-params");

export type ScopeType = "singleton" | "request" | "transient";

/**
 * Marks a class as injectable by the DI container.
 * @param scope - "singleton" (default), "request", or "transient"
 */
export function Injectable(scope: ScopeType = "singleton"): ClassDecorator {
  return (target: any) => {
    Reflect.defineMetadata(INJECTABLE_SCOPE, scope, target);
  };
}

/**
 * Specifies an injection token for a constructor parameter.
 * When omitted, the framework falls back to the TypeScript design:paramtypes metadata.
 * @param token - Optional string token for interface-based injection
 */
export function Inject(token?: string): ParameterDecorator {
  return (
    target: Object,
    _propertyKey: string | symbol | undefined,
    parameterIndex: number
  ) => {
    const params: (string | undefined)[] =
      Reflect.getMetadata(INJECT_PARAMS, target) || [];
    params[parameterIndex] = token;
    Reflect.defineMetadata(INJECT_PARAMS, params, target);
  };
}
