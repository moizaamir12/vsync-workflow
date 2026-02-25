import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import type { AuthInstance } from "@vsync/auth";
import { requireAuth, requireOrg, canEditWorkflow, canDeleteWorkflow } from "@vsync/auth";
import type { Database } from "@vsync/db";
import { WorkflowRepository } from "@vsync/db";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import { orgContext } from "../middleware/org-context.js";
import { ok, notFound, forbidden, conflict } from "../lib/response.js";
import { clampLimit, decodeCursor, buildPaginationMeta } from "../lib/pagination.js";
import type { AppEnv } from "../lib/types.js";

const CreateWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
});

const UpdateWorkflowSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  isDisabled: z.boolean().optional(),
});

const IdParam = z.object({ id: z.string().min(1) });

const ListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.string().optional(),
  status: z.enum(["active", "disabled", "all"]).optional(),
});

export function workflowRoutes(auth: AuthInstance, db: Database) {
  const app = new Hono<AppEnv>();
  const repo = new WorkflowRepository(db);

  /* ── Create ────────────────────────────────────────────────── */

  app.post("/", requireAuth(auth), requireOrg(auth), orgContext(), validateBody(CreateWorkflowSchema), async (c) => {
    const authCtx = c.get("auth");
    const { name, description } = c.req.valid("json");

    const workflow = await repo.create({
      id: nanoid(),
      orgId: authCtx.orgId,
      name,
      description: description ?? null,
      createdBy: authCtx.userId,
    });

    return ok(c, workflow, undefined, 201);
  });

  /* ── List (paginated) ──────────────────────────────────────── */

  app.get("/", requireAuth(auth), requireOrg(auth), orgContext(), validateQuery(ListQuerySchema), async (c) => {
    const authCtx = c.get("auth");
    const { cursor: rawCursor, limit: rawLimit } = c.req.valid("query");
    const limit = clampLimit(rawLimit);
    const _cursor = decodeCursor(rawCursor);

    const allWorkflows = await repo.findByOrg(authCtx.orgId);
    const { items, meta } = buildPaginationMeta(
      allWorkflows.slice(0, limit + 1),
      limit,
      "createdAt",
      (w) => w.createdAt?.toISOString() ?? "",
    );

    return ok(c, items, meta);
  });

  /* ── Get ────────────────────────────────────────────────────── */

  app.get("/:id", requireAuth(auth), validateParams(IdParam), async (c) => {
    const { id } = c.req.valid("param");
    const workflow = await repo.findById(id);
    if (!workflow) return notFound(c, "Workflow");

    const active = await repo.getActiveVersion(id);
    return ok(c, { ...workflow, activeVersionDetail: active ?? null });
  });

  /* ── Update ────────────────────────────────────────────────── */

  app.patch("/:id", requireAuth(auth), orgContext(), validateParams(IdParam), validateBody(UpdateWorkflowSchema), async (c) => {
    const authCtx = c.get("auth");
    const { id } = c.req.valid("param");

    const workflow = await repo.findById(id);
    if (!workflow) return notFound(c, "Workflow");

    if (!canEditWorkflow({ role: authCtx.role, orgId: authCtx.orgId }, { orgId: workflow.orgId })) {
      return forbidden(c, "You need member role or higher to edit workflows");
    }

    if (workflow.isLocked && workflow.lockedBy !== authCtx.userId) {
      return conflict(c, "Workflow is locked by another user");
    }

    const body = c.req.valid("json");
    const updated = await repo.update(id, {
      ...body,
      updatedBy: authCtx.userId,
    });

    return ok(c, updated);
  });

  /* ── Delete ────────────────────────────────────────────────── */

  app.delete("/:id", requireAuth(auth), orgContext(), validateParams(IdParam), async (c) => {
    const authCtx = c.get("auth");
    const { id } = c.req.valid("param");

    const workflow = await repo.findById(id);
    if (!workflow) return notFound(c, "Workflow");

    if (!canDeleteWorkflow({ role: authCtx.role, orgId: authCtx.orgId }, { orgId: workflow.orgId })) {
      return forbidden(c, "You need admin role or higher to delete workflows");
    }

    await repo.delete(id);
    return ok(c, { message: "Workflow deleted" });
  });

  /* ── Lock / Unlock ─────────────────────────────────────────── */

  app.post("/:id/lock", requireAuth(auth), orgContext(), validateParams(IdParam), async (c) => {
    const authCtx = c.get("auth");
    const { id } = c.req.valid("param");

    const workflow = await repo.findById(id);
    if (!workflow) return notFound(c, "Workflow");

    if (workflow.isLocked) {
      return conflict(c, `Workflow is already locked by ${workflow.lockedBy}`);
    }

    const updated = await repo.update(id, {
      isLocked: true,
      lockedBy: authCtx.userId,
    });

    return ok(c, updated);
  });

  app.delete("/:id/lock", requireAuth(auth), orgContext(), validateParams(IdParam), async (c) => {
    const authCtx = c.get("auth");
    const { id } = c.req.valid("param");

    const workflow = await repo.findById(id);
    if (!workflow) return notFound(c, "Workflow");

    if (!workflow.isLocked) {
      return ok(c, workflow);
    }

    /* Only the lock holder or an admin can unlock */
    if (workflow.lockedBy !== authCtx.userId && authCtx.role !== "admin" && authCtx.role !== "owner") {
      return forbidden(c, "Only the lock holder or an admin can unlock");
    }

    const updated = await repo.update(id, { isLocked: false, lockedBy: null });
    return ok(c, updated);
  });

  /* ── Duplicate ─────────────────────────────────────────────── */

  app.post("/:id/duplicate", requireAuth(auth), orgContext(), validateParams(IdParam), async (c) => {
    const authCtx = c.get("auth");
    const { id } = c.req.valid("param");

    const original = await repo.findById(id);
    if (!original) return notFound(c, "Workflow");

    const copy = await repo.create({
      id: nanoid(),
      orgId: authCtx.orgId,
      name: `${original.name} (copy)`,
      description: original.description,
      createdBy: authCtx.userId,
    });

    return ok(c, copy, undefined, 201);
  });

  /* ── Publish Public ──────────────────────────────────────── */

  const PublishPublicSchema = z.object({
    accessMode: z.enum(["view", "run"]).default("view"),
    slug: z.string().min(3).max(80).regex(/^[a-z0-9-]+$/).optional(),
    branding: z.object({
      title: z.string().max(120).optional(),
      description: z.string().max(500).optional(),
      accentColor: z.string().max(9).optional(),
      logoUrl: z.string().url().max(500).optional(),
      hideVsyncBranding: z.boolean().optional(),
    }).optional(),
    rateLimit: z.object({
      maxPerMinute: z.number().int().min(1).max(100).default(10),
    }).optional(),
  });

  app.post(
    "/:id/publish-public",
    requireAuth(auth),
    orgContext(),
    validateParams(IdParam),
    validateBody(PublishPublicSchema),
    async (c) => {
      const authCtx = c.get("auth");
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");

      const workflow = await repo.findById(id);
      if (!workflow) return notFound(c, "Workflow");

      if (!canEditWorkflow({ role: authCtx.role, orgId: authCtx.orgId }, { orgId: workflow.orgId })) {
        return forbidden(c, "You need member role or higher to publish workflows");
      }

      /* Generate or validate slug */
      let slug = body.slug;
      if (!slug) {
        /* Auto-generate from workflow name */
        const base = workflow.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 40);
        slug = `${base}-${nanoid(6)}`;
      }

      /* Check slug availability (if different from current) */
      if (slug !== workflow.publicSlug) {
        const existing = await repo.findByPublicSlug(slug);
        if (existing && existing.id !== id) {
          return conflict(c, "This slug is already taken");
        }
      }

      const updated = await repo.update(id, {
        isPublic: true,
        publicSlug: slug,
        publicAccessMode: body.accessMode,
        publicBranding: body.branding ?? null,
        publicRateLimit: body.rateLimit ?? null,
        updatedBy: authCtx.userId,
      });

      return ok(c, updated);
    },
  );

  /* ── Unpublish Public ────────────────────────────────────── */

  app.delete(
    "/:id/publish-public",
    requireAuth(auth),
    orgContext(),
    validateParams(IdParam),
    async (c) => {
      const authCtx = c.get("auth");
      const { id } = c.req.valid("param");

      const workflow = await repo.findById(id);
      if (!workflow) return notFound(c, "Workflow");

      if (!canEditWorkflow({ role: authCtx.role, orgId: authCtx.orgId }, { orgId: workflow.orgId })) {
        return forbidden(c, "You need member role or higher to unpublish workflows");
      }

      const updated = await repo.update(id, {
        isPublic: false,
        publicSlug: null,
        publicAccessMode: "view",
        publicBranding: null,
        publicRateLimit: null,
        updatedBy: authCtx.userId,
      });

      return ok(c, updated);
    },
  );

  return app;
}
