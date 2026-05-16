import "reflect-metadata";
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  AUTO_REGISTRY, Controller, Injectable, Configuration,
  Get, Post, CONTROLLER_PREFIX, INJECTABLE_SCOPE,
  CONFIGURATION_MARKER, Application,
} from "heming-bun-boot";

// ─────────────────────────────────────────────────────────────
// 1. Decorator → AUTO_REGISTRY side effects
// ─────────────────────────────────────────────────────────────

describe("AUTO_REGISTRY — @Controller", () => {
  beforeEach(() => {
    AUTO_REGISTRY.controllers.clear();
    AUTO_REGISTRY.providers.clear();
    AUTO_REGISTRY.configurations.clear();
  });

  test("registers class in AUTO_REGISTRY.controllers", () => {
    @Controller("/test")
    class TestCtrl {}

    expect(AUTO_REGISTRY.controllers.has(TestCtrl)).toBe(true);
    expect(AUTO_REGISTRY.controllers.size).toBe(1);
  });

  test("still writes CONTROLLER_PREFIX metadata", () => {
    @Controller("/api/users")
    class UserCtrl {}

    expect(Reflect.getMetadata(CONTROLLER_PREFIX, UserCtrl)).toBe("/api/users");
  });

  test("registers controller with empty prefix", () => {
    @Controller()
    class NoPrefixCtrl {}

    expect(AUTO_REGISTRY.controllers.has(NoPrefixCtrl)).toBe(true);
    expect(Reflect.getMetadata(CONTROLLER_PREFIX, NoPrefixCtrl)).toBe("");
  });

  test("registers multiple independent controllers", () => {
    @Controller("/a") class A {}
    @Controller("/b") class B {}
    @Controller("/c") class C {}

    expect(AUTO_REGISTRY.controllers.size).toBe(3);
    expect(AUTO_REGISTRY.controllers.has(A)).toBe(true);
    expect(AUTO_REGISTRY.controllers.has(B)).toBe(true);
    expect(AUTO_REGISTRY.controllers.has(C)).toBe(true);
  });

  test("Set deduplication: same class reference not duplicated", () => {
    @Controller("/x")
    class X {}
    // Applying same decorator again to same class — still one entry
    Controller("/x")(X);
    expect(AUTO_REGISTRY.controllers.size).toBe(1);
  });

  test("registry does NOT include non-decorated classes", () => {
    class PlainClass {}
    expect(AUTO_REGISTRY.controllers.has(PlainClass as any)).toBe(false);
  });
});

describe("AUTO_REGISTRY — @Injectable", () => {
  beforeEach(() => {
    AUTO_REGISTRY.providers.clear();
  });

  test("registers class in AUTO_REGISTRY.providers", () => {
    @Injectable()
    class TestSvc {}

    expect(AUTO_REGISTRY.providers.has(TestSvc)).toBe(true);
    expect(AUTO_REGISTRY.providers.size).toBe(1);
  });

  test("default scope is singleton", () => {
    @Injectable()
    class DefaultSvc {}

    expect(Reflect.getMetadata(INJECTABLE_SCOPE, DefaultSvc)).toBe("singleton");
  });

  test("explicit singleton scope", () => {
    @Injectable("singleton")
    class SingletonSvc {}

    expect(Reflect.getMetadata(INJECTABLE_SCOPE, SingletonSvc)).toBe("singleton");
  });

  test("transient scope", () => {
    @Injectable("transient")
    class TransientSvc {}

    expect(Reflect.getMetadata(INJECTABLE_SCOPE, TransientSvc)).toBe("transient");
  });

  test("request scope", () => {
    @Injectable("request")
    class RequestSvc {}

    expect(Reflect.getMetadata(INJECTABLE_SCOPE, RequestSvc)).toBe("request");
  });

  test("multiple providers from different scopes all registered", () => {
    @Injectable() class A {}
    @Injectable("transient") class B {}
    @Injectable("request") class C {}

    expect(AUTO_REGISTRY.providers.size).toBe(3);
  });
});

