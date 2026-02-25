import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Hono } from "hono";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import * as dbExports from "@vsync/db";
import {
  WorkflowRepository,
  RunRepository,
  UserRepository,
  OrgRepository,
  ArtifactRepository,
  CacheRepository,
} from "@vsync/db";
import type { Database } from "@vsync/db";

import { workflowRoutes } from "../routes/workflows.js";
import { versionRoutes } from "../routes/versions.js";
import { blockRoutes } from "../routes/blocks.js";
import { runRoutes } from "../routes/runs.js";
import { artifactRoutes } from "../routes/artifacts.js";
import { cacheRoutes } from "../routes/cache.js";
import { healthRoutes } from "../routes/health.js";
import { errorHandler } from "../middleware/error-handler.js";
import type { AppEnv } from "../lib/types.js";
import type { AuthContext } from "@vsync/auth";
import { WSManager } from "../ws/manager.js";
import type { WSLike, ClientMeta } from "../ws/manager.js";
import { handleMessage, handleDisconnect } from "../ws/handlers.js";
import {
  runStarted,
  runStep,
  runCompleted,
  runFailed,
  runAwaitingAction,
  workflowUpdated,
  workflowDeleted,
} from "../ws/events.js";

/**
 * API integration tests using PGlite (in-memory Postgres).
 *
 * Auth middleware is replaced with a test stub that injects a
 * fixed auth context — this lets us test route logic, validation,
 * pagination, and DB interactions without spinning up Better Auth.
 */

let pglite: PGlite;
let db: Database;
let testUserId: string;
let testOrgId: string;

/**
 * Creates a fake AuthInstance whose middleware methods just
 * inject the test auth context. Routes call requireAuth(auth)
 * which normally resolves a session; this version skips that.
 */
function createTestAuth(authCtx: AuthContext) {
  /**
   * Return a proxy object that pretends to be an AuthInstance.
   * The middleware functions from @vsync/auth call auth.api.getSession(),
   * so we provide an api stub that returns our test session.
   */
  return {
    api: {
      getSession: async () => ({
        user: {
          id: authCtx.userId,
          email: authCtx.email,
          name: authCtx.name,
        },
        session: {
          id: authCtx.sessionId,
          activeOrganizationId: authCtx.orgId,
          role: authCtx.role,
        },
      }),
    },
  } as ReturnType<typeof import("@vsync/auth").createAuthServer>;
}

/** Create a fully-wired test Hono app for a specific set of routes. */
function createTestApp(
  auth: ReturnType<typeof createTestAuth>,
  database: Database,
  wsManager?: WSManager,
) {
  const app = new Hono<AppEnv>();
  app.onError(errorHandler);

  app.route("/workflows", workflowRoutes(auth, database));
  app.route("/workflows", versionRoutes(auth, database));
  app.route("/", blockRoutes(auth, database));
  app.route("/", runRoutes(auth, database, wsManager));
  app.route("/artifacts", artifactRoutes(auth, database));
  app.route("/cache", cacheRoutes(auth, database));
  app.route("/health", healthRoutes());

  return app;
}

/** Helper to make JSON requests against the test app. */
async function request(
  app: Hono<AppEnv>,
  method: string,
  path: string,
  body?: unknown,
) {
  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) {
    init.body = JSON.stringify(body);
  }
  return app.request(path, init);
}

/* ── Database setup ────────────────────────────────────────────── */

