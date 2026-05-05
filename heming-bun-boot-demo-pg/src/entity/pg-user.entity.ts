import {
  Table,
  Column,
  Id,
  GeneratedValue,
  CreatedDate,
  UpdatedDate,
  GenerationType,
} from "heming-bun-boot-db";

@Table("pg_users", { comment: "PG user table" })
export class PgUser {
  @Id
  @GeneratedValue(GenerationType.IDENTITY)
  @Column({ comment: "PK" })
  id!: number;

  @Column({ length: 100, nullable: false, unique: true, comment: "Username" })
  name!: string;

  @Column({ length: 200, nullable: false, unique: true, comment: "Email" })
  email!: string;

  @CreatedDate
  @Column({ type: "TIMESTAMP", comment: "Created at" })
  createdAt!: Date;

  @UpdatedDate
  @Column({ type: "TIMESTAMP", comment: "Updated at" })
  updatedAt!: Date;
}
