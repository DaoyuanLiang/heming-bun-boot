import "reflect-metadata";
import {
  Controller,
  Get,
  Post,
  Injectable,
  Inject,
  Configuration,
  Value,
  Context,
} from "heming-bun-boot";
import {
  ExtApplication,
  Result,
  JwtService,
  UseGuard,
  CurrentUser,
  JwtAuthGuard,
  NotFoundException,
  BadRequestException,
} from "heming-bun-boot-ext";
import type { JwtPayload } from "heming-bun-boot-ext";
import {
  Table,
  Column,
  Id,
  GeneratedValue,
  CreatedDate,
  UpdatedDate,
  GenerationType,
  BaseRepository,
  createDbHooks,
  CONNECTION_TOKEN,
  DIALECT_TOKEN,
} from "heming-bun-boot-db";
import type { Connection, DatabaseDialect } from "heming-bun-boot-db";

// ─── Entity ────────────────────────────────────────────────
@Table("users", { comment: "用户表" })
class User {
  @Id
  @GeneratedValue(GenerationType.IDENTITY)
  @Column({ comment: "主键" })
  id!: number;

  @Column({ length: 50, nullable: false, unique: true, comment: "用户名" })
  name!: string;

  @Column({ length: 255, nullable: false, comment: "密码" })
  password!: string;

  @Column({ length: 50, nullable: false, comment: "角色" })
  role!: string;

  @CreatedDate
  @Column()
  createdAt!: Date;

  @UpdatedDate
  @Column()
  updatedAt!: Date;
}

// ─── Repository ────────────────────────────────────────────
@Injectable()
class UserRepository extends BaseRepository<User> {
  constructor(
    @Inject(DIALECT_TOKEN) dialect: DatabaseDialect,
    @Inject(CONNECTION_TOKEN) connection: Connection,
  ) {
    super(User, dialect, connection);
  }

  async findByName(name: string): Promise<User | null> {
    return this.selectOne(this.queryBuilder().eq("name", name));
  }
}

// ─── Configuration ─────────────────────────────────────────
@Configuration()
class AppConfig {
  @Value("PORT", 3000)
  port!: number;

  @Value("JWT_SECRET", "demo-secret-change-me")
  jwtSecret!: string;

  @Value("JWT_EXPIRES_IN", "2h")
  jwtExpiresIn!: string;
}

// ─── Service Layer ─────────────────────────────────────────
@Injectable()
class UserService {
  constructor(private repo: UserRepository) {}

  async findAll(): Promise<User[]> {
    return this.repo.selectList(this.repo.queryBuilder().orderByDesc("createdAt"));
  }

  async findById(id: number): Promise<User> {
    const user = await this.repo.selectById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async validateCredentials(name: string, password: string): Promise<User | null> {
    const user = await this.repo.findByName(name);
    if (!user || user.password !== password) return null;
    return user;
  }

  async create(name: string, password: string, role: string = "user"): Promise<User> {
    const user = new User();
    user.name = name;
    user.password = password;
    user.role = role;
    await this.repo.insert(user);
    return user;
  }
}

// ─── Controllers ───────────────────────────────────────────

@Controller("/auth")
class AuthController {
  constructor(
    @Inject() private jwtService: JwtService,
    @Inject() private userService: UserService,
  ) {}

  @Post("/login")
  async login({ request }: Context) {
    const { name, password } = await request.json();
    if (!name || !password) throw new BadRequestException("name and password are required");

    const user = await this.userService.validateCredentials(name, password);
    if (!user) throw new BadRequestException("invalid credentials");

    const token = this.jwtService.sign({ sub: String(user.id), name: user.name, role: user.role });
    return Result.ok({ token, user: { id: user.id, name: user.name } }, "login success");
  }

  @Post("/register")
  async register({ request }: Context) {
    const { name, password, role } = await request.json();
    if (!name || !password) throw new BadRequestException("name and password are required");

    const user = await this.userService.create(name, password, role);
    return Result.ok({ id: user.id, name: user.name, role: user.role }, "register success");
  }
}

@Controller("/users")
@UseGuard(JwtAuthGuard)
class UserController {
  constructor(@Inject() private userService: UserService) {}

  @Get()
  async listUsers() {
    const users = await this.userService.findAll();
    return Result.ok(users.map(u => ({ id: u.id, name: u.name, role: u.role, createdAt: u.createdAt })));
  }

  @Get("/:id")
  async getUser({ params }: Context) {
    const user = await this.userService.findById(Number(params.id));
    return Result.ok({ id: user.id, name: user.name, role: user.role, createdAt: user.createdAt });
  }

  @Get("/me")
  getProfile(@CurrentUser() user: JwtPayload) {
    return Result.ok({
      id: user.sub,
      name: user.name,
      role: user.role,
    });
  }
}

// Root health check
@Controller("/")
class RootController {
  @Get()
  health() {
    return Result.ok({
      status: "ok",
      uptime: Bun.nanoseconds(),
      framework: "heming-bun-boot + ext + db",
    });
  }
}

// ─── Bootstrap ─────────────────────────────────────────────
ExtApplication.run(
  {
    controllers: [RootController, AuthController, UserController],
    providers: [UserService, UserRepository],
    configurations: [AppConfig],
    static: { assets: "public", prefix: "/" },
  },
  createDbHooks({ entities: [User] }),
).then(() => {
  console.log("Server started");
  console.log("  POST /auth/register  — create user { name, password, role? }");
  console.log("  POST /auth/login     — login { name, password } → JWT token");
  console.log("  GET  /users          — list all users (auth required)");
});
