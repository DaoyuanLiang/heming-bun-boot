import {Controller, Get, Post, Put, Delete, Inject, Context} from "heming-bun-boot";
import {Result, BadRequestException} from "heming-bun-boot-ext";
import {PgUserService} from "../service";

@Controller("/api/users")
export class PgUserController {
    constructor(@Inject() private pgUserService: PgUserService) {
    }

    @Get()
    async listUsers() {
        const users = await this.pgUserService.findAll();
        return Result.ok(users);
    }

    @Get("/:id")
    async getUser({params}: Context) {
        const user = await this.pgUserService.findById(Number(params.id));
        return Result.ok(user);
    }

    @Post()
    async createUser({request}: Context) {
        const {name, email} = await request.json();
        if (!name || !email) throw new BadRequestException("name and email are required");

        const user = await this.pgUserService.create(name, email);
        return Result.ok(user, "user created");
    }

    @Put("/:id")
    async updateUser({params, request}: Context) {
        const {name, email} = await request.json();
        if (!name || !email) throw new BadRequestException("name and email are required");

        const user = await this.pgUserService.update(Number(params.id), name, email);
        return Result.ok(user, "user updated");
    }

    @Delete("/:id")
    async deleteUser({params}: Context) {
        await this.pgUserService.delete(Number(params.id));
        return Result.ok(null, "user deleted");
    }

    @Delete("/findAllGeom")
    async findAllGeom() {
        return Result.ok(await this.pgUserService.findAllGeom());
    }
}