beforeAll(async () => {
  pglite = new PGlite();
  db = drizzle(pglite, { schema: dbExports }) as unknown as Database;

  /* Create all tables needed by the tested routes */

  await db.execute(sql`
    CREATE TABLE users (
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
    CREATE TABLE organizations (
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
    CREATE TABLE org_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id),
      user_id UUID NOT NULL REFERENCES users(id),
      role TEXT DEFAULT 'member',
      created_at TIMESTAMP DEFAULT now(),
      UNIQUE(org_id, user_id)
    )
  `);

  await db.execute(sql`
    CREATE TABLE workflows (
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
    CREATE TABLE workflow_versions (
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
    CREATE TABLE blocks (
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
    CREATE TABLE runs (
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
    CREATE TABLE artifacts (
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
    CREATE TABLE cache (
      key TEXT NOT NULL,
      org_id UUID NOT NULL,
      value JSONB,
      accessed_at TIMESTAMP DEFAULT now(),
      access_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT now(),
      PRIMARY KEY (key, org_id)
    )
  `);

  /* Seed a test user + org */
  const userRepo = new UserRepository(db);
  const orgRepo = new OrgRepository(db);

  const user = await userRepo.create({
    email: "test@vsync.io",
    name: "Test User",
  });
  testUserId = user.id;

  const org = await orgRepo.create({
    name: "Test Org",
    slug: "test-org",
  });
  testOrgId = org.id;

  await orgRepo.addMember(org.id, user.id, "owner");
});

afterAll(async () => {
  await pglite.close();
});

/* ── Test helpers ────────────────────────────────────────────────── */

function getAuthCtx(): AuthContext {
  return {
    userId: testUserId,
    email: "test@vsync.io",
    name: "Test User",
    orgId: testOrgId,
    role: "owner",
    sessionId: "test-session",
  };
}

function getApp() {
  const auth = createTestAuth(getAuthCtx());
  return createTestApp(auth, db);
}

/* ── Health ──────────────────────────────────────────────────────── */

describe("Health", () => {
  it("GET /health returns ok", async () => {
    const app = getApp();
    const res = await app.request("/health");
    expect(res.status).toBe(200);

    const json = await res.json() as { data: { status: string } };
    expect(json.data.status).toBe("ok");
    expect(json.data).toHaveProperty("uptime");
  });
});

/* ── Workflows ───────────────────────────────────────────────────── */

describe("Workflows", () => {
  let workflowId: string;

  it("POST /workflows creates a workflow", async () => {
    const app = getApp();
    const res = await request(app, "POST", "/workflows", {
      name: "My Workflow",
      description: "A test workflow",
    });

    expect(res.status).toBe(201);
    const json = await res.json() as { data: { id: string; name: string } };
    expect(json.data.name).toBe("My Workflow");
    expect(json.data.id).toBeDefined();
    workflowId = json.data.id;
  });

  it("GET /workflows lists workflows", async () => {
    const app = getApp();
    const res = await app.request("/workflows");
    expect(res.status).toBe(200);

    const json = await res.json() as { data: unknown[]; meta: unknown };
    expect(json.data.length).toBeGreaterThanOrEqual(1);
    expect(json.meta).toBeDefined();
  });

  it("GET /workflows/:id returns a workflow", async () => {
    const app = getApp();
    const res = await app.request(`/workflows/${workflowId}`);
    expect(res.status).toBe(200);

    const json = await res.json() as { data: { id: string; name: string } };
    expect(json.data.id).toBe(workflowId);
    expect(json.data.name).toBe("My Workflow");
  });

  it("PATCH /workflows/:id updates a workflow", async () => {
    const app = getApp();
    const res = await request(app, "PATCH", `/workflows/${workflowId}`, {
      name: "Renamed Workflow",
    });
    expect(res.status).toBe(200);

    const json = await res.json() as { data: { name: string } };
    expect(json.data.name).toBe("Renamed Workflow");
  });

  it("POST /workflows/:id/lock locks a workflow", async () => {
    const app = getApp();
    const res = await request(app, "POST", `/workflows/${workflowId}/lock`);
    expect(res.status).toBe(200);

    const json = await res.json() as { data: { isLocked: boolean } };
    expect(json.data.isLocked).toBe(true);
  });

  it("DELETE /workflows/:id/lock unlocks a workflow", async () => {
    const app = getApp();
    const res = await request(app, "DELETE", `/workflows/${workflowId}/lock`);
    expect(res.status).toBe(200);

    const json = await res.json() as { data: { isLocked: boolean } };
    expect(json.data.isLocked).toBe(false);
  });

  it("POST /workflows/:id/duplicate duplicates a workflow", async () => {
    const app = getApp();
    const res = await request(app, "POST", `/workflows/${workflowId}/duplicate`);
    expect(res.status).toBe(201);

    const json = await res.json() as { data: { name: string } };
    expect(json.data.name).toContain("(copy)");
  });

  it("GET /workflows/nonexistent returns 404", async () => {
    const app = getApp();
    const res = await app.request("/workflows/nonexistent");
    expect(res.status).toBe(404);

    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe("NOT_FOUND");
  });

  it("POST /workflows validates request body", async () => {
    const app = getApp();
    const res = await request(app, "POST", "/workflows", {
      /* Missing required 'name' field */
    });
    expect(res.status).toBe(400);

    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });
});

