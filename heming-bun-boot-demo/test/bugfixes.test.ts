import "reflect-metadata";
import { describe, test, expect, beforeAll } from "bun:test";

// Common imports
import {
  Router, RouteMatcher, DIContainer, ConfigLoader,
  Scope, VALUE_METADATA,
} from "heming-bun-boot";
// The ext package doesn't export from npm — we import directly from node_modules
import {
  UseGuard, AUTH_GUARD, AUTH_GUARD_METHOD,
  JwtService, normalizeUserPayload,
} from "heming-bun-boot-ext";

// ─── Test 001: Route trailing slash mismatch ───────────────────────────────
describe("001 — Route trailing slash normalization", () => {
  test("match() strips trailing slash; static route without slash still matches", () => {
    const matcher = new RouteMatcher();
    matcher.addStaticRoute("GET", "/api/admin/cities", class FC1 {}, "list");

    // Request without trailing slash
    expect(matcher.match("GET", "/api/admin/cities")).not.toBeNull();
    // Request WITH trailing slash — match() strips it, key becomes same
    expect(matcher.match("GET", "/api/admin/cities/")).not.toBeNull();
  });

  test("match() keeps root '/' intact", () => {
    const matcher = new RouteMatcher();
    matcher.addStaticRoute("GET", "/", class FC2 {}, "root");

    const result = matcher.match("GET", "/");
    expect(result).not.toBeNull();
    expect(result!.handlerName).toBe("root");
  });

  test("normalizePath strips trailing slash (non-root)", () => {
    // Simulate what normalizePath does: prefix + path, strip trailing slash
    const normalizePath = (prefix: string, path: string) => {
      let result = prefix + path;
      if (!result.startsWith("/")) result = "/" + result;
      result = result.replace(/\/+/g, "/");
      if (result === "") result = "/";
      if (result.length > 1 && result.endsWith("/")) result = result.slice(0, -1);
      return result;
    };

    // @Controller("/api/admin") + @Get("/") => "/api/admin" (not "/api/admin/")
    expect(normalizePath("/api/admin", "/")).toBe("/api/admin");
    // @Controller("/api") + @Get("/users") => "/api/users"
    expect(normalizePath("/api", "/users")).toBe("/api/users");
    // @Controller("/") + @Get() => "/"
    expect(normalizePath("/", "")).toBe("/");
  });

  test("full Router integration: register then match with route ending in slash", () => {
    const router = new Router();

    // Simulate controller: @Controller("/cities") @Get("/")
    const prefix = "/cities";
    const rawPath = "/";
    const fullPath = (() => {
      let r = prefix + rawPath;
      if (!r.startsWith("/")) r = "/" + r;
      r = r.replace(/\/+/g, "/");
      if (r === "") r = "/";
      if (r.length > 1 && r.endsWith("/")) r = r.slice(0, -1);
      return r;
    })();

    expect(fullPath).toBe("/cities");

    const matcher = new RouteMatcher();
    matcher.addStaticRoute("GET", fullPath, class CitiesController {}, "list");

    // Both with and without trailing slash should match
    expect(matcher.match("GET", "/cities")).not.toBeNull();
    expect(matcher.match("GET", "/cities/")).not.toBeNull();
    expect(matcher.match("GET", "/cities")!.handlerName).toBe("list");
  });
});

// ─── Test 003: @UseGuard multi-guard + MethodDecorator ──────────────────────
describe("003 — @UseGuard multiple guards + MethodDecorator", () => {
  test("UseGuard stores array of guard classes on class metadata", () => {
    class MockGuard1 { canActivate() { return true; } }
    class MockGuard2 { canActivate() { return true; } }

    @UseGuard(MockGuard1, MockGuard2)
    class TestController {}

    const guards: Function[] = Reflect.getMetadata(AUTH_GUARD, TestController);
    expect(guards).toBeArray();
    expect(guards).toHaveLength(2);
    expect(guards[0]).toBe(MockGuard1);
    expect(guards[1]).toBe(MockGuard2);
  });

  test("UseGuard supports method-level decorator", () => {
    class MockGuard { canActivate() { return true; } }

    class TestController {
      @UseGuard(MockGuard)
      delete() {}
    }

    const methodGuards: Record<string, any> =
      Reflect.getMetadata(AUTH_GUARD_METHOD, TestController);
    expect(methodGuards).toBeDefined();
    expect(methodGuards["delete"]).toBeArray();
    expect(methodGuards["delete"]).toHaveLength(1);
    expect(methodGuards["delete"][0]).toBe(MockGuard);
  });

  test("UseGuard single arg still works (backward compat)", () => {
    class MockGuard { canActivate() { return true; } }

    @UseGuard(MockGuard)
    class TestController {}

    const guards = Reflect.getMetadata(AUTH_GUARD, TestController);
    expect(guards).toBeArray();
    expect(guards).toHaveLength(1);
    expect(guards[0]).toBe(MockGuard);
  });
});

