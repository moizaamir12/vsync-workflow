import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import type { AuthInstance } from "@vsync/auth";
import { requireAuth, requireOrg } from "@vsync/auth";
import type { Database } from "@vsync/db";
import { ArtifactRepository } from "@vsync/db";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import { orgContext } from "../middleware/org-context.js";
import { ok, notFound, err } from "../lib/response.js";
import { clampLimit, buildPaginationMeta } from "../lib/pagination.js";
import type { AppEnv } from "../lib/types.js";

const IdParam = z.object({ id: z.string().min(1) });

const ListQuerySchema = z.object({
  runId: z.string().optional(),
  workflowId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.string().optional(),
});

const CreateArtifactSchema = z.object({
  runId: z.string().min(1),
  workflowId: z.string().optional(),
  type: z.string().min(1),
  name: z.string().min(1).max(255),
  filePath: z.string().optional(),
  fileUrl: z.string().optional(),
  fileSize: z.number().int().optional(),
  mimeType: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  source: z.string().optional(),
  blockId: z.string().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
});

const BulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export function artifactRoutes(auth: AuthInstance, db: Database) {
  const app = new Hono<AppEnv>();
  const repo = new ArtifactRepository(db);

  /* ── List artifacts ────────────────────────────────────────── */

  app.get("/", requireAuth(auth), requireOrg(auth), orgContext(), validateQuery(ListQuerySchema), async (c) => {
    const query = c.req.valid("query");
    const limit = clampLimit(query.limit);

    if (!query.runId) {
      return err(c, "BAD_REQUEST", "runId query parameter is required", 400);
    }

    const allArtifacts = await repo.findByRun(query.runId);
    const { items, meta } = buildPaginationMeta(
      allArtifacts.slice(0, limit + 1),
      limit,
      "createdAt",
      (a) => a.createdAt?.toISOString() ?? "",
    );

    return ok(c, items, meta);
  });

  /* ── Get artifact ──────────────────────────────────────────── */

  app.get("/:id", requireAuth(auth), requireOrg(auth), orgContext(), validateParams(IdParam), async (c) => {
    const authCtx = c.get("auth");
    const { id } = c.req.valid("param");

    const { eq, and } = await import("drizzle-orm");
    const { artifacts } = await import("@vsync/db");
    const artifact = await db.query.artifacts.findFirst({
      where: and(eq(artifacts.id, id), eq(artifacts.orgId, authCtx.orgId)),
    });

    if (!artifact) return notFound(c, "Artifact");

    return ok(c, artifact);
  });

  /* ── Upload artifact ───────────────────────────────────────── */

  app.post("/", requireAuth(auth), requireOrg(auth), orgContext(), validateBody(CreateArtifactSchema), async (c) => {
    const authCtx = c.get("auth");
    const body = c.req.valid("json");

    const artifact = await repo.create({
      id: nanoid(),
      runId: body.runId,
      workflowId: body.workflowId ?? null,
      orgId: authCtx.orgId,
      type: body.type,
      name: body.name,
      filePath: body.filePath ?? null,
      fileUrl: body.fileUrl ?? null,
      fileSize: body.fileSize ?? null,
      mimeType: body.mimeType ?? null,
      metadata: body.metadata ?? null,
      source: body.source ?? null,
      blockId: body.blockId ?? null,
      width: body.width ?? null,
      height: body.height ?? null,
    });

    return ok(c, artifact, undefined, 201);
  });

  /* ── Delete artifact ───────────────────────────────────────── */

  app.delete("/:id", requireAuth(auth), orgContext(), validateParams(IdParam), async (c) => {
    const { id } = c.req.valid("param");
    await repo.delete(id);
    return ok(c, { message: "Artifact deleted" });
  });

  /* ── Bulk delete ───────────────────────────────────────────── */

  app.delete("/bulk", requireAuth(auth), orgContext(), validateBody(BulkDeleteSchema), async (c) => {
    const { ids } = c.req.valid("json");
    await repo.bulkDelete(ids);
    return ok(c, { message: `${ids.length} artifacts deleted` });
  });

  return app;
}
