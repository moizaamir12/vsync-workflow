import { Hono } from "hono";
import { z } from "zod";
import type { AuthInstance } from "@vsync/auth";
import { requireAuth, requireOrg, canEditWorkflow } from "@vsync/auth";
import type { Database } from "@vsync/db";
import { WorkflowRepository } from "@vsync/db";
import { validateBody, validateParams } from "../middleware/validate.js";
import { orgContext } from "../middleware/org-context.js";
import { ok, notFound, forbidden, err } from "../lib/response.js";
import type { AppEnv } from "../lib/types.js";

const WorkflowParam = z.object({ id: z.string().min(1) });
const VersionParam = z.object({ id: z.string().min(1), v: z.string().regex(/^\d+$/) });

const UpdateVersionSchema = z.object({
  triggerType: z.enum(["interactive", "api", "schedule", "webhook", "event"]).optional(),
  triggerConfig: z.record(z.unknown()).optional(),
  changelog: z.string().max(2000).optional(),
});

export function versionRoutes(auth: AuthInstance, db: Database) {
  const app = new Hono<AppEnv>();
  const repo = new WorkflowRepository(db);

  /* ── Create new version ────────────────────────────────────── */

  app.post("/:id/versions", requireAuth(auth), requireOrg(auth), orgContext(), validateParams(WorkflowParam), async (c) => {
    const authCtx = c.get("auth");
    const { id } = c.req.valid("param");

    const workflow = await repo.findById(id);
    if (!workflow) return notFound(c, "Workflow");

    if (!canEditWorkflow({ role: authCtx.role, orgId: authCtx.orgId }, { orgId: workflow.orgId })) {
      return forbidden(c, "You need member role or higher to create versions");
    }

    const versions = await repo.findVersions(id);
    const nextVersion = versions.length > 0 ? versions[0].version + 1 : 1;

    const result = await repo.createVersion(
      { workflowId: id, version: nextVersion },
      [],
    );

    return ok(c, result, undefined, 201);
  });

  /* ── List versions ─────────────────────────────────────────── */

  app.get("/:id/versions", requireAuth(auth), validateParams(WorkflowParam), async (c) => {
    const { id } = c.req.valid("param");
    const versions = await repo.findVersions(id);
    return ok(c, versions);
  });

  /* ── Get version with blocks ───────────────────────────────── */

  app.get("/:id/versions/:v", requireAuth(auth), validateParams(VersionParam), async (c) => {
    const { id, v } = c.req.valid("param");
    const versionNum = parseInt(v, 10);

    const versions = await repo.findVersions(id);
    const version = versions.find((ver) => ver.version === versionNum);
    if (!version) return notFound(c, "Version");

    return ok(c, version);
  });

  /* ── Update version metadata ───────────────────────────────── */

  app.patch("/:id/versions/:v", requireAuth(auth), orgContext(), validateParams(VersionParam), validateBody(UpdateVersionSchema), async (c) => {
    const authCtx = c.get("auth");
    const { id, v } = c.req.valid("param");
    const versionNum = parseInt(v, 10);

    const workflow = await repo.findById(id);
    if (!workflow) return notFound(c, "Workflow");

    if (!canEditWorkflow({ role: authCtx.role, orgId: authCtx.orgId }, { orgId: workflow.orgId })) {
      return forbidden(c);
    }

    /**
     * Direct version metadata update. The WorkflowRepository
     * could be extended with an updateVersion method; for now
     * we use the raw DB access.
     */
    const { eq, and } = await import("drizzle-orm");
    const { workflowVersions } = await import("@vsync/db");
    const body = c.req.valid("json");

    const [updated] = await db
      .update(workflowVersions)
      .set({ ...body, updatedAt: new Date() })
      .where(and(
        eq(workflowVersions.workflowId, id),
        eq(workflowVersions.version, versionNum),
      ))
      .returning();

    if (!updated) return notFound(c, "Version");
    return ok(c, updated);
  });

  /* ── Publish version ───────────────────────────────────────── */

  app.post("/:id/versions/:v/publish", requireAuth(auth), orgContext(), validateParams(VersionParam), async (c) => {
    const authCtx = c.get("auth");
    const { id, v } = c.req.valid("param");
    const versionNum = parseInt(v, 10);

    const workflow = await repo.findById(id);
    if (!workflow) return notFound(c, "Workflow");

    if (!canEditWorkflow({ role: authCtx.role, orgId: authCtx.orgId }, { orgId: workflow.orgId })) {
      return forbidden(c);
    }

    try {
      const updated = await repo.publishVersion(id, versionNum);
      return ok(c, updated);
    } catch (e) {
      return err(c, "PUBLISH_FAILED", (e as Error).message, 400);
    }
  });

  /* ── Delete draft version ──────────────────────────────────── */

  app.delete("/:id/versions/:v", requireAuth(auth), orgContext(), validateParams(VersionParam), async (c) => {
    const authCtx = c.get("auth");
    const { id, v } = c.req.valid("param");
    const versionNum = parseInt(v, 10);

    const workflow = await repo.findById(id);
    if (!workflow) return notFound(c, "Workflow");

    if (!canEditWorkflow({ role: authCtx.role, orgId: authCtx.orgId }, { orgId: workflow.orgId })) {
      return forbidden(c);
    }

    const { eq, and } = await import("drizzle-orm");
    const { workflowVersions } = await import("@vsync/db");

    await db
      .delete(workflowVersions)
      .where(and(
        eq(workflowVersions.workflowId, id),
        eq(workflowVersions.version, versionNum),
      ));

    return ok(c, { message: "Version deleted" });
  });

  return app;
}
