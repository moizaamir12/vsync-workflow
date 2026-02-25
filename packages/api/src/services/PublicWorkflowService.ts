import { nanoid } from "nanoid";
import { createHash } from "node:crypto";
import type { Database } from "@vsync/db";
import { WorkflowRepository, PublicRunRepository } from "@vsync/db";
import type { Interpreter, RunConfig, RunResult } from "@vsync/engine";
import type { Block as DbBlock } from "@vsync/shared-types";
import type { WSManager } from "../ws/manager.js";
import {
  runStarted,
  runStep,
  runCompleted,
  runFailed,
  runAwaitingAction,
} from "../ws/events.js";
import type { PausedRunState } from "./WorkflowExecutionService.js";

/* ── Block type allow-list for public runs ─────────────────── */

const PUBLIC_ALLOWED_BLOCK_TYPES = new Set([
  "object",
  "string",
  "array",
  "math",
  "date",
  "normalize",
  "fetch",
  "agent",
  "code",
  "goto",
  "sleep",
  "validation",
  "ui_form",
  "ui_table",
  "ui_details",
]);

/** Timeouts for public runs (stricter than authenticated) */
const PUBLIC_RUN_TIMEOUT_MS = 30_000;
const PUBLIC_BLOCK_TIMEOUT_MS = 10_000;

/* ── Public branding shape ─────────────────────────────────── */

export interface PublicBranding {
  title?: string;
  description?: string;
  accentColor?: string;
  logoUrl?: string;
  hideVsyncBranding?: boolean;
}

/** Rate limit config stored per workflow */
export interface PublicRateLimit {
  maxPerMinute: number;
}

/* ── Slug generation ───────────────────────────────────────── */

/** Generate a URL-safe slug from a workflow name + short random suffix */
function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const suffix = nanoid(6);
  return `${base}-${suffix}`;
}

/** Hash IP address with SHA-256 for privacy-preserving rate limiting */
function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

/**
 * Service layer for public workflow operations.
 *
 * Handles slug generation, public config management, anonymous
 * run execution with block-type restrictions, and view/run tracking.
 */
export class PublicWorkflowService {
  private readonly wfRepo: WorkflowRepository;
  private readonly publicRunRepo: PublicRunRepository;

  /** Cancellation flags keyed by runId */
  private readonly cancelFlags = new Map<string, boolean>();

  constructor(
    private readonly db: Database,
    private readonly wsManager: WSManager,
    private readonly interpreter: Interpreter,
  ) {
    this.wfRepo = new WorkflowRepository(db);
    this.publicRunRepo = new PublicRunRepository(db);
  }

  /* ── Slug management ──────────────────────────────── */

