import {Injectable} from "heming-bun-boot";
import {NotFoundException} from "heming-bun-boot-ext";
import {PgUserRepository} from "../repository";
import {PgUser} from "../entity";
import {PgDemoFeaturesEntityRepository} from "../repository/pg-geom.repository";
import {PgDemoFeaturesEntity} from "../entity/pg-demo-features.entity";

@Injectable()
export class PgUserService {
    constructor(private repo: PgUserRepository, private geomRepo: PgDemoFeaturesEntityRepository) {
    }

    async findAll(): Promise<PgUser[]> {
        return this.repo.selectList(
            // @ts-ignore
            this.repo.queryBuilder().orderByDesc("created_at"),
        );
    }

    async findById(id: number): Promise<PgUser> {
        const user = await this.repo.selectById(id);
        if (!user) throw new NotFoundException(`User ${id} not found`);
        return user;
    }

    async create(name: string, email: string): Promise<PgUser> {
        const user = new PgUser();
        user.name = name;
        user.email = email;
        await this.repo.insert(user);
        return user;
    }

    async update(id: number, name: string, email: string): Promise<PgUser> {
        const user = await this.findById(id);
        user.name = name;
        user.email = email;
        await this.repo.updateById(user);
        return user;
    }

    async delete(id: number): Promise<void> {
        const result = await this.repo.deleteById(id);
        if (result === 0) throw new NotFoundException(`User ${id} not found`);
    }

    async findAllGeom(): Promise<PgDemoFeaturesEntity[]> {
        return this.geomRepo.selectList(this.geomRepo.queryBuilder().orderByDesc("id"));
    }

    async testNativeSql() {
        // 1. queryRaw — 聚合查询
        const groupRows = await this.repo.queryRaw<{ name: string; cnt: number }>(
            `SELECT "name", COUNT(*)::int AS cnt FROM "pg_users" GROUP BY "name" ORDER BY cnt DESC`,
        );

        // 2. queryRawOne — 标量查询
        const statRow = await this.repo.queryRawOne<{ total: number; max_id: number }>(
            `SELECT COUNT(*)::int AS total, COALESCE(MAX("id"), 0)::int AS max_id FROM "pg_users"`,
        );

        // 3. executeRaw — 用原生 SQL 更新（示例：将所有 email 转小写）
        const execResult = await this.repo.executeRaw(
            `UPDATE "pg_users" SET "email" = LOWER("email") WHERE "email" != LOWER("email")`,
        );

        return {
            groupRows,
            stat: statRow,
            updatedRows: execResult.affectedRows,
        };
    }
}
