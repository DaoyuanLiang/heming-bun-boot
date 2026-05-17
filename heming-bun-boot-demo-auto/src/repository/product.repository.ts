import { Injectable } from "heming-bun-boot";
import { BaseRepository, CONNECTION_TOKEN, DIALECT_TOKEN } from "heming-bun-boot-db";
import type { Connection, DatabaseDialect } from "heming-bun-boot-db";
import { Product } from "../entity/product.entity";

@Injectable({ deps: [DIALECT_TOKEN, CONNECTION_TOKEN] })
export class ProductRepository extends BaseRepository<Product> {
  constructor(
    dialect: DatabaseDialect,
    connection: Connection,
  ) {
    super(Product, dialect, connection);
  }
}
