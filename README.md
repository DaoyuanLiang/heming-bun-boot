# heming-bun-boot

A **Spring Boot-style web framework** for Bun with decorators and dependency injection.

[中文文档](./README.zh-CN.md) | English | [🤖 Agents.md](./agents.md) — AI coding reference

A **Spring Boot-style web framework** for Bun with decorators and dependency injection, plus an optional enterprise extension module with logging, JWT auth, and unified response format, and a JPA-style database ORM with DDL auto-generation.

## Features

### Core (`heming-bun-boot`)

- **Decorator-based** — `@Controller`, `@Get`, `@Post`, `@Put`, `@Delete`, `@Patch`, `@Injectable`, `@Inject`, `@Configuration`, `@Value`
- **Auto-discovery** — decorators automatically register classes; `Application.run({ scan: [...] })` or just `Application.run()`
- **Dependency Injection** — constructor injection, singleton/request/transient scopes, circular dependency detection
- **Express-like Middleware** — `(ctx, next) => Response` chain, Koa-style compose
- **Static File Serving** — MIME detection (40+ types), directory traversal protection, route matching takes priority
- **Auto-configuration** — `.env` file loading, env vars with defaults and type coercion
- **High performance** — Map-based routing (O(1) static, fast param matching), thin wrapper over `Bun.serve()`
- **Zero heavy dependencies** — only `reflect-metadata`

### Ext (`heming-bun-boot-ext`)

- **Unified Response** — `Result<T>` format for all API responses (`{ code, message, data, timestamp, traceId }`)
- **Exception Handling** — `HttpException` family (7 types), automatic conversion to `Result.fail()`
- **Logging** — Winston logger with console colorization, daily rotate file (prod), `@Log()` method decorator
- **JWT Auth** — sign/verify tokens, `@UseGuard`/`@Public`/`@CurrentUser` decorators, Bearer token extraction
- **Request Tracing** — `traceId` (UUID v4) on every request, `X-Trace-Id` response header

### DB (`heming-bun-boot-db`)

- **JPA-Style Decorators** — `@Table`, `@Column`, `@Id`, `@GeneratedValue`, `@Version`, `@CreatedDate`, `@UpdatedDate`, `@Transient`, `@Enumerated`
- **MyBatis-Plus-Style Repository** — `BaseRepository<T>` with fluent `QueryWrapper<T>` builder (eq, ne, gt, lt, like, in, between, orderBy, groupBy, having, pagination)
- **Auto DDL** — `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE` generation from entity metadata (create/update/validate/none strategies)
- **Optimistic Locking** — `@Version` column with stale-update detection
- **Keyless Tables** — entities without `@Id` supported for append-only / log tables

---

## Installation

### Core only

```bash
bun add heming-bun-boot reflect-metadata
```

### With enterprise extensions

```bash
bun add heming-bun-boot-ext reflect-metadata
# heming-bun-boot is included as a peer dependency
```

---

## Quick Start (Core Only)

```typescript
import "reflect-metadata";
import {
  Application,
  Controller,
  Get,
  Post,
  Injectable,
  Inject,
  Configuration,
  Value,
  Context,
} from "heming-bun-boot";

// ── Configuration ──
@Configuration()
class AppConfig {
  @Value("PORT", 3000)
  port!: number;

  @Value("APP_NAME", "my-app")
  appName!: string;
}

// ── Service ──
@Injectable()
class UserService {
  private users = [
    { id: "1", name: "Alice" },
    { id: "2", name: "Bob" },
  ];

  findAll() { return this.users; }
  findById(id: string) { return this.users.find(u => u.id === id); }
}

// ── Controller ──
@Controller("/users")
class UserController {
  constructor(@Inject() private userService: UserService) {}

  @Get()
  listUsers() { return this.userService.findAll(); }

  @Get("/:id")
  getUser({ params }: Context) {
    const user = this.userService.findById(params.id);
    if (!user) return new Response("Not Found", { status: 404 });
    return user;
  }

  @Post()
  async createUser({ request }: Context) {
    const body = await request.json();
    return this.userService.create(body.name);
  }
}

// ── Root health check ──
@Controller("/")
class RootController {
  @Get()
  health() { return { status: "ok" }; }
}

// ── Bootstrap ──
Application.run({
  controllers: [RootController, UserController],
  providers: [UserService],
  configurations: [AppConfig],
  static: { assets: "public", prefix: "/" },   // optional static files
});
```

