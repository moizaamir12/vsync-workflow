import type { BlockType } from "./block.js";
import type { TriggerType } from "./workflow.js";

/**
 * Lifecycle states a run can be in.
 * Transitions: pending → running → completed | failed | cancelled
 *              running → awaiting_action → running (when user responds)
 */
export type RunStatus =
  | "pending"
  | "running"
  | "awaiting_action"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * Lifecycle states an individual step can be in.
 * Mirrors RunStatus but scoped to a single block execution.
 */
export type StepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

/**
 * Structured error captured when a step fails.
 * Stored on the step so operators can diagnose issues
 * without digging through raw logs.
 */
export interface StepError {
  /** Human-readable error description */
  message: string;

  /** Optional stack trace for debugging — omitted in production surfaces */
  stack?: string;

  /** Block that produced the error */
  blockId: string;

  /** Block name at the time of failure — denormalized for log readability */
  blockName: string;
}

/**
 * A single block execution within a run.
 * Steps form the granular audit trail — one step per block per iteration.
 */
export interface Step {
  /** Unique identifier for this step */
  stepId: string;

  /** Block that was executed */
  blockId: string;

  /** Block name at execution time — denormalized for timeline display */
  blockName: string;

  /** Block type — enables filtering steps by category */
  blockType: BlockType;

  /** Zero-based position of the block in the workflow definition */
  blockOrder: number;

  /** Monotonically increasing counter across all steps in the run */
  executionOrder: number;

  /** Current lifecycle state of this step */
  status: StepStatus;

  /**
   * Snapshot of the block's logic config at execution time.
   * Captured so post-run inspection shows what was actually run,
   * even if the workflow version is later modified.
   */
  logic?: Record<string, unknown>;

  /** Key/value pairs the block wrote into workflow state */
  stateDelta?: Record<string, unknown>;

  /** Key/value pairs the block wrote into the ephemeral cache */
  cacheDelta?: Record<string, unknown>;

  /** Artifact references produced by this step */
  artifactsDelta?: Record<string, unknown>;

  /** Events emitted during this step (WebSocket broadcasts, logs, etc.) */
  eventDelta?: Record<string, unknown>;

  /** ISO-8601 timestamp when the step began executing */
  startedAt: string;

  /** ISO-8601 timestamp when the step finished (success or failure) */
  endedAt: string;

  /**
   * Whether execution of this step was deferred (e.g. inside a loop
   * that yields between iterations).
   */
  isDeferred?: boolean;

  /** Loop iteration identifier when the step is part of a deferred loop */
  deferIterationId?: string;

  /** Populated only when status is 'failed' */
  error?: StepError;
}

/**
 * A single execution of a workflow version.
 * Runs are the top-level unit of observability — dashboards,
 * billing, and audit logs are all keyed on runs.
 */
export interface Run {
  /** Unique identifier for this run */
  id: string;

  /** Workflow that was executed */
  workflowId: string;

  /** Version number that was used for this run */
  version: number;

  /** Current lifecycle state */
  status: RunStatus;

  /** How this run was initiated */
  triggerType: TriggerType;

  /** Origin identifier — e.g. API key name, schedule ID, hook sender */
  triggerSource?: string;

  /** ISO-8601 timestamp when execution began (null while pending) */
  startedAt?: string;

  /** ISO-8601 timestamp when execution finished */
  completedAt?: string;

  /** Wall-clock duration in milliseconds (null while still running) */
  durationMs?: number;

  /** Top-level error message if the run failed */
  errorMessage?: string;

  /** Organization that owns this run — for multi-tenant isolation */
  orgId: string;

  /** Device or agent that executed the run (relevant for mobile/desktop) */
  deviceId?: string;

  /** ISO-8601 timestamp of creation */
  createdAt: string;
}
