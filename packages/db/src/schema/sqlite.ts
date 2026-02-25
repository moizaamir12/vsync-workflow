/**
 * SQLite table definitions — mirrors the PG schema using SQLite-compatible types.
 *
 * Type mappings:
 * - uuid() / text()  -> text()
 * - boolean()        -> integer({ mode: "boolean" })
 * - jsonb()          -> text({ mode: "json" })
 * - timestamp()      -> integer({ mode: "timestamp" })
 * - integer()        -> integer()
 * - real()           -> real()
 *
 * Used by the desktop Electron app for offline-first storage via better-sqlite3.
 */
import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

/* ── Helpers ────────────────────────────────────────────────────────── */

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => nanoid());

const uuid = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date());

const updatedAt = () =>
  integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date());

/* ── Auth ───────────────────────────────────────────────────────────── */

/** Core user identity — every person who can sign in. */
export const sqliteUsers = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text("email").unique().notNull(),
  name: text("name"),
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false),
  avatarUrl: text("avatar_url"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Active login sessions — one per device/browser. */
export const sqliteSessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => sqliteUsers.id),
  token: text("token").unique().notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Linked OAuth / SSO provider accounts. */
export const sqliteAccounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => sqliteUsers.id),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  createdAt: createdAt(),
});

/** Email / phone verification tokens. */
export const sqliteVerifications = sqliteTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: createdAt(),
});

/* ── Organizations ──────────────────────────────────────────────────── */

