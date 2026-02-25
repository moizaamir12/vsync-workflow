import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { WebSocketServer } from "ws";
import type { IncomingMessage } from "node:http";
import type { SqliteDatabase } from "@vsync/db";
import {
  SqliteWorkflowRepository,
  SqliteRunRepository,
  SqliteOrgRepository,
  SqliteArtifactRepository,
} from "@vsync/db";
import { createNodeInterpreter } from "@vsync/engine-adapters";
import crypto from "node:crypto";

export interface LocalServerHandle {
  port: number;
  shutdown: () => void;
}

/**
 * Boots an embedded Hono API server backed by the local SQLite database.
 *
 * Port 0 lets the OS pick a free port — the resolved port is returned
 * so the renderer can point its API client at `http://localhost:{port}`.
 *
 * The route surface mirrors the cloud API just enough for the web
 * frontend to function identically offline.
 */
export function startLocalServer(db: SqliteDatabase): Promise<LocalServerHandle> {
  return new Promise((resolve) => {
    const app = new Hono();

    /* ── Middleware ──────────────────────────────────────────── */

    app.use("*", cors({ origin: ["*"], credentials: true }));
    app.use("*", logger());
    app.use("*", async (c, next) => {
      const id = c.req.header("x-request-id") ?? crypto.randomUUID();
      c.set("requestId", id);
      c.header("X-Request-Id", id);
      await next();
    });

    app.onError((err, c) => {
      const message = err.message ?? "Internal server error";
      let status = 500;
      if ("status" in err && typeof err.status === "number") {
        status = err.status;
      } else if (message.includes("not found")) {
        status = 404;
      } else if (message.includes("unauthorized")) {
        status = 401;
      }

      if (status >= 500) {
        console.error(`[desktop-api] Error: ${message}`, err.stack);
      }

      return c.json(
        { data: null, error: { code: "ERROR", message }, meta: undefined },
        status as 400,
      );
    });

    /* ── Repositories ───────────────────────────────────────── */

    const workflowRepo = new SqliteWorkflowRepository(db);
    const runRepo = new SqliteRunRepository(db);
    const orgRepo = new SqliteOrgRepository(db);
    const artifactRepo = new SqliteArtifactRepository(db);

    /* ── Engine ─────────────────────────────────────────────── */

    const interpreter = createNodeInterpreter();

    /* ── Routes ─────────────────────────────────────────────── */

    const v1 = new Hono();

    /* Health */
    v1.get("/health", (c) =>
      c.json({ data: { status: "ok", mode: "desktop" }, error: null, meta: undefined }),
    );

    /* ── Workflows ──────────────────────────────────────── */

    v1.get("/workflows", async (c) => {
      const orgId = c.req.header("x-org-id") ?? "";
      const rows = await workflowRepo.findByOrg(orgId);
      return c.json({ data: rows, error: null, meta: undefined });
    });

    v1.post("/workflows", async (c) => {
      const body = await c.req.json();
      const row = await workflowRepo.create(body);
      return c.json({ data: row, error: null, meta: undefined }, 201);
    });

    v1.get("/workflows/:id", async (c) => {
      const row = await workflowRepo.findById(c.req.param("id"));
      if (!row) return c.json({ data: null, error: { code: "NOT_FOUND", message: "Workflow not found" }, meta: undefined }, 404);
      return c.json({ data: row, error: null, meta: undefined });
    });

    v1.patch("/workflows/:id", async (c) => {
      const body = await c.req.json();
      const row = await workflowRepo.update(c.req.param("id"), body);
      return c.json({ data: row, error: null, meta: undefined });
    });

    v1.delete("/workflows/:id", async (c) => {
      await workflowRepo.delete(c.req.param("id"));
      return c.json({ data: { deleted: true }, error: null, meta: undefined });
    });

    /* ── Versions ─────────────────────────────────────── */

    v1.get("/workflows/:id/versions", async (c) => {
      const rows = await workflowRepo.findVersions(c.req.param("id"));
      return c.json({ data: rows, error: null, meta: undefined });
    });

    v1.post("/workflows/:id/versions", async (c) => {
      const body = await c.req.json();
      const result = await workflowRepo.createVersion(
        { workflowId: c.req.param("id"), ...body.version },
        body.blocks ?? [],
      );
      return c.json({ data: result, error: null, meta: undefined }, 201);
    });

    v1.get("/workflows/:id/active-version", async (c) => {
      const result = await workflowRepo.getActiveVersion(c.req.param("id"));
      if (!result) return c.json({ data: null, error: { code: "NOT_FOUND", message: "No active version" }, meta: undefined }, 404);
      return c.json({ data: result, error: null, meta: undefined });
    });

    v1.post("/workflows/:id/versions/:version/publish", async (c) => {
      const version = Number(c.req.param("version"));
      const row = await workflowRepo.publishVersion(c.req.param("id"), version);
      return c.json({ data: row, error: null, meta: undefined });
    });

    /* ── Runs ────────────────────────────────────────── */

    v1.get("/runs", async (c) => {
      const orgId = c.req.header("x-org-id") ?? "";
      const rows = await runRepo.getRecent(orgId);
      return c.json({ data: rows, error: null, meta: undefined });
    });

    v1.get("/runs/:id", async (c) => {
      const row = await runRepo.findById(c.req.param("id"));
      if (!row) return c.json({ data: null, error: { code: "NOT_FOUND", message: "Run not found" }, meta: undefined }, 404);
      return c.json({ data: row, error: null, meta: undefined });
    });

    /* ── Trigger (execute workflow) ────────────────── */

    v1.post("/workflows/:id/trigger", async (c) => {
      const workflowId = c.req.param("id");
      const activeVersion = await workflowRepo.getActiveVersion(workflowId);
      if (!activeVersion) {
        return c.json(
          { data: null, error: { code: "NOT_FOUND", message: "No active version" }, meta: undefined },
          404,
        );
      }

      const run = await runRepo.create({
        workflowId,
        version: activeVersion.version.version,
        orgId: c.req.header("x-org-id") ?? undefined,
        status: "running",
        triggerType: "manual",
        triggerSource: "desktop",
        startedAt: new Date(),
      });

      /* Fire-and-forget execution — the run status is updated asynchronously */
      void (async () => {
        try {
          const result = await interpreter.execute({
            blocks: activeVersion.blocks.map((b) => ({
              id: b.id,
              type: b.type,
              name: b.name,
              properties: (b.logic ?? {}) as Record<string, unknown>,
              conditions: b.conditions as Record<string, unknown> | undefined,
            })),
          });
          await runRepo.updateStatus(run.id, result.status === "completed" ? "completed" : "failed", {
            completedAt: new Date(),
            durationMs: result.durationMs,
            stepsJson: result.steps as unknown as Record<string, unknown>,
            errorMessage: result.error ?? undefined,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          await runRepo.updateStatus(run.id, "failed", {
            completedAt: new Date(),
            errorMessage: msg,
          });
        }
      })();

      return c.json({ data: run, error: null, meta: undefined }, 201);
    });

    /* ── Organizations ────────────────────────────── */

    v1.get("/orgs", async (c) => {
      /* Desktop uses a single local org; list returns it */
      const orgId = c.req.header("x-org-id") ?? "";
      const org = await orgRepo.findById(orgId);
      return c.json({ data: org ? [org] : [], error: null, meta: undefined });
    });

    /* ── Artifacts ────────────────────────────────── */

    v1.get("/artifacts", async (c) => {
      const runId = c.req.query("runId");
      if (!runId) return c.json({ data: [], error: null, meta: undefined });
      const rows = await artifactRepo.findByRun(runId);
      return c.json({ data: rows, error: null, meta: undefined });
    });

    /* ── Mount ──────────────────────────────────────── */

    app.route("/api/v1", v1);

    /* ── HTTP server on port 0 (OS-assigned) ─────────── */

    const server = serve({ fetch: app.fetch, port: 0 }, (info) => {
      console.log(`[desktop-api] Local API running on http://localhost:${info.port}`);

      /* WebSocket upgrade handler (mirrors cloud API server) */
      const wss = new WebSocketServer({ noServer: true });

      server.on("upgrade", (request: IncomingMessage, socket, head) => {
        const url = new URL(request.url ?? "/", `http://localhost:${info.port}`);
        if (url.pathname !== "/api/v1/ws") {
          socket.destroy();
          return;
        }

        wss.handleUpgrade(request, socket, head, (ws) => {
          ws.send(
            JSON.stringify({
              type: "connected",
              timestamp: new Date().toISOString(),
              mode: "desktop",
            }),
          );
        });
      });

      const shutdown = () => {
        wss.close();
        server.close();
      };

      resolve({ port: info.port, shutdown });
    });
  });
}
