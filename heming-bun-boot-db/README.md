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
