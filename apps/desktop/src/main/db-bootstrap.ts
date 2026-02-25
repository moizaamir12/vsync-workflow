import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { createSQLiteClient, type SqliteDatabase } from "@vsync/db";

/**
 * Initialises the desktop SQLite database.
 *
 * Creates the data directory if needed, opens (or creates) the DB file,
 * enables WAL + foreign keys, and runs the full DDL to ensure all tables
 * exist.  Returns the Drizzle client ready for repository use.
 */
export function createDesktopDatabase(dataDir: string): SqliteDatabase {
  /* Ensure data directory exists */
  fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = path.join(dataDir, "vsync.db");

  /* Run raw DDL before handing off to Drizzle — `CREATE TABLE IF NOT EXISTS`
     is idempotent so this is safe to run on every launch. */
  const raw = new Database(dbPath);
  raw.pragma("journal_mode = WAL");
  raw.pragma("foreign_keys = ON");

  raw.exec(SCHEMA_DDL);
  raw.close();

  /* Now create the typed Drizzle client */
  return createSQLiteClient(dbPath);
}

/* ── DDL ────────────────────────────────────────────────────────────── */

const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  email_verified INTEGER DEFAULT 0,
  avatar_url TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expires_at INTEGER,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS verifications (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'free',
  sso_config TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS org_members (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT DEFAULT 'member',
  created_at INTEGER,
  UNIQUE(org_id, user_id)
);

CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  active_version INTEGER DEFAULT 0,
  is_locked INTEGER DEFAULT 0,
  locked_by TEXT,
  is_disabled INTEGER DEFAULT 0,
  is_public INTEGER DEFAULT 0,
  public_slug TEXT UNIQUE,
  public_access_mode TEXT DEFAULT 'view',
  public_branding TEXT,
  public_rate_limit TEXT,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS workflow_versions (
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  status TEXT DEFAULT 'draft',
  trigger_type TEXT DEFAULT 'interactive',
  trigger_config TEXT,
  execution_environments TEXT DEFAULT '["cloud"]',
  changelog TEXT,
  created_at INTEGER,
  updated_at INTEGER,
  PRIMARY KEY (workflow_id, version)
);

CREATE TABLE IF NOT EXISTS blocks (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  workflow_version INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  logic TEXT NOT NULL DEFAULT '{}',
  conditions TEXT,
  "order" INTEGER NOT NULL,
  notes TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS sqlite_blocks_wf_version_idx ON blocks(workflow_id, workflow_version);
CREATE INDEX IF NOT EXISTS sqlite_blocks_wf_version_order_idx ON blocks(workflow_id, workflow_version, "order");

CREATE TABLE IF NOT EXISTS secrets (
  id TEXT PRIMARY KEY,
  workflow_id TEXT REFERENCES workflows(id),
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at INTEGER,
  updated_at INTEGER,
  UNIQUE(workflow_id, key)
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT REFERENCES workflows(id),
  version INTEGER,
  org_id TEXT,
  status TEXT DEFAULT 'pending',
  trigger_type TEXT,
  trigger_source TEXT,
  started_at INTEGER,
  completed_at INTEGER,
  duration_ms INTEGER,
  error_message TEXT,
  steps_json TEXT,
  metadata TEXT,
  created_at INTEGER
);

CREATE INDEX IF NOT EXISTS sqlite_runs_workflow_idx ON runs(workflow_id);
CREATE INDEX IF NOT EXISTS sqlite_runs_org_idx ON runs(org_id);
CREATE INDEX IF NOT EXISTS sqlite_runs_status_idx ON runs(status);
CREATE INDEX IF NOT EXISTS sqlite_runs_started_at_idx ON runs(started_at);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  run_id TEXT REFERENCES runs(id) ON DELETE CASCADE,
  workflow_id TEXT,
  org_id TEXT,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  file_path TEXT,
  file_url TEXT,
  file_size INTEGER,
  mime_type TEXT,
  metadata TEXT,
  source TEXT,
  block_id TEXT,
  width INTEGER,
  height INTEGER,
  overlays TEXT,
  thumbnail_url TEXT,
  created_at INTEGER
);

CREATE INDEX IF NOT EXISTS sqlite_artifacts_run_idx ON artifacts(run_id);
CREATE INDEX IF NOT EXISTS sqlite_artifacts_workflow_idx ON artifacts(workflow_id);
CREATE INDEX IF NOT EXISTS sqlite_artifacts_org_idx ON artifacts(org_id);

CREATE TABLE IF NOT EXISTS public_runs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  public_slug TEXT NOT NULL,
  version INTEGER,
  status TEXT DEFAULT 'pending',
  ip_hash TEXT,
  user_agent TEXT,
  is_anonymous INTEGER DEFAULT 1,
  started_at INTEGER,
  completed_at INTEGER,
  duration_ms INTEGER,
  error_message TEXT,
  steps_json TEXT,
  metadata TEXT,
  created_at INTEGER
);

