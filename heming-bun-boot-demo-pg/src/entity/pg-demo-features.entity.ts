import {
  Table,
  Column,
  Id,
  GeneratedValue,
  GenerationType,
} from "heming-bun-boot-db";

@Table("demo_features", { comment: "PG user table" })
export class PgDemoFeaturesEntity {
  @Id
  @GeneratedValue(GenerationType.IDENTITY)
  @Column({ comment: "PK" })
  id!: number;

  @Column({ length: 50, nullable: true})
  name!: string;

  @Column({comment: "geom" })
  geom!: string;
}
