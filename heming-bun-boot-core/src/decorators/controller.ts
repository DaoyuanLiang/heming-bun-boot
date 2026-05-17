import { AUTO_REGISTRY } from "../di/registry";
import { INJECT_DEPS } from "./inject";
import type { RouteDefinition } from "./http";
import { createMetadataBridge } from "./metadata-bridge";

// Metadata keys for controller decorators
export const CONTROLLER_PREFIX = Symbol("bun-boot:controller-prefix");
export const CONTROLLER_ROUTES = Symbol("bun-boot:controller-routes");

export const routeBridge = createMetadataBridge<RouteDefinition>();

export interface ControllerOptions {
  deps?: (string | Function)[];
}

/**
 * Marks a class as a controller with an optional route prefix.
 * Compatible with both Stage 3 (Bun) and experimental (tsc) decorators.
 * @param prefix - URL prefix for all routes in this controller (e.g. "/users")
 * @param opts - Controller options (deps required for Bun Stage 3 DI)
 */
export function Controller(prefix: string = "", opts?: ControllerOptions): ClassDecorator {
  return (target: any, context?: any) => {
    // Stage 3 (Bun): consume route metadata accumulated during method processing
    if (context?.kind === "class") {
      routeBridge.consume(CONTROLLER_ROUTES, target);
    }
    Reflect.defineMetadata(CONTROLLER_PREFIX, prefix, target);
    if (opts?.deps) {
      Reflect.defineMetadata(INJECT_DEPS, opts.deps, target);
    }
    AUTO_REGISTRY.controllers.add(target);
  };
}
