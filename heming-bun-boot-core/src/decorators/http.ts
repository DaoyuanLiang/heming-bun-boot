import { CONTROLLER_ROUTES, routeBridge } from "./controller";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface RouteDefinition {
  method: HttpMethod;
  path: string;
  handlerName: string;
}

function createMethodDecorator(method: HttpMethod) {
  return (path: string = ""): MethodDecorator => {
    return (target: any, propertyKey: any) => {
      // Stage 3 (Bun): target is the method function, propertyKey is DecoratorContext
      if (propertyKey?.kind) {
        routeBridge.add({ method, path, handlerName: propertyKey.name as string });
        return;
      }

      // Legacy experimental (tsc): target is the prototype
      const routes: RouteDefinition[] =
        Reflect.getMetadata(CONTROLLER_ROUTES, target.constructor) || [];
      routes.push({ method, path, handlerName: propertyKey as string });
      Reflect.defineMetadata(CONTROLLER_ROUTES, routes, target.constructor);
    };
  };
}

export const Get = createMethodDecorator("GET");
export const Post = createMethodDecorator("POST");
export const Put = createMethodDecorator("PUT");
export const Delete = createMethodDecorator("DELETE");
export const Patch = createMethodDecorator("PATCH");
