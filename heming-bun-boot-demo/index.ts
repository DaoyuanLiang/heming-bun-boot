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
} from "@heming/bun-boot";
import {
  ExtApplication,
  Result,
  JwtService,
  UseGuard,
  CurrentUser,
  JwtAuthGuard,
  NotFoundException,
  BadRequestException,
} from "@heming/bun-boot-ext";
import type { JwtPayload } from "@heming/bun-boot-ext";

// ─── Configuration ───────────────────────────────────────
@Configuration()
class AppConfig {
  @Value("PORT", 3000)
  port!: number;

  @Value("JWT_SECRET", "demo-secret-change-me")
  jwtSecret!: string;

  @Value("JWT_EXPIRES_IN", "2h")
  jwtExpiresIn!: string;
}

// ─── Service Layer ───────────────────────────────────────
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
    const user = this.users.find((u) => u.id === id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return { id: user.id, name: user.name, role: user.role };
  }

  validateCredentials(name: string) {
    return this.users.find((u) => u.name === name) || null;
  }
}

// ─── Controllers ─────────────────────────────────────────

@Controller("/auth")
class AuthController {
  constructor(
    @Inject() private jwtService: JwtService,
    @Inject() private userService: UserService
  ) {}

  @Post("/login")
  async login({ request }: Context) {
    const { name } = await request.json();
    if (!name) throw new BadRequestException("name is required");

    const user = this.userService.validateCredentials(name);
    if (!user) throw new BadRequestException("invalid user");

    const token = this.jwtService.sign({ sub: user.id, name: user.name, role: user.role });
    return Result.ok({ token, user: { id: user.id, name: user.name } }, "login success");
  }
}

@Controller("/users")
@UseGuard(JwtAuthGuard)
class UserController {
  constructor(@Inject() private userService: UserService) {}

  @Get()
  listUsers() {
    return Result.ok(this.userService.findAll());
  }

  @Get("/:id")
  getUser({ params }: Context) {
    return Result.ok(this.userService.findById(params.id));
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
      framework: "@heming/bun-boot + ext",
    });
  }
}

// ─── Bootstrap ───────────────────────────────────────────
ExtApplication.run({
  controllers: [RootController, AuthController, UserController],
  providers: [UserService],
  configurations: [AppConfig],
  static: { assets: "public", prefix: "/" },
}).then(()=>{
  console.log("Server started");
});
