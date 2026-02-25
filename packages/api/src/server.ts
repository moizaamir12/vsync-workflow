import { serve } from "@hono/node-server";
import { WebSocketServer } from "ws";
import type { WebSocket as WsWebSocket, RawData } from "ws";
import { createPostgresClient, createPgliteClient, type Database } from "@vsync/db";
import { createAuthServer } from "@vsync/auth";
import { Interpreter } from "@vsync/engine";
import { NodeAdapter } from "@vsync/engine-adapters";
import { createApp } from "./index.js";
import { handleMessage, handleDisconnect } from "./ws/handlers.js";
import type { IncomingMessage } from "node:http";
import type { WSLike } from "./ws/manager.js";
import { sql } from "drizzle-orm";

const PORT = parseInt(process.env["PORT"] ?? "3001", 10);

/**
 * Bootstrap an in-memory PGlite database with all required tables.
 * Used for local development when DATABASE_URL is not provided.
 */
async function createDevDatabase(): Promise<Database> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pglite = new PGlite();
  /* Cast through unknown — PGlite and postgres.js Drizzle types are
     structurally compatible at runtime but differ at the type level. */
  const db = createPgliteClient(pglite) as unknown as Database;

  console.log("[api] No DATABASE_URL found — using in-memory PGlite for local dev");

  /* Create tables matching the Drizzle schema */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      email_verified BOOLEAN DEFAULT false,
      avatar_url TEXT,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )
  `);
  await db.execute(sql`
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
  `);
  await db.execute(sql`
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
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS verifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS organizations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      plan TEXT DEFAULT 'free',
      sso_config JSONB,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS org_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id),
      user_id UUID NOT NULL REFERENCES users(id),
      role TEXT DEFAULT 'member',
      created_at TIMESTAMP DEFAULT now(),
      UNIQUE(org_id, user_id)
    )
  `);
  await db.execute(sql`
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
  `);
  await db.execute(sql`
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
  `);
  await db.execute(sql`
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
  `);
  await db.execute(sql`
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
  `);
  await db.execute(sql`
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
  `);
  await db.execute(sql`
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
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cache (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS devices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      platform TEXT NOT NULL,
      device_token TEXT,
      last_seen_at TIMESTAMP DEFAULT now(),
      created_at TIMESTAMP DEFAULT now()
    )
  `);
  await db.execute(sql`
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
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS key_audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key_id UUID NOT NULL REFERENCES keys(id),
      action TEXT NOT NULL,
      performed_by UUID REFERENCES users(id),
      metadata JSONB,
      created_at TIMESTAMP DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS chats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id),
      title TEXT,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT now()
    )
  `);

  await db.execute(sql`
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
  `);

  console.log("[api] PGlite schema created (19 tables)");
  return db;
}

/**
 * Standalone entry point for the V Sync API server.
 * Connects to Postgres (or falls back to in-memory PGlite),
 * initialises auth, and starts Hono on the configured port.
 * WebSocket upgrades on /api/v1/ws are handled by a co-located
 * WSS instance. Graceful shutdown tears down HTTP + WS connections.
 */
async function main() {
  const databaseUrl = process.env["DATABASE_URL"];

  /* Initialise core dependencies */
  const db: Database = databaseUrl
    ? createPostgresClient(databaseUrl)
    : await createDevDatabase();
  const auth = createAuthServer(db);

  /* Build the workflow engine with Node-native block adapters */
  const interpreter = new Interpreter();
  const nodeAdapter = new NodeAdapter();
  nodeAdapter.registerBlocks(interpreter.blockExecutor);

  const { app, wsManager } = createApp(auth, db, {
    corsOrigins: (process.env["CORS_ORIGINS"] ?? "").split(",").filter(Boolean),
    interpreter,
  });

  /* Start the HTTP server */
  const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`[api] V Sync API running on http://localhost:${info.port}`);
  });

  /**
   * WebSocket upgrade handler.
   *
   * Uses the `ws` package in noServer mode so upgrades only happen
   * on /api/v1/ws. Auth is done via a ?token= query param since
   * browsers can't send custom headers during WebSocket handshake.
   */
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request: IncomingMessage, socket, head) => {
    const url = new URL(request.url ?? "/", `http://localhost:${PORT}`);

    /* Only upgrade requests to /api/v1/ws */
    if (url.pathname !== "/api/v1/ws") {
      socket.destroy();
      return;
    }

    const token = url.searchParams.get("token");
    const channels = (url.searchParams.get("channels") ?? "")
      .split(",")
      .filter(Boolean);

    wss.handleUpgrade(request, socket, head, (ws: WsWebSocket) => {
      const wsLike = ws as unknown as WSLike;

      wsManager.register(wsLike, {
        userId: token ? "pending-auth" : null,
        orgId: null,
        channels: new Set(channels),
      });

      ws.on("message", (data: RawData) => {
        handleMessage(wsManager, wsLike, data.toString());
      });

      ws.on("close", () => {
        handleDisconnect(wsManager, wsLike);
      });

      ws.on("error", () => {
        handleDisconnect(wsManager, wsLike);
      });

      /* Send a welcome message so clients know the connection is live */
      ws.send(JSON.stringify({
        type: "connected",
        timestamp: new Date().toISOString(),
        channels,
      }));
    });
  });

  /* Graceful shutdown */
  const shutdown = () => {
    console.log("[api] Shutting down...");
    wss.close();
    server.close(() => {
      console.log("[api] Server closed");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[api] Fatal error:", err);
  process.exit(1);
});
