import { DIContainer } from "./container";

/**
 * Per-request injector that scopes request-scoped instances
 * to a single HTTP request lifecycle.
 */
export class RequestInjector {
  private requestScopeInstances = new Map<string | Function, any>();

  constructor(private container: DIContainer) {}

  resolve<T = any>(token: string | Function): T {
    return this.container.resolve<T>(token, this.requestScopeInstances);
  }
}
