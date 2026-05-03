# heming-bun-boot

> 性能接近原生 Bun，开发体验接近 Spring Boot。

[English](./README.md) | 中文文档

一个基于 **Bun + TypeScript + 装饰器** 的高性能 Web 框架，内置依赖注入，可选企业级扩展模块（日志、JWT 鉴权、统一响应格式）。

## 特性

### 核心模块 (`heming-bun-boot`)

- **注解式开发** — `@Controller`、`@Get`、`@Post`、`@Put`、`@Delete`、`@Patch`、`@Injectable`、`@Inject`、`@Configuration`、`@Value`
- **依赖注入** — 构造函数注入、单例/请求作用域、循环依赖检测
- **Express 风格中间件** — `(ctx, next) => Response` 链式调用，Koa 式组合
- **静态文件服务** — MIME 自动检测（40+ 类型），目录遍历防护，路由匹配优先
- **自动配置** — `.env` 文件加载、环境变量默认值与类型转换
- **高性能** — 基于 Map 的路由匹配（静态 O(1)，参数化快速比较），对 `Bun.serve()` 的薄封装
- **零重型依赖** — 仅依赖 `reflect-metadata`

### 扩展模块 (`heming-bun-boot-ext`)

- **统一响应** — 所有 API 响应使用 `Result<T>` 格式（`{ code, message, data, timestamp, traceId }`）
- **异常处理** — `HttpException` 家族（7 种异常），自动转换为 `Result.fail()`
- **日志系统** — Winston 日志，控制台彩色输出，生产环境按天切割，`@Log()` 方法装饰器
- **JWT 鉴权** — 签发/验证 token，`@UseGuard`/`@Public`/`@CurrentUser` 装饰器，Bearer token 提取
- **请求追踪** — 每个请求生成 `traceId`（UUID v4），`X-Trace-Id` 响应头

---

## 安装

### 仅核心模块

```bash
bun add heming-bun-boot reflect-metadata
```

### 含企业扩展

```bash
bun add heming-bun-boot-ext reflect-metadata
# heming-bun-boot 作为 peer dependency 自动包含
```

---

## 快速开始（仅核心）

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

// ── 配置 ──
@Configuration()
class AppConfig {
  @Value("PORT", 3000)
  port!: number;

  @Value("APP_NAME", "my-app")
  appName!: string;
}

// ── 服务层 ──
@Injectable()
class UserService {
  private users = [
    { id: "1", name: "Alice" },
    { id: "2", name: "Bob" },
  ];

  findAll() { return this.users; }
  findById(id: string) { return this.users.find(u => u.id === id); }
}

// ── 控制器 ──
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

// ── 健康检查 ──
@Controller("/")
class RootController {
  @Get()
  health() { return { status: "ok" }; }
}

// ── 启动 ──
Application.run({
  controllers: [RootController, UserController],
  providers: [UserService],
  configurations: [AppConfig],
  static: { assets: "public", prefix: "/" },   // 可选的静态文件服务
});
```

运行：

```bash
bun run index.ts
# → [bun-boot] Server running at http://localhost:3000
```

---

## 快速开始（含扩展）

```typescript
import "reflect-metadata";
import {
  Controller, Get, Post, Injectable, Inject,
  Configuration, Value, Context,
} from "heming-bun-boot";
import {
  ExtApplication,
  Result,
  JwtService,
  UseGuard,
  JwtAuthGuard,
  NotFoundException,
  BadRequestException,
} from "heming-bun-boot-ext";

// ── 配置 ──
@Configuration()
class AppConfig {
  @Value("PORT", 3000)
  port!: number;
}

// ── 服务层 ──
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
    if (!user) throw new NotFoundException(`用户 ${id} 不存在`);
    return user;
  }

  validateCredentials(name: string) {
    return this.users.find(u => u.name === name) || null;
  }
}

// ── 控制器 ──
@Controller("/auth")
class AuthController {
  constructor(
    @Inject() private jwtService: JwtService,
    @Inject() private userService: UserService,
  ) {}

  @Post("/login")
  async login({ request }: Context) {
    const { name } = await request.json();
    if (!name) throw new BadRequestException("用户名不能为空");

    const user = this.userService.validateCredentials(name);
    if (!user) throw new BadRequestException("用户不存在");

    const token = this.jwtService.sign({
      sub: user.id, name: user.name, role: user.role
    });
    return Result.ok({ token, user }, "登录成功");
  }
}

@Controller("/users")
@UseGuard(JwtAuthGuard)        // 所有接口需要鉴权
class UserController {
  constructor(@Inject() private userService: UserService) {}