Run it:

```bash
bun run index.ts
# → [bun-boot] Server running at http://localhost:3000
```

---

## Quick Start (With Ext)

```typescript
import "reflect-metadata";
import {
  Controller, Get, Post, Injectable, Inject,
  Configuration, Value, Context,
} from "heming-bun-boot";
import {
  ExtApplication,
  Result,
  UseGuard,
  JwtAuthGuard,
  NotFoundException,
  BadRequestException,
} from "heming-bun-boot-ext";

// ── Configuration ──
@Configuration()
class AppConfig {
  @Value("PORT", 3000)
  port!: number;
}

// ── Service ──
@Injectable()
class UserService {
  private users = [
    { id: "1", name: "Alice", role: "admin" },
    { id: "2", name: "Bob", role: "user" },
  ];

  findAll() {
    return this.users.map(({ id, name, role }) => ({ id, name, role }));
  }

  findById(id: string) {
    const user = this.users.find(u => u.id === id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }
}

// ── Controllers ──
@Controller("/auth")
class AuthController {
  constructor(
    @Inject() private jwtService: JwtService,
    @Inject() private userService: UserService,
  ) {}

  @Post("/login")
  async login({ request }: Context) {
    const { name } = await request.json();
    if (!name) throw new BadRequestException("name is required");

    const user = this.userService.validateCredentials(name);
    if (!user) throw new BadRequestException("invalid credentials");

    const token = this.jwtService.sign(
      { id: String(user.id), name: user.name, role: user.role },
    );
    return Result.ok({ token, user }, "login success");
  }
}

@Controller("/users")
@UseGuard(JwtAuthGuard)        // All routes require auth
class UserController {
  constructor(@Inject() private userService: UserService) {}

  @Get()
  listUsers() { return Result.ok(this.userService.findAll()); }

  @Get("/:id")
  getUser({ params }: Context) {
    return Result.ok(this.userService.findById(params.id));
  }
}

// ── Bootstrap ──
ExtApplication.run({
  controllers: [AuthController, UserController],
  providers: [UserService],
  configurations: [AppConfig],
  static: { assets: "public", prefix: "/" },   // optional static files
});
```

**What you get with Ext:**

| Scenario | Response |
|----------|----------|
| `POST /auth/login` with valid name | `{"code":0, "message":"login success", "data":{"token":"...", "user":{...}}, ...}` |
| `GET /users` with Bearer token | `{"code":0, "message":"success", "data":[{...}, {...}], ...}` |
| `GET /users` without token | `{"code":401, "message":"Unauthorized", "data":null, ...}` |
| `GET /users/999` with token | `{"code":404, "message":"User 999 not found", "data":null, ...}` |
| Any unhandled error | `{"code":500, "message":"Internal Server Error", "data":null, ...}` |

Every response includes `traceId` and `timestamp`.

**.env file** (optional):

```env
PORT=3000
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
LOG_LEVEL=debug
```

---

## Quick Start (Declarative / Auto-Discovery)

Same decorators, no manual registration — `Application.run()` automatically collects decorated classes:

```typescript
import "reflect-metadata";
import { Application, Controller, Get, Injectable, Context } from "heming-bun-boot";

@Injectable()
class UserService {
  findAll() { return [{ id: "1", name: "Alice" }, { id: "2", name: "Bob" }]; }
}

@Controller("/users")
class UserController {
  constructor(private userService: UserService) {}

  @Get()
  list() { return this.userService.findAll(); }
}

// Auto-discovery mode — no explicit arrays needed
Application.run();

// Or with filesystem scanning:
// Application.run({ scan: ["src/controller", "src/service"] });

// Explicit arrays still work and are merged with discovered classes:
// Application.run({
//   scan: ["src/controller"],
//   providers: [CustomService],  // merged with discovered ones
// });
```

---

## Decorator Reference

### HTTP Routing

