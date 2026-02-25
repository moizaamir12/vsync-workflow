import { createMobileInterpreter } from "@vsync/engine-adapters";
import type { Interpreter, RunConfig, RunResult } from "@vsync/engine";
import type {
  Block,
  Step,
  WorkflowVersion,
  WorkflowContext,
  TriggerType,
} from "@vsync/shared-types";

/* Singleton interpreter — heavy to create, reuse across runs. */
let interpreterInstance: Interpreter | null = null;

function getInterpreter(): Interpreter {
  if (!interpreterInstance) {
    interpreterInstance = createMobileInterpreter();
  }
  return interpreterInstance;
}

/**
 * Block types that the MobileAdapter can execute on-device.
 * Matches the handlers registered in MobileAdapter.registerBlocks().
 */
const MOBILE_SUPPORTED_TYPES = new Set([
  /* data blocks */
  "object",
  "string",
  "array",
  "math",
  "date",
  "normalize",
  /* flow blocks */
  "fetch",
  "agent",
  "goto",
  "sleep",
  "code",
  /* platform blocks */
  "image",
  "location",
  /* UI blocks (intercepted by Interpreter, not actually "executed") */
  "ui_camera",
  "ui_form",
  "ui_table",
  "ui_details",
  /* validation */
  "validation",
]);

/**
 * Check if a single block can be executed on-device.
 */
export function canExecuteBlock(blockType: string): boolean {
  return MOBILE_SUPPORTED_TYPES.has(blockType);
}

/**
 * Determine the execution strategy for a full workflow.
 *
 * - "local"  — every block is mobile-supported → run entirely on-device
 * - "cloud"  — at least one block is unsupported → delegate to cloud API
 * - "hybrid" — mixed; execute supported blocks locally, delegate the rest
 */
export function getExecutionStrategy(
  blocks: Array<{ type: string }>,
): "local" | "cloud" | "hybrid" {
  const unsupported = blocks.filter((b) => !canExecuteBlock(b.type));

  if (unsupported.length === 0) return "local";
  if (unsupported.length === blocks.length) return "cloud";
  return "hybrid";
}

/* ── Options for local execution ──────────────────────────── */

/** Parameters needed to run a workflow on-device. */
export interface LocalRunOptions {
  /** The workflow ID (from route params) */
  workflowId: string;

  /** Active version number */
  version: number;

  /** Blocks from the active version */
  blocks: Block[];

  /** Trigger type — defaults to "interactive" */
  triggerType?: TriggerType;

  /** Organization ID — defaults to "local" for offline */
  orgId?: string;

  /** Device identifier — defaults to "mobile" */
  deviceId?: string;

  /** Trigger event payload */
  event?: Record<string, unknown>;

  /** Pre-seeded state (e.g. from a previous partial run) */
  initialState?: Record<string, unknown>;
}

/**
 * Build a minimal WorkflowVersion from the available data.
 * The engine only needs blocks, workflowId, version, and triggerType.
 */
function buildWorkflowVersion(options: LocalRunOptions): WorkflowVersion {
  return {
    workflowId: options.workflowId,
    version: options.version,
    status: "published",
    triggerType: options.triggerType ?? "interactive",
    triggerConfig: {},
    executionEnvironments: ["mobile"],
    blocks: options.blocks,
    groups: [],
    changelog: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Build a RunConfig from the local run options.
 */
function buildRunConfig(options: LocalRunOptions): RunConfig {
  return {
    runId: crypto.randomUUID(),
    orgId: options.orgId ?? "local",
    deviceId: options.deviceId ?? "mobile",
    workflowVersion: buildWorkflowVersion(options),
    event: options.event ?? {},
    initialState: options.initialState,
  };
}

/**
 * Execute a workflow entirely on-device using the MobileAdapter.
 *
 * Returns the engine result which includes steps, status, duration, etc.
 * UI blocks will cause the execution to pause with an "awaiting_action" status.
 */
export async function executeLocally(
  options: LocalRunOptions,
): Promise<{
  status: string;
  steps: Step[];
  durationMs: number;
  error?: string;
}> {
  const interpreter = getInterpreter();
  const runConfig = buildRunConfig(options);

  const result: RunResult = await interpreter.executeRun(runConfig);

  return {
    status: result.status,
    steps: result.steps,
    durationMs: result.durationMs,
    error: result.errorMessage,
  };
}

/**
 * Resume a paused local execution (e.g. after user completes a UI block).
 * `userResponse` is the data gathered from the UI block (form values, photo URI, etc.).
 */
export async function resumeLocally(
  options: LocalRunOptions,
  fromBlockIndex: number,
  existingState: Record<string, unknown>,
  userResponse: Record<string, unknown>,
): Promise<{
  status: string;
  steps: Step[];
  durationMs: number;
  error?: string;
}> {
  const interpreter = getInterpreter();
  const runConfig = buildRunConfig(options);

  /* Merge user response into existing state */
  const mergedState = { ...existingState, ...userResponse };

  /* Construct a WorkflowContext for the resumed execution */
  const existingContext: WorkflowContext = {
    state: mergedState,
    cache: new Map<string, unknown>(),
    artifacts: [],
    secrets: {},
    run: {
      id: runConfig.runId,
      workflowId: options.workflowId,
      versionId: `${options.workflowId}:v${options.version}`,
      status: "running",
      triggerType: runConfig.workflowVersion.triggerType,
      startedAt: new Date().toISOString(),
      platform: "mobile",
      deviceId: options.deviceId ?? "mobile",
    },
    event: (runConfig.event ?? {}) as Record<string, unknown> & { type?: string },
    loops: {},
    paths: {},
  };

  const result: RunResult = await interpreter.resumeRun(
    runConfig,
    fromBlockIndex,
    existingContext,
  );

  return {
    status: result.status,
    steps: result.steps,
    durationMs: result.durationMs,
    error: result.errorMessage,
  };
}