/* ── Versions ────────────────────────────────────────────────────── */

describe("Versions", () => {
  let workflowId: string;

  beforeAll(async () => {
    const wfRepo = new WorkflowRepository(db);
    const wf = await wfRepo.create({
      id: `wf-ver-${Date.now()}`,
      orgId: testOrgId,
      name: "Version Test WF",
    });
    workflowId = wf.id;
  });

  it("POST /workflows/:id/versions creates a version", async () => {
    const app = getApp();
    const res = await request(app, "POST", `/workflows/${workflowId}/versions`);
    expect(res.status).toBe(201);

    const json = await res.json() as { data: { version: { version: number } } };
    expect(json.data.version.version).toBe(1);
  });

  it("GET /workflows/:id/versions lists versions", async () => {
    const app = getApp();
    const res = await app.request(`/workflows/${workflowId}/versions`);
    expect(res.status).toBe(200);

    const json = await res.json() as { data: unknown[] };
    expect(json.data).toHaveLength(1);
  });

  it("POST /workflows/:id/versions/:v/publish publishes a version", async () => {
    const app = getApp();
    const res = await request(app, "POST", `/workflows/${workflowId}/versions/1/publish`);
    expect(res.status).toBe(200);

    const json = await res.json() as { data: { activeVersion: number } };
    expect(json.data.activeVersion).toBe(1);
  });
});

/* ── Blocks ──────────────────────────────────────────────────────── */

describe("Blocks", () => {
  let workflowId: string;
  let blockId: string;

  beforeAll(async () => {
    const wfRepo = new WorkflowRepository(db);
    const wf = await wfRepo.create({
      id: `wf-blk-${Date.now()}`,
      orgId: testOrgId,
      name: "Block Test WF",
    });
    workflowId = wf.id;
    await wfRepo.createVersion({ workflowId: wf.id, version: 1 }, []);
  });

  it("POST /workflows/:wid/versions/:v/blocks creates a block", async () => {
    const app = getApp();
    const res = await request(app, "POST", `/workflows/${workflowId}/versions/1/blocks`, {
      name: "Fetch Data",
      type: "fetch",
      logic: { url: "https://api.example.com" },
      order: 0,
    });

    expect(res.status).toBe(201);
    const json = await res.json() as { data: { id: string; name: string } };
    expect(json.data.name).toBe("Fetch Data");
    blockId = json.data.id;
  });

  it("GET /workflows/:wid/versions/:v/blocks lists blocks in order", async () => {
    const app = getApp();

    /* Add a second block */
    await request(app, "POST", `/workflows/${workflowId}/versions/1/blocks`, {
      name: "Transform",
      type: "object",
      logic: {},
      order: 1,
    });

    const res = await app.request(`/workflows/${workflowId}/versions/1/blocks`);
    expect(res.status).toBe(200);

    const json = await res.json() as { data: { order: number }[] };
    expect(json.data).toHaveLength(2);
    expect(json.data[0].order).toBe(0);
    expect(json.data[1].order).toBe(1);
  });

  it("PATCH /blocks/:id updates a block", async () => {
    const app = getApp();
    const res = await request(app, "PATCH", `/blocks/${blockId}`, {
      name: "Updated Fetch",
    });

    expect(res.status).toBe(200);
    const json = await res.json() as { data: { name: string } };
    expect(json.data.name).toBe("Updated Fetch");
  });

  it("DELETE /blocks/:id deletes a block", async () => {
    const app = getApp();
    const res = await request(app, "DELETE", `/blocks/${blockId}`);
    expect(res.status).toBe(200);
  });
});

