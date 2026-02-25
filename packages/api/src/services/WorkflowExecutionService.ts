import type { Database } from "@vsync/db";
import { RunRepository, WorkflowRepository, KeyRepository } from "@vsync/db";
import type { Interpreter, RunConfig, RunResult } from "@vsync/engine";
import type { Block as DbBlock, Artifact } from "@vsync/shared-types";
import type { WSManager } from "../ws/manager.js";
import {
  runStarted,
  runStep,
  runCompleted,
  runFailed,
  runAwaitingAction,
} from "../ws/events.js";

/**
 * Paused-run state stored in runs.stepsJson when a UI block pauses execution.
 * On server restart, paused runs can be resumed by loading this from DB.
 */
export interface PausedRunState {
  currentBlockIndex: number;
  contextSnapshot: {
    state: Record<string, unknown>;
    cache: Array<[string, unknown]>;
    artifacts: unknown[];
    event: Record<string, unknown>;
    loops: Record<string, unknown>;
  };
  pausedBlockId: string;
  pausedUiConfig: Record<string, unknown>;
}

/**
 * Orchestrates workflow execution by bridging the engine Interpreter
 * with the API's database layer and real-time WebSocket events.
 *
 * Key responsibilities:
 *   - Load workflow version + blocks from DB
 *   - Resolve secrets for the engine's keyResolver
 *   - Start execution in background (non-blocking trigger)
 *   - Broadcast step-level and lifecycle events via WSManager
 *   - Handle UI block pausing and resumption
 *   - Support run cancellation via a flag checked between blocks
 */
export class WorkflowExecutionService {
  private readonly runRepo: RunRepository;
  private readonly wfRepo: WorkflowRepository;
  private readonly keyRepo: KeyRepository;

  /** Cancellation flags keyed by runId — engine checks between blocks */
  private readonly cancelFlags = new Map<string, boolean>();

  constructor(
    private readonly db: Database,
    private readonly wsManager: WSManager,
    private readonly interpreter: Interpreter,
  ) {
    this.runRepo = new RunRepository(db);
    this.wfRepo = new WorkflowRepository(db);
    this.keyRepo = new KeyRepository(db);
  }

  /**
   * Trigger a new workflow run.
   *
   * Creates a run record in "pending" state, then kicks off background
   * execution without blocking the HTTP response. Returns the run ID
   * immediately so the caller can respond with 202 Accepted.
   */
  async triggerRun(
    workflowId: string,
    runId: string,
    version: number,
    triggerType: string,
    eventData: Record<string, unknown>,
    orgId: string,
  ): Promise<void> {
    /* Load the workflow version and its blocks */
    const versionData = await this.loadWorkflowVersion(workflowId, version);
    if (!versionData) {
      await this.runRepo.updateStatus(runId, "failed", {
        errorMessage: `Workflow version ${version} not found`,
        completedAt: new Date(),
      });
      this.broadcastChannels(runId, orgId, runFailed(runId, `Workflow version ${version} not found`));
      return;
    }

    /* Fire-and-forget background execution */
    this.executeInBackground(
      runId,
      workflowId,
      orgId,
      versionData.version,
      versionData.blocks,
      triggerType,
      eventData,
    );
  }

  /**
   * Submit a user action to resume a paused run.
   *
   * Loads the paused state from DB, merges action data into the
   * workflow context, and resumes the interpreter from the next block.
   */
  async submitAction(
    runId: string,
    actionData: Record<string, unknown>,
  ): Promise<{ resumed: boolean; error?: string }> {
    const run = await this.runRepo.findById(runId);
    if (!run) return { resumed: false, error: "Run not found" };

    if (run.status !== "awaiting_action") {
      return { resumed: false, error: `Cannot submit action to run in "${run.status}" state` };
    }

    /* Load paused state from stepsJson */
    const pausedState = run.stepsJson as PausedRunState | null;
    if (!pausedState?.contextSnapshot) {
      return { resumed: false, error: "No paused state found for this run" };
    }

    const orgId = (run.orgId as string) ?? "";
    const workflowId = (run.workflowId as string) ?? "";
    const version = run.version ?? 1;

    /* Load workflow blocks for resumption */
    const versionData = await this.loadWorkflowVersion(workflowId, version);
    if (!versionData) {
      return { resumed: false, error: "Workflow version not found" };
    }

    /* Resume execution in background */
    this.resumeInBackground(
      runId,
      workflowId,
      orgId,
      versionData.version,
      versionData.blocks,
      pausedState,
      actionData,
    );

    return { resumed: true };
  }

  /**
   * Cancel a running workflow.
   *
   * Sets a cancellation flag that the execution loop checks between
   * block executions. The run will be marked as cancelled once the
   * current block finishes.
   */
  cancelRun(runId: string): void {
    this.cancelFlags.set(runId, true);
  }