| Decorator | Target | Description |
|-----------|--------|-------------|
| `@Controller(prefix?)` | Class | Marks a controller with optional route prefix |
| `@Get(path?)` | Method | Maps GET requests |
| `@Post(path?)` | Method | Maps POST requests |
| `@Put(path?)` | Method | Maps PUT requests |
| `@Delete(path?)` | Method | Maps DELETE requests |
| `@Patch(path?)` | Method | Maps PATCH requests |

Route parameters use `:paramName` syntax:

```typescript
@Get("/:id")
getUser({ params }: Context) {
  // params.id → "42" for GET /users/42
}
```

A method can have multiple HTTP decorators:

```typescript
@Get("/:id")
@Post("/:id")
handleUser({ params, request }: Context) { ... }
```

### Dependency Injection

| Decorator | Target | Description |
|-----------|--------|-------------|
| `@Injectable(scope?)` | Class | Marks a class for DI. Scope: `"singleton"` (default), `"request"`, or `"transient"` |
| `@Inject(token?)` | Parameter | Specifies injection token. Falls back to type inference if omitted |

```typescript
@Injectable()
class UserService { ... }

@Injectable("request")    // New instance per request
class RequestLogger { ... }

@Controller("/users")
class UserController {
  constructor(
    @Inject() private userService: UserService,    // Token-based
    private requestLogger: RequestLogger,           // Type-inferred
  ) {}
}
```

**Scope rules:**
- Singleton is the default. Instance cached for app lifetime.
- Request scope creates a new instance per HTTP request.
- Transient scope always creates a new instance on every injection/resolution.
- Singleton cannot depend on Request scope (detected at startup).

### Configuration

| Decorator | Target | Description |
|-----------|--------|-------------|
| `@Configuration()` | Class | Marks a class as configuration holder |
| `@Value(key, default?)` | Property | Binds property to env var with optional default |

```typescript
@Configuration()
class AppConfig {
  @Value("PORT", 3000)
  port!: number;

  @Value("DB_HOST", "localhost")
  dbHost!: string;

  @Value("DEBUG", false)
  debug!: boolean;
}
```

Values are resolved from `process.env`, with automatic type coercion (`Number`, `Boolean`, `String`). Priority: **command-line env > .env file > default value**.

---

## Context API

The `Context` object is passed to every route handler:

```typescript
class Context {
  request: Request              // Native Bun Request
  params: Record<string, string> // Path params { id: "42" }
  query: URLSearchParams        // Query string params
  route?: MatchResult           // Route metadata (available to middleware)

  status: number                // Response status (default 200)
  setHeader(key, value): void   // Set response header
  json(data): Response          // Return JSON response
  text(data): Response          // Return text response
}
```

### Handler Return Values

| Return Type | Behavior |
|-------------|----------|
| `Response` | Passed through directly |
| `null` / `undefined` | `204 No Content` |
| Other value | `200 OK` with `application/json` |

In Ext module, non-`Response` returns are automatically wrapped in `Result.ok(data)`.

---

## Middleware

Middleware functions follow the Express/Koa pattern:

```typescript
type Middleware = (
  ctx: Context,
  next: () => Promise<Response>
) => Promise<Response> | Response;
```

### Custom Middleware

```typescript
import { Application, type Middleware } from "heming-bun-boot";

// Timing middleware
const timingMiddleware: Middleware = async (ctx, next) => {
  const start = Date.now();
  const response = await next();
  const elapsed = Date.now() - start;
  console.log(`${ctx.request.method} ${ctx.request.url} → ${elapsed}ms`);
  return response;
};

// CORS middleware
const corsMiddleware: Middleware = async (ctx, next) => {
  if (ctx.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }
  const response = await next();
  response.headers.set("Access-Control-Allow-Origin", "*");
  return response;
};

// Auth middleware (short-circuit example)
const authMiddleware: Middleware = async (ctx, next) => {
  const token = ctx.request.headers.get("authorization");
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return next();
};

Application.run({
  controllers: [UserController],
  providers: [UserService],
  middlewares: [timingMiddleware, corsMiddleware, authMiddleware],
});
```

### Execution Order

Middleware executes in array order, wrapping inward:

```
Request → mw[0] → mw[1] → mw[2] → Route Handler → Response
         ←       ←       ←       ←
```

- Call `await next()` to pass control to the next middleware.
- Return a `Response` to short-circuit (skip remaining middleware and handler).
- Throw an error to propagate up through the chain.