CREATE INDEX IF NOT EXISTS sqlite_public_runs_workflow_idx ON public_runs(workflow_id);
CREATE INDEX IF NOT EXISTS sqlite_public_runs_slug_idx ON public_runs(public_slug);
CREATE INDEX IF NOT EXISTS sqlite_public_runs_ip_hash_idx ON public_runs(ip_hash);
CREATE INDEX IF NOT EXISTS sqlite_public_runs_created_at_idx ON public_runs(created_at);

CREATE TABLE IF NOT EXISTS cache (
  key TEXT NOT NULL,
  org_id TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at INTEGER,
  accessed_at INTEGER,
  access_count INTEGER DEFAULT 0,
  PRIMARY KEY (key, org_id)
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  org_id TEXT,
  hardware_id TEXT UNIQUE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  platform TEXT,
  arch TEXT,
  execution_environment TEXT DEFAULT 'desktop',
  tags TEXT,
  cpu_cores INTEGER,
  memory_gb REAL,
  disk_gb REAL,
  last_seen_at INTEGER,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS keys (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  workflow_id TEXT REFERENCES workflows(id),
  name TEXT NOT NULL,
  description TEXT,
  provider TEXT NOT NULL DEFAULT 'custom',
  key_type TEXT NOT NULL DEFAULT 'api_key',
  encrypted_value TEXT NOT NULL,
  iv TEXT NOT NULL,
  algorithm TEXT DEFAULT 'aes-256-gcm',
  storage_mode TEXT DEFAULT 'cloud',
  last_used_at INTEGER,
  last_rotated_at INTEGER,
  expires_at INTEGER,
  is_revoked INTEGER DEFAULT 0,
  metadata TEXT,
  created_by TEXT REFERENCES users(id),
  created_at INTEGER,
  updated_at INTEGER,
  UNIQUE(org_id, name)
);

CREATE INDEX IF NOT EXISTS sqlite_keys_org_idx ON keys(org_id);
CREATE INDEX IF NOT EXISTS sqlite_keys_workflow_idx ON keys(workflow_id);

CREATE TABLE IF NOT EXISTS key_audit_log (
  id TEXT PRIMARY KEY,
  key_id TEXT NOT NULL REFERENCES keys(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by TEXT REFERENCES users(id),
  ip_address TEXT,
  user_agent TEXT,
  metadata TEXT,
  created_at INTEGER
);

CREATE INDEX IF NOT EXISTS sqlite_key_audit_key_idx ON key_audit_log(key_id);
CREATE INDEX IF NOT EXISTS sqlite_key_audit_performer_idx ON key_audit_log(performed_by);

CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  workflow_id TEXT,
  version TEXT DEFAULT 'default',
  title TEXT,
  org_id TEXT,
  created_at INTEGER,
  updated_at INTEGER,
  UNIQUE(workflow_id, version, org_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload TEXT NOT NULL,
  synced_at INTEGER,
  created_at INTEGER
);

CREATE INDEX IF NOT EXISTS sqlite_sync_queue_synced_idx ON sync_queue(synced_at);
CREATE INDEX IF NOT EXISTS sqlite_sync_queue_table_idx ON sync_queue(table_name);
`;
