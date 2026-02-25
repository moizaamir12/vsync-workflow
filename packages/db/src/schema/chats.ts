import {
  pgTable,
  text,
  uuid,
  timestamp,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";

/** AI assistant conversation threads scoped to a workflow. */
export const chats = pgTable(
  "chats",
  {
    id: text("id").primaryKey(),
    workflowId: text("workflow_id"),
    version: text("version").default("default"),
    title: text("title"),
    orgId: uuid("org_id"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("chats_workflow_version_org_unique").on(
      table.workflowId,
      table.version,
      table.orgId,
    ),
  ],
);

/** Individual messages within a chat thread. */
export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});
