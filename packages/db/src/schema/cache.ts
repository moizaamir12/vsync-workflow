import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  jsonb,
  primaryKey,
} from "drizzle-orm/pg-core";

/** Ephemeral key-value cache scoped per organization. */
export const cache = pgTable(
  "cache",
  {
    key: text("key").notNull(),
    // TODO(schema): Add foreign key reference to organizations.id for data integrity.
    orgId: uuid("org_id").notNull(),
    value: jsonb("value").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    accessedAt: timestamp("accessed_at").defaultNow(),
    accessCount: integer("access_count").default(0),
  },
  (table) => [
    primaryKey({
      name: "cache_pk",
      columns: [table.key, table.orgId],
    }),
  ],
);
// TODO(schema): This schema differs from setup.ts (which has no org_id, accessed_at, or access_count columns). Reconcile.
