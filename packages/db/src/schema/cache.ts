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
    orgId: uuid("org_id").notNull(),
    value: jsonb("value").notNull(),
    expiresAt: timestamp("expires_at"),
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