  /** Generate a unique slug for a workflow, retrying on collision. */
  async generateUniqueSlug(workflowName: string): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = generateSlug(workflowName);
      const existing = await this.wfRepo.findByPublicSlug(slug);
      if (!existing) return slug;
    }
    /* Fallback: fully random slug */
    return nanoid(12);
  }

  /** Check if a slug is available (not taken by another workflow). */
  async isSlugAvailable(slug: string): Promise<boolean> {
    const existing = await this.wfRepo.findByPublicSlug(slug);
    return !existing;
  }

  /* ── Public config ────────────────────────────────── */

  /**
   * Get the public-facing config for a published workflow.
   * Returns null if the workflow doesn't exist or isn't public.
   */
  async getPublicConfig(slug: string) {
    const workflow = await this.wfRepo.findByPublicSlug(slug);
    if (!workflow) return null;

    const active = await this.wfRepo.getActiveVersion(workflow.id);
    if (!active) return null;

    /* Filter blocks to only allowed types for public runs */
    const safeBlocks = active.blocks.filter((b) =>
      PUBLIC_ALLOWED_BLOCK_TYPES.has(b.type),
    );

    const branding = (workflow.publicBranding ?? {}) as PublicBranding;

    return {
      slug: workflow.publicSlug,
      name: branding.title ?? workflow.name,
      description: branding.description ?? workflow.description,
      branding,
      accessMode: workflow.publicAccessMode ?? "view",
      triggerType: active.version.triggerType ?? "interactive",
      blockCount: safeBlocks.length,
      blocks: safeBlocks.map((b) => ({
        id: b.id,
        name: b.name,
        type: b.type,
        order: b.order,
      })),
      environments: active.version.executionEnvironments,
    };
  }

  /* ── Run execution ────────────────────────────────── */

  /**
   * Trigger a public run. Validates block types, creates a public run
   * record, and starts background execution with stricter timeouts.
   */
  async triggerPublicRun(
    slug: string,
    ip: string,
    userAgent: string,
    eventData: Record<string, unknown> = {},
  ): Promise<{ runId: string } | { error: string; status: number }> {
    const workflow = await this.wfRepo.findByPublicSlug(slug);
    if (!workflow) return { error: "Workflow not found", status: 404 };

    if (workflow.publicAccessMode !== "run") {
      return { error: "This workflow is view-only", status: 403 };
    }

    if (workflow.isDisabled) {
      return { error: "Workflow is currently disabled", status: 422 };
    }

    const active = await this.wfRepo.getActiveVersion(workflow.id);
    if (!active) {
      return { error: "No published version available", status: 422 };
    }

    /* Validate all blocks are in the public allow-list */
    const blockedTypes = active.blocks
      .map((b) => b.type)
      .filter((t) => !PUBLIC_ALLOWED_BLOCK_TYPES.has(t));

    if (blockedTypes.length > 0) {
      return {
        error: `Workflow contains restricted block types: ${[...new Set(blockedTypes)].join(", ")}`,
        status: 422,
      };
    }

    /* Create the public run record */
    const ipHash = hashIp(ip);
    const runId = nanoid();
    const run = await this.publicRunRepo.create({
      id: runId,
      workflowId: workflow.id,
      publicSlug: slug,
      version: active.version.version,
      ipHash,
      userAgent: userAgent.slice(0, 200),
      isAnonymous: true,
      startedAt: new Date(),
    });

    /* Fire-and-forget background execution */
    this.executePublicRun(
      run.id,
      workflow.id,
      workflow.orgId,
      active.version,
      active.blocks as unknown as DbBlock[],
      active.version.triggerType ?? "interactive",
      eventData,
    );

    return { runId: run.id };
  }

  /* ── Run status ───────────────────────────────────── */

  /** Get the current status of a public run. */
  async getPublicRunStatus(runId: string) {
    const run = await this.publicRunRepo.findById(runId);
    if (!run) return null;

    return {
      id: run.id,
      status: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      durationMs: run.durationMs,
      errorMessage: run.errorMessage,
      stepsJson: run.stepsJson,
    };
  }

  /** Submit a user action to resume a paused public run. */
  async submitPublicAction(
    runId: string,
    actionData: Record<string, unknown>,
  ): Promise<{ resumed: boolean; error?: string }> {
    const run = await this.publicRunRepo.findById(runId);
    if (!run) return { resumed: false, error: "Run not found" };

    if (run.status !== "awaiting_action") {
      return { resumed: false, error: `Cannot submit action to run in "${run.status}" state` };
    }

    const pausedState = run.stepsJson as PausedRunState | null;
    if (!pausedState?.contextSnapshot) {
      return { resumed: false, error: "No paused state found" };
    }

    const workflow = await this.wfRepo.findById(run.workflowId);
    if (!workflow) return { resumed: false, error: "Workflow not found" };

    const version = run.version ?? 1;
    const versionData = await this.loadWorkflowVersion(run.workflowId, version);
    if (!versionData) return { resumed: false, error: "Version not found" };

    /* Resume execution in background */
    this.resumePublicRun(
      runId,
      run.workflowId,
      workflow.orgId,
      versionData.version,
      versionData.blocks,
      pausedState,
      actionData,
    );

    return { resumed: true };
  }

  /** Cancel a running public workflow. */
  cancelRun(runId: string): void {
    this.cancelFlags.set(runId, true);
  }

  /* ── Rate limiting ────────────────────────────────── */

  /**
   * Check if an IP has exceeded the rate limit for a slug.
   * Returns the remaining allowance or 0 if exceeded.
   */
  async checkRateLimit(
    slug: string,
    ip: string,
    maxPerMinute = 10,
  ): Promise<{ allowed: boolean; remaining: number; retryAfterMs: number }> {
    const ipHash = hashIp(ip);
    const windowStart = new Date(Date.now() - 60_000);
    const count = await this.publicRunRepo.countByIpInWindow(slug, ipHash, windowStart);

    return {
      allowed: count < maxPerMinute,
      remaining: Math.max(0, maxPerMinute - count),
      retryAfterMs: count >= maxPerMinute ? 60_000 : 0,
    };
  }

  /* ── Background execution ─────────────────────────── */

  private executePublicRun(
    runId: string,
    workflowId: string,
    orgId: string,
    versionRecord: { triggerType: string | null; version: number },
    dbBlocks: DbBlock[],
    triggerType: string,
    eventData: Record<string, unknown>,
  ): void {
    void (async () => {
      try {
        await this.publicRunRepo.updateStatus(runId, "running", {
          startedAt: new Date(),
        });

        this.wsManager.broadcastToMany(
          [`public-run:${runId}`],
          runStarted(runId, workflowId, {
            version: versionRecord.version,
            triggerType,
            isPublic: true,
          }),
        );

        const runConfig = this.buildPublicRunConfig(
          runId,
          workflowId,
          orgId,
          versionRecord,
          dbBlocks,
          triggerType,
          eventData,
        );

        const result = await this.interpreter.executeRun(runConfig);
        await this.processPublicRunResult(runId, workflowId, result, dbBlocks);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.publicRunRepo.updateStatus(runId, "failed", {
          errorMessage: message,
          completedAt: new Date(),
        });
        this.wsManager.broadcastToMany(
          [`public-run:${runId}`],
          runFailed(runId, message),
        );
      } finally {
        this.cancelFlags.delete(runId);
      }
    })();
  }

  private resumePublicRun(
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
        await this.publicRunRepo.updateStatus(runId, "running");

        const context = {
          state: { ...pausedState.contextSnapshot.state, ...actionData },
          cache: new Map(pausedState.contextSnapshot.cache),
          artifacts: pausedState.contextSnapshot.artifacts as import("@vsync/shared-types").Artifact[],
          secrets: {},
          run: {
            id: runId,
            workflowId,
            versionId: `${workflowId}:v${versionRecord.version}`,
            status: "running" as const,
            triggerType: (versionRecord.triggerType ?? "interactive") as "interactive",
            startedAt: new Date().toISOString(),
            platform: "node",
            deviceId: "public",
          },
          event: pausedState.contextSnapshot.event as Record<string, unknown> & { type?: string },
          loops: pausedState.contextSnapshot.loops as Record<string, { index: number }>,
          paths: {},
        };

        const runConfig = this.buildPublicRunConfig(
          runId,
          workflowId,
          orgId,
          versionRecord,
          dbBlocks,
          versionRecord.triggerType ?? "interactive",
          pausedState.contextSnapshot.event,
        );

        const resumeIndex = pausedState.currentBlockIndex + 1;
        const result = await this.interpreter.resumeRun(runConfig, resumeIndex, context);
        await this.processPublicRunResult(runId, workflowId, result, dbBlocks);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.publicRunRepo.updateStatus(runId, "failed", {
          errorMessage: message,
          completedAt: new Date(),
        });
        this.wsManager.broadcastToMany(
          [`public-run:${runId}`],
          runFailed(runId, message),
        );
      } finally {
        this.cancelFlags.delete(runId);
      }
    })();
  }

  /* ── Result processing ────────────────────────────── */

  private async processPublicRunResult(
    runId: string,
    workflowId: string,
    result: RunResult,
    dbBlocks: DbBlock[],
  ): Promise<void> {
    /* Broadcast step events */
    for (const step of result.steps) {
      this.wsManager.broadcastToMany(
        [`public-run:${runId}`],
        runStep(runId, step.stepId, step.blockId, step.status, {
          stepIndex: step.executionOrder,
          blockType: step.blockType,
          blockName: step.blockName,
        }),
      );
    }

    switch (result.status) {
      case "completed": {
        await this.publicRunRepo.updateStatus(runId, "completed", {
          completedAt: new Date(),
          durationMs: result.durationMs,
          stepsJson: result.steps,
        });

        this.wsManager.broadcastToMany(
          [`public-run:${runId}`],
          runCompleted(runId, result.durationMs, {
            totalSteps: result.steps.length,
            isPublic: true,
          }),
        );
        break;
      }

      case "failed": {
        await this.publicRunRepo.updateStatus(runId, "failed", {
          completedAt: new Date(),
          durationMs: result.durationMs,
          errorMessage: result.errorMessage,
          stepsJson: result.steps,
        });

        this.wsManager.broadcastToMany(
          [`public-run:${runId}`],
          runFailed(runId, result.errorMessage ?? "Unknown error"),
        );
        break;
      }

      case "awaiting_action": {
        const lastStep = result.steps[result.steps.length - 1];
        const pausedBlock = dbBlocks.find((b) => b.id === lastStep?.blockId);
        const stepIndex = lastStep?.executionOrder ?? 0;

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

        await this.publicRunRepo.updateStatus(runId, "awaiting_action", {
          stepsJson: pausedState,
        });

        this.wsManager.broadcastToMany(
          [`public-run:${runId}`],
          runAwaitingAction(
            runId,
            lastStep?.blockId ?? "",
            pausedBlock?.type ?? "ui_form",
            {
              stepIndex,
              blockType: pausedBlock?.type,
              uiConfig: pausedBlock?.logic ?? {},
              isPublic: true,
            },
          ),
        );
        break;
      }

      default:
        await this.publicRunRepo.updateStatus(runId, "failed", {
          completedAt: new Date(),
          errorMessage: `Unexpected result status: ${result.status}`,
          stepsJson: result.steps,
        });
        break;
    }
  }

  /* ── RunConfig builder ────────────────────────────── */

  private buildPublicRunConfig(
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
      deviceId: "public",
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
      /* Public runs have no key resolver — secrets are not available */
      keyResolver: () => null,
    };
  }

  /* ── Helpers ──────────────────────────────────────── */

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
}
