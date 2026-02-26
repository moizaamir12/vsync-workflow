import { Hono } from "hono";
import { z } from "zod";
import { streamSSE } from "hono/streaming";
import type { Database } from "@vsync/db";
import { PublicRunRepository } from "@vsync/db";
import { validateBody, validateParams } from "../middleware/validate.js";
import { publicRateLimit } from "../middleware/public-rate-limit.js";
import { ok, notFound, err } from "../lib/response.js";
import type { PublicWorkflowService } from "../services/PublicWorkflowService.js";

const SlugParam = z.object({ slug: z.string().min(1).max(100) });
const RunIdParam = z.object({ slug: z.string().min(1), runId: z.string().min(1) });

const TriggerPublicSchema = z.object({
  eventData: z.record(z.unknown()).default({}),
});

const PublicActionSchema = z.object({
  actionType: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
});

/**
 * Public workflow routes — no authentication required.
 *
 * GET  /public/:slug         → Get public workflow config
 * POST /public/:slug/run     → Trigger a public run (rate-limited)
 * GET  /public/:slug/runs/:runId → Get run status
 * POST /public/:slug/runs/:runId/actions → Submit user action
 * GET  /public/:slug/runs/:runId/live → SSE live status
 */
export function publicRoutes(
  db: Database,
  publicService?: PublicWorkflowService,
) {
  const app = new Hono();
  const publicRunRepo = new PublicRunRepository(db);

  /* ── Get public workflow config ────────────────────── */

  // TODO(security): Add rate limiting to public endpoints to prevent abuse.
  app.get("/:slug", validateParams(SlugParam), async (c) => {
    if (!publicService) {
      return err(c, "SERVICE_UNAVAILABLE", "Public workflow service not available", 503);
    }

    const { slug } = c.req.valid("param");
    const config = await publicService.getPublicConfig(slug);
    if (!config) return notFound(c, "Public workflow");

    /* Allow embedding via iframe */
    c.header("X-Frame-Options", "ALLOWALL");
    c.header("Content-Security-Policy", "frame-ancestors *");

    return ok(c, config);
  });

  /* ── Trigger a public run ──────────────────────────── */

  app.post(
    "/:slug/run",
    publicRateLimit(10, 60_000),
    validateParams(SlugParam),
    validateBody(TriggerPublicSchema),
    async (c) => {
      if (!publicService) {
        return err(c, "SERVICE_UNAVAILABLE", "Public workflow service not available", 503);
      }

      const { slug } = c.req.valid("param");
      const { eventData } = c.req.valid("json");

      const forwarded = c.req.header("x-forwarded-for");
      const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
      const userAgent = c.req.header("user-agent") ?? "unknown";

      const result = await publicService.triggerPublicRun(slug, ip, userAgent, eventData);

      if ("error" in result) {
        return err(c, "TRIGGER_FAILED", result.error, result.status);
      }

      return ok(c, { runId: result.runId }, undefined, 201);
    },
  );

  /* ── Get public run status ─────────────────────────── */

  app.get("/:slug/runs/:runId", validateParams(RunIdParam), async (c) => {
    if (!publicService) {
      return err(c, "SERVICE_UNAVAILABLE", "Public workflow service not available", 503);
    }

    const { runId } = c.req.valid("param");
    const status = await publicService.getPublicRunStatus(runId);
    if (!status) return notFound(c, "Public run");

    return ok(c, status);
  });

  /* ── Submit user action for interactive public runs ── */

  app.post(
    "/:slug/runs/:runId/actions",
    publicRateLimit(30, 60_000),
    validateParams(RunIdParam),
    validateBody(PublicActionSchema),
    async (c) => {
      if (!publicService) {
        return err(c, "SERVICE_UNAVAILABLE", "Public workflow service not available", 503);
      }

      const { runId } = c.req.valid("param");
      const { payload } = c.req.valid("json");

      const result = await publicService.submitPublicAction(runId, payload);

      if (!result.resumed) {
        return err(c, "ACTION_FAILED", result.error ?? "Failed to submit action", 422);
      }

      return ok(c, { message: "Action submitted, run resumed", runId });
    },
  );

  /* ── SSE live status for public runs ────────────────── */

  // TODO(perf): Replace polling-based SSE with event-driven updates.
  app.get("/:slug/runs/:runId/live", validateParams(RunIdParam), async (c) => {
    const { runId } = c.req.valid("param");

    return streamSSE(c, async (stream) => {
      let lastStatus = "";
      for (let i = 0; i < 60; i++) {
        const run = await publicRunRepo.findById(runId);
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
              stepsJson: run.stepsJson,
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

        await stream.sleep(2000);
      }
    });
  });

  return app;
}
