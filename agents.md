# Agents.md — Heming Bun Boot Reference for AI Coding Agents

> **Purpose:** This document is written for AI assistants (Claude, Copilot, Cursor, etc.) to quickly understand and use the `heming-bun-boot` framework. It is terse, example-driven, and organized by task.

## Architecture Overview

```
heming-bun-boot      — Core DI + HTTP (npm: ^0.1.1)
heming-bun-boot-ext  — Logging, JWT auth, Result envelope, exception filter
heming-bun-boot-db   — ORM: JPA-style decorators, MyBatis-Plus-style repository, DDL auto-gen
heming-bun-boot-demo — Reference blog application
```

**Request lifecycle:** Middleware chain → Auth guard (`JwtAuthGuard`) → Controller handler → `Result` wrapping → JSON response

## Bootstrapping

### Explicit mode (original)

```ts
import "reflect-metadata";
import { ExtApplication } from "heming-bun-boot-ext";
import { createDbHooks } from "heming-bun-boot-db";

ExtApplication.run(
  {
    controllers: [UserController, PostController],
    providers: [UserService, UserRepository],
    configurations: [AppConfig],
    static: { assets: "public", prefix: "/" },
  },
  createDbHooks({ entities: [User, Post] }),
);
```

### Declarative mode (auto-discovery)

Decorators automatically register classes. `AUTO_REGISTRY` collects them at import time.

```ts
import "reflect-metadata";
import { ExtApplication } from "heming-bun-boot-ext";
import { createDbHooks } from "heming-bun-boot-db";

// No explicit arrays — decorators handle registration
ExtApplication.run({ scan: ["src/controller", "src/service", "src/config"] }, createDbHooks({ entities: [User, Post] }));

// Or pure registry mode (no filesystem scan):
// ExtApplication.run(...);

// Explicit arrays still work and merge with discovered classes:
// ExtApplication.run(
//   { scan: ["src/controller"], providers: [CustomService], ... },
//   createDbHooks(...),
// );
```

Merge priority: `explicit > AUTO_REGISTRY > FS scan`. `AUTO_REGISTRY` is exported from `heming-bun-boot` for test cleanup: `AUTO_REGISTRY.controllers.clear()`.

## DI Tokens (from DB module)

| Token | Value | Provides |
|-------|-------|----------|
| `CONNECTION_TOKEN` | `"bun-db:connection"` | `Connection` instance |
| `DIALECT_TOKEN` | `"bun-db:dialect"` | `DatabaseDialect` instance |

## Core Decorators Quick Reference

### From `heming-bun-boot` (core)

| Decorator | Target | Purpose |
|-----------|--------|---------|
| `@Controller("/path")` | Class | Route prefix |
| `@Get("/path")` / `@Post()` / `@Put()` / `@Delete()` | Method | HTTP method + path |
| `@Injectable()` | Class | Register in DI container |
| `@Inject(token?)` | Constructor param | DI injection |
| `@Configuration()` | Class | Config class, auto-scans `@Value` |
| `@Value("KEY", default)` | Property | Env var injection |

### From `heming-bun-boot-ext`

| Decorator | Target | Purpose |
|-----------|--------|---------|
| `@UseGuard(GuardClass)` | **Class only** | Apply auth guard to all routes |
| `@Public()` | Method | Exempt route from guard |
| `@CurrentUser()` | Parameter | Inject JWT payload (`ctx.user`) |
| `@Log(options?)` | Method | Auto-log method calls |

### From `heming-bun-boot-db`

| Decorator | Target | Purpose |
|-----------|--------|---------|
| `@Table("name", opts?)` | Class | Map entity to table |
| `@Column(opts?)` | Property | Map to DB column |
| `@Id` / `@Id()` | Property | Primary key |
| `@GeneratedValue(strategy)` | Property | PK generation: `IDENTITY`, `UUID`, `AUTO` |
| `@Version` / `@Version()` | Property | Optimistic lock version |
| `@CreatedDate` / `@CreatedDate()` | Property | Auto-set on insert |
| `@UpdatedDate` / `@UpdatedDate()` | Property | Auto-set on insert + update |
| `@Transient` / `@Transient()` | Property | Exclude from persistence |
| `@Enumerated(EnumType)` | Property | Enum storage: `STRING` or `ORDINAL` |

## Entity Definition

```ts
@Table("posts", { comment: "Blog posts" })
export class Post {
  @Id
  @GeneratedValue(GenerationType.IDENTITY)
  @Column({ comment: "PK" })
  id!: number;

  @Column({ length: 200, nullable: false, comment: "Title" })
  title!: string;

  @Column({ type: "TEXT", nullable: false, comment: "Body" })
  content!: string;

  @Column()
  authorId!: number;

  @CreatedDate
  @Column()
  createdAt!: Date;

  @UpdatedDate
  @Column()
  updatedAt!: Date;
}
```

