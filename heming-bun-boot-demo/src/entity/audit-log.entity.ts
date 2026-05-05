import { Table, Column, CreatedDate } from "heming-bun-boot-db";

/**
 * Keyless entity — no @Id column.
 * Demonstrates that tables without primary keys are supported.
 * PK-dependent operations (deleteById, updateById, selectById, etc.)
 * will throw a descriptive error at runtime.
 */
@Table("audit_logs", { comment: "Audit log (keyless table)" })
export class AuditLog {
  @Column({ length: 100, nullable: false, comment: "Operator" })
  operator!: string;

  @Column({ length: 50, nullable: false, comment: "Action type" })
  action!: string;

  @Column({ length: 100, nullable: false, comment: "Target resource" })
  target!: string;

  @Column({ type: "JSON", comment: "Action detail" })
  detail!: object;

  @CreatedDate
  @Column()
  createdAt!: Date;
}
