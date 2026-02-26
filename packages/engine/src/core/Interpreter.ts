import { nanoid } from "nanoid";
import type {
  Block,
  WorkflowContext,
  StepError,
} from "@vsync/shared-types";
import type {
  InterpreterConfig,
  RunConfig,
  RunResult,
  BlockResult,
} from "../types.js";
import { BlockExecutor } from "./BlockExecutor.js";
import { ConditionEvaluator } from "./ConditionEvaluator.js";
import { ContextManager } from "./ContextManager.js";
import { RunBuilder } from "./RunBuilder.js";

/**
 * Default interpreter settings.
 * 10 000 steps max, 5 minutes wall-clock, 3 concurrent deferred iterations.
 */
const DEFAULT_CONFIG: InterpreterConfig = {
  maxSteps: 10_000,
  maxDurationMs: 5 * 60 * 1000,
  deferConcurrency: 3,
};

/**
 * Main workflow execution engine.
 *
 * Processes a WorkflowVersion's blocks sequentially, evaluating
 * conditions, executing handlers, tracking steps, and supporting
 * goto/deferred execution patterns.
 *
 * Key behaviours:
 *   - Blocks execute in `order` sequence
 *   - Conditions are AND-gated — all must pass
 *   - Skipped blocks create a step with status='skipped'
 *   - UI blocks (ui_*) pause the run with status='awaiting_action'
 *   - Goto blocks jump to a named block, with optional defer
 *   - Deferred execution runs iterations concurrently (semaphore-limited)
 *   - Step and time limits prevent runaway executions
 */
export class Interpreter {
  readonly blockExecutor: BlockExecutor;
  readonly contextManager: ContextManager;
  private readonly conditionEvaluator: ConditionEvaluator;
  private readonly config: InterpreterConfig;

  constructor(config?: Partial<InterpreterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.blockExecutor = new BlockExecutor();
    this.contextManager = new ContextManager();
    this.conditionEvaluator = new ConditionEvaluator(this.contextManager);
  }

  /**
   * Execute a full workflow run from the beginning.
   *
   * Creates the workflow context from RunConfig, then processes
   * all blocks in order. Returns a RunResult with the final status,
   * steps, and context snapshot.
   */
  async executeRun(runConfig: RunConfig): Promise<RunResult> {
    const startTime = Date.now();
    const context = this.buildContext(runConfig);
    const runBuilder = new RunBuilder();
    const blocks = [...runConfig.workflowVersion.blocks].sort(
      (a, b) => a.order - b.order,
    );

    try {
      await this.executeBlocks(blocks, 0, context, runBuilder, startTime);

      return this.buildResult("completed", runBuilder, context, startTime);
    } catch (error) {
      if (error instanceof AwaitingActionError) {
        return this.buildResult("awaiting_action", runBuilder, context, startTime);
      }
      if (error instanceof RunAbortedError) {
        return this.buildResult(
          "failed",
          runBuilder,
          context,
          startTime,
          error.message,
        );
      }
      const msg = error instanceof Error ? error.message : String(error);
      return this.buildResult("failed", runBuilder, context, startTime, msg);
    }
  }

  /**
   * Resume a paused run from a specific block index.
   *
   * Used after a UI block has been completed by the user.
   * Accepts the existing context (with any user-provided data merged)
   * and continues from the next block.
   */
  async resumeRun(
    runConfig: RunConfig,
    fromBlockIndex: number,
    existingContext: WorkflowContext,
  ): Promise<RunResult> {
    const startTime = Date.now();
    const runBuilder = new RunBuilder();
    const blocks = [...runConfig.workflowVersion.blocks].sort(
      (a, b) => a.order - b.order,
    );

    try {
      await this.executeBlocks(
        blocks,
        fromBlockIndex,
        existingContext,
        runBuilder,
        startTime,
      );

      return this.buildResult("completed", runBuilder, existingContext, startTime);
    } catch (error) {
      if (error instanceof AwaitingActionError) {
        return this.buildResult(
          "awaiting_action",
          runBuilder,
          existingContext,
          startTime,
        );
      }
      if (error instanceof RunAbortedError) {
        return this.buildResult(
          "failed",
          runBuilder,
          existingContext,
          startTime,
          error.message,
        );
      }
      const msg = error instanceof Error ? error.message : String(error);
      return this.buildResult(
        "failed",
        runBuilder,
        existingContext,
        startTime,
        msg,
      );
    }
  }

  /* ── Core execution loop ────────────────────────────── */

