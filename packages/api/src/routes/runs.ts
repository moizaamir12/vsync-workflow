import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { streamSSE } from "hono/streaming";
import type { AuthInstance } from "@vsync/auth";
import { requireAuth, requireOrg } from "@vsync/auth";
import type { Database } from "@vsync/db";
import { RunRepository, WorkflowRepository } from "@vsync/db";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import { orgContext } from "../middleware/org-context.js";
import { ok, notFound, err } from "../lib/response.js";
import { clampLimit, decodeCursor, buildPaginationMeta } from "../lib/pagination.js";
import type { AppEnv } from "../lib/types.js";
import type { WSManager } from "../ws/manager.js";
import { runStarted, runCompleted, runFailed } from "../ws/events.js";
import type { WorkflowExecutionService } from "../services/WorkflowExecutionService.js";

const TriggerSchema = z.object({
  triggerType: z.enum(["interactive", "api", "schedule", "webhook", "event"]).default("api"),
  triggerSource: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const IdParam = z.object({ id: z.string().min(1) });
const WorkflowIdParam = z.object({ id: z.string().min(1) });

const ListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.string().optional(),
  workflowId: z.string().optional(),
  status: z.string().optional(),
});

const ActionSchema = z.object({
  actionType: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
});

/**
 * @param wsManager — optional; when provided, run lifecycle events
 *   are broadcast to `run:<id>` and `org:<orgId>` channels.
 * @param executionService — optional; when provided, trigger/cancel/actions
 *   delegate to the engine-backed execution service.
 */
