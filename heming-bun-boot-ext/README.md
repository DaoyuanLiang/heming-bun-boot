# @heming/bun-boot-ext

> Enterprise extensions for @heming/bun-boot — logging, JWT auth, unified response format.

## Features

- **Unified Response** — `Result<T>` format (`{ code, message, data, timestamp, traceId }`)
- **Exception Handling** — `HttpException` family (7 types), automatic conversion to `Result.fail()`
- **Logging** — Winston logger with console colorization, daily rotate file (prod), `@Log()` method decorator
- **JWT Auth** — sign/verify tokens with `UserPayload`, `@UseGuard`/`@Public`/`@CurrentUser` decorators, Bearer token extraction, multi-guard support at class and method level
- **Request Tracing** — `traceId` (UUID v4) on every request, `X-Trace-Id` response header

## Quick Start

```bash
bun add heming-bun-boot-ext reflect-metadata
# heming-bun-boot is included as a peer dependency
```

```typescript
import "reflect-metadata";
import { Controller, Get, Post, Injectable, Inject, Context } from "heming-bun-boot";
import { ExtApplication, Result, JwtService, UseGuard, JwtAuthGuard, NotFoundException } from "heming-bun-boot-ext";

@Injectable()
class UserService {
  private users = [{ id: "1", name: "Alice", role: "admin" }];
  findAll() { return this.users; }
  findById(id: string) {
    const user = this.users.find(u => u.id === id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }
}

@Controller("/auth")
class AuthController {
  constructor(@Inject() private jwtService: JwtService) {}
  @Post("/login")
  async login({ request }: Context) {
    const { name } = await request.json();
    const token = this.jwtService.sign({ id: "1", name, role: "admin" });
    return Result.ok({ token }, "login success");
  }
}

@Controller("/users")
@UseGuard(JwtAuthGuard)
class UserController {
  constructor(@Inject() private userService: UserService) {}
  @Get() listUsers() { return Result.ok(this.userService.findAll()); }
  @Get("/:id") getUser({ params }: Context) {
    return Result.ok(this.userService.findById(params.id));
  }
}

// Explicit registration (original)
ExtApplication.run({
  controllers: [AuthController, UserController],
  providers: [UserService],
});

// Or auto-discovery — no explicit arrays needed:
// ExtApplication.run({ scan: ["src/controller", "src/service"] });
// ExtApplication.run();  // pure registry mode
```

## Response Format

| Scenario | Response |
|----------|----------|
| Success | `{"code":0, "message":"success", "data":{...}, "timestamp":..., "traceId":"..."}` |
| Auth error | `{"code":401, "message":"Unauthorized", "data":null, ...}` |
| Not found | `{"code":404, "message":"User 999 not found", "data":null, ...}` |

## Environment Variables

```env
PORT=3000
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
LOG_LEVEL=debug
```

## Documentation

Full docs: [github.com/DaoyuanLiang/heming-bun-boot](https://github.com/DaoyuanLiang/heming-bun-boot)

## License

MIT
