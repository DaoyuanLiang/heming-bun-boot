import { Scope } from "./scope";
import { INJECTABLE_SCOPE, INJECT_PARAMS, INJECT_DEPS, type ScopeType } from "../decorators/inject";

export interface ProviderDefinition {
  token: string | Function;
  useClass?: Function;
  useValue?: any;
  useFactory?: () => any;
  scope: Scope;
  instance?: any;
  resolved: boolean;
}

/**
 * Lightweight IoC container with singleton/request/transient scopes and cycle detection.
 */
export class DIContainer {
  private providers = new Map<string | Function, ProviderDefinition>();
  private resolving = new Set<string | Function>();

  private toScopeEnum(scope?: ScopeType): Scope {
    switch (scope) {
      case "transient": return Scope.TRANSIENT;
      case "request":   return Scope.REQUEST;
      default:          return Scope.SINGLETON;
    }
  }

  /** Register a class-based provider. */
  registerClass(token: string | Function, cls: Function, scope?: ScopeType): void {
    const scopeEnum = this.toScopeEnum(scope);
    this.providers.set(token, {
      token,
      useClass: cls,
      scope: scopeEnum,
      resolved: false,
    });
  }

  /** Register a constant value provider. */
  registerValue(token: string | Function, value: any): void {
    this.providers.set(token, {
      token,
      useValue: value,
      scope: Scope.SINGLETON,
      resolved: true,
    });
  }

  /** Register a factory-based provider for lazy instantiation. */
  registerFactory(token: string | Function, factory: () => any, scope: ScopeType = "singleton"): void {
    const scopeEnum = this.toScopeEnum(scope);
    this.providers.set(token, {
      token,
      useFactory: factory,
      scope: scopeEnum,
      resolved: false,
    });
  }

  /** Check if a token is registered. */
  has(token: string | Function): boolean {
    return this.providers.has(token);
  }

  /**
   * Resolve a token to its instance.
   * @param token - The injection token (class or string)
   * @param requestContext - Per-request cache for request-scoped instances
   */
  resolve<T = any>(token: string | Function, requestContext?: Map<string | Function, any>): T {
    const definition = this.providers.get(token);
    if (!definition) {
      throw new Error(`No provider registered for token: ${String(token)}`);
    }

    // Circular dependency check
    if (this.resolving.has(token)) {
      const chain = [...this.resolving, token].map(String).join(" -> ");
      throw new Error(`Circular dependency detected: ${chain}`);
    }
    this.resolving.add(token);

    try {
      // Value provider
      if ("useValue" in definition && definition.useValue !== undefined) {
        return definition.useValue;
      }

      // Factory provider
      if (definition.useFactory) {
        if (definition.scope === Scope.TRANSIENT) {
          return definition.useFactory();
        }
        if (definition.scope === Scope.SINGLETON) {
          if (!definition.resolved) {
            definition.instance = definition.useFactory();
            definition.resolved = true;
          }
          return definition.instance;
        }
        // Request scope
        if (requestContext?.has(token)) {
          return requestContext.get(token);
        }
        const instance = definition.useFactory();
        requestContext?.set(token, instance);
        return instance;
      }

      // Class provider
      if (definition.scope === Scope.TRANSIENT) {
        return this.constructInstance(definition, requestContext);
      }
      if (definition.scope === Scope.SINGLETON && definition.instance !== undefined) {
        return definition.instance;
      }
      if (definition.scope === Scope.REQUEST && requestContext?.has(token)) {
        return requestContext.get(token);
      }

      const instance = this.constructInstance(definition, requestContext);

      if (definition.scope === Scope.SINGLETON) {
        definition.instance = instance;
      } else if (definition.scope === Scope.REQUEST && requestContext) {
        requestContext.set(token, instance);
      }

      return instance;
    } finally {
      this.resolving.delete(token);
    }
  }

  private constructInstance(definition: ProviderDefinition, requestContext?: Map<string | Function, any>): any {
    const cls = definition.useClass!;
    const paramTypes: Function[] =
      Reflect.getMetadata("design:paramtypes", cls) || [];
    const paramTokens: (string | Function | undefined)[] =
      Reflect.getMetadata(INJECT_PARAMS, cls) || [];

    const classDeps: (string | Function)[] =
      Reflect.getMetadata(INJECT_DEPS, cls) || [];
    const paramCount = Math.max(paramTypes.length, paramTokens.length, classDeps.length, cls.length);
    const args: any[] = [];

    for (let i = 0; i < paramCount; i++) {
      const customToken = paramTokens[i];
      if (customToken) {
        args.push(this.resolve(customToken, requestContext));
      } else if (paramTypes[i]) {
        args.push(this.resolve(paramTypes[i], requestContext));
      } else if (classDeps[i]) {
        args.push(this.resolve(classDeps[i], requestContext));
      } else {
        throw new Error(
          `Cannot resolve parameter ${i} of "${cls.name}". ` +
          `Bun's Stage 3 decorators do not emit design:paramtypes and parameter decorators are not supported. ` +
          `Pass deps via @Injectable({ deps: [YourService] }) or @Controller(prefix, { deps: [...] }).`
        );
      }
    }

    return new (cls as any)(...args);
  }
}
