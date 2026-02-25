import {
  pgTable,
  text,
  uuid,
  timestamp,
  boolean,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";
import { users } from "./auth.js";
import { organizations } from "./organizations.js";
import { workflows } from "./workflows.js";

/**
 * Encrypted API keys and credentials.
 * Scoped to an org (workflowId = null) or a specific workflow.
 */
export const keys = pgTable(
  "keys",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    workflowId: text("workflow_id").references(() => workflows.id),
    name: text("name").notNull(),
    description: text("description"),
    provider: text("provider").notNull().default("custom"),
    keyType: text("key_type").notNull().default("api_key"),
    encryptedValue: text("encrypted_value").notNull(),
    iv: text("iv").notNull(),
    algorithm: text("algorithm").default("aes-256-gcm"),
    storageMode: text("storage_mode").default("cloud"),
    lastUsedAt: timestamp("last_used_at"),
    lastRotatedAt: timestamp("last_rotated_at"),
    expiresAt: timestamp("expires_at"),
    isRevoked: boolean("is_revoked").default(false),
    metadata: jsonb("metadata"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("keys_org_name_unique").on(table.orgId, table.name),
    unique("keys_org_workflow_name_unique").on(
      table.orgId,
      table.workflowId,
      table.name,
    ),
    index("keys_org_idx").on(table.orgId),
    index("keys_workflow_idx").on(table.workflowId),
  ],
);

/** Immutable log of key lifecycle events (create, rotate, revoke, access). */
export const keyAuditLog = pgTable(
  "key_audit_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    keyId: text("key_id")
      .notNull()
      .references(() => keys.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    performedBy: uuid("performed_by").references(() => users.id),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("key_audit_key_idx").on(table.keyId),
    index("key_audit_performer_idx").on(table.performedBy),
  ],
);