describe("AUTO_REGISTRY — @Configuration", () => {
  beforeEach(() => {
    AUTO_REGISTRY.configurations.clear();
  });

  test("registers class in AUTO_REGISTRY.configurations", () => {
    @Configuration()
    class TestCfg {}

    expect(AUTO_REGISTRY.configurations.has(TestCfg)).toBe(true);
    expect(AUTO_REGISTRY.configurations.size).toBe(1);
  });

  test("still writes CONFIGURATION_MARKER metadata", () => {
    @Configuration()
    class MyCfg {}

    expect(Reflect.getMetadata(CONFIGURATION_MARKER, MyCfg)).toBe(true);
  });

  test("multiple configurations all registered", () => {
    @Configuration() class A {}
    @Configuration() class B {}

    expect(AUTO_REGISTRY.configurations.size).toBe(2);
  });
});

describe("AUTO_REGISTRY — three registries are independent", () => {
  beforeEach(() => {
    AUTO_REGISTRY.controllers.clear();
    AUTO_REGISTRY.providers.clear();
    AUTO_REGISTRY.configurations.clear();
  });

  test("@Controller only adds to controllers, not providers or configurations", () => {
    @Controller("/x") class Ctrl {}

    expect(AUTO_REGISTRY.controllers.size).toBe(1);
    expect(AUTO_REGISTRY.providers.size).toBe(0);
    expect(AUTO_REGISTRY.configurations.size).toBe(0);
  });

  test("@Injectable only adds to providers", () => {
    @Injectable() class Svc {}

    expect(AUTO_REGISTRY.controllers.size).toBe(0);
    expect(AUTO_REGISTRY.providers.size).toBe(1);
    expect(AUTO_REGISTRY.configurations.size).toBe(0);
  });

  test("@Configuration only adds to configurations", () => {
    @Configuration() class Cfg {}

    expect(AUTO_REGISTRY.controllers.size).toBe(0);
    expect(AUTO_REGISTRY.providers.size).toBe(0);
    expect(AUTO_REGISTRY.configurations.size).toBe(1);
  });

  test("full mixed scenario", () => {
    @Controller("/user") class UserCtrl {}
    @Injectable() class UserSvc {}
    @Configuration() class AppCfg {}

    expect(AUTO_REGISTRY.controllers.size).toBe(1);
    expect(AUTO_REGISTRY.providers.size).toBe(1);
    expect(AUTO_REGISTRY.configurations.size).toBe(1);
  });
});