  @Get()
  listUsers() { return Result.ok(this.userService.findAll()); }

  @Get("/:id")
  getUser({ params }: Context) {
    return Result.ok(this.userService.findById(params.id));
  }
}

// ── 启动 ──
ExtApplication.run({
  controllers: [AuthController, UserController],
  providers: [UserService],
  configurations: [AppConfig],
  static: { assets: "public", prefix: "/" },   // 可选的静态文件服务
});
```

**使用 Ext 后的效果：**

| 场景 | 响应 |
|------|------|
| `POST /auth/login` 有效用户名 | `{"code":0, "message":"登录成功", "data":{"token":"...", "user":{...}}, ...}` |
| `GET /users` 带 Bearer token | `{"code":0, "message":"success", "data":[{...}, {...}], ...}` |
| `GET /users` 无 token | `{"code":401, "message":"Unauthorized", "data":null, ...}` |
| `GET /users/999` 带 token | `{"code":404, "message":"用户 999 不存在", "data":null, ...}` |
| 未处理的异常 | `{"code":500, "message":"Internal Server Error", "data":null, ...}` |

每个响应都包含 `traceId` 和 `timestamp`。

**.env 文件**（可选）：

```env
PORT=3000
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
LOG_LEVEL=debug
```

---

## 装饰器参考

### HTTP 路由

| 装饰器 | 目标 | 说明 |
|--------|------|------|
| `@Controller(prefix?)` | 类 | 标记控制器，可选路由前缀 |
| `@Get(path?)` | 方法 | 映射 GET 请求 |
| `@Post(path?)` | 方法 | 映射 POST 请求 |
| `@Put(path?)` | 方法 | 映射 PUT 请求 |
| `@Delete(path?)` | 方法 | 映射 DELETE 请求 |
| `@Patch(path?)` | 方法 | 映射 PATCH 请求 |

路径参数使用 `:paramName` 语法：

```typescript
@Get("/:id")
getUser({ params }: Context) {
  // params.id → "42"（当请求 GET /users/42 时）
}
```

一个方法可以挂载多个 HTTP 装饰器：

```typescript
@Get("/:id")
@Post("/:id")
handleUser({ params, request }: Context) { ... }
```

### 依赖注入

| 装饰器 | 目标 | 说明 |
|--------|------|------|
| `@Injectable(scope?)` | 类 | 标记可注入类。作用域：`"singleton"`（默认）或 `"request"` |
| `@Inject(token?)` | 参数 | 指定注入令牌。不填则通过类型推断自动识别 |

```typescript
@Injectable()
class UserService { ... }

@Injectable("request")    // 每个请求创建新实例
class RequestLogger { ... }

@Controller("/users")
class UserController {
  constructor(
    @Inject() private userService: UserService,    // 令牌注入
    private requestLogger: RequestLogger,           // 类型推断
  ) {}
}
```

**作用域规则：**
- Singleton 为默认值，实例在应用生命周期内缓存复用
- Request 作用域每个 HTTP 请求创建新实例
- Singleton 不能依赖 Request 作用域（启动时检测并报错）

### 配置

| 装饰器 | 目标 | 说明 |
|--------|------|------|
| `@Configuration()` | 类 | 标记配置类 |
| `@Value(key, default?)` | 属性 | 绑定环境变量，可选默认值 |

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

值从 `process.env` 解析，自动类型转换（`Number`、`Boolean`、`String`）。优先级：**命令行环境变量 > .env 文件 > 默认值**。

---

## Context API

`Context` 对象会传递给每个路由处理器：

```typescript
class Context {
  request: Request               // Bun 原生 Request
  params: Record<string, string> // 路径参数 { id: "42" }
  query: URLSearchParams         // 查询参数
  route?: MatchResult            // 路由元数据（中间件可访问）

  status: number                 // 响应状态码（默认 200）
  setHeader(key, value): void    // 设置响应头
  json(data): Response           // 返回 JSON 响应
  text(data): Response           // 返回文本响应
}
```

### 处理器返回值

| 返回值类型 | 框架行为 |
|-----------|---------|
| `Response` | 直接透传 |
| `null` / `undefined` | `204 No Content` |
| 其他值 | `200 OK` + `application/json` |

在 Ext 模块中，非 `Response` 返回值会自动包装为 `Result.ok(data)`。

---

## 中间件

中间件遵循 Express/Koa 的设计模式：

```typescript
type Middleware = (
  ctx: Context,
  next: () => Promise<Response>
) => Promise<Response> | Response;
```

### 自定义中间件

```typescript
import { Application, type Middleware } from "heming-bun-boot";

