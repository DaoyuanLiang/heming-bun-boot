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
import { AuditLog } from "../entity";

@Injectable()
export class AuditLogRepository extends BaseRepository<AuditLog> {
  constructor(
    @Inject(DIALECT_TOKEN) dialect: DatabaseDialect,
    @Inject(CONNECTION_TOKEN) connection: Connection,
  ) {
    super(AuditLog, dialect, connection);
  }

  async findByOperator(operator: string): Promise<AuditLog[]> {
    return this.selectList(
      this.queryBuilder().eq("operator", operator).orderByDesc("createdAt"),
    );
  }
}
