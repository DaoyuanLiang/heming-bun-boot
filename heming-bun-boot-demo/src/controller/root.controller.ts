import { Controller, Get } from "heming-bun-boot";
import { Result } from "heming-bun-boot-ext";

@Controller("/")
export class RootController {
  @Get()
  health() {
    return Result.ok({
      status: "ok",
      uptime: Bun.nanoseconds(),
      framework: "heming-bun-boot + ext + db",
    });
  }
}
