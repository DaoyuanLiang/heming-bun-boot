import "reflect-metadata";
import { describe, test, expect } from "bun:test";
import { EntityMetadataStorage } from "heming-bun-boot-db";
import { User, AuditLog } from "../src/entity";

describe("EntityMetadataStorage", () => {
  test("User entity — primary key detected correctly", () => {
    // Force-register to avoid stale state from other tests
    EntityMetadataStorage.clear();
    const meta = EntityMetadataStorage.getOrRegister(User);

    expect(meta.tableName).toBe("users");
    expect(meta.primaryKeys.length).toBe(1);
    expect(meta.primaryKeys[0].propertyKey).toBe("id");
    expect(meta.primaryKeys[0].columnName).toBe("id");
    expect(meta.primaryKeys[0].isPrimary).toBe(true);
    expect(meta.primaryKeys[0].isGenerated).toBe(true);
  });

  test("User entity — metadata structure", () => {
    EntityMetadataStorage.clear();
    const meta = EntityMetadataStorage.getOrRegister(User);

    expect(meta.columns.size).toBe(6); // id, name, password, role, createdAt, updatedAt
    expect(meta.schema).toBeUndefined();
    expect(meta.comment).toBe("User table");

    // Verify column types
    expect(meta.columns.get("id")?.databaseType).toContain("BIGINT");
    expect(meta.columns.get("name")?.nullable).toBe(false);
    expect(meta.columns.get("name")?.unique).toBe(true);
    expect(meta.columns.get("password")?.nullable).toBe(false);
  });

  test("User entity — requirePrimaryKey returns the PK", () => {
    EntityMetadataStorage.clear();
    const meta = EntityMetadataStorage.getOrRegister(User);
    const pk = EntityMetadataStorage.requirePrimaryKey(meta);
    expect(pk.propertyKey).toBe("id");
  });

  test("AuditLog entity — keyless table registers without error", () => {
    EntityMetadataStorage.clear();
    const meta = EntityMetadataStorage.getOrRegister(AuditLog);

    expect(meta.tableName).toBe("audit_logs");
    expect(meta.primaryKeys.length).toBe(0);
    expect(meta.columns.size).toBe(5); // operator, action, target, detail, createdAt
  });

  test("AuditLog entity — requirePrimaryKey throws descriptive error", () => {
    EntityMetadataStorage.clear();
    const meta = EntityMetadataStorage.getOrRegister(AuditLog);

    expect(() => EntityMetadataStorage.requirePrimaryKey(meta)).toThrow(
      /AuditLog.*no @Id column/,
    );
  });
});
