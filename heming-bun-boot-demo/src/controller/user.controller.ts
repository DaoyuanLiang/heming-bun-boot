import { Controller, Get, Inject, Context } from "heming-bun-boot";
import { Result, UseGuard, CurrentUser, JwtAuthGuard } from "heming-bun-boot-ext";
import type { JwtPayload } from "heming-bun-boot-ext";
import { UserService } from "../service";

@Controller("/users")
@UseGuard(JwtAuthGuard)
export class UserController {
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