/* ── Runs ────────────────────────────────────────────────────────── */

describe("Runs", () => {
  let workflowId: string;
  let runId: string;

  beforeAll(async () => {
    const wfRepo = new WorkflowRepository(db);
    const wf = await wfRepo.create({
      id: `wf-run-${Date.now()}`,
      orgId: testOrgId,
      name: "Run Test WF",
    });
    workflowId = wf.id;
  });

  it("POST /workflows/:id/trigger creates a run", async () => {
    const app = getApp();
    const res = await request(app, "POST", `/workflows/${workflowId}/trigger`, {
      triggerType: "api",
    });

    expect(res.status).toBe(201);
    const json = await res.json() as { data: { id: string; status: string } };
    expect(json.data.status).toBe("pending");
    runId = json.data.id;
  });

  it("GET /runs lists runs", async () => {
    const app = getApp();
    const res = await app.request("/runs");
    expect(res.status).toBe(200);

    const json = await res.json() as { data: unknown[]; meta: unknown };
    expect(json.data.length).toBeGreaterThanOrEqual(1);
  });

  it("GET /runs/:id returns a run", async () => {
    const app = getApp();
    const res = await app.request(`/runs/${runId}`);
    expect(res.status).toBe(200);

    const json = await res.json() as { data: { id: string } };
    expect(json.data.id).toBe(runId);
  });

  it("POST /runs/:id/cancel cancels a pending run", async () => {
    const app = getApp();
    const res = await request(app, "POST", `/runs/${runId}/cancel`);
    expect(res.status).toBe(200);

    const json = await res.json() as { data: { status: string } };
    expect(json.data.status).toBe("cancelled");
  });

  it("POST /runs/:id/cancel rejects cancelling a completed run", async () => {
    const app = getApp();
    const res = await request(app, "POST", `/runs/${runId}/cancel`);
    expect(res.status).toBe(422);

    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe("INVALID_STATE");
  });
});

/* ── Artifacts ───────────────────────────────────────────────────── */

describe("Artifacts", () => {
  let runId: string;
  let artifactId: string;

  beforeAll(async () => {
    const wfRepo = new WorkflowRepository(db);
    const runRepo = new RunRepository(db);

    const wf = await wfRepo.create({
      id: `wf-art-${Date.now()}`,
      orgId: testOrgId,
      name: "Artifact WF",
    });

    const run = await runRepo.create({
      id: `run-art-${Date.now()}`,
      workflowId: wf.id,
      version: 1,
      orgId: testOrgId,
    });
    runId = run.id;
  });

  it("POST /artifacts creates an artifact", async () => {
    const app = getApp();
    const res = await request(app, "POST", "/artifacts", {
      runId,
      type: "image",
      name: "screenshot.png",
      mimeType: "image/png",
      fileSize: 12345,
    });

    expect(res.status).toBe(201);
    const json = await res.json() as { data: { id: string; name: string } };
    expect(json.data.name).toBe("screenshot.png");
    artifactId = json.data.id;
  });

  it("GET /artifacts?runId=... lists artifacts", async () => {
    const app = getApp();
    const res = await app.request(`/artifacts?runId=${runId}`);
    expect(res.status).toBe(200);

    const json = await res.json() as { data: unknown[] };
    expect(json.data).toHaveLength(1);
  });

  it("DELETE /artifacts/:id deletes an artifact", async () => {
    const app = getApp();
    const res = await request(app, "DELETE", `/artifacts/${artifactId}`);
    expect(res.status).toBe(200);
  });
});

/* ── Cache ───────────────────────────────────────────────────────── */

describe("Cache", () => {
  it("POST /cache sets a value", async () => {
    const app = getApp();
    const res = await request(app, "POST", "/cache", {
      key: "test-key",
      value: { count: 42 },
    });

    expect(res.status).toBe(201);
    const json = await res.json() as { data: { key: string } };
    expect(json.data.key).toBe("test-key");
  });

  it("GET /cache/:key retrieves a value", async () => {
    const app = getApp();
    const res = await app.request("/cache/test-key");
    expect(res.status).toBe(200);

    const json = await res.json() as { data: { value: { count: number } } };
    expect(json.data.value.count).toBe(42);
  });

  it("DELETE /cache/:key removes a value", async () => {
    const app = getApp();
    const res = await request(app, "DELETE", "/cache/test-key");
    expect(res.status).toBe(200);

    /* Verify it's gone */
    const check = await app.request("/cache/test-key");
    expect(check.status).toBe(404);
  });
});

