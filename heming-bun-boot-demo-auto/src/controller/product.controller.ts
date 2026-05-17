import { Controller, Get, Post, Put, Delete, Context } from "heming-bun-boot";
import { Result, BadRequestException } from "heming-bun-boot-ext";
import { ProductService } from "../service/product.service";

@Controller("/api/products", { deps: [ProductService] })
export class ProductController {
  constructor(private productService: ProductService) {}

  @Get()
  async list() {
    const products = await this.productService.findAll();
    return Result.ok(products);
  }

  @Get("/:id")
  async getById({ params }: Context) {
    const product = await this.productService.findById(Number(params.id));
    return Result.ok(product);
  }

  @Post()
  async create({ request }: Context) {
    const { name, price, stock } = await request.json();
    if (!name) throw new BadRequestException("name is required");
    if (price == null || price < 0) throw new BadRequestException("valid price is required");
    if (stock == null || stock < 0) throw new BadRequestException("valid stock is required");

    const product = await this.productService.create(name, Number(price), Number(stock));
    return Result.ok(product, "product created");
  }

  @Put("/:id")
  async update({ params, request }: Context) {
    const { name, price, stock } = await request.json();
    if (!name) throw new BadRequestException("name is required");

    const product = await this.productService.update(Number(params.id), name, Number(price), Number(stock));
    return Result.ok(product, "product updated");
  }

  @Delete("/:id")
  async remove({ params }: Context) {
    await this.productService.remove(Number(params.id));
    return Result.ok(null, "product deleted");
  }
}