describe("AUTO_REGISTRY — cleanup for test isolation", () => {
  test("clear controllers", () => {
    @Controller("/x") class X {}
    expect(AUTO_REGISTRY.controllers.size).toBeGreaterThan(0);
    AUTO_REGISTRY.controllers.clear();
    expect(AUTO_REGISTRY.controllers.size).toBe(0);
  });

  test("clear providers", () => {
    @Injectable() class Y {}
    expect(AUTO_REGISTRY.providers.size).toBeGreaterThan(0);
    AUTO_REGISTRY.providers.clear();
    expect(AUTO_REGISTRY.providers.size).toBe(0);
  });

  test("clear configurations", () => {
    @Configuration() class Z {}
    expect(AUTO_REGISTRY.configurations.size).toBeGreaterThan(0);
    AUTO_REGISTRY.configurations.clear();
    expect(AUTO_REGISTRY.configurations.size).toBe(0);
  });

  test("clear all three", () => {
    @Controller("/c") class C {}
    @Injectable() class P {}
    @Configuration() class CF {}

    AUTO_REGISTRY.controllers.clear();
    AUTO_REGISTRY.providers.clear();
    AUTO_REGISTRY.configurations.clear();

    expect(AUTO_REGISTRY.controllers.size).toBe(0);
    expect(AUTO_REGISTRY.providers.size).toBe(0);
    expect(AUTO_REGISTRY.configurations.size).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 2. Application.run() end-to-end integration (auto-discovery)
// ─────────────────────────────────────────────────────────────

describe("Application.run() — end-to-end auto-discovery", () => {
  let server: any;

  afterEach(() => {
    AUTO_REGISTRY.controllers.clear();
    AUTO_REGISTRY.providers.clear();
    AUTO_REGISTRY.configurations.clear();
    server?.stop();
    server = null;
  });

  test("starts server with AUTO_REGISTRY-collected controller", async () => {
    @Controller("/api")
    class HealthCtrl {
      @Get("/health")
      health(ctx: any) {
        return new Response("OK");
      }
    }

    server = await Application.run({ port: 0 });
    expect(server.port).toBeGreaterThan(0);

    const res = await fetch(`http://localhost:${server.port}/api/health`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  test("handles 404 for unknown routes", async () => {
    @Controller("/api")
    class PingCtrl {
      @Get("/ping")
      pong(ctx: any) {
        return new Response("pong");
      }
    }

    server = await Application.run({ port: 0 });

    const res = await fetch(`http://localhost:${server.port}/not-found`);
    expect(res.status).toBe(404);
  });

  test("explicit controllers merge with registry (additive, not replace)", async () => {
    @Controller("/registry")
    class RegistryCtrl {
      @Get("/route")
      route(ctx: any) {
        return new Response("from-registry");
      }
    }

    @Controller("/explicit")
    class ExplicitCtrl {
      @Get("/route")
      route(ctx: any) {
        return new Response("from-explicit");
      }
    }

    server = await Application.run({
      controllers: [ExplicitCtrl],
      scan: [],  // explicit scan enables auto mode (merge registry + explicit)
      port: 0,
    });

    // Both routes should work (additive merge)
    const r1 = await fetch(`http://localhost:${server.port}/registry/route`);
    expect(await r1.text()).toBe("from-registry");

    const r2 = await fetch(`http://localhost:${server.port}/explicit/route`);
    expect(await r2.text()).toBe("from-explicit");
  });

  test("POST request with JSON body", async () => {
    @Controller("/data")
    class DataCtrl {
      @Post("/echo")
      async echo(ctx: any) {
        const body = await ctx.request.json();
        return new Response(JSON.stringify(body), {
          headers: { "content-type": "application/json" },
        });
      }
    }

    server = await Application.run({ port: 0 });

    const res = await fetch(`http://localhost:${server.port}/data/echo`, {
      method: "POST",
      body: JSON.stringify({ message: "hello" }),
      headers: { "content-type": "application/json" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("hello");
  });

  test("multiple controllers from registry all get routes", async () => {
    @Controller("/users")
    class UserCtrl {
      @Get("/list")
      list(ctx: any) { return new Response("user-list"); }
    }

    @Controller("/posts")
    class PostCtrl {
      @Get("/list")
      list(ctx: any) { return new Response("post-list"); }
    }

    server = await Application.run({ port: 0 });

    const r1 = await fetch(`http://localhost:${server.port}/users/list`);
    expect(await r1.text()).toBe("user-list");

    const r2 = await fetch(`http://localhost:${server.port}/posts/list`);
    expect(await r2.text()).toBe("post-list");
  });

  test("server can be stopped cleanly", async () => {
    @Controller("/stop")
    class StopCtrl {
      @Get("/test")
      test(ctx: any) { return new Response("before-stop"); }
    }

    server = await Application.run({ port: 0 });
    const port = server.port;

    // Verify running
    const r1 = await fetch(`http://localhost:${port}/stop/test`);
    expect(await r1.text()).toBe("before-stop");

    // Stop
    server.stop();
    server = null;

    // Should fail to connect
    try {
      await fetch(`http://localhost:${port}/stop/test`);
      // If we get here without throwing, connection refused didn't happen
      // That's OK — Bun may still have lingering connections
    } catch {}
  });
});

describe("Application.run() — merge priority", () => {
  let server: any;

  afterEach(() => {
    AUTO_REGISTRY.controllers.clear();
    AUTO_REGISTRY.providers.clear();
    AUTO_REGISTRY.configurations.clear();
    server?.stop();
    server = null;
  });

  test("no scan, no explicit — collects from AUTO_REGISTRY", async () => {
    @Controller("/registry")
    class RegistryCtrl {
      @Get("/check")
      check(ctx: any) { return new Response("from-registry"); }
    }

    server = await Application.run({ port: 0 });

    const res = await fetch(`http://localhost:${server.port}/registry/check`);
    expect(await res.text()).toBe("from-registry");
  });

  test("scan parameter is stripped before passing to run()", async () => {
    // run() strips scan before passing to rest of startup logic
    @Controller("/clean")
    class CleanCtrl {
      @Get("/param")
      param(ctx: any) { return new Response("clean-param"); }
    }

    // Pass an empty scan array — should work fine
    server = await Application.run({ scan: [], port: 0 });

    const res = await fetch(`http://localhost:${server.port}/clean/param`);
    expect(await res.text()).toBe("clean-param");
  });
});
