import { nanoid } from "nanoid";
import type {
  Block,
  Step,
  StepStatus,
  StepError,
  WorkflowContext,
} from "@vsync/shared-types";
import type { BlockResult } from "../types.js";

/**
 * Tracks execution steps and computes context deltas.
 *
 * Each block execution becomes a Step with timing, status,
 * and delta information. The RunBuilder is the single source
 * of truth for the step list within a run.
 */
export class RunBuilder {
  private readonly steps: Step[] = [];
  private executionCounter = 0;

  /** Read-only access to all recorded steps */
  getSteps(): Step[] {
    return [...this.steps];
  }

  /** Get the current execution counter (total steps started) */
  getExecutionCount(): number {
    return this.executionCounter;
  }

  /**
   * Create a new step for a block execution.
   * Records the start time and sets status to 'running'.
   */
  createStep(block: Block): Step {
    const step: Step = {
      stepId: nanoid(),
      blockId: block.id,
      blockName: block.name,
      blockType: block.type,
      blockOrder: block.order,
      executionOrder: this.executionCounter++,
      status: "running",
      logic: { ...block.logic },
      startedAt: new Date().toISOString(),
      endedAt: "",
    };

    this.steps.push(step);
    return step;
  }

  /**
   * Mark a step as completed with optional result deltas.
   * Snapshots the timing and merges any block output.
   */
  completeStep(
    step: Step,
    result?: BlockResult,
  ): void {
    step.status = "completed";
    step.endedAt = new Date().toISOString();

    if (result) {
      step.stateDelta = result.stateDelta;
      step.cacheDelta = result.cacheDelta;
      step.artifactsDelta = result.artifactsDelta;
      step.eventDelta = result.eventDelta;
    }
  }

  /**
   * Mark a step as failed with error details.
   */
  failStep(step: Step, error: StepError): void {
    step.status = "failed";
    step.endedAt = new Date().toISOString();
    step.error = error;
  }

  /**
   * Mark a step as skipped (condition not met).
   */
  skipStep(step: Step): void {
    step.status = "skipped";
    step.endedAt = new Date().toISOString();
  }

  /**
   * Create a deferred step for a loop iteration.
   * Sets the isDeferred flag and deferIterationId.
   */
  createDeferredStep(block: Block, iterationId: string): Step {
    const step = this.createStep(block);
    step.isDeferred = true;
    step.deferIterationId = iterationId;
    return step;
  }

  /**
   * Calculate the delta between two context snapshots.
   * Used to capture what changed during a block execution.
   *
   * Only includes keys that were added or changed — deletions
   * are not tracked (workflow state is append-only by convention).
   */
  calculateDelta(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): Record<string, unknown> {
    const delta: Record<string, unknown> = {};

    for (const key of Object.keys(after)) {
      const beforeVal = before[key];
      const afterVal = after[key];

      /* New key or changed value */
      if (beforeVal === undefined || !this.deepEqual(beforeVal, afterVal)) {
        delta[key] = afterVal;
      }
    }

    return delta;
  }

  /**
   * Apply a BlockResult's deltas to the workflow context.
   * Mutates context in place for efficiency.
   */
  applyDeltas(context: WorkflowContext, result: BlockResult): void {
    if (result.stateDelta) {
      Object.assign(context.state, result.stateDelta);
    }

    if (result.cacheDelta) {
      for (const [key, value] of Object.entries(result.cacheDelta)) {
        context.cache.set(key, value);
      }
    }
  }

  /* ── Internal helpers ───────────────────────────────── */

  /** Simple deep equality check for delta detection */
  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== typeof b) return false;

    if (typeof a === "object" && typeof b === "object") {
      const aObj = a as Record<string, unknown>;
      const bObj = b as Record<string, unknown>;
      const aKeys = Object.keys(aObj);
      const bKeys = Object.keys(bObj);

      if (aKeys.length !== bKeys.length) return false;

      return aKeys.every((key) => this.deepEqual(aObj[key], bObj[key]));
    }

    return false;
  }
}
