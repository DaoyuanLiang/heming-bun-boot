# @heming/bun-boot

> Performance close to native Bun, developer experience close to Spring Boot.

A **Spring Boot-style web framework** for Bun with decorators and dependency injection.

## Features

- **Decorator-based** — `@Controller`, `@Get`, `@Post`, `@Put`, `@Delete`, `@Patch`, `@Injectable`, `@Inject`, `@Configuration`, `@Value`
- **Dependency Injection** — constructor injection, singleton/request scopes, circular dependency detection
- **Express-like Middleware** — `(ctx, next) => Response` chain, Koa-style compose
- **Static File Serving** — MIME detection (40+ types), directory traversal protection
- **Auto-configuration** — `.env` file loading, env vars with defaults and type coercion
- **High performance** — Map-based routing (O(1) static, fast param matching), thin wrapper over `Bun.serve()`

## Quick Start

```bash
bun add @heming/bun-boot reflect-metadata
```

```typescript
import "reflect-metadata";
import { Application, Controller, Get, Injectable, Inject, Context } from "@heming/bun-boot";

@Injectable()
class UserService {
  private users = [{ id: "1", name: "Alice" }, { id: "2", name: "Bob" }];
  findAll() { return this.users; }
}

@Controller("/users")
class UserController {
  constructor(@Inject() private userService: UserService) {}
  @Get() listUsers() { return this.userService.findAll(); }
  @Get("/:id") getUser({ params }: Context) {
    return this.userService.findById(params.id);
  }
}

Application.run({
  controllers: [UserController],
  providers: [UserService],
});
```

## Middleware

```typescript
const timingMiddleware: Middleware = async (ctx, next) => {
  const start = Date.now();
  const response = await next();
  console.log(`${ctx.request.method} ${ctx.request.url} → ${Date.now() - start}ms`);
  return response;
};

Application.run({ controllers: [...], middlewares: [timingMiddleware] });
```

## Static Files

```typescript
Application.run({
  controllers: [...],
  static: { assets: "public", prefix: "/" },
});
```

## Documentation

Full docs: [github.com/DaoyuanLiang/heming-bun-boot](https://github.com/DaoyuanLiang/heming-bun-boot)

## License

MIT
