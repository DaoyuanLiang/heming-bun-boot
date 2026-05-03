// Metadata keys for controller decorators
export const CONTROLLER_PREFIX = Symbol("bun-boot:controller-prefix");
export const CONTROLLER_ROUTES = Symbol("bun-boot:controller-routes");

/**
 * Marks a class as a controller with an optional route prefix.
 * @param prefix - URL prefix for all routes in this controller (e.g. "/users")
 */
export function Controller(prefix: string = ""): ClassDecorator {
  return (target: any) => {
    Reflect.defineMetadata(CONTROLLER_PREFIX, prefix, target);
  };
}
