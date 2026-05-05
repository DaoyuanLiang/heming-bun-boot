# heming-bun-boot-db

Database ORM module for `heming-bun-boot` — JPA-style decorators, MyBatis-Plus-style repository, and DDL auto-generation for MySQL and PostgreSQL.

## Features

- **JPA-Style Decorators** — `@Table`, `@Column`, `@Id`, `@GeneratedValue`, `@Version`, `@CreatedDate`, `@UpdatedDate`, `@Transient`, `@Enumerated`
- **MyBatis-Plus-Style Repository** — `BaseRepository<T>` with fluent `QueryWrapper<T>` (20+ query operators)
- **Auto DDL** — `CREATE TABLE`, `ALTER TABLE` from entity metadata (create / update / validate / none)
- **Optimistic Locking** — `@Version` column, stale-update detection
- **Keyless Tables** — entities without `@Id` supported for append-only / log tables
- **Type Inference** — `design:type` metadata → database column type (e.g., `number` → `BIGINT`, `string` → `VARCHAR(255)`)
- **Snake Case Auto-Mapping** — `camelCase` property names → `snake_case` column names
- **PostGIS Geometry Support** — Automatic WKB → GeoJSON parsing for `geometry` / `geography` columns (PostgreSQL), with typed `Geometry` exports
- **Zero config** — reads `DB_HOST`, `DB_PORT`, etc. from `.env` automatically

## Installation

MySQL:

```bash
bun add mysql2 reflect-metadata
```

PostgreSQL:

```bash
bun add pg reflect-metadata
```

The DB module is used as a local dependency alongside `heming-bun-boot-ext`.

## Quick Start

```ts
import "reflect-metadata";
import { ExtApplication } from "heming-bun-boot-ext";
import {
  Table, Column, Id, GeneratedValue, GenerationType,
  CreatedDate, UpdatedDate,
  BaseRepository, createDbHooks,
  CONNECTION_TOKEN, DIALECT_TOKEN,
} from "heming-bun-boot-db";
import type { Connection, DatabaseDialect } from "heming-bun-boot-db";

// 1. Define entity
@Table("users", { comment: "User table" })
class User {
  @Id
  @GeneratedValue(GenerationType.IDENTITY)
  @Column({ comment: "PK" })
  id!: number;

  @Column({ length: 50, nullable: false, unique: true })
  name!: string;

  @Column({ length: 255, nullable: false })
  password!: string;

  @CreatedDate
  @Column()
  createdAt!: Date;

  @UpdatedDate
  @Column()
  updatedAt!: Date;
}

// 2. Repository
@Injectable()
class UserRepository extends BaseRepository<User> {
  constructor(
    @Inject(DIALECT_TOKEN) dialect: DatabaseDialect,
    @Inject(CONNECTION_TOKEN) connection: Connection,
  ) {
    super(User, dialect, connection);
  }

  async findByName(name: string): Promise<User | null> {
    // @ts-ignore — column name is snake_case in DB
    return this.selectOne(this.queryBuilder().eq("name", name));
  }
}

// 3. Bootstrap
ExtApplication.run(appOptions, createDbHooks({ entities: [User] }));
```

`.env` (MySQL):

```env
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=123456
DB_DATABASE=test
DB_DDL_AUTO=update
DB_SHOW_SQL=true   # 开启 SQL 日志（默认 false）
```

`.env` (PostgreSQL):

```env
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=123456
DB_DATABASE=test
DB_DDL_AUTO=update
DB_SHOW_SQL=true   # 开启 SQL 日志（默认 false）
```

> **Dialect selection**: Set `DB_TYPE=postgres` (or `pg` / `postgresql`) to use PostgreSQL. Defaults to `mysql`.

## Entity Decorators

