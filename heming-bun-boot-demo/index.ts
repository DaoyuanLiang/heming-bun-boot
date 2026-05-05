import "reflect-metadata";
import { ExtApplication } from "heming-bun-boot-ext";
import { createDbHooks } from "heming-bun-boot-db";
import { AppConfig } from "./src/config/app.config";
import { RootController, AuthController, UserController, PostController } from "./src/controller";
import { AuthService, PostService, UserService } from "./src/service";
import { UserRepository, PostRepository } from "./src/repository";
import { User, Post } from "./src/entity";

ExtApplication.run(
  {
    controllers: [RootController, AuthController, UserController, PostController],
    providers: [AuthService, PostService, UserService, UserRepository, PostRepository],
    configurations: [AppConfig],
    static: { assets: "public", prefix: "/" },
  },
  createDbHooks({ entities: [User, Post] }),
).then(() => {
  console.log("=== Blog Demo Started ===");
  console.log("  GET  /          — health check");
  console.log("  POST /auth/register — { name, password }");
  console.log("  POST /auth/login    — { name, password } → JWT");
  console.log("  GET  /posts         — list all posts");
  console.log("  GET  /posts/:id     — post detail");
  console.log("  POST /posts         — create post (auth req'd)");
  console.log("  GET  /users/me      — current user (auth req'd)");
});
