import { Injectable, Inject } from "heming-bun-boot";
import {
  BaseRepository,
  CONNECTION_TOKEN,
  DIALECT_TOKEN,
} from "heming-bun-boot-db";
import type { Connection, DatabaseDialect } from "heming-bun-boot-db";
import { Post } from "../entity";

@Injectable()
export class PostRepository extends BaseRepository<Post> {
  constructor(
    @Inject(DIALECT_TOKEN) dialect: DatabaseDialect,
    @Inject(CONNECTION_TOKEN) connection: Connection,
  ) {
    super(Post, dialect, connection);
  }

  async findAll(): Promise<Post[]> {
    // @ts-ignore — column name is snake_case in DB
    return this.selectList(this.queryBuilder().orderByDesc("created_at"));
  }

  async findByAuthorId(authorId: number): Promise<Post[]> {
    // @ts-ignore
    return this.selectList(this.queryBuilder().eq("author_id", authorId).orderByDesc("created_at"));
  }
}
