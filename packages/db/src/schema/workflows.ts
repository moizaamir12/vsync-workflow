import {
  pgTable,
  text,
  uuid,
  timestamp,
  boolean,
  integer,
  jsonb,
  primaryKey,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";
import { users } from "./auth.js";
import { organizations } from "./organizations.js";

/** A reusable automation definition owned by an organization. */
export const workflows = pgTable("workflows", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description"),
  activeVersion: integer("active_version").default(0),
  isLocked: boolean("is_locked").default(false),
  lockedBy: text("locked_by"),
  isDisabled: boolean("is_disabled").default(false),
  isPublic: boolean("is_public").default(false),

  /* ── Public sharing fields ──────────────────────────────────── */

  /** URL-safe slug for public access (e.g. "my-cool-workflow-a3xk") */
  publicSlug: text("public_slug"),
  /** Access mode: "view" = read-only, "run" = anyone can trigger */
  publicAccessMode: text("public_access_mode").default("view"),
  /** Custom branding shown on the public page (title, description, accent colour) */
  publicBranding: jsonb("public_branding"),
  /** Per-slug rate limit: max runs per window (default 10/minute) */
  publicRateLimit: jsonb("public_rate_limit"),

  createdBy: uuid("created_by").references(() => users.id),
  updatedBy: uuid("updated_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
},
(table) => [
  unique("workflows_public_slug_unique").on(table.publicSlug),
  index("workflows_org_id_idx").on(table.orgId),
]);

/** An immutable snapshot of a workflow's configuration. */
export const workflowVersions = pgTable(
  "workflow_versions",
  {
    workflowId: text("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: text("status").default("draft"),
    triggerType: text("trigger_type").default("interactive"),
    triggerConfig: jsonb("trigger_config"),
    executionEnvironments: jsonb("execution_environments").default(
      '["cloud"]',
    ),
    changelog: text("changelog"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "workflow_versions_pk",
      columns: [table.workflowId, table.version],
    }),
  ],
);

/** A single executable unit inside a workflow version. */
export const blocks = pgTable(
  "blocks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    workflowId: text("workflow_id").notNull(),
    workflowVersion: integer("workflow_version").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    logic: jsonb("logic").notNull().default("{}"),
    conditions: jsonb("conditions"),
    order: integer("order").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("blocks_wf_version_idx").on(table.workflowId, table.workflowVersion),
    index("blocks_wf_version_order_idx").on(
      table.workflowId,
      table.workflowVersion,
      table.order,
    ),
  ],
);

/** Encrypted key-value pairs scoped to a workflow. */
export const secrets = pgTable(
  "secrets",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    workflowId: text("workflow_id").references(() => workflows.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("secrets_workflow_key_unique").on(table.workflowId, table.key),
  ],
);