### Type Mapping

| TS Type | DB Type | Customizable |
|---------|---------|--------------|
| `string` | `VARCHAR(255)` | `@Column({ type: "TEXT" })` or `@Column({ length: 50 })` |
| `number` | `BIGINT` | `@Column({ type: "INT" })` |
| `boolean` | `TINYINT(1)` | `@Column({ length: 4 })` |
| `Date` | `DATETIME(3)` | — |
| `bigint` | `BIGINT` | — |
| `object` | `JSON` | — |
| `Buffer` | `BLOB` | — |

> **Important:** Property names are auto-converted `camelCase` → `snake_case` for column names. `authorId` → `author_id`, `createdAt` → `created_at`. Use **snake_case column names** in `QueryWrapper` calls.

## Keyless Tables

Tables without `@Id` are supported. Non-PK operations (`insert`, `selectList`, `selectCount`, `selectPage`, `update` by condition, `delete` by condition) work normally. PK-dependent methods (`deleteById`, `updateById`, `selectById`, `selectBatchIds`) throw: `"Entity X has no @Id column defined. Operations requiring a primary key (deleteById, updateById, selectById, selectBatchIds) are not supported on keyless entities."`

## Repository Pattern

```ts
@Injectable()
export class PostRepository extends BaseRepository<Post> {
  constructor(
    @Inject(DIALECT_TOKEN) dialect: DatabaseDialect,
    @Inject(CONNECTION_TOKEN) connection: Connection,
  ) {
    super(Post, dialect, connection);
  }

  async findAll(): Promise<Post[]> {
    // @ts-ignore — column names are snake_case in DB
    return this.selectList(this.queryBuilder().orderByDesc("created_at"));
  }

  async findByAuthor(authorId: number): Promise<Post[]> {
    // @ts-ignore
    return this.selectList(
      this.queryBuilder().eq("author_id", authorId).orderByDesc("created_at"),
    );
  }

  async searchByTitle(keyword: string): Promise<Post[]> {
    // @ts-ignore
    return this.selectList(this.queryBuilder().like("title", keyword));
  }
}
```

### BaseRepository Methods (All Async)

| Category | Methods |
|----------|---------|
| **Insert** | `insert(entity)`, `insertBatch(entities, batchSize?)` |
| **Update** | `updateById(entity)`, `updateBatchById(entities)`, `update(partial, query)` |
| **Delete** | `deleteById(id)`, `deleteBatchIds(ids)`, `delete(query)` |
| **Select** | `selectById(id)`, `selectBatchIds(ids)`, `selectOne(query)`, `selectList(query)`, `selectCount(query)`, `selectPage(page, query)`, `exists(query)` |

- `insert()` auto-fills `@CreatedDate` / `@UpdatedDate`, sets `@GeneratedValue` fields from `insertId`
- `updateById()` auto-fills `@UpdatedDate`, implements optimistic locking if `@Version` column exists

### QueryWrapper — Fluent Builder

```ts
this.repo.queryBuilder()
  .eq("name", "Alice")              // =
  .ne("status", "deleted")          // !=
  .gt("age", 18)                    // >
  .ge("score", 60)                  // >=
  .lt("price", 100)                 // <
  .le("stock", 50)                  // <=
  .between("created_at", d1, d2)    // BETWEEN
  .like("title", "hello")           // LIKE '%hello%'
  .likeLeft("email", "@gmail.com")  // LIKE '%@gmail.com'
  .likeRight("name", "Dr.")         // LIKE 'Dr.%'
  .in("role", ["admin", "editor"])  // IN (...)
  .isNull("deleted_at")             // IS NULL
  .or()                             // next condition is OR
  .and(qb => qb.eq("a", 1).eq("b", 2)) // nested AND
  .orderByDesc("created_at")        // ORDER BY
  .orderByAsc("name")
  .groupBy("category")              // GROUP BY
  .having("COUNT(*) > ?", 5)        // HAVING
  .select("id", "title")            // SELECT columns
  .limit(10).offset(0)              // pagination
```

## Auth & Guards

### `@UseGuard` — must be on the CLASS, not methods

```ts
// ✅ Correct
@UseGuard(JwtAuthGuard)
@Controller("/api/admin")
class AdminController {
  @Get("/dashboard")  // requires auth
  dashboard(@CurrentUser() user: JwtPayload) { ... }

  @Public()           // exempt
  @Get("/health")
  health() { ... }
}

// ❌ Wrong — @UseGuard is ClassDecorator, won't work on methods
class PostController {
  @UseGuard(JwtAuthGuard)  // does NOTHING
  @Post()
  createPost() { ... }
}
```