export function runRoutes(
  auth: AuthInstance,
  db: Database,
  wsManager?: WSManager,
  executionService?: WorkflowExecutionService,
) {
  const app = new Hono<AppEnv>();
  const runRepo = new RunRepository(db);
  const wfRepo = new WorkflowRepository(db);

  /* ── Trigger a workflow run ────────────────────────────────── */

  app.post(
    "/workflows/:id/trigger",
    requireAuth(auth),
    requireOrg(auth),
    orgContext(),
    validateParams(WorkflowIdParam),
    validateBody(TriggerSchema),
    async (c) => {
      const authCtx = c.get("auth");
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");

      const workflow = await wfRepo.findById(id);
      if (!workflow) return notFound(c, "Workflow");

      if (workflow.isDisabled) {
        return err(c, "WORKFLOW_DISABLED", "Cannot trigger a disabled workflow", 422);
      }

      const run = await runRepo.create({
        id: nanoid(),
        workflowId: id,
        version: workflow.activeVersion ?? 1,
        orgId: authCtx.orgId,
        triggerType: body.triggerType,
        triggerSource: body.triggerSource ?? null,
        metadata: body.metadata ?? null,
        startedAt: new Date(),
      });

      /* Delegate to the engine execution service when available */
      if (executionService) {
        await executionService.triggerRun(
          id,
          run.id,
          run.version ?? 1,
          body.triggerType,
          body.metadata ?? {},
          authCtx.orgId,
        );
      } else if (wsManager) {
        /* Legacy path: broadcast run:started without engine execution */
        const event = runStarted(run.id, id, {
          version: run.version,
          triggerType: run.triggerType,
        });
        wsManager.broadcastToMany(
          [`run:${run.id}`, `org:${authCtx.orgId}`],
          event,
        );
      }

      return ok(c, run, undefined, 201);
    },
  );

  /* ── List runs (paginated) ─────────────────────────────────── */

  app.get("/runs", requireAuth(auth), requireOrg(auth), orgContext(), validateQuery(ListQuerySchema), async (c) => {
    const authCtx = c.get("auth");
    const query = c.req.valid("query");
    const limit = clampLimit(query.limit);
    const _cursor = decodeCursor(query.cursor);

    const allRuns = query.workflowId
      ? await runRepo.findByWorkflow(query.workflowId)
      : await runRepo.getRecent(authCtx.orgId, limit + 1);

    const { items, meta } = buildPaginationMeta(
      allRuns.slice(0, limit + 1),
      limit,
      "createdAt",
      (r) => r.createdAt?.toISOString() ?? "",
    );

    return ok(c, items, meta);
  });

  /* ── Get run with steps ────────────────────────────────────── */

  // TODO(auth): Verify the authenticated user's org owns this run before returning data.
  app.get("/runs/:id", requireAuth(auth), validateParams(IdParam), async (c) => {
    const { id } = c.req.valid("param");
    const run = await runRepo.findById(id);
    if (!run) return notFound(c, "Run");
    return ok(c, run);
  });

  /* ── Delete run ────────────────────────────────────────────── */

  // TODO(auth): Verify org ownership before allowing deletion — currently any authenticated user can delete any run.
  app.delete("/runs/:id", requireAuth(auth), orgContext(), validateParams(IdParam), async (c) => {
    const { id } = c.req.valid("param");
    const { eq } = await import("drizzle-orm");
    const { runs } = await import("@vsync/db");
    await db.delete(runs).where(eq(runs.id, id));
    return ok(c, { message: "Run deleted" });
  });

  /* ── Cancel run ────────────────────────────────────────────── */

  app.post("/runs/:id/cancel", requireAuth(auth), orgContext(), validateParams(IdParam), async (c) => {
    const { id } = c.req.valid("param");
    const run = await runRepo.findById(id);
    if (!run) return notFound(c, "Run");

    if (run.status !== "pending" && run.status !== "running" && run.status !== "awaiting_action") {
      return err(c, "INVALID_STATE", "Can only cancel pending, running, or awaiting runs", 422);
    }

    /* Signal the engine to stop between blocks */
    if (executionService) {
      executionService.cancelRun(id);
    }

    const updated = await runRepo.updateStatus(id, "cancelled", {
      completedAt: new Date(),
    });

    /* Broadcast cancellation as a failure variant */
    if (wsManager && updated) {
      const event = runFailed(id, "Run cancelled by user");
      const orgId = run.orgId ?? c.get("auth").orgId;
      wsManager.broadcastToMany(
        [`run:${id}`, `org:${orgId}`],
        event,
      );
    }

    return ok(c, updated);
  });

  /* ── Submit user action ────────────────────────────────────── */

  app.post("/runs/:id/actions", requireAuth(auth), validateParams(IdParam), validateBody(ActionSchema), async (c) => {
    const { id } = c.req.valid("param");
    const run = await runRepo.findById(id);
    if (!run) return notFound(c, "Run");

    /* Delegate to the execution service to resume a paused run */
    if (executionService) {
      const result = await executionService.submitAction(id, c.req.valid("json").payload);
      if (!result.resumed) {
        return err(c, "ACTION_FAILED", result.error ?? "Failed to submit action", 422);
      }
      return ok(c, { message: "Action submitted, run resumed", runId: id });
    }

    /**
     * Legacy fallback: user actions are acknowledged but not executed.
     * Full engine-backed execution requires the WorkflowExecutionService.
     */
    return ok(c, { message: "Action queued", runId: id });
  });

  /* ── SSE live status ───────────────────────────────────────── */

  // TODO(perf): Replace polling-based SSE with push-based event delivery (e.g. Postgres LISTEN/NOTIFY or in-memory pub/sub).
  app.get("/runs/:id/live", requireAuth(auth), validateParams(IdParam), async (c) => {
    const { id } = c.req.valid("param");

    return streamSSE(c, async (stream) => {
      let lastStatus = "";
      for (let i = 0; i < 60; i++) {
        const run = await runRepo.findById(id);
        if (!run) break;

        if (run.status !== lastStatus) {
          lastStatus = run.status ?? "";
          await stream.writeSSE({
            event: "status",
            data: JSON.stringify({
              id: run.id,
              status: run.status,
              completedAt: run.completedAt,
              durationMs: run.durationMs,
            }),
          });
        }

        /* Terminal state — close the stream */
        if (
          run.status === "completed" ||
          run.status === "failed" ||
          run.status === "cancelled" ||
          run.status === "awaiting_action"
        ) {
          break;
        }

        await stream.sleep(1000);
      }
    });
  });

  return app;
}
