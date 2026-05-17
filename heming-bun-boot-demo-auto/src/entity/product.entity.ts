import {
  Table, Column, Id, GeneratedValue,
  CreatedDate, UpdatedDate, GenerationType,
} from "heming-bun-boot-db";

@Table("products", { comment: "Product catalog" })
export class Product {
  @Id
  @GeneratedValue(GenerationType.IDENTITY)
  @Column({ comment: "PK" })
  id!: number;

  @Column({ length: 100, nullable: false, comment: "Product name" })
  name!: string;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: false, comment: "Unit price" })
  price!: number;

  @Column({ type: "int", nullable: false, comment: "Stock quantity" })
  stock!: number;

  @CreatedDate
  @Column()
  createdAt!: Date;

  @UpdatedDate
  @Column()
  updatedAt!: Date;
}
