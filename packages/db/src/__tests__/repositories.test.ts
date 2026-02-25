import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import * as schema from "../schema/index.js";
import { WorkflowRepository } from "../repositories/workflow-repository.js";
import { RunRepository } from "../repositories/run-repository.js";
import { UserRepository } from "../repositories/user-repository.js";
import { OrgRepository } from "../repositories/org-repository.js";
import { ArtifactRepository } from "../repositories/artifact-repository.js";
import type { Database } from "../client.js";

/**
 * Integration tests for repository classes using PGlite (in-memory Postgres).
 * PGlite runs a full Postgres engine in WASM, so pgTable schemas work
 * without modification — no mocks, no stubs.
 */

let pglite: PGlite;
let db: Database;

beforeAll(async () => {
  pglite = new PGlite();
  db = drizzle(pglite, { schema }) as unknown as Database;

  /* Create tables via raw DDL — mirrors the Drizzle schema definitions.
     gen_random_uuid() is built-in since Postgres 13 / PGlite. */

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
});

afterAll(async () => {
  await pglite.close();
});

/* ── Seed helpers ──────────────────────────────────────────────── */

let testOrgId: string;
let testUserId: string;

async function seedUserAndOrg() {
  const userRepo = new UserRepository(db);
  const orgRepo = new OrgRepository(db);

  const user = await userRepo.create({
    email: `test-${Date.now()}@vsync.io`,
    name: "Test User",
  });
  testUserId = user.id;

  const org = await orgRepo.create({
    name: "Test Org",
    slug: `test-org-${Date.now()}`,
  });
  testOrgId = org.id;

  await orgRepo.addMember(org.id, user.id, "owner");

  return { user, org };
}

/* ── UserRepository ───────────────────────────────────────────── */

describe("UserRepository", () => {
  const repo = () => new UserRepository(db);

  it("creates and retrieves a user by ID", async () => {
    const created = await repo().create({
      email: `user-${Date.now()}@test.com`,
      name: "Alice",
    });

    expect(created.id).toBeDefined();
    expect(created.name).toBe("Alice");

    const found = await repo().findById(created.id);
    expect(found?.email).toBe(created.email);
  });

  it("finds a user by email", async () => {
    const email = `lookup-${Date.now()}@test.com`;
    await repo().create({ email, name: "Bob" });

    const found = await repo().findByEmail(email);
    expect(found?.name).toBe("Bob");
  });

  it("updates a user's name", async () => {
    const created = await repo().create({
      email: `update-${Date.now()}@test.com`,
      name: "Before",
    });

    const updated = await repo().update(created.id, { name: "After" });
    expect(updated.name).toBe("After");
  });
});

/* ── OrgRepository ────────────────────────────────────────────── */

describe("OrgRepository", () => {
  const repo = () => new OrgRepository(db);

  it("creates an org and finds it by slug", async () => {
    const slug = `org-${Date.now()}`;
    const org = await repo().create({ name: "My Org", slug });

    const found = await repo().findBySlug(slug);
    expect(found?.id).toBe(org.id);
  });

  it("adds members and retrieves their roles", async () => {
    const userRepo = new UserRepository(db);
    const user = await userRepo.create({
      email: `member-${Date.now()}@test.com`,
      name: "Member",
    });
    const org = await repo().create({
      name: "Membership Org",
      slug: `membership-${Date.now()}`,
    });

    await repo().addMember(org.id, user.id, "admin");

    const role = await repo().getMemberRole(org.id, user.id);
    expect(role).toBe("admin");

    const members = await repo().getMembers(org.id);
    expect(members).toHaveLength(1);
  });
});

/* ── WorkflowRepository ──────────────────────────────────────── */

