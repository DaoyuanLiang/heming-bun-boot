import { Injectable } from "heming-bun-boot";
import { NotFoundException } from "heming-bun-boot-ext";
import { UserRepository } from "../repository";
import { User } from "../entity";

@Injectable()
export class UserService {
  constructor(private repo: UserRepository) {}

  async findAll(): Promise<User[]> {
    // @ts-ignore
    return this.repo.selectList(this.repo.queryBuilder().orderByDesc("created_at"));
  }

  async findById(id: number): Promise<User> {
    const user = await this.repo.selectById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async findByName(name: string): Promise<User | null> {
    return this.repo.findByName(name);
  }

  async validateCredentials(name: string, password: string): Promise<User | null> {
    const user = await this.repo.findByName(name);
    if (!user || user.password !== password) return null;
    return user;
  }

  async create(name: string, password: string, role = "user"): Promise<User> {
    const user = new User();
    user.name = name;
    user.password = password;
    user.role = role;
    await this.repo.insert(user);
    return user;
  }
}