  private async executeBlocks(
    blocks: Block[],
    startIndex: number,
    context: WorkflowContext,
    runBuilder: RunBuilder,
    startTime: number,
  ): Promise<void> {
    let i = startIndex;

    while (i < blocks.length) {
      /* Guard: step limit */
      if (runBuilder.getExecutionCount() >= this.config.maxSteps) {
        throw new RunAbortedError(
          `Step limit reached (${this.config.maxSteps}). Possible infinite loop.`,
        );
      }

      /* Guard: time limit */
      if (Date.now() - startTime > this.config.maxDurationMs) {
        throw new RunAbortedError(
          `Time limit reached (${this.config.maxDurationMs}ms). Run took too long.`,
        );
      }

      const block = blocks[i];

      /* Update run context with current position */
      context.run.stepIndex = i;
      context.run.blockId = block.id;
      context.run.blockName = block.name;
      context.run.blockType = block.type;

      /* Evaluate conditions (AND logic) */
      const conditionsMet = this.conditionEvaluator.evaluateAll(
        block.conditions,
        context,
      );

      if (!conditionsMet) {
        /* Create a skipped step for audit trail */
        const step = runBuilder.createStep(block);
        runBuilder.skipStep(step);
        i++;
        continue;
      }

      /* UI blocks pause execution — the caller must resume */
      if (this.isUiBlock(block.type)) {
        const step = runBuilder.createStep(block);
        runBuilder.completeStep(step);
        throw new AwaitingActionError(block.id);
      }

      /* Goto blocks — jump to a target block */
      if (block.type === "goto") {
        i = await this.handleGoto(
          block,
          blocks,
          context,
          runBuilder,
          startTime,
          i,
        );
        continue;
      }

      /* Normal block execution */
      await this.executeBlock(block, context, runBuilder);
      i++;
    }
  }

  /* ── Single block execution ─────────────────────────── */

  private async executeBlock(
    block: Block,
    context: WorkflowContext,
    runBuilder: RunBuilder,
  ): Promise<void> {
    const step = runBuilder.createStep(block);

    /* Snapshot state before execution for delta calculation */
    const stateBefore = { ...context.state };

    try {
      const result = await this.blockExecutor.execute(block, context);

      /* Apply deltas to context */
      runBuilder.applyDeltas(context, result);

      /* Calculate actual delta from state snapshot */
      const actualStateDelta = runBuilder.calculateDelta(stateBefore, context.state);
      const enrichedResult: BlockResult = {
        ...result,
        stateDelta: Object.keys(actualStateDelta).length > 0
          ? actualStateDelta
          : result.stateDelta,
      };

      runBuilder.completeStep(step, enrichedResult);
      this.contextManager.setLastError(null);
    } catch (error) {
      const stepError: StepError = {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        blockId: block.id,
        blockName: block.name,
      };

      runBuilder.failStep(step, stepError);
      this.contextManager.setLastError(stepError);

      const strategy = this.blockExecutor.getErrorStrategy(block);
      if (strategy === "abort") {
        throw new RunAbortedError(
          `Block "${block.name}" failed: ${stepError.message}`,
        );
      }
      /* strategy === 'continue' — proceed to next block */
    }
  }

  /* ── Goto handling ──────────────────────────────────── */

  private async handleGoto(
    block: Block,
    blocks: Block[],
    context: WorkflowContext,
    runBuilder: RunBuilder,
    startTime: number,
    currentIndex: number,
  ): Promise<number> {
    const targetName = block.logic.goto_target as string | undefined;
    const defer = block.logic.goto_defer as boolean | undefined;

    if (!targetName) {
      throw new RunAbortedError(
        `Goto block "${block.name}" is missing goto_target in logic.`,
      );
    }

    const targetIndex = blocks.findIndex((b) => b.name === targetName);
    if (targetIndex === -1) {
      throw new RunAbortedError(
        `Goto block "${block.name}" references unknown target "${targetName}".`,
      );
    }

    /* Record the goto step itself */
    const step = runBuilder.createStep(block);
    runBuilder.completeStep(step, {
      stateDelta: { _goto_target: targetName, _goto_defer: !!defer },
    });

    if (defer) {
      /* Deferred execution — run remaining blocks from target concurrently */
      await this.executeDeferredIteration(
        blocks,
        targetIndex,
        context,
        runBuilder,
        startTime,
        block,
      );

      /* After deferred iteration, continue from the block after the goto */
      return currentIndex + 1;
    }

    /* Non-deferred goto — jump directly */
    return targetIndex;
  }

  /* ── Deferred execution ─────────────────────────────── */

