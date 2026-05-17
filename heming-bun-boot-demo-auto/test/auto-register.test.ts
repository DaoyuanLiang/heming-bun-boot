import "reflect-metadata";
import { describe, test, expect, afterEach } from "bun:test";
import { AUTO_REGISTRY, Controller, Get, Post, Injectable, Application } from "heming-bun-boot";

describe("auto-discovery: decorators register into AUTO_REGISTRY", () => {
  afterEach(() => {
    AUTO_REGISTRY.controllers.clear();
    AUTO_REGISTRY.providers.clear();
    AUTO_REGISTRY.configurations.clear();
  });

  test("@Controller registers into AUTO_REGISTRY.controllers", () => {
    @Controller("/api/products")
    class TestCtrl {
      @Get()
      list() { return []; }
      @Get("/:id")
      getById() { return {}; }
      @Post()
      create() { return {}; }
    }

    expect(AUTO_REGISTRY.controllers.has(TestCtrl)).toBe(true);
    expect(AUTO_REGISTRY.controllers.size).toBe(1);
  });

  test("@Injectable registers into AUTO_REGISTRY.providers", () => {
    @Injectable()
    class TestSvc {}

    expect(AUTO_REGISTRY.providers.has(TestSvc)).toBe(true);
  });

  test("empty run() auto-discovers controllers and registers routes", async () => {
    let server: any;

    @Controller("/test")
    class TestCtrl {
      @Get("/hello")
      hello() { return new Response("world"); }
    }

    server = await Application.run({ port: 0 });
    expect(server.port).toBeGreaterThan(0);

    const res = await fetch(`http://localhost:${server.port}/test/hello`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("world");

    server.stop();
  });

  test("POST route is registered and reachable alongside GET on same path", async () => {
    let server: any;

    @Controller("/api/products")
    class ProductCtrl {
      @Post()
      async create(ctx: any) {
        const body = await ctx.request.json();
        return new Response(JSON.stringify(body), {
          headers: { "content-type": "application/json" },
        });
      }
      @Get()
      list() {
        return new Response(JSON.stringify([]), {
          headers: { "content-type": "application/json" },
        });
      }
    }

    server = await Application.run({ port: 0 });
    const port = server.port;

    // POST should work
    const postRes = await fetch(`http://localhost:${port}/api/products`, {
      method: "POST",
      body: JSON.stringify({ name: "test", price: 10, stock: 5 }),
      headers: { "content-type": "application/json" },
    });
    expect(postRes.status).toBe(200);
    const postBody = await postRes.json();
    expect(postBody.name).toBe("test");

    // GET should work on the same path
    const getRes = await fetch(`http://localhost:${port}/api/products`);
    expect(getRes.status).toBe(200);

    server.stop();
  });
});
