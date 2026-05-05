import {
  Table,
  Column,
  Id,
  GeneratedValue,
  CreatedDate,
  UpdatedDate,
  GenerationType,
} from "heming-bun-boot-db";

@Table("posts", { comment: "Blog posts" })
export class Post {
  @Id
  @GeneratedValue(GenerationType.IDENTITY)
  @Column({ comment: "PK" })
  id!: number;

  @Column({ length: 200, nullable: false, comment: "Title" })
  title!: string;

  @Column({ type: "TEXT", nullable: false, comment: "Content" })
  content!: string;

  @Column({ comment: "Author ID" })
  authorId!: number;

  @Column({ length: 50, comment: "Author name" })
  authorName!: string;

  @CreatedDate
  @Column()
  createdAt!: Date;

  @UpdatedDate
  @Column()
  updatedAt!: Date;
}