---

## Ext Module Features

### Unified Response Format

All responses in Ext follow this structure:

```typescript
class Result<T> {
  code: number;       // 0 = success, non-zero = error
  message: string;    // Human-readable message
  data: T | null;     // Payload
  timestamp: number;  // Unix timestamp (ms)
  traceId?: string;   // Request tracing ID
}
```

**Usage in handlers:**

```typescript
// Success
return Result.ok(userList);                              // { code:0, message:"success", data:[...] }
return Result.ok(user, "user found");                    // { code:0, message:"user found", data:{...} }
return Result.ok(null);                                  // { code:0, message:"success", data:null }

// Failure
throw new NotFoundException("User 42 not found");        // { code:404, message:"User 42 not found", data:null }
throw new BadRequestException("name is required");       // { code:400, message:"name is required", data:null }
throw new UnauthorizedException();                       // { code:401, message:"Unauthorized", data:null }
```

### Exception Types

| Exception | HTTP Status |
|-----------|-------------|
| `BadRequestException` | 400 |
| `UnauthorizedException` | 401 |
| `ForbiddenException` | 403 |
| `NotFoundException` | 404 |
| `ConflictException` | 409 |
| `InternalServerErrorException` | 500 |

All extend `HttpException` and are automatically caught by `GlobalExceptionFilter`, which converts them to `Result.fail()`.

### Logging

**LoggerService** — Winston-based, auto-registered:

```typescript
import { LoggerService } from "heming-bun-boot-ext";

@Injectable()
class UserService {
  constructor(@Inject() private logger: LoggerService) {}

  findById(id: string) {
    this.logger.info("Finding user", { userId: id });
    // ...
    this.logger.warn("User not found", { userId: id });
    this.logger.error("Database connection failed", { error: err.message });
  }
}
```

**Log levels:** `debug`, `info`, `warn`, `error`

**Transports:**
- **Development** (`NODE_ENV !== "production"`): Colorized console output
- **Production**: Console + daily rotate file (`logs/app-YYYY-MM-DD.log`, kept 30 days)

**@Log() method decorator:**

```typescript
import { Log } from "heming-bun-boot-ext";

class UserService {
  @Log()
  findById(id: string) {
    // Auto-logs: → findById { args: ["42"] }
    //            ← findById { result: {...} }
  }

  @Log({ level: "debug", message: "Fetching user" })
  findByEmail(email: string) {
    // Auto-logs with custom message and level
  }
}
```

### JWT Authentication

**JwtService** — auto-registered, reads `JWT_SECRET` and `JWT_EXPIRES_IN` from env. Signs with `UserPayload` (uses `id` instead of raw `sub`):

```typescript
import { JwtService } from "heming-bun-boot-ext";
import type { UserPayload } from "heming-bun-boot-ext";

@Injectable()
class AuthService {
  constructor(@Inject() private jwtService: JwtService) {}

  login(user: User) {
    const token = this.jwtService.sign(
      { id: String(user.id), name: user.name, role: user.role },
      { expiresIn: "2h" }  // optional override
    );
    return { token };
  }

  validate(token: string) {
    const payload = this.jwtService.verify(token);
    if (!payload) throw new UnauthorizedException("invalid token");
    // normalizeUserPayload ensures `id` is always present
    return payload;
  }
}
```

**Decorators:**

| Decorator | Target | Description |
|-----------|--------|-------------|
| `@UseGuard(...GuardClasses)` | Class/Method | Apply one or more auth guards (class or method level) |
| `@Public()` | Method | Skip auth for a specific route |
| `@CurrentUser()` | Parameter | Inject `UserPayload` into handler parameter |

```typescript
import { UseGuard, Public, CurrentUser, JwtAuthGuard } from "heming-bun-boot-ext";
import type { UserPayload } from "heming-bun-boot-ext";

@Controller("/users")
@UseGuard(JwtAuthGuard)         // All routes require authentication
class UserController {

  @Get()
  listUsers() { ... }           // Requires auth

  @Get("/me")
  getProfile(@CurrentUser() user: UserPayload) {
    // user.id, user.name, user.role are available
    return Result.ok({ id: user.id, name: user.name });
  }

  @Get("/public")
  @Public()                     // This route skips auth
  publicData() { ... }

  // Method-level multi-guard: runs JwtAuthGuard + RoleGuard
  @UseGuard(RoleGuard)
  @Delete("/:id")
  async remove() { ... }
}
```

