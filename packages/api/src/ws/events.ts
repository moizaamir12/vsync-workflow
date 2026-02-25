import type { WSEvent, WSEventType } from "@vsync/shared-types";

/**
 * Factory functions that produce type-safe WSEvent envelopes.
 * Each factory stamps the current ISO timestamp so callers
 * don't have to remember to do it themselves.
 */

function createEvent(type: WSEventType, payload: Record<string, unknown>): WSEvent {
  return { type, payload, timestamp: new Date().toISOString() };
}

/* ── Run lifecycle events ──────────────────────────────────── */

export function runStarted(runId: string, workflowId: string, extra?: Record<string, unknown>): WSEvent {
  return createEvent("run:started", { runId, workflowId, ...extra });
}

export function runStep(
  runId: string,
  stepId: string,
  blockId: string,
  status: string,
  extra?: Record<string, unknown>,
): WSEvent {
  return createEvent("run:step", { runId, stepId, blockId, status, ...extra });
}

export function runCompleted(
  runId: string,
  durationMs?: number,
  extra?: Record<string, unknown>,
): WSEvent {
  return createEvent("run:completed", { runId, durationMs: durationMs ?? null, ...extra });
}

export function runFailed(
  runId: string,
  errorMessage: string,
  extra?: Record<string, unknown>,
): WSEvent {
  return createEvent("run:failed", { runId, errorMessage, ...extra });
}

export function runAwaitingAction(
  runId: string,
  blockId: string,
  actionType: string,
  extra?: Record<string, unknown>,
): WSEvent {
  return createEvent("run:awaiting_action", { runId, blockId, actionType, ...extra });
}

/* ── Workflow events ───────────────────────────────────────── */

export function workflowUpdated(workflowId: string, extra?: Record<string, unknown>): WSEvent {
  return createEvent("workflow:updated", { workflowId, ...extra });
}

export function workflowDeleted(workflowId: string): WSEvent {
  return createEvent("workflow:deleted", { workflowId });
}
