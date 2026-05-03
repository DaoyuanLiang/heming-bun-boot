# @heming/bun-boot

A **Spring Boot-style web framework** for Bun with decorators and dependency injection.

> "Performance close to native Bun, development experience close to Spring Boot."

## Features

- **Decorator-based** — `@Controller`, `@Get`, `@Post`, `@Put`, `@Delete`, `@Injectable`, `@Inject`, `@Configuration`, `@Value`
- **Dependency Injection** — constructor injection, singleton/request scopes, circular dependency detection
- **Auto-configuration** — env vars with defaults and type coercion
- **High performance** — Map-based routing (O(1) static, fast param matching), thin wrapper over `Bun.serve()`
- **Zero heavy dependencies** — only `reflect-metadata`

## Quick Start

### Installation

```bash
bun add @heming/bun-boot reflect-metadata
```

### Basic Example

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
} from "@heming/bun-boot";

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
  getUser({ params }: Context) { return this.userService.findById(params.id); }

  @Post()
  async createUser({ request }: Context) {
    const body = await request.json();
    return this.userService.findAll(); // stub
  }
}

// ── Start ──
Application.run({
  controllers: [UserController],
  providers: [UserService],
  configurations: [AppConfig],
});
```

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

### Dependency Injection

| Decorator | Target | Description |
|-----------|--------|-------------|
| `@Injectable(scope?)` | Class | Marks a class for DI. Scope: `"singleton"` (default) or `"request"` |
| `@Inject(token?)` | Parameter | Specifies injection token. Falls back to type inference if omitted |

### Configuration

| Decorator | Target | Description |
|-----------|--------|-------------|
| `@Configuration()` | Class | Marks a class as configuration holder |
| `@Value(key, default?)` | Property | Binds property to env var with optional default |

## Context API

The `Context` object is passed to every route handler:

```typescript
class Context {
  request: Request          // Native Bun Request
  params: Record<string, string>  // Path params (e.g. { id: "42" })
  query: URLSearchParams    // Query string params

  status: number            // Response status (default 200)
  setHeader(key, value)     // Set response header
  json(data): Response      // Return JSON response
  text(data): Response      // Return text response
}
```

### Handler Return Values

| Return Type | Behavior |
|-------------|----------|
| `Response` | Passed through directly |
| `null` / `undefined` | `204 No Content` |
| Other | `200 OK` with `application/json` |

## Configuration System

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

Values are resolved at startup from `process.env`, with automatic type coercion (`Number`, `Boolean`, `String`).

## Local Development

```bash
# In core directory
cd heming-bun-boot-core
bun install

# Run the demo
cd ../heming-bun-boot-demo
bun install
bun run index.ts
```

### Testing with yarn pack

```bash
cd heming-bun-boot-core
yarn pack                           # creates heming-bun-boot-v0.1.0.tgz

cd ../heming-bun-boot-demo
bun add ../heming-bun-boot-core/heming-bun-boot-v0.1.0.tgz
```

## Architecture

See [doc/design.md](doc/design.md) for the full architecture documentation including:

- Decorator metadata storage strategy
- DI container implementation
- Route matching algorithm (Map-based, O(1) static + segment-based param matching)
- Bun.serve() integration and performance analysis
- Module auto-scanning

## Performance

- Static route lookup: O(1) via native `Map.get()`
- Parameterized routes: O(R × S) where R = routes per method, S = path segments
- Request overhead: ~5μs per request (Context allocation + route matching)
- Zero middleware chain — direct handler invocation

## License

MIT
