import {
  pgTable,
  text,
  uuid,
  timestamp,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { users } from "./auth.js";

/** Multi-tenant organization — owns workflows, runs, and billing. */
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  // TODO(validation): Change plan to an enum or constrained type (e.g. 'free' | 'pro' | 'enterprise') to prevent invalid values.
  plan: text("plan").default("free"),
  ssoConfig: jsonb("sso_config"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// TODO(perf): Add index on user_id for reverse lookups (finding all orgs a user belongs to).
/** Maps users to organizations with a role. */
export const orgMembers = pgTable(
  "org_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").default("member"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [unique("org_members_org_user_unique").on(table.orgId, table.userId)],
);