/* ── Pagination helpers ──────────────────────────────────────────── */

describe("Pagination", () => {
  it("returns cursor-based pagination meta", async () => {
    const wfRepo = new WorkflowRepository(db);

    /* Create enough workflows for pagination to kick in */
    for (let i = 0; i < 3; i++) {
      await wfRepo.create({
        id: `wf-page-${Date.now()}-${i}`,
        orgId: testOrgId,
        name: `Paginated WF ${i}`,
      });
    }

    const app = getApp();
    const res = await app.request("/workflows?limit=2");
    expect(res.status).toBe(200);

    const json = await res.json() as {
      data: unknown[];
      meta: { cursor: string | null; hasMore: boolean };
    };

    expect(json.data).toHaveLength(2);
    expect(json.meta.hasMore).toBe(true);
    expect(json.meta.cursor).toBeTruthy();
  });
});

/* ── WSManager ──────────────────────────────────────────────────── */

/**
 * Lightweight fake WebSocket for testing the WSManager
 * without a real network connection. Captures sent messages
 * so assertions can verify broadcast behaviour.
 */
function createFakeWS(readyState = 1): WSLike & { messages: string[] } {
  const messages: string[] = [];
  return {
    readyState,
    send(data: string) {
      messages.push(data);
    },
    messages,
  };
}

describe("WSManager", () => {
  it("registers and unregisters clients", () => {
    const mgr = new WSManager();
    const ws = createFakeWS();

    mgr.register(ws, { userId: "u1", orgId: "o1", channels: new Set(["run:abc"]) });
    expect(mgr.clientCount).toBe(1);
    expect(mgr.channelCount).toBe(1);
    expect(mgr.subscriberCount("run:abc")).toBe(1);

    mgr.unregister(ws);
    expect(mgr.clientCount).toBe(0);
    expect(mgr.channelCount).toBe(0);
  });

  it("subscribes and unsubscribes from channels", () => {
    const mgr = new WSManager();
    const ws = createFakeWS();

    mgr.register(ws, { userId: "u1", orgId: "o1", channels: new Set() });
    mgr.subscribe(ws, "org:o1");
    expect(mgr.subscriberCount("org:o1")).toBe(1);

    mgr.unsubscribe(ws, "org:o1");
    expect(mgr.subscriberCount("org:o1")).toBe(0);
    /* Empty channel sets are cleaned up */
    expect(mgr.channelCount).toBe(0);
  });

  it("broadcasts events to subscribed clients", () => {
    const mgr = new WSManager();
    const ws1 = createFakeWS();
    const ws2 = createFakeWS();
    const ws3 = createFakeWS();

    mgr.register(ws1, { userId: "u1", orgId: "o1", channels: new Set(["run:abc"]) });
    mgr.register(ws2, { userId: "u2", orgId: "o1", channels: new Set(["run:abc"]) });
    mgr.register(ws3, { userId: "u3", orgId: "o1", channels: new Set(["run:def"]) });

    const event = runStarted("abc", "wf-1");
    mgr.broadcast("run:abc", event);

    expect(ws1.messages).toHaveLength(1);
    expect(ws2.messages).toHaveLength(1);
    expect(ws3.messages).toHaveLength(0);

    const parsed = JSON.parse(ws1.messages[0]) as { type: string; payload: { runId: string } };
    expect(parsed.type).toBe("run:started");
    expect(parsed.payload.runId).toBe("abc");
  });

  it("broadcastToMany sends to multiple channels", () => {
    const mgr = new WSManager();
    const wsRun = createFakeWS();
    const wsOrg = createFakeWS();

    mgr.register(wsRun, { userId: "u1", orgId: "o1", channels: new Set(["run:abc"]) });
    mgr.register(wsOrg, { userId: "u2", orgId: "o1", channels: new Set(["org:o1"]) });

    const event = runCompleted("abc", 1234);
    mgr.broadcastToMany(["run:abc", "org:o1"], event);

    expect(wsRun.messages).toHaveLength(1);
    expect(wsOrg.messages).toHaveLength(1);
  });

  it("skips closed sockets and cleans them up", () => {
    const mgr = new WSManager();
    const open = createFakeWS(1);
    const closed = createFakeWS(3);

    mgr.register(open, { userId: "u1", orgId: "o1", channels: new Set(["ch"]) });
    mgr.register(closed, { userId: "u2", orgId: "o1", channels: new Set(["ch"]) });
    expect(mgr.clientCount).toBe(2);

    mgr.broadcast("ch", runStarted("r1", "wf1"));

    expect(open.messages).toHaveLength(1);
    expect(closed.messages).toHaveLength(0);
    /* Closed socket should be auto-unregistered */
    expect(mgr.clientCount).toBe(1);
  });

  it("getClientMeta returns correct metadata", () => {
    const mgr = new WSManager();
    const ws = createFakeWS();
    const meta: ClientMeta = { userId: "u1", orgId: "o1", channels: new Set(["a", "b"]) };

    mgr.register(ws, meta);
    const retrieved = mgr.getClientMeta(ws);
    expect(retrieved?.userId).toBe("u1");
    expect(retrieved?.channels.size).toBe(2);
  });
});