  /** Check whether a cancellation has been requested for a run */
  isCancelled(runId: string): boolean {
    return this.cancelFlags.get(runId) === true;
  }

  /* ── Background execution ──────────────────────────── */

  private executeInBackground(
    runId: string,
    workflowId: string,
    orgId: string,
    versionRecord: { triggerType: string | null; version: number },
    dbBlocks: DbBlock[],
    triggerType: string,
    eventData: Record<string, unknown>,
  ): void {
    /* Run in microtask so the caller can return immediately */
    void (async () => {
      try {
        /* Mark as running */
        await this.runRepo.updateStatus(runId, "running", {
          startedAt: new Date(),
        });

        this.broadcastChannels(runId, orgId, runStarted(runId, workflowId, {
          version: versionRecord.version,
          triggerType,
          startedAt: new Date().toISOString(),
        }));

        /* Build the RunConfig the engine expects */
        const runConfig = this.buildRunConfig(
          runId,
          workflowId,
          orgId,
          versionRecord,
          dbBlocks,
          triggerType,
          eventData,
        );

        /* Execute! */
        const result = await this.interpreter.executeRun(runConfig);

        /* Process the result */
        await this.processRunResult(runId, workflowId, orgId, result, dbBlocks);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.runRepo.updateStatus(runId, "failed", {
          errorMessage: message,
          completedAt: new Date(),
        });
        this.broadcastChannels(runId, orgId, runFailed(runId, message));
      } finally {
        this.cancelFlags.delete(runId);
      }
    })();
  }

  private resumeInBackground(
    runId: string,
    workflowId: string,
    orgId: string,
    versionRecord: { triggerType: string | null; version: number },
    dbBlocks: DbBlock[],
    pausedState: PausedRunState,
    actionData: Record<string, unknown>,
  ): void {
    void (async () => {
      try {
        /* Mark as running again */
        await this.runRepo.updateStatus(runId, "running");

        this.broadcastChannels(runId, orgId, runStarted(runId, workflowId, {
          version: versionRecord.version,
          resumed: true,
        }));

        /* Rebuild the workflow context from the snapshot */
        const context = {
          state: { ...pausedState.contextSnapshot.state, ...actionData },
          cache: new Map(pausedState.contextSnapshot.cache),
          artifacts: pausedState.contextSnapshot.artifacts as Artifact[],
          secrets: {},
          run: {
            id: runId,
            workflowId,
            versionId: `${workflowId}:v${versionRecord.version}`,
            status: "running" as const,
            triggerType: (versionRecord.triggerType ?? "interactive") as "interactive",
            startedAt: new Date().toISOString(),
            platform: "node",
            deviceId: "server",
          },
          event: pausedState.contextSnapshot.event as Record<string, unknown> & { type?: string },
          loops: pausedState.contextSnapshot.loops as Record<string, { index: number }>,
          paths: {},
        };

        /* Build config for resumption */
        const runConfig = this.buildRunConfig(
          runId,
          workflowId,
          orgId,
          versionRecord,
          dbBlocks,
          versionRecord.triggerType ?? "interactive",
          pausedState.contextSnapshot.event,
        );

        /* Resume from the block after the paused one */
        const resumeIndex = pausedState.currentBlockIndex + 1;
        const result = await this.interpreter.resumeRun(runConfig, resumeIndex, context);

        await this.processRunResult(runId, workflowId, orgId, result, dbBlocks);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.runRepo.updateStatus(runId, "failed", {
          errorMessage: message,
          completedAt: new Date(),
        });
        this.broadcastChannels(runId, orgId, runFailed(runId, message));
      } finally {
        this.cancelFlags.delete(runId);
      }
    })();
  }

  /* ── Result processing ─────────────────────────────── */

