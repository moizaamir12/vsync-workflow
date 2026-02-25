import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
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
} from "@vsync/db";
import type { Database } from "@vsync/db";
import { Interpreter } from "@vsync/engine";
import type { BlockHandler } from "@vsync/engine";

import { runRoutes } from "../routes/runs.js";
import { workflowRoutes } from "../routes/workflows.js";
import { versionRoutes } from "../routes/versions.js";
import { blockRoutes } from "../routes/blocks.js";
import { errorHandler } from "../middleware/error-handler.js";
import type { AppEnv } from "../lib/types.js";
import type { AuthContext } from "@vsync/auth";
import { WSManager } from "../ws/manager.js";
import type { WSLike } from "../ws/manager.js";
import { WorkflowExecutionService } from "../services/WorkflowExecutionService.js";

/**
 * Engine ↔ API integration tests.
 *
 * These tests verify the full pipeline: HTTP trigger → WorkflowExecutionService
 * → Interpreter → block handlers → DB status updates → WS events.
 *
 * A real Interpreter with custom block handlers is used — no mocking.
 */

let pglite: PGlite;
let db: Database;
let testUserId: string;
let testOrgId: string;

/* ── Auth stub ──────────────────────────────────────────────── */

function createTestAuth(authCtx: AuthContext) {
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

/* ── Test app factory ───────────────────────────────────────── */

function createEngineTestApp(
  auth: ReturnType<typeof createTestAuth>,
  database: Database,
  wsManager: WSManager,
  executionService: WorkflowExecutionService,
) {
  const app = new Hono<AppEnv>();
  app.onError(errorHandler);

  app.route("/workflows", workflowRoutes(auth, database));
  app.route("/workflows", versionRoutes(auth, database));
  app.route("/", blockRoutes(auth, database));
  app.route("/", runRoutes(auth, database, wsManager, executionService));

  return app;
}

/* ── Request helper ─────────────────────────────────────────── */

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

/* ── Helpers ────────────────────────────────────────────────── */

/** Wait for a condition to become true by polling. */
async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs = 5000,
  intervalMs = 50,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

/* ── Database setup ─────────────────────────────────────────── */

beforeAll(async () => {
  pglite = new PGlite();
  db = drizzle(pglite, { schema: dbExports }) as unknown as Database;

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
    CREATE TABLE secrets (
      id TEXT PRIMARY KEY,
      org_id UUID NOT NULL,
      name TEXT NOT NULL,
      encrypted_value TEXT NOT NULL,
      iv TEXT NOT NULL,
      description TEXT,
      provider TEXT,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )
  `);

  /* Seed a test user + org */
  const userRepo = new UserRepository(db);
  const orgRepo = new OrgRepository(db);

  const user = await userRepo.create({
    email: "engine-test@vsync.io",
    name: "Engine Test User",
  });
  testUserId = user.id;

  const org = await orgRepo.create({
    name: "Engine Test Org",
    slug: "engine-test-org",
  });
  testOrgId = org.id;

  await orgRepo.addMember(org.id, user.id, "owner");
});

afterAll(async () => {
  await pglite.close();
});

function getAuthCtx(): AuthContext {
  return {
    userId: testUserId,
    email: "engine-test@vsync.io",
    name: "Engine Test User",
    orgId: testOrgId,
    role: "owner",
    sessionId: "test-session",
  };
}

/* ── Workflow seeding helpers ────────────────────────────────── */

async function seedWorkflow(workflowId: string, name: string) {
  const wfRepo = new WorkflowRepository(db);
  await wfRepo.create({
    id: workflowId,
    orgId: testOrgId,
    name,
    activeVersion: 1,
    createdBy: testUserId,
  });
}

async function seedVersion(
  workflowId: string,
  version: number,
  triggerType = "api",
) {
  await db.execute(sql`
    INSERT INTO workflow_versions (workflow_id, version, status, trigger_type)
    VALUES (${workflowId}, ${version}, 'published', ${triggerType})
  `);
}

async function seedBlock(
  id: string,
  workflowId: string,
  version: number,
  name: string,
  type: string,
  order: number,
  logic: Record<string, unknown> = {},
) {
  await db.execute(sql`
    INSERT INTO blocks (id, workflow_id, workflow_version, name, type, logic, "order")
    VALUES (${id}, ${workflowId}, ${version}, ${name}, ${type}, ${JSON.stringify(logic)}::jsonb, ${order})
  `);
}

/* ── Mock WS socket for capturing broadcasts ────────────────── */

function createMockSocket(): WSLike & { messages: string[] } {
  const messages: string[] = [];
  return {
    messages,
    send(data: string) {
      messages.push(data);
    },
    close() {},
    readyState: 1,
  };
}

/* ══════════════════════════════════════════════════════════════
 *  Test suites
 * ══════════════════════════════════════════════════════════════ */

describe("Engine Integration: Trigger and complete a simple workflow", () => {
  const workflowId = `wf-simple-${nanoid(6)}`;

  let app: Hono<AppEnv>;
  let wsManager: WSManager;
  let runRepo: RunRepository;
  let mockSocket: ReturnType<typeof createMockSocket>;

  beforeAll(async () => {
    /* Seed a workflow with a single "string" block */
    await seedWorkflow(workflowId, "Simple String Workflow");
    await seedVersion(workflowId, 1);
    await seedBlock("blk-str-1", workflowId, 1, "Set Greeting", "string", 0, {
      string_template: "Hello, {{event.name}}!",
      string_outputKey: "greeting",
    });

    /* Create interpreter with a custom string handler */
    const interpreter = new Interpreter();
    const stringHandler: BlockHandler = async (block, context) => {
      const logic = block.logic as Record<string, unknown>;
      const template = (logic["string_template"] as string) ?? "";
      const outputKey = (logic["string_outputKey"] as string) ?? "result";

      /* Simple template replacement */
      const resolved = template.replace(/\{\{event\.(\w+)\}\}/g, (_m, key) => {
        return String((context.event as Record<string, unknown>)[key] ?? "");
      });

      return { stateDelta: { [outputKey]: resolved } };
    };
    interpreter.blockExecutor.registerHandler("string", stringHandler);

    wsManager = new WSManager();
    mockSocket = createMockSocket();
    wsManager.register(mockSocket, {
      userId: testUserId,
      orgId: testOrgId,
      channels: new Set([`org:${testOrgId}`]),
    });

    const executionService = new WorkflowExecutionService(db, wsManager, interpreter);
    const auth = createTestAuth(getAuthCtx());
    app = createEngineTestApp(auth, db, wsManager, executionService);
    runRepo = new RunRepository(db);
  });

  it("triggers a run that completes with correct state", async () => {
    const res = await request(app, "POST", `/workflows/${workflowId}/trigger`, {
      triggerType: "api",
      metadata: { name: "World" },
    });

    expect(res.status).toBe(201);
    const json = (await res.json()) as { data: { id: string; status: string } };
    const runId = json.data.id;
    expect(runId).toBeDefined();

    /* Background execution is async — wait for it to finish */
    await waitFor(async () => {
      const run = await runRepo.findById(runId);
      return run?.status === "completed" || run?.status === "failed";
    });

    const run = await runRepo.findById(runId);
    expect(run).toBeDefined();
    expect(run!.status).toBe("completed");
    expect(run!.durationMs).toBeGreaterThanOrEqual(0);

    /* Steps should be stored in stepsJson */
    const steps = run!.stepsJson as unknown[];
    expect(Array.isArray(steps)).toBe(true);
    expect(steps.length).toBeGreaterThanOrEqual(1);
  });

  it("broadcasts WS events for the completed run", async () => {
    /* The previous test should have triggered broadcasts.
     * Give a small buffer for async events to propagate. */
    await new Promise((r) => setTimeout(r, 100));

    /* At least run:started and run:completed events expected */
    expect(mockSocket.messages.length).toBeGreaterThanOrEqual(2);

    const parsed = mockSocket.messages.map((m) => JSON.parse(m));
    const types = parsed.map((e: { type: string }) => e.type);

    expect(types).toContain("run:started");
    /* run:step or run:completed should be present */
    const hasTerminal = types.includes("run:completed") || types.includes("run:failed");
    expect(hasTerminal).toBe(true);
  });
});

describe("Engine Integration: Multi-block workflow with object + string blocks", () => {
  const workflowId = `wf-multi-${nanoid(6)}`;

  let app: Hono<AppEnv>;
  let runRepo: RunRepository;

  beforeAll(async () => {
    await seedWorkflow(workflowId, "Multi-Block Workflow");
    await seedVersion(workflowId, 1);

    /* Block 1: object — sets some state */
    await seedBlock("blk-obj-1", workflowId, 1, "Init Data", "object", 0, {
      object_template: { counter: 42, label: "test" },
      object_outputKey: "data",
    });

    /* Block 2: string — reads from state */
    await seedBlock("blk-str-2", workflowId, 1, "Format Output", "string", 1, {
      string_template: "Count is: {{state.counter}}",
      string_outputKey: "formatted",
    });

    /* Create interpreter with handlers for both block types */
    const interpreter = new Interpreter();

    const objectHandler: BlockHandler = async (block) => {
      const logic = block.logic as Record<string, unknown>;
      const template = logic["object_template"] as Record<string, unknown> | undefined;
      const outputKey = (logic["object_outputKey"] as string) ?? "result";
      return { stateDelta: { [outputKey]: template ?? {} } };
    };

    const stringHandler: BlockHandler = async (block, context) => {
      const logic = block.logic as Record<string, unknown>;
      const template = (logic["string_template"] as string) ?? "";
      const outputKey = (logic["string_outputKey"] as string) ?? "result";

      const resolved = template.replace(/\{\{state\.(\w+)\}\}/g, (_m, key) => {
        return String(context.state[key] ?? "");
      });

      return { stateDelta: { [outputKey]: resolved } };
    };

    interpreter.blockExecutor.registerHandler("object", objectHandler);
    interpreter.blockExecutor.registerHandler("string", stringHandler);

    const wsManager = new WSManager();
    const executionService = new WorkflowExecutionService(db, wsManager, interpreter);
    const auth = createTestAuth(getAuthCtx());
    app = createEngineTestApp(auth, db, wsManager, executionService);
    runRepo = new RunRepository(db);
  });

  it("executes both blocks in sequence", async () => {
    const res = await request(app, "POST", `/workflows/${workflowId}/trigger`, {
      triggerType: "api",
    });

    expect(res.status).toBe(201);
    const json = (await res.json()) as { data: { id: string } };
    const runId = json.data.id;

    await waitFor(async () => {
      const run = await runRepo.findById(runId);
      return run?.status === "completed" || run?.status === "failed";
    });

    const run = await runRepo.findById(runId);
    expect(run!.status).toBe("completed");

    /* Verify two steps were executed */
    const steps = run!.stepsJson as unknown[];
    expect(Array.isArray(steps)).toBe(true);
    expect(steps.length).toBe(2);
  });
});

describe("Engine Integration: Cancel a running workflow", () => {
  const workflowId = `wf-cancel-${nanoid(6)}`;

  let app: Hono<AppEnv>;
  let runRepo: RunRepository;

  beforeAll(async () => {
    await seedWorkflow(workflowId, "Cancellable Workflow");
    await seedVersion(workflowId, 1);

    /* A single slow block that takes 2 seconds */
    await seedBlock("blk-slow-1", workflowId, 1, "Slow Block", "sleep", 0, {
      sleep_durationMs: 2000,
    });

    const interpreter = new Interpreter();

    const sleepHandler: BlockHandler = async (block) => {
      const logic = block.logic as Record<string, unknown>;
      const ms = (logic["sleep_durationMs"] as number) ?? 100;
      await new Promise((r) => setTimeout(r, ms));
      return { stateDelta: { slept: true } };
    };

    interpreter.blockExecutor.registerHandler("sleep", sleepHandler);

    const wsManager = new WSManager();
    const executionService = new WorkflowExecutionService(db, wsManager, interpreter);
    const auth = createTestAuth(getAuthCtx());
    app = createEngineTestApp(auth, db, wsManager, executionService);
    runRepo = new RunRepository(db);
  });

  it("cancels a running or pending run via POST /runs/:id/cancel", async () => {
    const res = await request(app, "POST", `/workflows/${workflowId}/trigger`, {
      triggerType: "api",
    });

    expect(res.status).toBe(201);
    const json = (await res.json()) as { data: { id: string } };
    const runId = json.data.id;

    /* Immediately cancel — the run may still be pending or just starting */
    const cancelRes = await request(app, "POST", `/runs/${runId}/cancel`);
    expect(cancelRes.status).toBe(200);

    const cancelJson = (await cancelRes.json()) as { data: { status: string } };
    expect(cancelJson.data.status).toBe("cancelled");
  });
});

describe("Engine Integration: Failed workflow propagates error", () => {
  const workflowId = `wf-fail-${nanoid(6)}`;

  let app: Hono<AppEnv>;
  let runRepo: RunRepository;

  beforeAll(async () => {
    await seedWorkflow(workflowId, "Failing Workflow");
    await seedVersion(workflowId, 1);

    /* A block whose handler always throws */
    await seedBlock("blk-boom-1", workflowId, 1, "Boom Block", "code", 0, {
      code_source: "throw new Error('kaboom')",
    });

    const interpreter = new Interpreter();

    const codeHandler: BlockHandler = async () => {
      throw new Error("kaboom");
    };

    interpreter.blockExecutor.registerHandler("code", codeHandler);

    const wsManager = new WSManager();
    const executionService = new WorkflowExecutionService(db, wsManager, interpreter);
    const auth = createTestAuth(getAuthCtx());
    app = createEngineTestApp(auth, db, wsManager, executionService);
    runRepo = new RunRepository(db);
  });

  it("marks run as failed when a block throws", async () => {
    const res = await request(app, "POST", `/workflows/${workflowId}/trigger`, {
      triggerType: "api",
    });

    expect(res.status).toBe(201);
    const json = (await res.json()) as { data: { id: string } };
    const runId = json.data.id;

    await waitFor(async () => {
      const run = await runRepo.findById(runId);
      return run?.status === "completed" || run?.status === "failed";
    });

    const run = await runRepo.findById(runId);
    expect(run!.status).toBe("failed");
    /* Error message should contain the thrown message */
    expect(run!.errorMessage).toBeDefined();
  });
});

describe("Engine Integration: Trigger non-existent version", () => {
  const workflowId = `wf-noversion-${nanoid(6)}`;

  let app: Hono<AppEnv>;
  let runRepo: RunRepository;

  beforeAll(async () => {
    /* Workflow exists but with activeVersion = 99 which has no version record */
    const wfRepo = new WorkflowRepository(db);
    await wfRepo.create({
      id: workflowId,
      orgId: testOrgId,
      name: "No Version Workflow",
      activeVersion: 99,
      createdBy: testUserId,
    });

    const interpreter = new Interpreter();
    const wsManager = new WSManager();
    const executionService = new WorkflowExecutionService(db, wsManager, interpreter);
    const auth = createTestAuth(getAuthCtx());
    app = createEngineTestApp(auth, db, wsManager, executionService);
    runRepo = new RunRepository(db);
  });

  it("marks run as failed when version does not exist", async () => {
    const res = await request(app, "POST", `/workflows/${workflowId}/trigger`, {
      triggerType: "api",
    });

    expect(res.status).toBe(201);
    const json = (await res.json()) as { data: { id: string } };
    const runId = json.data.id;

    /* triggerRun is async but version-not-found is handled synchronously in triggerRun */
    await waitFor(async () => {
      const run = await runRepo.findById(runId);
      return run?.status === "failed";
    });

    const run = await runRepo.findById(runId);
    expect(run!.status).toBe("failed");
    expect(run!.errorMessage).toContain("not found");
  });
});

describe("Engine Integration: SSE live endpoint", () => {
  const workflowId = `wf-sse-${nanoid(6)}`;

  let app: Hono<AppEnv>;
  let runRepo: RunRepository;

  beforeAll(async () => {
    await seedWorkflow(workflowId, "SSE Workflow");
    await seedVersion(workflowId, 1);
    await seedBlock("blk-sse-1", workflowId, 1, "Quick Block", "string", 0, {
      string_template: "done",
      string_outputKey: "result",
    });

    const interpreter = new Interpreter();

    const stringHandler: BlockHandler = async (block) => {
      const logic = block.logic as Record<string, unknown>;
      const outputKey = (logic["string_outputKey"] as string) ?? "result";
      const template = (logic["string_template"] as string) ?? "";
      return { stateDelta: { [outputKey]: template } };
    };

    interpreter.blockExecutor.registerHandler("string", stringHandler);

    const wsManager = new WSManager();
    const executionService = new WorkflowExecutionService(db, wsManager, interpreter);
    const auth = createTestAuth(getAuthCtx());
    app = createEngineTestApp(auth, db, wsManager, executionService);
    runRepo = new RunRepository(db);
  });

  it("GET /runs/:id/live returns SSE stream that closes on terminal state", async () => {
    /* Trigger a run first */
    const triggerRes = await request(app, "POST", `/workflows/${workflowId}/trigger`, {
      triggerType: "api",
    });

    expect(triggerRes.status).toBe(201);
    const json = (await triggerRes.json()) as { data: { id: string } };
    const runId = json.data.id;

    /* Wait for the run to complete */
    await waitFor(async () => {
      const run = await runRepo.findById(runId);
      return run?.status === "completed" || run?.status === "failed";
    });

    /* Now request the SSE endpoint — since the run is already completed
     * it should immediately emit a status event and close. */
    const sseRes = await app.request(`/runs/${runId}/live`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    expect(sseRes.status).toBe(200);
    expect(sseRes.headers.get("content-type")).toContain("text/event-stream");

    const body = await sseRes.text();
    expect(body).toContain("event: status");
    expect(body).toContain("completed");
  });
});

describe("Engine Integration: Actions endpoint rejects when not awaiting", () => {
  const workflowId = `wf-action-reject-${nanoid(6)}`;

  let app: Hono<AppEnv>;
  let runRepo: RunRepository;

  beforeAll(async () => {
    await seedWorkflow(workflowId, "Action Reject Workflow");
    await seedVersion(workflowId, 1);
    await seedBlock("blk-ar-1", workflowId, 1, "Quick Block", "string", 0, {
      string_template: "done",
      string_outputKey: "result",
    });

    const interpreter = new Interpreter();

    const stringHandler: BlockHandler = async (block) => {
      const logic = block.logic as Record<string, unknown>;
      const outputKey = (logic["string_outputKey"] as string) ?? "result";
      return { stateDelta: { [outputKey]: "done" } };
    };

    interpreter.blockExecutor.registerHandler("string", stringHandler);

    const wsManager = new WSManager();
    const executionService = new WorkflowExecutionService(db, wsManager, interpreter);
    const auth = createTestAuth(getAuthCtx());
    app = createEngineTestApp(auth, db, wsManager, executionService);
    runRepo = new RunRepository(db);
  });

  it("returns error when submitting action to a completed run", async () => {
    /* Trigger and wait for completion */
    const triggerRes = await request(app, "POST", `/workflows/${workflowId}/trigger`, {
      triggerType: "api",
    });

    const json = (await triggerRes.json()) as { data: { id: string } };
    const runId = json.data.id;

    await waitFor(async () => {
      const run = await runRepo.findById(runId);
      return run?.status === "completed";
    });

    /* Try to submit an action — should fail */
    const actionRes = await request(app, "POST", `/runs/${runId}/actions`, {
      actionType: "submit",
      payload: { field: "value" },
    });

    expect(actionRes.status).toBe(422);
    const actionJson = (await actionRes.json()) as { error: { code: string } };
    expect(actionJson.error.code).toBe("ACTION_FAILED");
  });
});

describe("Engine Integration: WorkflowExecutionService unit behaviour", () => {
  it("cancelRun sets and isCancelled reads the flag", () => {
    const interpreter = new Interpreter();
    const wsManager = new WSManager();
    const service = new WorkflowExecutionService(db, wsManager, interpreter);

    expect(service.isCancelled("run-1")).toBe(false);
    service.cancelRun("run-1");
    expect(service.isCancelled("run-1")).toBe(true);
  });
});