// ─── Test 005: @Value default value coercion ──────────────────────────────
describe("005 — @Value default value type coercion", () => {
  beforeAll(() => {
    delete process.env.PORT;
    delete process.env.FEATURE;
  });

  test("default value coerced to number via design:type metadata", () => {
    class TestConfig {}

    const meta = [{ key: "PORT", defaultValue: "3002", propertyKey: "port" }];
    Reflect.defineMetadata(VALUE_METADATA, meta, TestConfig);
    Reflect.defineMetadata("design:type", Number, TestConfig.prototype, "port");

    const container = new DIContainer();
    container.registerValue(TestConfig, {});
    const loader = new ConfigLoader(container);

    loader.load([TestConfig]);
    const instance = container.resolve<Record<string, any>>(TestConfig);

    expect(instance.port).toBe(3002);
    expect(typeof instance.port).toBe("number");
  });

  test("default value coerced to boolean", () => {
    class TestConfig {}

    const meta = [{ key: "FEATURE", defaultValue: "true", propertyKey: "enabled" }];
    Reflect.defineMetadata(VALUE_METADATA, meta, TestConfig);
    Reflect.defineMetadata("design:type", Boolean, TestConfig.prototype, "enabled");

    const container = new DIContainer();
    container.registerValue(TestConfig, {});
    const loader = new ConfigLoader(container);

    loader.load([TestConfig]);
    const instance = container.resolve<Record<string, any>>(TestConfig);

    expect(instance.enabled).toBe(true);
    expect(typeof instance.enabled).toBe("boolean");
  });

  test("env value takes precedence and is coerced", () => {
    class TestConfig {}
    process.env.PORT = "8080";

    const meta = [{ key: "PORT", defaultValue: "9999", propertyKey: "port" }];
    Reflect.defineMetadata(VALUE_METADATA, meta, TestConfig);
    Reflect.defineMetadata("design:type", Number, TestConfig.prototype, "port");

    const container = new DIContainer();
    container.registerValue(TestConfig, {});
    const loader = new ConfigLoader(container);

    loader.load([TestConfig]);
    const instance = container.resolve<Record<string, any>>(TestConfig);

    expect(instance.port).toBe(8080);
    expect(typeof instance.port).toBe("number");
  });
});

// ─── Test 006: JWT payload contract ──────────────────────────────────────
describe("006 — JWT payload contract (UserPayload + normalization)", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret-for-jwt";
  });

  test("normalizeUserPayload sets id from sub when id is missing", () => {
    const result = normalizeUserPayload({ sub: "123", name: "Alice" });
    expect(result.id).toBe("123");
    expect(result.name).toBe("Alice");
  });

  test("normalizeUserPayload keeps existing id over sub", () => {
    const result = normalizeUserPayload({ id: "456", sub: "789", name: "Bob" });
    expect(result.id).toBe("456"); // id wins
  });

  test("JwtService.sign maps UserPayload.id to sub claim", () => {
    const jwtService = new JwtService();
    const token = jwtService.sign({ id: "42", role: "admin" });
    expect(token).toBeString();
    expect(token.split(".")).toHaveLength(3);

    const payload = jwtService.verify(token);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe("42");
  });

  test("JwtService.verify returns normalized payload that can be normalized", () => {
    const jwtService = new JwtService();
    const token = jwtService.sign({ id: "99", name: "Charlie", role: "user" });

    const payload = jwtService.verify(token)!;
    expect(payload.sub).toBe("99");
    expect(payload.name).toBe("Charlie");

    // Simulate what JwtAuthGuard does
    const user = normalizeUserPayload(payload);
    expect(user.id).toBe("99");
    expect(user.name).toBe("Charlie");
    expect(user.role).toBe("user");
  });
});

// ─── Test 007: DI Transient scope ────────────────────────────────────────
describe("007 — DI Transient scope", () => {
  test("transient class: each resolve creates a new instance", () => {
    let counter = 0;
    class TransientService { id = ++counter; }

    const container = new DIContainer();
    container.registerClass("TransientService", TransientService, "transient");

    const a: TransientService = container.resolve("TransientService");
    const b: TransientService = container.resolve("TransientService");

    expect(a).not.toBe(b);
    expect(a.id).toBe(1);
    expect(b.id).toBe(2);
  });

  test("transient factory: each resolve calls factory anew", () => {
    let counter = 0;
    const container = new DIContainer();
    container.registerFactory("TransientFactory", () => ({ id: ++counter }), "transient");

    const a = container.resolve<{ id: number }>("TransientFactory");
    const b = container.resolve<{ id: number }>("TransientFactory");

    expect(a.id).toBe(1);
    expect(b.id).toBe(2);
    expect(a).not.toBe(b);
  });

  test("singleton scope still cached correctly", () => {
    let counter = 0;
    class SingletonService { id = ++counter; }

    const container = new DIContainer();
    container.registerClass("SingletonService", SingletonService, "singleton");

    const a: SingletonService = container.resolve("SingletonService");
    const b: SingletonService = container.resolve("SingletonService");

    expect(a.id).toBe(1);
    expect(b.id).toBe(1);
    expect(a).toBe(b);
  });

  test("request scope works with requestContext", () => {
    let counter = 0;
    class RequestService { id = ++counter; }

    const container = new DIContainer();
    container.registerClass("RequestService", RequestService, "request");

    const ctx1 = new Map();
    const ctx2 = new Map();

    const a1 = container.resolve("RequestService", ctx1);
    const a2 = container.resolve("RequestService", ctx1);
    const b1 = container.resolve("RequestService", ctx2);

    expect(a1).toBe(a2);      // same request -> same instance
    expect(a1.id).toBe(1);
    expect(a2.id).toBe(1);
    expect(b1).not.toBe(a1);  // different request -> different instance
    expect(b1.id).toBe(2);
  });
});