describe("WorkflowRepository", () => {
  const repo = () => new WorkflowRepository(db);

  it("creates a workflow and retrieves it", async () => {
    const { org } = await seedUserAndOrg();

    const wf = await repo().create({
      id: `wf-${Date.now()}`,
      orgId: org.id,
      name: "Test Workflow",
    });

    expect(wf.name).toBe("Test Workflow");

    const found = await repo().findById(wf.id);
    expect(found?.orgId).toBe(org.id);
  });

  it("lists workflows by organization", async () => {
    const { org } = await seedUserAndOrg();

    await repo().create({
      id: `wf-list-1-${Date.now()}`,
      orgId: org.id,
      name: "Workflow A",
    });
    await repo().create({
      id: `wf-list-2-${Date.now()}`,
      orgId: org.id,
      name: "Workflow B",
    });

    const list = await repo().findByOrg(org.id);
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  it("updates a workflow", async () => {
    const { org } = await seedUserAndOrg();

    const wf = await repo().create({
      id: `wf-upd-${Date.now()}`,
      orgId: org.id,
      name: "Original",
    });

    const updated = await repo().update(wf.id, { name: "Renamed" });
    expect(updated.name).toBe("Renamed");
  });

  it("deletes a workflow", async () => {
    const { org } = await seedUserAndOrg();

    const wf = await repo().create({
      id: `wf-del-${Date.now()}`,
      orgId: org.id,
      name: "To Delete",
    });

    await repo().delete(wf.id);
    const found = await repo().findById(wf.id);
    expect(found).toBeUndefined();
  });

  it("creates a version with blocks atomically", async () => {
    const { org } = await seedUserAndOrg();
    const wfId = `wf-ver-${Date.now()}`;

    await repo().create({ id: wfId, orgId: org.id, name: "Versioned" });

    const result = await repo().createVersion(
      { workflowId: wfId, version: 1 },
      [
        {
          id: `blk-1-${Date.now()}`,
          workflowId: wfId,
          workflowVersion: 1,
          name: "Fetch Data",
          type: "fetch",
          order: 0,
          logic: { url: "https://api.example.com" },
        },
        {
          id: `blk-2-${Date.now()}`,
          workflowId: wfId,
          workflowVersion: 1,
          name: "Transform",
          type: "object",
          order: 1,
          logic: { mapping: {} },
        },
      ],
    );

    expect(result.version.version).toBe(1);
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0].type).toBe("fetch");
  });

  it("publishes a version and sets activeVersion", async () => {
    const { org } = await seedUserAndOrg();
    const wfId = `wf-pub-${Date.now()}`;

    await repo().create({ id: wfId, orgId: org.id, name: "Publishable" });
    await repo().createVersion({ workflowId: wfId, version: 1 }, []);

    const updated = await repo().publishVersion(wfId, 1);
    expect(updated.activeVersion).toBe(1);

    const active = await repo().getActiveVersion(wfId);
    expect(active?.version.status).toBe("published");
  });

  it("lists versions for a workflow", async () => {
    const { org } = await seedUserAndOrg();
    const wfId = `wf-vers-${Date.now()}`;

    await repo().create({ id: wfId, orgId: org.id, name: "Multi-version" });
    await repo().createVersion({ workflowId: wfId, version: 1 }, []);
    await repo().createVersion({ workflowId: wfId, version: 2 }, []);

    const versions = await repo().findVersions(wfId);
    expect(versions).toHaveLength(2);
    /* Newest first */
    expect(versions[0].version).toBe(2);
  });
});

/* ── RunRepository ────────────────────────────────────────────── */