### JWT Authentication

```ts
// Login endpoint
@Post("/login")
async login({ request }: Context) {
  const { name, password } = await request.json();
  const user = await this.authService.login(name, password);  // Bun.password.verify()
  if (!user) throw new BadRequestException("invalid credentials");

  const token = this.jwtService.sign({ sub: String(user.id), name: user.name });
  return Result.ok({ token, user: { id: user.id, name: user.name } });
}

// Protected route — user injected from JWT
@Get("/me")
getProfile(@CurrentUser() user: JwtPayload) {
  // user = { sub: "1", name: "alice", iat: ..., exp: ... }
  return Result.ok({ id: user.sub, name: user.name });
}
```

- JWT secret: env `JWT_SECRET` (default `"change-me-in-production"`)
- JWT expiry: env `JWT_EXPIRES_IN` (default `"24h"`)
- Password hashing: `await Bun.password.hash(password)` / `await Bun.password.verify(password, hash)`

## Result Envelope

Every controller return value is wrapped in `Result`:

```json
{ "code": 0, "message": "success", "data": { ... }, "timestamp": 1714915200000 }
```

- **Success:** `code = 0` (NOT 200!)
- **Error:** `code = non-zero`, `data = null`

```ts
// Success
return Result.ok(data, "optional message");        // code=0
// Fail
throw new BadRequestException("field required");   // code=400, status 400
throw new NotFoundException("User 1 not found");   // code=404, status 404
throw new UnauthorizedException();                 // code=401, status 401
```

**Available exceptions:** `BadRequestException` (400), `UnauthorizedException` (401), `ForbiddenException` (403), `NotFoundException` (404), `ConflictException` (409), `InternalServerErrorException` (500).

## Config & Env

```ts
@Configuration()
class AppConfig {
  @Value("PORT", 3000)
  port!: number;

  @Value("JWT_SECRET", "change-me")
  jwtSecret!: string;
}
```

DB config is read from env by `createDbHooks`:
- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`
- `DB_POOL_SIZE` (default: 10)
- `DB_DDL_AUTO`: `"create"` | `"update"` | `"create-drop"` | `"validate"` | `"none"`

## DDL Auto-Generation

```ts
createDbHooks({ entities: [User, Post] })
// Reads DB_DDL_AUTO from env (default: "none")
// "update" — creates missing tables, ALTER TABLE for new columns
// "create" — CREATE TABLE IF NOT EXISTS
// "validate" — checks schema, throws on mismatch
```

## Directory Convention (Enterprise)

```
src/
  entity/          — @Table classes
    user.entity.ts
    post.entity.ts
    index.ts       — barrel export
  repository/      — extends BaseRepository
    user.repository.ts
    index.ts
  service/         — business logic
    auth.service.ts
    index.ts
  controller/      — @Controller classes
    user.controller.ts
    index.ts
  config/          — @Configuration classes
    app.config.ts
index.ts           — bootstrap
public/            — static assets (HTML, CSS, JS)
```

## Frontend Fetch Pattern

```js
// Token stored in localStorage, sent as Bearer
fetch("/api/posts", {
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  },
}).then(r => r.json()).then(res => {
  if (res.code === 0) {  // Success code is 0, NOT 200
    // res.data = payload
  } else {
    // res.message = error message
  }
});
```

## Common Pitfalls

1. **`res.code === 0`** for success, not `200`
2. **`@UseGuard` is ClassDecorator** — apply to class, not method
3. **Column names are snake_case** in QueryWrapper calls — `"created_at"` not `"createdAt"`
4. **Always `import "reflect-metadata"`** at entry point
5. **Keys without `@Id` work** for insert/selectList, but PK-dependent ops throw
6. **`@Column()` is required** on every persistent property (even with `@Id`, `@CreatedDate`, etc.)
7. **`@CurrentUser()` parameter order matters** — it injects into the declared parameter index; the first parameter (`ctx`) is always position 0

## Packages

| Package | npm name / source | Purpose |
|---------|-------------------|---------|
| Core | `heming-bun-boot` | DI, HTTP routing, middleware |
| Ext | `heming-bun-boot-ext` | Logging, JWT, Result, exceptions |
| DB | `heming-bun-boot-db` | ORM decorators, repository, DDL |
| Demo | local only | Reference blog app |

## Development Workflow (Windows)

```bat
cd heming-bun-boot-demo
sync-deps.bat          # pack ext + db → tgz → install
bun run index.ts       # start dev server
```
