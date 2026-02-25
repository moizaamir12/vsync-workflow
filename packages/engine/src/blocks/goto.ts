import type { Block, WorkflowContext } from "@vsync/shared-types";
import type { BlockResult } from "../types.js";
import { ContextManager } from "../core/ContextManager.js";

/**
 * Result shape specific to goto blocks.
 * The Interpreter reads these fields to handle jumps and loops.
 */
export interface GotoResult {
  goto: string;
  defer: boolean;
  maxConcurrent: number;
  loopName?: string;
}

/**
 * Goto (flow control) block executor.
 *
 * Resolves the target block ID and flow control parameters.
 * The actual jump / loop setup is handled by the Interpreter —
 * this executor only validates inputs and returns the directive.
 *
 * Returns: { stateDelta: { __goto: GotoResult } }
 */
export async function gotoExecutor(
  block: Block,
  context: WorkflowContext,
): Promise<BlockResult> {
  const cm = new ContextManager();
  const logic = block.logic;

  const targetBlockId = String(
    resolveDynamic(cm, logic.goto_target_block_id, context) ?? "",
  );
  const defer = resolveDynamic(cm, logic.goto_defer, context) === true;
  const maxConcurrent = Number(
    resolveDynamic(cm, logic.goto_max_concurrent, context) ?? 10,
  );
  const loopName = resolveDynamic(cm, logic.goto_loop_name, context) as string | undefined;

  if (!targetBlockId) {
    throw new Error("goto_target_block_id is required");
  }

  /* Validate max concurrent is a positive integer */
  if (maxConcurrent < 1 || !Number.isFinite(maxConcurrent)) {
    throw new Error(`goto_max_concurrent must be a positive number, got ${maxConcurrent}`);
  }

  const gotoResult: GotoResult = {
    goto: targetBlockId,
    defer,
    maxConcurrent: Math.floor(maxConcurrent),
    ...(loopName ? { loopName } : {}),
  };

  return {
    stateDelta: { __goto: gotoResult },
  };
}

/* ── Helpers ──────────────────────────────────────────── */

function resolveDynamic(
  cm: ContextManager,
  value: unknown,
  context: WorkflowContext,
): unknown {
  return cm.resolveValue(value, context);
}