### Custom Auth Guard

```typescript
import { Injectable } from "heming-bun-boot";
import type { AuthGuard, Context } from "heming-bun-boot-ext";

@Injectable()
class ApiKeyGuard implements AuthGuard {
  canActivate(ctx: Context): boolean {
    const apiKey = ctx.request.headers.get("x-api-key");
    return apiKey === process.env.API_KEY;
  }
}

// Single guard:
@Controller("/admin")
@UseGuard(ApiKeyGuard)
class AdminController { ... }

// Multiple guards (runs in order, all must pass):
@Controller("/super-admin")
@UseGuard(JwtAuthGuard, ApiKeyGuard)
class SuperAdminController { ... }
```

---

## ExtApplication Middleware Chain

The built-in middleware runs in this order:

```
Request
  → ExceptionFilter    (try/catch → Result.fail on error)
    → RequestId        (generate traceId, set X-Trace-Id header)
      → Logger         (log request → await next() → log response)
        → AuthGuard    (check @UseGuard / @Public, verify token)
          → User Middlewares  (custom middlewares from options)
            → Route Handler + Result.ok wrapping
```

Custom middlewares passed via `options.middlewares` are placed after Auth but before the route handler.

---

## Configuration System

### .env File

Place a `.env` file in your project root:

```env
PORT=3000
APP_NAME=my-app
DEBUG=false
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
LOG_LEVEL=debug
```

- Loaded automatically by `ConfigLoader.loadEnvFile()`
- Values already in `process.env` take precedence (no override)
- Lines starting with `#` are comments
- Quotes around values are stripped

### Type Coercion

```typescript
@Configuration()
class AppConfig {
  @Value("PORT", 3000)          // env "3000" → number 3000
  port!: number;

  @Value("DEBUG", false)        // env "true" → boolean true
  debug!: boolean;

  @Value("APP_NAME", "my-app")  // env string → string
  appName!: string;
}
```

Types are inferred from the property's TypeScript type annotation (`design:type` metadata). Default values are also coerced — `@Value("PORT", "3002") port!: number` gives numeric `3002`, not the string `"3002"`.

---

## Application Options

```typescript
// Core
Application.run({
  controllers?: Function[];      // Controller classes
  providers?: Function[];        // Injectable services
  configurations?: Function[];   // @Configuration classes
  scan?: string[];               // Auto-discover from filesystem directories
  middlewares?: Middleware[];    // Custom middleware chain
  static?: StaticOptions;        // Serve static files (e.g. { assets: "public", prefix: "/" })
  port?: number;                 // Override port (top priority)
  hostname?: string;             // Default: "0.0.0.0"
}, hooks?: ApplicationHooks);    // Extension hooks (library authors only)

// Ext
ExtApplication.run({
  // ... same options as Application.run
  // middlewares are appended after the built-in Ext chain
});
```

### Port Resolution

The port is resolved in this priority order:

```
1. options.port         (explicit in code — highest priority)
2. @Value("PORT")       (on @Configuration class, loaded from .env)
3. .env file            (PORT=3000, loaded automatically)
4. 3000                 (framework default)
```

### ApplicationHooks (Library Authors)

The `hooks` parameter lets library authors inject framework-level behavior without modifying core. This is how `ExtApplication` is built — it delegates entirely to `Application.run()` with 6 hooks:

| Hook | Purpose |
|------|---------|
| `builtinProviders` | Register framework services before user classes |
| `onInit` | Wire services after container is built and config loaded |
| `routeHandlerFactory` | Override route handler (e.g. `Result` wrapping + `@CurrentUser` injection) |
| `builtinMiddlewares` | Add framework-level middleware (runs before user middleware) |
| `onNotFound` | Custom 404 response |
| `onError` | Custom unhandled error response |

End users should use `ExtApplication.run()` directly — hooks are only needed when building custom framework extensions.

### Static Files

Serve static assets with automatic MIME detection (40+ types) and directory traversal protection:

```typescript
Application.run({
  controllers: [UserController],
  static: { assets: "public", prefix: "/" },
});
```