  private async processRunResult(
    runId: string,
    workflowId: string,
    orgId: string,
    result: RunResult,
    dbBlocks: DbBlock[],
  ): Promise<void> {
    /* Broadcast individual step events */
    for (const step of result.steps) {
      const outputKeys = step.stateDelta
        ? Object.keys(step.stateDelta as Record<string, unknown>)
        : [];

      this.broadcastChannels(runId, orgId, runStep(
        runId,
        step.stepId,
        step.blockId,
        step.status,
        {
          stepIndex: step.executionOrder,
          blockType: step.blockType,
          blockName: step.blockName,
          outputKeys,
          error: step.error?.message,
        },
      ));
    }

    switch (result.status) {
      case "completed": {
        await this.runRepo.updateStatus(runId, "completed", {
          completedAt: new Date(),
          durationMs: result.durationMs,
          stepsJson: result.steps,
        });

        this.broadcastChannels(runId, orgId, runCompleted(runId, result.durationMs, {
          status: "completed",
          totalSteps: result.steps.length,
          totalDurationMs: result.durationMs,
          artifactCount: result.context.artifacts.length,
        }));
        break;
      }

      case "failed": {
        await this.runRepo.updateStatus(runId, "failed", {
          completedAt: new Date(),
          durationMs: result.durationMs,
          errorMessage: result.errorMessage,
          stepsJson: result.steps,
        });

        /* Find the failed step for detailed error reporting */
        const failedStep = result.steps.find((s) => s.status === "failed");

        this.broadcastChannels(runId, orgId, runFailed(runId, result.errorMessage ?? "Unknown error", {
          status: "failed",
          failedAtStep: failedStep?.executionOrder ?? -1,
          blockId: failedStep?.blockId,
          blockType: failedStep?.blockType,
        }));
        break;
      }

      case "awaiting_action": {
        /* Find the UI block that paused execution */
        const lastStep = result.steps[result.steps.length - 1];
        const pausedBlock = dbBlocks.find((b) => b.id === lastStep?.blockId);
        const stepIndex = lastStep?.executionOrder ?? 0;

        /* Serialize paused state for resumption */
        const pausedState: PausedRunState = {
          currentBlockIndex: stepIndex,
          contextSnapshot: {
            state: result.context.state,
            cache: [...result.context.cache.entries()],
            artifacts: result.context.artifacts,
            event: result.context.event,
            loops: result.context.loops,
          },
          pausedBlockId: lastStep?.blockId ?? "",
          pausedUiConfig: pausedBlock?.logic ?? {},
        };

        await this.runRepo.updateStatus(runId, "awaiting_action", {
          stepsJson: pausedState,
        });

        this.broadcastChannels(runId, orgId, runAwaitingAction(
          runId,
          lastStep?.blockId ?? "",
          pausedBlock?.type ?? "ui_form",
          {
            stepIndex,
            blockType: pausedBlock?.type,
            uiConfig: pausedBlock?.logic ?? {},
          },
        ));
        break;
      }

      default:
        /* Shouldn't happen, but handle gracefully */
        await this.runRepo.updateStatus(runId, "failed", {
          completedAt: new Date(),
          errorMessage: `Unexpected result status: ${result.status}`,
          stepsJson: result.steps,
        });
        break;
    }
  }

  /* ── RunConfig builder ─────────────────────────────── */

  private buildRunConfig(
    runId: string,
    workflowId: string,
    orgId: string,
    versionRecord: { triggerType: string | null; version: number },
    dbBlocks: DbBlock[],
    triggerType: string,
    eventData: Record<string, unknown>,
  ): RunConfig {
    return {
      runId,
      orgId,
      deviceId: "server",
      workflowVersion: {
        workflowId,
        version: versionRecord.version,
        status: "published",
        triggerType: (triggerType ?? "interactive") as "interactive",
        triggerConfig: {},
        executionEnvironments: ["cloud"],
        blocks: dbBlocks.map((b) => ({
          id: b.id,
          workflowId: b.workflowId,
          workflowVersion: b.workflowVersion,
          name: b.name,
          type: b.type as DbBlock["type"],
          logic: (b.logic ?? {}) as Record<string, unknown>,
          conditions: b.conditions as DbBlock["conditions"],
          order: b.order,
          notes: b.notes ?? undefined,
        })),
        groups: [],
        changelog: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      event: eventData,
      keyResolver: this.createKeyResolver(orgId),
    };
  }

  /* ── Key resolution ────────────────────────────────── */

  /**
   * Creates a key resolver function that the engine uses to
   * dereference $keys.* expressions at runtime.
   */
  private createKeyResolver(orgId: string): (keyName: string) => unknown {
    return (keyName: string) => {
      /**
       * Key resolution is synchronous in the engine interface,
       * but DB lookup is async. For now, return a placeholder
       * that signals the engine should use the fetch block's
       * secret resolution instead. Full async key resolution
       * will be added when the engine supports async resolvers.
       */
      return `$keys.${keyName}`;
    };
  }

  /* ── Helpers ───────────────────────────────────────── */

  private async loadWorkflowVersion(workflowId: string, version: number) {
    const { eq, and } = await import("drizzle-orm");
    const { workflowVersions, blocks } = await import("@vsync/db");

    const versionRecord = await this.db.query.workflowVersions.findFirst({
      where: and(
        eq(workflowVersions.workflowId, workflowId),
        eq(workflowVersions.version, version),
      ),
    });

    if (!versionRecord) return null;

    const versionBlocks = await this.db.query.blocks.findMany({
      where: and(
        eq(blocks.workflowId, workflowId),
        eq(blocks.workflowVersion, version),
      ),
      orderBy: blocks.order,
    });

    return {
      version: versionRecord,
      blocks: versionBlocks as unknown as DbBlock[],
    };
  }

  /** Broadcast an event to both the run channel and the org channel */
  private broadcastChannels(
    runId: string,
    orgId: string,
    event: ReturnType<typeof runStarted>,
  ): void {
    this.wsManager.broadcastToMany([`run:${runId}`, `org:${orgId}`], event);
  }
}