/* ── WS Handlers ────────────────────────────────────────────────── */

describe("WS Handlers", () => {
  it("handles subscribe messages", () => {
    const mgr = new WSManager();
    const ws = createFakeWS();
    mgr.register(ws, { userId: "u1", orgId: "o1", channels: new Set() });

    handleMessage(mgr, ws, JSON.stringify({ type: "subscribe", channel: "run:abc" }));

    expect(mgr.subscriberCount("run:abc")).toBe(1);
    /* Should receive a "subscribed" confirmation */
    expect(ws.messages).toHaveLength(1);
    const msg = JSON.parse(ws.messages[0]) as { type: string; channel: string };
    expect(msg.type).toBe("subscribed");
    expect(msg.channel).toBe("run:abc");
  });

  it("handles unsubscribe messages", () => {
    const mgr = new WSManager();
    const ws = createFakeWS();
    mgr.register(ws, { userId: "u1", orgId: "o1", channels: new Set(["run:abc"]) });
    expect(mgr.subscriberCount("run:abc")).toBe(1);

    handleMessage(mgr, ws, JSON.stringify({ type: "unsubscribe", channel: "run:abc" }));

    expect(mgr.subscriberCount("run:abc")).toBe(0);
    const msg = JSON.parse(ws.messages[0]) as { type: string };
    expect(msg.type).toBe("unsubscribed");
  });

  it("handles ping messages", () => {
    const mgr = new WSManager();
    const ws = createFakeWS();
    mgr.register(ws, { userId: "u1", orgId: "o1", channels: new Set() });

    handleMessage(mgr, ws, JSON.stringify({ type: "ping" }));

    expect(ws.messages).toHaveLength(1);
    const msg = JSON.parse(ws.messages[0]) as { type: string; timestamp: string };
    expect(msg.type).toBe("pong");
    expect(msg.timestamp).toBeDefined();
  });

  it("ignores invalid JSON", () => {
    const mgr = new WSManager();
    const ws = createFakeWS();
    mgr.register(ws, { userId: "u1", orgId: "o1", channels: new Set() });

    handleMessage(mgr, ws, "not valid json{{{");

    expect(ws.messages).toHaveLength(0);
  });

  it("ignores unknown message types", () => {
    const mgr = new WSManager();
    const ws = createFakeWS();
    mgr.register(ws, { userId: "u1", orgId: "o1", channels: new Set() });

    handleMessage(mgr, ws, JSON.stringify({ type: "explode", channel: "run:x" }));

    expect(ws.messages).toHaveLength(0);
  });

  it("handleDisconnect cleans up the client", () => {
    const mgr = new WSManager();
    const ws = createFakeWS();
    mgr.register(ws, { userId: "u1", orgId: "o1", channels: new Set(["ch1", "ch2"]) });
    expect(mgr.clientCount).toBe(1);

    handleDisconnect(mgr, ws);

    expect(mgr.clientCount).toBe(0);
    expect(mgr.subscriberCount("ch1")).toBe(0);
    expect(mgr.subscriberCount("ch2")).toBe(0);
  });
});