- **Route matching takes priority** — if a route matches, it handles the request first
- **Configurable prefix** — `prefix: "/static"` serves files under `/static/*`
- **Security** — resolved paths are normalized and validated to stay within the assets directory

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│              Application.run(options, hooks)               │
├──────────────────────────────────────────────────────────┤
│  AUTO_REGISTRY    │  ModuleScanner  │  DIContainer        │
│  (decorator →     │  (FS scan)      │  (IoC)              │
│   Set<Function>)  │                 │                     │
├──────────────────────────────────────────────────────────┤
│  ConfigLoader     │  Middleware Chain                      │
│  (env → config)   │  (builtin → user → route handler)     │
├──────────────────────────────────────────────────────────┤
│                       Router                               │
│  Static routes: Map<key, entry> — O(1)                    │
│  Param routes:  segment comparison — O(R × S)             │
├──────────────────────────────────────────────────────────┤
│                      Bun.serve()                           │
│                   (native HTTP server)                     │
└──────────────────────────────────────────────────────────┘
```

### Performance

- **Static route lookup:** O(1) via native `Map.get()`
- **Parameterized routes:** O(R × S) where R = routes per method, S = path segments (typically < 6)
- **Request overhead:** ~5μs (Context allocation + route matching)
- **Zero middleware overhead** when no middleware is registered (fast path preserved)
- **No regex** in route matching — pure string comparison

---

## Local Development

```bash
# Clone and install
cd heming-bun-boot-core
bun install

cd ../heming-bun-boot-ext
bun install

# Run the demo
cd ../heming-bun-boot-demo
bun install
bun run index.ts
```

### Testing with Ext

```bash
# Start demo server
cd heming-bun-boot-demo
bun run index.ts

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice"}'

# Access protected route
curl http://localhost:3000/users \
  -H "Authorization: Bearer <token>"

# Test unauthorized
curl http://localhost:3000/users
# → {"code":401,"message":"Unauthorized","data":null,...}

# Test not found
curl http://localhost:3000/users/999 \
  -H "Authorization: Bearer <token>"
# → {"code":404,"message":"User 999 not found","data":null,...}
```

---

## Project Structure

```
bun-project/
├── heming-bun-boot-core/              # heming-bun-boot
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                   # Public API
│       ├── application.ts             # Application.run()
│       ├── context.ts                 # Context class
│       ├── middleware.ts              # Middleware type + compose
│       ├── static.ts                 # Static file serving
│       ├── di/
│       │   ├── container.ts           # DI container
│       │   ├── injector.ts            # Request-scope injector
│       │   ├── registry.ts            # AUTO_REGISTRY (decorator → Set)
│       │   └── scope.ts               # Scope enum
│       ├── decorators/
│       │   ├── controller.ts          # @Controller
│       │   ├── http.ts                # @Get/@Post/...
│       │   ├── inject.ts              # @Injectable/@Inject
│       │   └── config.ts              # @Configuration/@Value
│       ├── router/
│       │   ├── router.ts              # Router
│       │   └── matcher.ts             # Route matching algorithm
│       ├── config/
│       │   └── config-loader.ts       # Env/config loader
│       └── scanner/
│           └── module-scanner.ts      # Auto-discovery
├── heming-bun-boot-ext/               # heming-bun-boot-ext
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                   # Public API
│       ├── application.ts             # ExtApplication.run()
│       ├── result/
│       │   ├── result.ts              # Result<T>
│       │   ├── exceptions.ts          # HttpException family
│       │   └── exception.filter.ts    # Global exception filter
│       ├── logging/
│       │   ├── logger.service.ts      # Winston LoggerService
│       │   ├── logger.decorator.ts    # @Log() decorator
│       │   └── logger.middleware.ts   # Request/response logging
│       ├── middleware/
│       │   └── request-id.ts          # traceId middleware
│       └── auth/
│           ├── jwt.service.ts         # JwtService
│           ├── auth.guard.ts          # AuthGuard + JwtAuthGuard
│           └── auth.decorators.ts     # @UseGuard/@Public/@CurrentUser
└── heming-bun-boot-demo/              # Demo project
    ├── package.json
    ├── .env
    └── index.ts
```

## License

MIT
