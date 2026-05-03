import { CONTROLLER_ROUTES } from "./controller";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface RouteDefinition {
  method: HttpMethod;
  path: string;
  handlerName: string;
}

function createMethodDecorator(method: HttpMethod) {
  return (path: string = ""): MethodDecorator => {
    return (target: Object, propertyKey: string | symbol) => {
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
