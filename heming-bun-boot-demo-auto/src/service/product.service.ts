import { Injectable } from "heming-bun-boot";
import { NotFoundException } from "heming-bun-boot-ext";
import { ProductRepository } from "../repository/product.repository";
import { Product } from "../entity/product.entity";

@Injectable({ deps: [ProductRepository] })
export class ProductService {
  constructor(private repo: ProductRepository) {}

  async findAll(): Promise<Product[]> {
    return this.repo.selectList(
      this.repo.queryBuilder().orderByDesc("created_at")
    );
  }

  async findById(id: number): Promise<Product> {
    const p = await this.repo.selectById(id);
    if (!p) throw new NotFoundException(`Product ${id} not found`);
    return p;
  }

  async create(name: string, price: number, stock: number): Promise<Product> {
    const p = new Product();
    p.name = name;
    p.price = price;
    p.stock = stock;
    await this.repo.insert(p);
    return p;
  }

  async update(id: number, name: string, price: number, stock: number): Promise<Product> {
    const p = await this.findById(id);
    p.name = name;
    p.price = price;
    p.stock = stock;
    await this.repo.updateById(p);
    return p;
  }

  async remove(id: number): Promise<void> {
    const p = await this.findById(id);
    await this.repo.deleteById(p.id);
  }
}
