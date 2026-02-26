import postgres from "postgres";

/**
 * Creates all required tables in a PostgreSQL database.
 * This mirrors the PGlite bootstrap in packages/api/src/server.ts
 * so that a real Postgres instance has the same schema.
 *
 * Usage: DATABASE_URL=postgresql://... tsx src/setup.ts
 */
async function main(): Promise<void> {
  // TODO(schema): CRITICAL — Several tables in this DDL are out of sync with the Drizzle schema definitions in src/schema/. The following tables need reconciliation: accounts (column names differ), secrets (completely different schema), chats (missing workflow columns), cache (missing org scoping), devices (different columns and scoping). Reconcile one source of truth before production use.
  const url = process.env["DATABASE_URL"];

  if (!url) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const sql = postgres(url);

  console.log("[db:setup] Creating tables...");

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      email_verified BOOLEAN DEFAULT false,
      avatar_url TEXT,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )
  `;

  // TODO(schema): Column names here (account_id, provider_id) differ from Drizzle schema (provider_account_id, provider). Drizzle ORM queries will fail against this DDL.
  await sql`
    CREATE TABLE IF NOT EXISTS accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      id_token TEXT,
      access_token_expires_at TIMESTAMP,
      refresh_token_expires_at TIMESTAMP,
      scope TEXT,
      password TEXT,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS verifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS organizations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      plan TEXT DEFAULT 'free',
      sso_config JSONB,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )
  `;

  // TODO: Add ON DELETE CASCADE to org_id and user_id foreign keys to prevent orphaned records when orgs or users are deleted.
  await sql`
    CREATE TABLE IF NOT EXISTS org_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id),
      user_id UUID NOT NULL REFERENCES users(id),
      role TEXT DEFAULT 'member',
      created_at TIMESTAMP DEFAULT now(),
      UNIQUE(org_id, user_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      org_id UUID NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL,
      description TEXT,
      active_version INT DEFAULT 0,
      is_locked BOOLEAN DEFAULT false,
      locked_by TEXT,
      is_disabled BOOLEAN DEFAULT false,
      is_public BOOLEAN DEFAULT false,
      public_slug TEXT UNIQUE,
      public_access_mode TEXT DEFAULT 'view',
      public_branding JSONB,
      public_rate_limit JSONB,
      created_by UUID REFERENCES users(id),
      updated_by UUID,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS workflow_versions (
      workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      version INT NOT NULL,
      status TEXT DEFAULT 'draft',
      trigger_type TEXT DEFAULT 'interactive',
      trigger_config JSONB,
      execution_environments JSONB DEFAULT '["cloud"]',
      changelog TEXT,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now(),
      PRIMARY KEY (workflow_id, version)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS blocks (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      workflow_version INT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      logic JSONB NOT NULL DEFAULT '{}',
      conditions JSONB,
      "order" INT NOT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT REFERENCES workflows(id),
      version INT,
      org_id UUID,
      status TEXT DEFAULT 'pending',
      trigger_type TEXT,
      trigger_source TEXT,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      duration_ms INT,
      error_message TEXT,
      steps_json JSONB,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      run_id TEXT REFERENCES runs(id) ON DELETE CASCADE,
      workflow_id TEXT,
      org_id UUID,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      file_path TEXT,
      file_url TEXT,
      file_size INT,
      mime_type TEXT,
      metadata JSONB,
      source TEXT,
      block_id TEXT,
      width INT,
      height INT,
      overlays JSONB,
      thumbnail_url TEXT,
      created_at TIMESTAMP DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS secrets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL,
      encrypted_value TEXT NOT NULL,
      iv TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now(),
      UNIQUE(org_id, name)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS cache (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS devices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      platform TEXT NOT NULL,
      device_token TEXT,
      last_seen_at TIMESTAMP DEFAULT now(),
      created_at TIMESTAMP DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS keys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL,
      encrypted_key TEXT NOT NULL,
      iv TEXT NOT NULL,
      algorithm TEXT DEFAULT 'aes-256-gcm',
      is_active BOOLEAN DEFAULT true,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP DEFAULT now(),
      rotated_at TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS key_audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key_id UUID NOT NULL REFERENCES keys(id),
      action TEXT NOT NULL,
      performed_by UUID REFERENCES users(id),
      metadata JSONB,
      created_at TIMESTAMP DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS chats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id),
      title TEXT,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS public_runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      public_slug TEXT NOT NULL,
      version INT,
      status TEXT DEFAULT 'pending',
      ip_hash TEXT,
      user_agent TEXT,
      is_anonymous BOOLEAN DEFAULT true,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      duration_ms INT,
      error_message TEXT,
      steps_json JSONB,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT now()
    )
  `;

  console.log("[db:setup] All 19 tables created successfully");

  await sql.end();
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error("[db:setup] Failed:", err);
  process.exit(1);
});
