import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { AuthInstance } from "@vsync/auth";
import type { Database } from "@vsync/db";
import type { Interpreter } from "@vsync/engine";

import { errorHandler } from "./middleware/error-handler.js";
import { requestId } from "./middleware/request-id.js";
import { mountRoutes } from "./routes/index.js";
import { WSManager } from "./ws/manager.js";
import { WorkflowExecutionService } from "./services/WorkflowExecutionService.js";
import { PublicWorkflowService } from "./services/PublicWorkflowService.js";

/** Configuration passed to createApp so the factory stays pure. */
export interface AppConfig {
  /** Allowed CORS origins. Defaults to ["*"] in development. */
  corsOrigins?: string[];
  /** Disable WebSocket manager (e.g. for minimal test setups). */
  disableWs?: boolean;
  /** Pre-built Interpreter instance — enables engine-backed execution. */
  interpreter?: Interpreter;
}

/** Return type wrapping the Hono app plus the WSManager instance. */
export interface AppInstance {
  app: Hono;
  wsManager: WSManager;
  /** Present when an interpreter was provided via config. */
  executionService?: WorkflowExecutionService;
  /** Present when an interpreter was provided via config. */
  publicService?: PublicWorkflowService;
}

/**
 * Creates a fully configured Hono app with all routes mounted.
 * Designed to be called from a standalone Node server OR from
 * inside an Electron main process — the app is transport-agnostic.
 *
 * Returns both the Hono `app` and the `wsManager` so callers
 * can wire WebSocket upgrades at the transport layer (e.g.
 * Node's `http.Server.on("upgrade")` or Electron IPC).
 */
export function createApp(auth: AuthInstance, db: Database, config?: AppConfig): AppInstance {
  const app = new Hono();

  /* ── Global middleware ─────────────────────────────────────── */

  app.use("*", cors({
    origin: config?.corsOrigins ?? ["*"],
    credentials: true,
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Org-Id", "X-Request-Id", "X-Service-Token"],
  }));

  app.use("*", logger());
  app.use("*", requestId());
  app.onError(errorHandler);

  /* ── WebSocket manager ────────────────────────────────────── */

  const wsManager = new WSManager();

  /* ── Engine execution services ──────────────────────────────── */

  let executionService: WorkflowExecutionService | undefined;
  let publicService: PublicWorkflowService | undefined;

  if (config?.interpreter) {
    executionService = new WorkflowExecutionService(db, wsManager, config.interpreter);
    publicService = new PublicWorkflowService(db, wsManager, config.interpreter);
  }

  /* ── Routes ────────────────────────────────────────────────── */

  mountRoutes(
    app,
    auth,
    db,
    config?.disableWs ? undefined : wsManager,
    executionService,
    publicService,
  );

  return { app, wsManager, executionService, publicService };
}
