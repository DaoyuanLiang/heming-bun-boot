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
}
