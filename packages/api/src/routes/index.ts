import { Hono } from "hono";
import type { AuthInstance } from "@vsync/auth";
import type { Database } from "@vsync/db";

import { authRoutes } from "./auth.js";
import { organizationRoutes } from "./organizations.js";
import { workflowRoutes } from "./workflows.js";
import { versionRoutes } from "./versions.js";
import { blockRoutes } from "./blocks.js";
import { runRoutes } from "./runs.js";
import { publicRoutes } from "./public.js";
import { artifactRoutes } from "./artifacts.js";
import { cacheRoutes } from "./cache.js";
import { deviceRoutes } from "./devices.js";
import { keyRoutes } from "./keys.js";
import { healthRoutes } from "./health.js";
import { eventRoutes } from "./events.js";
import type { WSManager } from "../ws/manager.js";
import type { WorkflowExecutionService } from "../services/WorkflowExecutionService.js";
import type { PublicWorkflowService } from "../services/PublicWorkflowService.js";

/**
 * Mounts every route group under /api/v1 so the top-level
 * Hono app is a clean composition of versioned sub-routers.
 */
export function mountRoutes(
  app: Hono,
  auth: AuthInstance,
  db: Database,
  wsManager?: WSManager,
  executionService?: WorkflowExecutionService,
  publicService?: PublicWorkflowService,
) {
  const v1 = new Hono();

  v1.route("/auth", authRoutes(auth, db));
  v1.route("/orgs", organizationRoutes(auth, db));
  v1.route("/workflows", workflowRoutes(auth, db));
  /* Version + block routes are nested under /workflows */
  v1.route("/workflows", versionRoutes(auth, db));
  v1.route("/", blockRoutes(auth, db));
  /**
   * Run routes use full paths (/workflows/:id/trigger + /runs/*)
   * internally, so mount at root to preserve both namespaces.
   */
  v1.route("/", runRoutes(auth, db, wsManager, executionService));
  v1.route("/artifacts", artifactRoutes(auth, db));
  v1.route("/cache", cacheRoutes(auth, db));
  v1.route("/devices", deviceRoutes(auth, db));
  v1.route("/keys", keyRoutes(auth, db));
  v1.route("/health", healthRoutes());

  /* Public workflow routes — no auth required */
  v1.route("/public", publicRoutes(db, publicService));

  /* SSE fallback for real-time events */
  if (wsManager) {
    v1.route("/events", eventRoutes(auth, wsManager));
  }

  app.route("/api/v1", v1);
}