/** Multi-tenant organization — owns workflows, runs, and billing. */
export const sqliteOrganizations = sqliteTable("organizations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  plan: text("plan").default("free"),
  ssoConfig: text("sso_config", { mode: "json" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Maps users to organizations with a role. */
export const sqliteOrgMembers = sqliteTable(
  "org_members",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    orgId: text("org_id")
      .notNull()
      .references(() => sqliteOrganizations.id),
    userId: text("user_id")
      .notNull()
      .references(() => sqliteUsers.id),
    role: text("role").default("member"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("sqlite_org_members_org_user_unique").on(table.orgId, table.userId),
  ],
);

/* ── Workflows ──────────────────────────────────────────────────────── */

/** A reusable automation definition owned by an organization. */
export const sqliteWorkflows = sqliteTable(
  "workflows",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    orgId: text("org_id")
      .notNull()
      .references(() => sqliteOrganizations.id),
    name: text("name").notNull(),
    description: text("description"),
    activeVersion: integer("active_version").default(0),
    isLocked: integer("is_locked", { mode: "boolean" }).default(false),
    lockedBy: text("locked_by"),
    isDisabled: integer("is_disabled", { mode: "boolean" }).default(false),
    isPublic: integer("is_public", { mode: "boolean" }).default(false),
    publicSlug: text("public_slug"),
    publicAccessMode: text("public_access_mode").default("view"),
    publicBranding: text("public_branding", { mode: "json" }),
    publicRateLimit: text("public_rate_limit", { mode: "json" }),
    createdBy: text("created_by").references(() => sqliteUsers.id),
    updatedBy: text("updated_by"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("sqlite_workflows_public_slug_unique").on(table.publicSlug),
  ],
);

/** An immutable snapshot of a workflow's configuration. */
export const sqliteWorkflowVersions = sqliteTable(
  "workflow_versions",
  {
    workflowId: text("workflow_id")
      .notNull()
      .references(() => sqliteWorkflows.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: text("status").default("draft"),
    triggerType: text("trigger_type").default("interactive"),
    triggerConfig: text("trigger_config", { mode: "json" }),
    executionEnvironments: text("execution_environments", { mode: "json" }).default(
      '["cloud"]',
    ),
    changelog: text("changelog"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({
      name: "sqlite_workflow_versions_pk",
      columns: [table.workflowId, table.version],
    }),
  ],
);

/** A single executable unit inside a workflow version. */
export const sqliteBlocks = sqliteTable(
  "blocks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    workflowId: text("workflow_id").notNull(),
    workflowVersion: integer("workflow_version").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    logic: text("logic", { mode: "json" }).notNull().default("{}"),
    conditions: text("conditions", { mode: "json" }),
    order: integer("order").notNull(),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("sqlite_blocks_wf_version_idx").on(table.workflowId, table.workflowVersion),
    index("sqlite_blocks_wf_version_order_idx").on(
      table.workflowId,
      table.workflowVersion,
      table.order,
    ),
  ],
);

/** Encrypted key-value pairs scoped to a workflow. */
export const sqliteSecrets = sqliteTable(
  "secrets",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    workflowId: text("workflow_id").references(() => sqliteWorkflows.id),
    key: text("key").notNull(),
    value: text("value").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("sqlite_secrets_workflow_key_unique").on(table.workflowId, table.key),
  ],
);

/* ── Runs ───────────────────────────────────────────────────────────── */

/** A single execution of a workflow version. */
export const sqliteRuns = sqliteTable(
  "runs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    workflowId: text("workflow_id").references(() => sqliteWorkflows.id),
    version: integer("version"),
    orgId: text("org_id"),
    status: text("status").default("pending"),
    triggerType: text("trigger_type"),
    triggerSource: text("trigger_source"),
    startedAt: integer("started_at", { mode: "timestamp" }),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    durationMs: integer("duration_ms"),
    errorMessage: text("error_message"),
    stepsJson: text("steps_json", { mode: "json" }),
    metadata: text("metadata", { mode: "json" }),
    createdAt: createdAt(),
  },
  (table) => [
    index("sqlite_runs_workflow_idx").on(table.workflowId),
    index("sqlite_runs_org_idx").on(table.orgId),
    index("sqlite_runs_status_idx").on(table.status),
    index("sqlite_runs_started_at_idx").on(table.startedAt),
  ],
);

/** A binary asset produced or consumed during a run. */
export const sqliteArtifacts = sqliteTable(
  "artifacts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    runId: text("run_id").references(() => sqliteRuns.id, { onDelete: "cascade" }),
    workflowId: text("workflow_id"),
    orgId: text("org_id"),
    type: text("type").notNull(),
    name: text("name").notNull(),
    filePath: text("file_path"),
    fileUrl: text("file_url"),
    fileSize: integer("file_size"),
    mimeType: text("mime_type"),
    metadata: text("metadata", { mode: "json" }),
    source: text("source"),
    blockId: text("block_id"),
    width: integer("width"),
    height: integer("height"),
    overlays: text("overlays", { mode: "json" }),
    thumbnailUrl: text("thumbnail_url"),
    createdAt: createdAt(),
  },
  (table) => [
    index("sqlite_artifacts_run_idx").on(table.runId),
    index("sqlite_artifacts_workflow_idx").on(table.workflowId),
    index("sqlite_artifacts_org_idx").on(table.orgId),
  ],
);

/** Public (anonymous) workflow runs tracked separately for rate limiting. */
export const sqlitePublicRuns = sqliteTable(
  "public_runs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => sqliteWorkflows.id, { onDelete: "cascade" }),
    publicSlug: text("public_slug").notNull(),
    version: integer("version"),
    status: text("status").default("pending"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    isAnonymous: integer("is_anonymous", { mode: "boolean" }).default(true),
    startedAt: integer("started_at", { mode: "timestamp" }),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    durationMs: integer("duration_ms"),
    errorMessage: text("error_message"),
    stepsJson: text("steps_json", { mode: "json" }),
    metadata: text("metadata", { mode: "json" }),
    createdAt: createdAt(),
  },
  (table) => [
    index("sqlite_public_runs_workflow_idx").on(table.workflowId),
    index("sqlite_public_runs_slug_idx").on(table.publicSlug),
    index("sqlite_public_runs_ip_hash_idx").on(table.ipHash),
    index("sqlite_public_runs_created_at_idx").on(table.createdAt),
  ],
);

/* ── Cache ──────────────────────────────────────────────────────────── */

/** Ephemeral key-value cache scoped per organization. */
export const sqliteCache = sqliteTable(
  "cache",
  {
    key: text("key").notNull(),
    orgId: text("org_id").notNull(),
    value: text("value", { mode: "json" }).notNull(),
    createdAt: createdAt(),
    accessedAt: integer("accessed_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    accessCount: integer("access_count").default(0),
  },
  (table) => [
    primaryKey({
      name: "sqlite_cache_pk",
      columns: [table.key, table.orgId],
    }),
  ],
);

/* ── Devices ────────────────────────────────────────────────────────── */

/** A registered execution agent (phone, desktop, kiosk, etc.). */
export const sqliteDevices = sqliteTable("devices", {
  id: text("id").primaryKey(),
  orgId: text("org_id"),
  hardwareId: text("hardware_id").unique(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  platform: text("platform"),
  arch: text("arch"),
  executionEnvironment: text("execution_environment").default("desktop"),
  tags: text("tags", { mode: "json" }),
  cpuCores: integer("cpu_cores"),
  memoryGb: real("memory_gb"),
  diskGb: real("disk_gb"),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ── Keys ───────────────────────────────────────────────────────────── */

/** Encrypted API keys and credentials. */
export const sqliteKeys = sqliteTable(
  "keys",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    orgId: text("org_id")
      .notNull()
      .references(() => sqliteOrganizations.id),
    workflowId: text("workflow_id").references(() => sqliteWorkflows.id),
    name: text("name").notNull(),
    description: text("description"),
    provider: text("provider").notNull().default("custom"),
    keyType: text("key_type").notNull().default("api_key"),
    encryptedValue: text("encrypted_value").notNull(),
    iv: text("iv").notNull(),
    algorithm: text("algorithm").default("aes-256-gcm"),
    storageMode: text("storage_mode").default("cloud"),
    lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
    lastRotatedAt: integer("last_rotated_at", { mode: "timestamp" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    isRevoked: integer("is_revoked", { mode: "boolean" }).default(false),
    metadata: text("metadata", { mode: "json" }),
    createdBy: text("created_by").references(() => sqliteUsers.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("sqlite_keys_org_name_unique").on(table.orgId, table.name),
    uniqueIndex("sqlite_keys_org_workflow_name_unique").on(
      table.orgId,
      table.workflowId,
      table.name,
    ),
    index("sqlite_keys_org_idx").on(table.orgId),
    index("sqlite_keys_workflow_idx").on(table.workflowId),
  ],
);

/** Immutable log of key lifecycle events. */
export const sqliteKeyAuditLog = sqliteTable(
  "key_audit_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    keyId: text("key_id")
      .notNull()
      .references(() => sqliteKeys.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    performedBy: text("performed_by").references(() => sqliteUsers.id),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    metadata: text("metadata", { mode: "json" }),
    createdAt: createdAt(),
  },
  (table) => [
    index("sqlite_key_audit_key_idx").on(table.keyId),
    index("sqlite_key_audit_performer_idx").on(table.performedBy),
  ],
);

/* ── Chats ──────────────────────────────────────────────────────────── */

/** AI assistant conversation threads scoped to a workflow. */
export const sqliteChats = sqliteTable(
  "chats",
  {
    id: text("id").primaryKey(),
    workflowId: text("workflow_id"),
    version: text("version").default("default"),
    title: text("title"),
    orgId: text("org_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("sqlite_chats_workflow_version_org_unique").on(
      table.workflowId,
      table.version,
      table.orgId,
    ),
  ],
);

/** Individual messages within a chat thread. */
export const sqliteMessages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .notNull()
    .references(() => sqliteChats.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  metadata: text("metadata", { mode: "json" }),
  createdAt: createdAt(),
});

/* ── Sync (desktop-only) ────────────────────────────────────────────── */

/** Offline mutation queue — desktop records local changes here for cloud sync. */
export const sqliteSyncQueue = sqliteTable(
  "sync_queue",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    tableName: text("table_name").notNull(),
    rowId: text("row_id").notNull(),
    action: text("action").notNull(),
    payload: text("payload", { mode: "json" }).notNull(),
    syncedAt: integer("synced_at", { mode: "timestamp" }),
    createdAt: createdAt(),
  },
  (table) => [
    index("sqlite_sync_queue_synced_idx").on(table.syncedAt),
    index("sqlite_sync_queue_table_idx").on(table.tableName),
  ],
);
