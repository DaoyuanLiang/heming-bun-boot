import { Injectable } from "heming-bun-boot";
import { BadRequestException } from "heming-bun-boot-ext";
import { UserRepository } from "../repository";
import { User } from "../entity";

@Injectable()
export class AuthService {
  constructor(private userRepo: UserRepository) {}

  async register(name: string, password: string, role = "user"): Promise<User> {
    const existing = await this.userRepo.findByName(name);
    if (existing) throw new BadRequestException(`User "${name}" already exists`);

    const hashed = await Bun.password.hash(password);

    const user = new User();
    user.name = name;
    user.password = hashed;
    user.role = role;
    await this.userRepo.insert(user);
    return user;
  }

  async login(name: string, password: string): Promise<User | null> {
    const user = await this.userRepo.findByName(name);
    if (!user) return null;

    const valid = await Bun.password.verify(password, user.password);
    return valid ? user : null;
  }
}
