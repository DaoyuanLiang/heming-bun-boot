import { Injectable } from "heming-bun-boot";
import { NotFoundException } from "heming-bun-boot-ext";
import { PostRepository } from "../repository";
import { Post } from "../entity";

@Injectable()
export class PostService {
  constructor(private postRepo: PostRepository) {}

  async findAll(): Promise<Post[]> {
    return this.postRepo.findAll();
  }

  async findById(id: number): Promise<Post> {
    const post = await this.postRepo.selectById(id);
    if (!post) throw new NotFoundException(`Post ${id} not found`);
    return post;
  }

  async create(title: string, content: string, authorId: number, authorName: string): Promise<Post> {
    const post = new Post();
    post.title = title;
    post.content = content;
    post.authorId = authorId;
    post.authorName = authorName;
    await this.postRepo.insert(post);
    return post;
  }
}
