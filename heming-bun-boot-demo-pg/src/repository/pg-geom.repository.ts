import { Injectable, Inject } from "heming-bun-boot";
import {
  BaseRepository,
  CONNECTION_TOKEN,
  DIALECT_TOKEN,
} from "heming-bun-boot-db";
import type { Connection, DatabaseDialect } from "heming-bun-boot-db";
import {PgDemoFeaturesEntity} from "../entity/pg-demo-features.entity";

@Injectable()
export class PgDemoFeaturesEntityRepository extends BaseRepository<PgDemoFeaturesEntity> {
  constructor(
    @Inject(DIALECT_TOKEN) dialect: DatabaseDialect,
    @Inject(CONNECTION_TOKEN) connection: Connection,
  ) {
    super(PgDemoFeaturesEntity, dialect, connection);
  }
}