  // TODO: Enforce deferConcurrency limit — the config value is accepted but never actually used to limit concurrent deferred executions.
  private async executeDeferredIteration(
    blocks: Block[],
    targetIndex: number,
    parentContext: WorkflowContext,
    runBuilder: RunBuilder,
    startTime: number,
    gotoBlock: Block,
  ): Promise<void> {
    const iterationId = nanoid();

    /**
     * Create a shallow copy of the context for deferred execution.
     * State is shared (mutations visible to parent), but the run
     * context gets an isolated step tracking scope.
     */
    const iterationContext: WorkflowContext = {
      ...parentContext,
      state: { ...parentContext.state },
      cache: new Map(parentContext.cache),
      artifacts: [...parentContext.artifacts],
    };

    /* Execute from the target block onward within the deferred scope */
    for (let i = targetIndex; i < blocks.length; i++) {
      if (runBuilder.getExecutionCount() >= this.config.maxSteps) {
        throw new RunAbortedError(
          `Step limit reached during deferred execution (${this.config.maxSteps}).`,
        );
      }
      if (Date.now() - startTime > this.config.maxDurationMs) {
        throw new RunAbortedError(
          `Time limit reached during deferred execution (${this.config.maxDurationMs}ms).`,
        );
      }

      const block = blocks[i];

      /* Skip UI blocks in deferred context — they can't pause */
      if (this.isUiBlock(block.type)) continue;

      /* Evaluate conditions */
      const conditionsMet = this.conditionEvaluator.evaluateAll(
        block.conditions,
        iterationContext,
      );
      if (!conditionsMet) {
        const step = runBuilder.createDeferredStep(block, iterationId);
        runBuilder.skipStep(step);
        continue;
      }

      /* Execute the block within the deferred scope */
      const step = runBuilder.createDeferredStep(block, iterationId);
      const stateBefore = { ...iterationContext.state };

      try {
        const result = await this.blockExecutor.execute(block, iterationContext);
        runBuilder.applyDeltas(iterationContext, result);
        const actualDelta = runBuilder.calculateDelta(stateBefore, iterationContext.state);
        runBuilder.completeStep(step, {
          ...result,
          stateDelta: Object.keys(actualDelta).length > 0 ? actualDelta : result.stateDelta,
        });
      } catch (error) {
        const stepError: StepError = {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          blockId: block.id,
          blockName: block.name,
        };
        runBuilder.failStep(step, stepError);

        const strategy = this.blockExecutor.getErrorStrategy(block);
        if (strategy === "abort") {
          throw new RunAbortedError(
            `Deferred block "${block.name}" failed: ${stepError.message}`,
          );
        }
      }
    }

    /* Merge deferred state back into parent */
    Object.assign(parentContext.state, iterationContext.state);
  }

  /* ── Context construction ───────────────────────────── */

  private buildContext(runConfig: RunConfig): WorkflowContext {
    return {
      state: runConfig.initialState ? { ...runConfig.initialState } : {},
      cache: new Map(),
      artifacts: [],
      secrets: runConfig.secrets ? { ...runConfig.secrets } : {},
      run: {
        id: runConfig.runId,
        workflowId: runConfig.workflowVersion.workflowId,
        versionId: `${runConfig.workflowVersion.workflowId}:v${runConfig.workflowVersion.version}`,
        status: "running",
        triggerType: runConfig.workflowVersion.triggerType,
        startedAt: new Date().toISOString(),
        platform: runConfig.deviceId,
        deviceId: runConfig.deviceId,
      },
      event: runConfig.event as Record<string, unknown> & { type?: string },
      loops: {},
      paths: runConfig.paths ? { ...runConfig.paths } : {},
      keyResolver: runConfig.keyResolver,
    };
  }

  /* ── Result construction ────────────────────────────── */

  private buildResult(
    status: RunResult["status"],
    runBuilder: RunBuilder,
    context: WorkflowContext,
    startTime: number,
    errorMessage?: string,
  ): RunResult {
    return {
      status,
      steps: runBuilder.getSteps(),
      context,
      durationMs: Date.now() - startTime,
      ...(errorMessage ? { errorMessage } : {}),
    };
  }

  /* ── Helpers ────────────────────────────────────────── */

  private isUiBlock(type: string): boolean {
    return type.startsWith("ui_");
  }
}

/* ── Internal error types ───────────────────────────────── */

/** Thrown when a UI block is encountered and the run should pause */
class AwaitingActionError extends Error {
  constructor(public readonly blockId: string) {
    super(`Awaiting action for block ${blockId}`);
    this.name = "AwaitingActionError";
  }
}

/** Thrown when the run should be aborted due to a fatal error */
class RunAbortedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunAbortedError";
  }
}