| Decorator | Target | Description |
|-----------|--------|-------------|
| `@Table(name, opts?)` | Class | Map class to table. Options: `schema`, `comment`, `engine`, `charset` |
| `@Column(opts?)` | Property | Map property to column. Options: `name`, `type`, `length`, `precision`, `scale`, `nullable`, `unique`, `default`, `comment`, `insertable`, `updatable` |
| `@Id` / `@Id()` | Property | Primary key (supports composite keys) |
| `@GeneratedValue(strategy)` | Property | PK generation: `AUTO`, `IDENTITY`, `UUID` |
| `@Version` / `@Version()` | Property | Optimistic lock — auto-incremented on update |
| `@CreatedDate` / `@CreatedDate()` | Property | Auto-set to `new Date()` on insert |
| `@UpdatedDate` / `@UpdatedDate()` | Property | Auto-set to `new Date()` on insert and update |
| `@Transient` / `@Transient()` | Property | Exclude from persistence |
| `@Enumerated(type)` | Property | Enum storage: `EnumType.STRING` or `EnumType.ORDINAL` |

## PostGIS 几何类型支持

当使用 PostgreSQL 方言时，框架会自动识别 PostGIS 的 `geometry` / `geography` 列，并将数据库返回的 WKB（Well-Known Binary）十六进制自动解析为 **GeoJSON** 对象。

### 自动解析

启动时框架会从 `pg_type` 查询 PostGIS geometry 类型的 OID，并注册对应的 `pg` 类型解析器。SELECT 查询中的 `geometry` 列会直接返回 GeoJSON：

```json
{
  "type": "Point",
  "coordinates": [117.985, 24.526],
  "crs": { "type": "name", "properties": { "name": "EPSG:4326" } }
}
```

### 实体定义

```ts
import type { Geometry } from "heming-bun-boot-db";

@Table("demo_features")
export class PgDemoFeaturesEntity {
  @Id
  @GeneratedValue(GenerationType.IDENTITY)
  @Column({ comment: "PK" })
  id!: number;

  @Column({ length: 50, nullable: true })
  name!: string;

  // geometry 列 — 使用 @Column({ type: "geometry(...)" })
  @Column({ type: "geometry(point, 4326)", nullable: true, comment: "坐标点" })
  geom!: Geometry;
}
```

### 支持的几何类型

| 类型常量 | GeoJSON type | coordinates 结构 |
|---------|-------------|------------------|
| `Point` | `"Point"` | `[number, number]` |
| `LineString` | `"LineString"` | `[number, number][]` |
| `Polygon` | `"Polygon"` | `[number, number][][]` |
| `MultiPoint` | `"MultiPoint"` | `[number, number][]` |
| `MultiLineString` | `"MultiLineString"` | `[number, number][][]` |
| `MultiPolygon` | `"MultiPolygon"` | `[number, number][][][]` |
| `GeometryCollection` | `"GeometryCollection"` | `{ geometries: Geometry[] }` |

所有类型都包含可选的 `crs?: GeoJsonCrs` 字段，携带 SRID 信息（如 `EPSG:4326`）。

### 使用示例

```ts
import type { Point } from "heming-bun-boot-db";

const features = await repo.selectList(
  repo.queryBuilder().orderByDesc("id")
);

// 类型安全地使用几何数据
for (const f of features) {
  if (f.geom && f.geom.type === "Point") {
    const [lng, lat] = f.geom.coordinates;
    console.log(`坐标: (${lng}, ${lat})`);
  }
}
```

### GeoJSON 类型导出

```ts
import type {
  Geometry,           // 联合类型
  Point,
  MultiPoint,
  LineString,
  MultiLineString,
  Polygon,
  MultiPolygon,
  GeometryCollection,
  Position,           // number[]
  GeoJsonCrs,         // { type, properties }
} from "heming-bun-boot-db";
```

> **无需引入第三方库** — WKB 解析器是框架内置的，零依赖。未安装 PostGIS 时几何列仍然可以正常 SELECT，只是返回十六进制 WKB 字符串。

## Default Type Mapping

| TypeScript type | Database type |
|-----------------|---------------|
| `string` | `VARCHAR(255)` |
| `number` | `BIGINT` |
| `boolean` | `TINYINT(1)` |
| `Date` | `DATETIME(3)` |
| `bigint` | `BIGINT` |
| `object` | `JSON` |
| `Buffer` | `BLOB` |

