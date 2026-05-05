import { Injectable, Inject } from "heming-bun-boot";
import {
  BaseRepository,
  CONNECTION_TOKEN,
  DIALECT_TOKEN,
} from "heming-bun-boot-db";
import type { Connection, DatabaseDialect } from "heming-bun-boot-db";
import { PgUser } from "../entity";

@Injectable()
export class PgUserRepository extends BaseRepository<PgUser> {
  constructor(
    @Inject(DIALECT_TOKEN) dialect: DatabaseDialect,
    @Inject(CONNECTION_TOKEN) connection: Connection,
  ) {
    super(PgUser, dialect, connection);
  }
}
