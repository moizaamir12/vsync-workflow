import type { Block, WorkflowContext } from "@vsync/shared-types";
import type { BlockResult } from "../types.js";
import { ContextManager } from "../core/ContextManager.js";

/** Maximum sleep duration: 5 minutes */
const MAX_SLEEP_DURATION_MS = 300_000;

/**
 * Sleep (delay) block executor.
 *
 * Pauses execution for a specified duration, capped at MAX_SLEEP_DURATION_MS.
 * Useful for rate limiting, polling intervals, or sequencing external effects.
 */
export async function sleepExecutor(
  block: Block,
  context: WorkflowContext,
): Promise<BlockResult> {
  const cm = new ContextManager();
  const logic = block.logic;

  const rawDuration = Number(
    resolveDynamic(cm, logic.sleep_duration_ms, context) ?? 0,
  );

  /* Clamp to valid range */
  const duration = Math.min(
    Math.max(0, rawDuration),
    MAX_SLEEP_DURATION_MS,
  );

  if (duration > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, duration));
  }

  return {};
}

/** Exposed for tests to verify the cap constant */
export { MAX_SLEEP_DURATION_MS };

/* ── Helpers ──────────────────────────────────────────── */

function resolveDynamic(
  cm: ContextManager,
  value: unknown,
  context: WorkflowContext,
): unknown {
  return cm.resolveValue(value, context);
}