// 计时中间件
const timingMiddleware: Middleware = async (ctx, next) => {
  const start = Date.now();
  const response = await next();
  const elapsed = Date.now() - start;
  console.log(`${ctx.request.method} ${ctx.request.url} → ${elapsed}ms`);
  return response;
};

// CORS 中间件
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

// 鉴权中间件（短路示例）
const authMiddleware: Middleware = async (ctx, next) => {
  const token = ctx.request.headers.get("authorization");
  if (!token) {
    return new Response(JSON.stringify({ error: "未授权" }), {
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

### 执行顺序

中间件按数组顺序执行，层层包裹：

```
请求 → mw[0] → mw[1] → mw[2] → 路由处理器 → 响应
      ←       ←       ←       ←
```

- 调用 `await next()` 将控制权传递给下一个中间件
- 直接返回 `Response` 可短路（跳过后续中间件和处理器）
- 抛出异常会沿链向上传播

---

## 扩展模块功能

### 统一响应格式

Ext 模块中所有响应遵循以下结构：

```typescript
class Result<T> {
  code: number;       // 0 = 成功，非零 = 错误
  message: string;    // 提示信息
  data: T | null;     // 数据负载
  timestamp: number;  // Unix 时间戳（毫秒）
  traceId?: string;   // 请求追踪 ID
}
```

**在处理器中使用：**

```typescript
// 成功
return Result.ok(userList);                              // { code:0, message:"success", data:[...] }
return Result.ok(user, "用户已找到");                      // { code:0, message:"用户已找到", data:{...} }
return Result.ok(null);                                  // { code:0, message:"success", data:null }

// 失败
throw new NotFoundException("用户 42 不存在");             // { code:404, message:"用户 42 不存在", data:null }
throw new BadRequestException("用户名不能为空");            // { code:400, message:"用户名不能为空", data:null }
throw new UnauthorizedException();                       // { code:401, message:"Unauthorized", data:null }
```

### 异常类型

| 异常类 | HTTP 状态码 |
|--------|------------|
| `BadRequestException` | 400 |
| `UnauthorizedException` | 401 |
| `ForbiddenException` | 403 |
| `NotFoundException` | 404 |
| `ConflictException` | 409 |
| `InternalServerErrorException` | 500 |

所有异常继承自 `HttpException`，由 `GlobalExceptionFilter` 自动捕获并转换为 `Result.fail()`。

### 日志系统

**LoggerService** — 基于 Winston，自动注册：

```typescript
import { LoggerService } from "heming-bun-boot-ext";

@Injectable()
class UserService {
  constructor(@Inject() private logger: LoggerService) {}

  findById(id: string) {
    this.logger.info("正在查找用户", { userId: id });
    // ...
    this.logger.warn("用户未找到", { userId: id });
    this.logger.error("数据库连接失败", { error: err.message });
  }
}
```

**日志级别：** `debug`、`info`、`warn`、`error`

**输出方式：**
- **开发环境**（`NODE_ENV !== "production"`）：彩色控制台输出
- **生产环境**：控制台 + 按天切割文件（`logs/app-YYYY-MM-DD.log`，保留 30 天）

**@Log() 方法装饰器：**

```typescript
import { Log } from "heming-bun-boot-ext";

class UserService {
  @Log()
  findById(id: string) {
    // 自动记录：→ findById { args: ["42"] }
    //           ← findById { result: {...} }
  }

  @Log({ level: "debug", message: "正在获取用户" })
  findByEmail(email: string) {
    // 以自定义消息和级别记录
  }
}
```

### JWT 鉴权

**JwtService** — 自动注册，从环境变量读取 `JWT_SECRET` 和 `JWT_EXPIRES_IN`：

```typescript
import { JwtService } from "heming-bun-boot-ext";

@Injectable()
class AuthService {
  constructor(@Inject() private jwtService: JwtService) {}

  login(user: User) {
    const token = this.jwtService.sign(
      { sub: user.id, name: user.name, role: user.role },
      { expiresIn: "2h" }  // 可选覆盖
    );
    return { token };
  }

  validate(token: string) {
    const payload = this.jwtService.verify(token);
    if (!payload) throw new UnauthorizedException("token 无效");
    return payload;
  }
}
```

**鉴权装饰器：**

| 装饰器 | 目标 | 说明 |
|--------|------|------|
| `@UseGuard(GuardClass)` | 类 | 对控制器所有路由启用鉴权 |
| `@Public()` | 方法 | 跳过鉴权（白名单） |
| `@CurrentUser()` | 参数 | 将 JWT 负载注入处理器参数 |

```typescript
import { UseGuard, Public, CurrentUser, JwtAuthGuard } from "heming-bun-boot-ext";
import type { JwtPayload } from "heming-bun-boot-ext";

@Controller("/users")
@UseGuard(JwtAuthGuard)         // 所有接口需要鉴权
class UserController {

  @Get()
  listUsers() { ... }           // 需要鉴权

  @Get("/me")
  getProfile(@CurrentUser() user: JwtPayload) {
    // user.sub、user.name、user.role 可用
    return Result.ok({ id: user.sub, name: user.name });
  }

  @Get("/public")
  @Public()                     // 此接口跳过鉴权
  publicData() { ... }
}
```

### 自定义鉴权守卫

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

// 使用：
@Controller("/admin")
@UseGuard(ApiKeyGuard)
class AdminController { ... }
```

---

## ExtApplication 中间件链

内置中间件的执行顺序：

```
请求
  → ExceptionFilter    （try/catch → 异常转 Result.fail）
    → RequestId        （生成 traceId，设置 X-Trace-Id 响应头）
      → Logger         （记录请求 → await next() → 记录响应）
        → AuthGuard    （检查 @UseGuard / @Public，验证 token）
          → 用户中间件   （通过 options.middlewares 传入的自定义中间件）
            → 路由处理器 + Result.ok 包装
```

通过 `options.middlewares` 传入的自定义中间件位于 Auth 之后、路由处理器之前。

---

## 配置系统

### .env 文件

在项目根目录放置 `.env` 文件：

```env
PORT=3000
APP_NAME=my-app
DEBUG=false
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
LOG_LEVEL=debug
```

- 由 `ConfigLoader.loadEnvFile()` 自动加载
- `process.env` 中已存在的值不会被覆盖（优先级更高）
- 以 `#` 开头的行视为注释
- 值两端的引号会自动去除

### 类型转换

```typescript
@Configuration()
class AppConfig {
  @Value("PORT", 3000)          // 环境变量 "3000" → 数字 3000
  port!: number;

  @Value("DEBUG", false)        // 环境变量 "true" → 布尔值 true
  debug!: boolean;

  @Value("APP_NAME", "my-app")  // 环境变量字符串 → 字符串
  appName!: string;
}
```

类型通过属性的 TypeScript 类型注解（`design:type` 元数据）自动推断。

---

## 应用启动选项

```typescript
// 核心模块
Application.run({
  controllers?: Function[];      // 控制器类
  providers?: Function[];        // 可注入服务
  configurations?: Function[];   // @Configuration 配置类
  middlewares?: Middleware[];    // 自定义中间件链
  static?: StaticOptions;        // 静态文件服务（如 { assets: "public", prefix: "/" }）
  port?: number;                 // 覆盖端口（最高优先级）
  hostname?: string;             // 默认 "0.0.0.0"
}, hooks?: ApplicationHooks);    // 扩展钩子（仅限库作者使用）

// 扩展模块
ExtApplication.run({
  // ... 同 Application.run 的选项
  // middlewares 追加在内置中间件链之后
});
```

### 端口解析

端口按以下优先级解析：

```
1. options.port         （代码中显式指定 — 最高优先级）
2. @Value("PORT")       （在 @Configuration 类上，从 .env 加载）
3. .env 文件             （PORT=3000，自动加载）
4. 3000                 （框架默认值）
```

### ApplicationHooks（库作者使用）

`hooks` 参数允许库作者在不修改核心代码的情况下注入框架级行为。`ExtApplication` 就是通过 6 个钩子完全委托给 `Application.run()` 实现的：

| 钩子 | 用途 |
|------|------|
| `builtinProviders` | 在用户类之前注册框架服务 |
| `onInit` | 容器构建和配置加载完成后连接服务 |
| `routeHandlerFactory` | 覆盖路由处理器（如 Result 包装 + @CurrentUser 注入） |
| `builtinMiddlewares` | 添加框架级中间件（在用户中间件之前执行） |
| `onNotFound` | 自定义 404 响应 |
| `onError` | 自定义未处理异常响应 |

终端用户应直接使用 `ExtApplication.run()` —— 钩子仅在构建自定义框架扩展时需要。

### 静态文件服务

提供静态资源服务，自动 MIME 检测（40+ 类型）和目录遍历防护：

```typescript
Application.run({
  controllers: [UserController],
  static: { assets: "public", prefix: "/" },
});
```

- **路由匹配优先** — 如果路由匹配成功，优先由路由处理
- **可配置前缀** — `prefix: "/static"` 将文件挂载在 `/static/*` 路径下
- **安全防护** — 解析路径经过规范化处理，确保不会越出资源目录

---

## 架构

```
┌──────────────────────────────────────────────────────────┐
│              Application.run(options, hooks)               │
├──────────────────────────────────────────────────────────┤
│  ModuleScanner    │  DIContainer   │  ConfigLoader        │
│  (自动扫描)        │  (IoC 容器)    │  (环境变量 → 配置)    │
├──────────────────────────────────────────────────────────┤
│                      中间件链                             │
│  (内置 → 用户中间件 → 路由处理器)                          │
├──────────────────────────────────────────────────────────┤
│                       路由器                              │
│  静态路由: Map<key, entry> — O(1)                         │
│  参数路由: 逐段比较 — O(R × S)                             │
├──────────────────────────────────────────────────────────┤
│                      静态文件                             │
│  路由未匹配时的回退（MIME 检测 + 目录遍历检查）             │
├──────────────────────────────────────────────────────────┤
│                      Bun.serve()                          │
│                   (原生 HTTP 服务器)                       │
└──────────────────────────────────────────────────────────┘
```

### 性能

- **静态路由查找：** O(1)，通过原生 `Map.get()`
- **参数化路由：** O(R × S)，R = 每个方法的参数化路由数，S = 路径段数（通常 < 6）
- **每请求开销：** ~5μs（Context 分配 + 路由匹配）
- **无中间件时零开销**（保留快速路径）
- **路由匹配不使用正则** — 纯字符串比较

---

## 本地开发

```bash
# 克隆并安装
cd heming-bun-boot-core
bun install

cd ../heming-bun-boot-ext
bun install

# 运行示例
cd ../heming-bun-boot-demo
bun install
bun run index.ts
```

### 使用 Ext 测试

```bash
# 启动示例服务
cd heming-bun-boot-demo
bun run index.ts

# 登录
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice"}'

# 访问受保护路由
curl http://localhost:3000/users \
  -H "Authorization: Bearer <token>"

# 测试未授权
curl http://localhost:3000/users
# → {"code":401,"message":"Unauthorized","data":null,...}

# 测试资源不存在
curl http://localhost:3000/users/999 \
  -H "Authorization: Bearer <token>"
# → {"code":404,"message":"用户 999 不存在","data":null,...}
```

---

## 项目结构

```
bun-project/
├── heming-bun-boot-core/              # heming-bun-boot
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                   # 公开 API
│       ├── application.ts             # Application.run()
│       ├── context.ts                 # Context 类
│       ├── middleware.ts              # 中间件类型 + compose 函数
│       ├── static.ts                 # 静态文件服务
│       ├── di/
│       │   ├── container.ts           # DI 容器
│       │   ├── injector.ts            # 请求作用域注入器
│       │   └── scope.ts               # Scope 枚举
│       ├── decorators/
│       │   ├── controller.ts          # @Controller
│       │   ├── http.ts                # @Get/@Post/...
│       │   ├── inject.ts              # @Injectable/@Inject
│       │   └── config.ts              # @Configuration/@Value
│       ├── router/
│       │   ├── router.ts              # Router
│       │   └── matcher.ts             # 路由匹配算法
│       ├── config/
│       │   └── config-loader.ts       # 环境变量/配置加载器
│       └── scanner/
│           └── module-scanner.ts      # 自动扫描
├── heming-bun-boot-ext/               # heming-bun-boot-ext
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                   # 公开 API
│       ├── application.ts             # ExtApplication.run()
│       ├── result/
│       │   ├── result.ts              # Result<T>
│       │   ├── exceptions.ts          # HttpException 家族
│       │   └── exception.filter.ts    # 全局异常过滤器
│       ├── logging/
│       │   ├── logger.service.ts      # Winston LoggerService
│       │   ├── logger.decorator.ts    # @Log() 装饰器
│       │   └── logger.middleware.ts   # 请求/响应日志中间件
│       ├── middleware/
│       │   └── request-id.ts          # traceId 中间件
│       └── auth/
│           ├── jwt.service.ts         # JwtService
│           ├── auth.guard.ts          # AuthGuard + JwtAuthGuard
│           └── auth.decorators.ts     # @UseGuard/@Public/@CurrentUser
└── heming-bun-boot-demo/              # 示例项目
    ├── package.json
    ├── .env
    └── index.ts
```

## 开源协议

MIT