Override with `@Column({ type: "TEXT" })` or `@Column({ length: 100 })`.

## BaseRepository<T>

Extend `BaseRepository<T>` for full CRUD:

| Category | Methods |
|----------|---------|
| Insert | `insert(entity)`, `insertBatch(entities, batchSize?)` |
| Update | `updateById(entity)`, `updateBatchById(entities)`, `update(partial, query)` |
| Delete | `deleteById(id)`, `deleteBatchIds(ids)`, `delete(query)` |
| Select | `selectById(id)`, `selectBatchIds(ids)`, `selectOne(query)`, `selectList(query)`, `selectCount(query)`, `selectPage(page, query)`, `exists(query)` |
| Native SQL | `queryRaw<T>(sql, params?)`, `queryRawOne<T>(sql, params?)`, `executeRaw(sql, params?)`, `getConnection()` |

- `insert()` auto-fills `@CreatedDate` / `@UpdatedDate`, sets `@GeneratedValue` fields from `insertId`
- `updateById()` auto-fills `@UpdatedDate`, implements optimistic locking with `@Version`
- `deleteById`, `updateById`, `selectById`, `selectBatchIds` require a primary key

## QueryWrapper<T>

Fluent query builder (all methods return `this` for chaining):

```ts
repo.queryBuilder()
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
  .orderByDesc("created_at")        // ORDER BY ... DESC
  .orderByAsc("name")
  .groupBy("category")              // GROUP BY
  .having("COUNT(*) > ?", 5)        // HAVING
  .select("id", "title")            // SELECT columns
  .limit(10).offset(0)              // pagination
```

> **Important:** Column names in `QueryWrapper` calls are **snake_case** (database names), not camelCase property names. Use `"created_at"` not `"createdAt"`.

## Native SQL（原生查询）

对于复杂查询、窗口函数、CTE、存储过程、地理空间函数等场景，`BaseRepository` 直接暴露底层 `Connection` 的能力：

```ts
// SELECT — 返回任意类型行
const rows = await repo.queryRaw<{ name: string; cnt: number }>(
  "SELECT name, COUNT(*) AS cnt FROM users GROUP BY name HAVING COUNT(*) > ?",
  [5],
);

// SELECT 单行
const row = await repo.queryRawOne<{ total: number }>(
  "SELECT COUNT(*) AS total FROM users",
);

// DML — INSERT / UPDATE / DELETE
const result = await repo.executeRaw(
  "DELETE FROM logs WHERE created_at < ?",
  [thirtyDaysAgo],
);
console.log(result.affectedRows); // 删除行数

// 完全原生访问 — 事务、驱动特性等
const conn = repo.getConnection();
await conn.beginTransaction();
try {
  await conn.execute("UPDATE accounts SET balance = balance - ? WHERE id = ?", [100, 1]);
  await conn.execute("UPDATE accounts SET balance = balance + ? WHERE id = ?", [100, 2]);
  await conn.commit();
} catch (e) {
  await conn.rollback();
  throw e;
}
```

> **参数占位符：** 始终使用 `?`，框架会自动转为 PostgreSQL 的 `$N`。不要手动写 `$1`, `$2`。

## Keyless Tables

Tables without `@Id` are supported. All non-PK operations work normally. PK-dependent methods (`deleteById`, `updateById`, `selectById`, `selectBatchIds`) throw a descriptive error.

## DDL Strategies

Set `DB_DDL_AUTO` in `.env`:

| Value | Behavior |
|-------|----------|
| `"none"` | No DDL (default) |
| `"create"` | `CREATE TABLE IF NOT EXISTS` for each entity |
| `"create-drop"` | Same as `create` (drop not auto-triggered) |
| `"update"` | Create missing tables, `ALTER TABLE` for new columns |
| `"validate"` | Check that tables and columns exist, throw on mismatch |

## DI Tokens

| Token | Provides |
|-------|----------|
| `DIALECT_TOKEN` (`"bun-db:dialect"`) | `DatabaseDialect` instance |
| `CONNECTION_TOKEN` (`"bun-db:connection"`) | `Connection` instance |

## License

MIT
