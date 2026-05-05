import { Controller, Get, Post, Inject, Context } from "heming-bun-boot";
import { Result, UseGuard, Public, CurrentUser, JwtAuthGuard, BadRequestException } from "heming-bun-boot-ext";
import type { JwtPayload } from "heming-bun-boot-ext";
import { PostService } from "../service";

@Controller("/posts")
@UseGuard(JwtAuthGuard)
export class PostController {
  constructor(@Inject() private postService: PostService) {}

  @Get()
  @Public()
  async listPosts() {
    const posts = await this.postService.findAll();
    return Result.ok(posts.map(p => ({
      id: p.id,
      title: p.title,
      authorName: p.authorName,
      createdAt: p.createdAt,
    })));
  }

  @Get("/:id")
  @Public()
  async getPost({ params }: Context) {
    const post = await this.postService.findById(Number(params.id));
    return Result.ok({
      id: post.id,
      title: post.title,
      content: post.content,
      authorName: post.authorName,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    });
  }

  @Post()
  async createPost({ request }: Context, @CurrentUser() user: JwtPayload) {
    const { title, content } = await request.json();
    if (!title || !content) throw new BadRequestException("title and content are required");

    const post = await this.postService.create(title, content, Number(user.sub), user.name);
    return Result.ok({
      id: post.id,
      title: post.title,
      content: post.content,
      authorName: post.authorName,
      createdAt: post.createdAt,
    }, "post created");
  }
}
