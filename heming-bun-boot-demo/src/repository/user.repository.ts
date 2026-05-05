import {
  Injectable,
  Inject,
} from "heming-bun-boot";
import {
  BaseRepository,
  CONNECTION_TOKEN,
  DIALECT_TOKEN,
} from "heming-bun-boot-db";
import type { Connection, DatabaseDialect } from "heming-bun-boot-db";
import { User } from "../entity";

@Injectable()
export class UserRepository extends BaseRepository<User> {
  constructor(
    @Inject(DIALECT_TOKEN) dialect: DatabaseDialect,
    @Inject(CONNECTION_TOKEN) connection: Connection,
  ) {
    super(User, dialect, connection);
  }

  async findByName(name: string): Promise<User | null> {
    return this.selectOne(this.queryBuilder().eq("name", name));
  }
}
