import { Controller, Post, Inject, Context } from "heming-bun-boot";
import { Result, JwtService, BadRequestException } from "heming-bun-boot-ext";
import { AuthService } from "../service";

@Controller("/auth")
export class AuthController {
  constructor(
    @Inject() private jwtService: JwtService,
    @Inject() private authService: AuthService,
  ) {}

  @Post("/login")
  async login({ request }: Context) {
    const { name, password } = await request.json();
    if (!name || !password) throw new BadRequestException("name and password are required");

    const user = await this.authService.login(name, password);
    if (!user) throw new BadRequestException("invalid credentials");

    const token = this.jwtService.sign({ sub: String(user.id), name: user.name, role: user.role });
    return Result.ok({ token, user: { id: user.id, name: user.name } }, "login success");
  }

  @Post("/register")
  async register({ request }: Context) {
    const { name, password, role } = await request.json();
    if (!name || !password) throw new BadRequestException("name and password are required");

    const user = await this.authService.register(name, password, role);
    return Result.ok({ id: user.id, name: user.name, role: user.role }, "register success");
  }
}
