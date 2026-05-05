import {
  Table,
  Column,
  Id,
  GeneratedValue,
  CreatedDate,
  UpdatedDate,
  GenerationType,
} from "heming-bun-boot-db";

@Table("users", { comment: "User table" })
export class User {
  @Id
  @GeneratedValue(GenerationType.IDENTITY)
  @Column({ comment: "PK" })
  id!: number;

  @Column({ length: 50, nullable: false, unique: true, comment: "Username" })
  name!: string;

  @Column({ length: 255, nullable: false, comment: "Password hash" })
  password!: string;

  @Column({ length: 50, nullable: false, comment: "Role" })
  role!: string;

  @CreatedDate
  @Column()
  createdAt!: Date;

  @UpdatedDate
  @Column()
  updatedAt!: Date;
}