describe("RunRepository", () => {
  const repo = () => new RunRepository(db);

  it("creates a run and retrieves it", async () => {
    const { org } = await seedUserAndOrg();
    const wfRepo = new WorkflowRepository(db);
    const wfId = `wf-run-${Date.now()}`;
    await wfRepo.create({ id: wfId, orgId: org.id, name: "Run Target" });

    const run = await repo().create({
      id: `run-${Date.now()}`,
      workflowId: wfId,
      version: 1,
      orgId: org.id,
      triggerType: "api",
    });

    expect(run.status).toBe("pending");

    const found = await repo().findById(run.id);
    expect(found?.workflowId).toBe(wfId);
  });

  it("updates run status with timing fields", async () => {
    const { org } = await seedUserAndOrg();
    const wfRepo = new WorkflowRepository(db);
    const wfId = `wf-run-stat-${Date.now()}`;
    await wfRepo.create({ id: wfId, orgId: org.id, name: "Status Target" });

    const run = await repo().create({
      id: `run-stat-${Date.now()}`,
      workflowId: wfId,
      version: 1,
      orgId: org.id,
    });

    const updated = await repo().updateStatus(run.id, "completed", {
      completedAt: new Date(),
      durationMs: 1234,
    });

    expect(updated.status).toBe("completed");
    expect(updated.durationMs).toBe(1234);
  });

  it("lists runs by workflow", async () => {
    const { org } = await seedUserAndOrg();
    const wfRepo = new WorkflowRepository(db);
    const wfId = `wf-run-list-${Date.now()}`;
    await wfRepo.create({ id: wfId, orgId: org.id, name: "List Target" });

    await repo().create({
      id: `run-list-1-${Date.now()}`,
      workflowId: wfId,
      version: 1,
      orgId: org.id,
    });
    await repo().create({
      id: `run-list-2-${Date.now()}`,
      workflowId: wfId,
      version: 1,
      orgId: org.id,
    });

    const list = await repo().findByWorkflow(wfId);
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  it("counts runs by org", async () => {
    const { org } = await seedUserAndOrg();
    const wfRepo = new WorkflowRepository(db);
    const wfId = `wf-run-count-${Date.now()}`;
    await wfRepo.create({ id: wfId, orgId: org.id, name: "Count Target" });

    await repo().create({
      id: `run-count-${Date.now()}`,
      workflowId: wfId,
      version: 1,
      orgId: org.id,
    });

    const count = await repo().countByOrg(org.id);
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

/* ── ArtifactRepository ───────────────────────────────────────── */

describe("ArtifactRepository", () => {
  const repo = () => new ArtifactRepository(db);

  it("creates an artifact and finds it by run", async () => {
    const { org } = await seedUserAndOrg();
    const wfRepo = new WorkflowRepository(db);
    const runRepo = new RunRepository(db);

    const wfId = `wf-art-${Date.now()}`;
    await wfRepo.create({ id: wfId, orgId: org.id, name: "Artifact WF" });

    const run = await runRepo.create({
      id: `run-art-${Date.now()}`,
      workflowId: wfId,
      version: 1,
      orgId: org.id,
    });

    const artifact = await repo().create({
      id: `art-${Date.now()}`,
      runId: run.id,
      workflowId: wfId,
      orgId: org.id,
      type: "image",
      name: "screenshot.png",
      mimeType: "image/png",
      fileSize: 12345,
    });

    expect(artifact.type).toBe("image");

    const found = await repo().findByRun(run.id);
    expect(found).toHaveLength(1);
    expect(found[0].name).toBe("screenshot.png");
  });

  it("deletes artifacts individually and in bulk", async () => {
    const { org } = await seedUserAndOrg();
    const wfRepo = new WorkflowRepository(db);
    const runRepo = new RunRepository(db);

    const wfId = `wf-art-del-${Date.now()}`;
    await wfRepo.create({ id: wfId, orgId: org.id, name: "Delete WF" });

    const run = await runRepo.create({
      id: `run-art-del-${Date.now()}`,
      workflowId: wfId,
      version: 1,
      orgId: org.id,
    });

    const a1 = await repo().create({
      id: `art-del-1-${Date.now()}`,
      runId: run.id,
      type: "data",
      name: "file1.csv",
    });
    const a2 = await repo().create({
      id: `art-del-2-${Date.now()}`,
      runId: run.id,
      type: "data",
      name: "file2.csv",
    });

    /* Single delete */
    await repo().delete(a1.id);
    const afterSingle = await repo().findByRun(run.id);
    expect(afterSingle).toHaveLength(1);

    /* Bulk delete */
    await repo().bulkDelete([a2.id]);
    const afterBulk = await repo().findByRun(run.id);
    expect(afterBulk).toHaveLength(0);
  });
});
