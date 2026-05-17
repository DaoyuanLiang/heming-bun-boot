import "reflect-metadata";

// ── Auto-discovered: no explicit arrays needed ──
// @Controller, @Injectable, @Configuration decorators register into AUTO_REGISTRY
import "./src/config/app.config";
import "./src/controller/product.controller";
import "./src/service/product.service";
import "./src/repository/product.repository";
import { Product } from "./src/entity/product.entity";

import { ExtApplication } from "heming-bun-boot-ext";
import { createDbHooks } from "heming-bun-boot-db";

// Pure registry mode — decorators handle all registration via AUTO_REGISTRY
// No controllers/providers/configurations arrays needed
ExtApplication.run(
  {
    static: { assets: "public", prefix: "/" },
  },
  createDbHooks({ entities: [Product] }),
);