/* ── WS Event factories ─────────────────────────────────────────── */

describe("WS Events", () => {
  it("runStarted creates a correct event", () => {
    const event = runStarted("r1", "wf1", { version: 3 });
    expect(event.type).toBe("run:started");
    expect((event.payload as Record<string, unknown>).runId).toBe("r1");
    expect((event.payload as Record<string, unknown>).workflowId).toBe("wf1");
    expect((event.payload as Record<string, unknown>).version).toBe(3);
    expect(event.timestamp).toBeDefined();
  });

  it("runStep creates a correct event", () => {
    const event = runStep("r1", "s1", "b1", "running");
    expect(event.type).toBe("run:step");
    const p = event.payload as Record<string, unknown>;
    expect(p.runId).toBe("r1");
    expect(p.stepId).toBe("s1");
    expect(p.blockId).toBe("b1");
    expect(p.status).toBe("running");
  });

  it("runCompleted creates a correct event", () => {
    const event = runCompleted("r1", 5000);
    expect(event.type).toBe("run:completed");
    expect((event.payload as Record<string, unknown>).durationMs).toBe(5000);
  });

  it("runFailed creates a correct event", () => {
    const event = runFailed("r1", "Timeout exceeded");
    expect(event.type).toBe("run:failed");
    expect((event.payload as Record<string, unknown>).errorMessage).toBe("Timeout exceeded");
  });

  it("runAwaitingAction creates a correct event", () => {
    const event = runAwaitingAction("r1", "b1", "button_click");
    expect(event.type).toBe("run:awaiting_action");
    const p = event.payload as Record<string, unknown>;
    expect(p.blockId).toBe("b1");
    expect(p.actionType).toBe("button_click");
  });

  it("workflowUpdated creates a correct event", () => {
    const event = workflowUpdated("wf1", { name: "New Name" });
    expect(event.type).toBe("workflow:updated");
    expect((event.payload as Record<string, unknown>).workflowId).toBe("wf1");
  });

  it("workflowDeleted creates a correct event", () => {
    const event = workflowDeleted("wf1");
    expect(event.type).toBe("workflow:deleted");
    expect((event.payload as Record<string, unknown>).workflowId).toBe("wf1");
  });
});

/* ── Run routes + WS broadcast integration ───────────────────────── */

describe("Runs with WebSocket broadcast", () => {
  let workflowId: string;
  let testWsManager: WSManager;

  beforeAll(async () => {
    const wfRepo = new WorkflowRepository(db);
    const wf = await wfRepo.create({
      id: `wf-ws-${Date.now()}`,
      orgId: testOrgId,
      name: "WS Broadcast WF",
    });
    workflowId = wf.id;
    testWsManager = new WSManager();
  });

  it("trigger broadcasts run:started to subscribers", async () => {
    const subscriber = createFakeWS();
    testWsManager.register(subscriber, {
      userId: "u1",
      orgId: testOrgId,
      channels: new Set([`org:${testOrgId}`]),
    });

    const auth = createTestAuth(getAuthCtx());
    const app = createTestApp(auth, db, testWsManager);

    const res = await request(app, "POST", `/workflows/${workflowId}/trigger`, {
      triggerType: "api",
    });

    expect(res.status).toBe(201);

    /* The subscriber on org channel should have received a run:started event */
    expect(subscriber.messages.length).toBeGreaterThanOrEqual(1);

    const event = JSON.parse(subscriber.messages[0]) as { type: string; payload: { workflowId: string } };
    expect(event.type).toBe("run:started");
    expect(event.payload.workflowId).toBe(workflowId);

    testWsManager.unregister(subscriber);
  });
});
