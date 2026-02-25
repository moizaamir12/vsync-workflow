import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  jsonb,
  index,
  boolean,
} from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";
import { workflows } from "./workflows.js";

/** A single execution of a workflow version. */
export const runs = pgTable(
  "runs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    workflowId: text("workflow_id").references(() => workflows.id),
    version: integer("version"),
    orgId: uuid("org_id"),
    status: text("status").default("pending"),
    triggerType: text("trigger_type"),
    triggerSource: text("trigger_source"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    durationMs: integer("duration_ms"),
    errorMessage: text("error_message"),
    stepsJson: jsonb("steps_json"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("runs_workflow_idx").on(table.workflowId),
    index("runs_org_idx").on(table.orgId),
    index("runs_status_idx").on(table.status),
    index("runs_started_at_idx").on(table.startedAt),
  ],
);

/** A binary asset produced or consumed during a run. */
export const artifacts = pgTable(
  "artifacts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    runId: text("run_id").references(() => runs.id, { onDelete: "cascade" }),
    workflowId: text("workflow_id"),
    orgId: uuid("org_id"),
    type: text("type").notNull(),
    name: text("name").notNull(),
    filePath: text("file_path"),
    fileUrl: text("file_url"),
    fileSize: integer("file_size"),
    mimeType: text("mime_type"),
    metadata: jsonb("metadata"),
    source: text("source"),
    blockId: text("block_id"),
    width: integer("width"),
    height: integer("height"),
    overlays: jsonb("overlays"),
    thumbnailUrl: text("thumbnail_url"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("artifacts_run_idx").on(table.runId),
    index("artifacts_workflow_idx").on(table.workflowId),
    index("artifacts_org_idx").on(table.orgId),
  ],
);

/**
 * Tracks anonymous/public workflow runs separately from org runs.
 * Includes IP-based identity for rate limiting and abuse detection.
 */
export const publicRuns = pgTable(
  "public_runs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    publicSlug: text("public_slug").notNull(),
    version: integer("version"),
    status: text("status").default("pending"),
    /** Hashed IP for rate-limiting without storing raw PII */
    ipHash: text("ip_hash"),
    /** Browser User-Agent fingerprint (truncated) */
    userAgent: text("user_agent"),
    /** Run is anonymous — no authenticated user */
    isAnonymous: boolean("is_anonymous").default(true),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    durationMs: integer("duration_ms"),
    errorMessage: text("error_message"),
    stepsJson: jsonb("steps_json"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("public_runs_workflow_idx").on(table.workflowId),
    index("public_runs_slug_idx").on(table.publicSlug),
    index("public_runs_ip_hash_idx").on(table.ipHash),
    index("public_runs_created_at_idx").on(table.createdAt),
  ],
);
