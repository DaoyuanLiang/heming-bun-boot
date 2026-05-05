import "reflect-metadata";
import {ExtApplication} from "heming-bun-boot-ext";
import {Configuration, Value} from "heming-bun-boot";
import {createDbHooks} from "heming-bun-boot-db";
import {PgUserController} from "./src/controller";
import {PgUserService} from "./src/service";
import {PgUserRepository} from "./src/repository";
import {PgUser} from "./src/entity";
import {PgDemoFeaturesEntity} from "./src/entity/pg-demo-features.entity";
import {PgDemoFeaturesEntityRepository} from "./src/repository/pg-geom.repository";

@Configuration()
class AppConfig {
    @Value("PORT", 3002)
    port!: number;
}

ExtApplication.run(
    {
        controllers: [PgUserController],
        providers: [PgUserService, PgUserRepository, PgDemoFeaturesEntityRepository],
        configurations: [AppConfig],
        static: {
            assets: 'public',
            prefix: '/'
        }
    },
    createDbHooks({
        entities: [PgUser, PgDemoFeaturesEntity]
    }),
).then(() => {
    console.log("=== PG User CRUD Demo Started ===");
    console.log("  GET    /api/users      — list all users");
    console.log("  GET    /api/users/:id  — get user by id");
    console.log("  POST   /api/users      — create user {name, email}");
    console.log("  PUT    /api/users/:id  — update user {name, email}");
    console.log("  DELETE /api/users/:id  — delete user");
});
