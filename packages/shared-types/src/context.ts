import type { Artifact } from "./artifact.js";
import type { BlockType } from "./block.js";
import type { RunStatus } from "./run.js";
import type { TriggerType } from "./workflow.js";

/**
 * Function signature for resolving dynamic keys at runtime.
 * Used by the engine to dereference template expressions
 * (e.g. `{{state.orderId}}`) inside block logic.
 */
export type KeyResolver = (key: string) => unknown;

/**
 * Per-run metadata available to every block during execution.
 * Provides identity, timing, and positional information
 * so blocks can make context-aware decisions.
 */
export interface RunContext {
  /** Run identifier */
  id: string;

  /** Workflow being executed */
  workflowId: string;

  /** Version identifier of the workflow snapshot */
  versionId: string;

  /** Current run lifecycle state */
  status: RunStatus;

  /** How the run was initiated */
  triggerType: TriggerType;

  /** ISO-8601 timestamp of run start */
  startedAt: string;

  /** Execution platform (e.g. "web", "ios", "android", "server") */
  platform: string;

  /** Device or agent identifier */
  deviceId: string;

  /** Currently executing step ID */
  stepId?: string;

  /** Zero-based index of the current step in the run */
  stepIndex?: number;

  /** Currently executing block ID */
  blockId?: string;

  /** Currently executing block name — for logging convenience */
  blockName?: string;

  /** Currently executing block type — enables type-specific branching */
  blockType?: BlockType;
}

/**
 * Tracks iteration state when a block runs inside a loop.
 * The engine creates one LoopContext per active loop and
 * updates it on each iteration.
 */
export interface LoopContext {
  /** Zero-based iteration counter */
  index: number;

  /** Artifact scoped to the current iteration (e.g. current image in a batch) */
  artifact?: Artifact;
}

/**
 * Payload delivered alongside the trigger that started a run.
 * The `type` discriminator lets blocks react to specific event kinds
 * while the index signature accommodates arbitrary provider-specific fields.
 */
export interface EventData {
  /** Optional discriminator for the event kind */
  type?: string;

  /** Arbitrary event payload fields from the trigger source */
  [key: string]: unknown;
}

/**
 * The complete execution context threaded through every block.
 * This is the single object the engine passes into adapter `execute()`
 * methods — it contains everything a block needs to read inputs,
 * write outputs, and interact with the runtime.
 */
export interface WorkflowContext {
  /** Persistent key-value store — survives across steps within a run */
  state: Record<string, unknown>;

  /**
   * Ephemeral key-value cache — cleared between runs.
   * Useful for deduplication and intermediate computation results.
   */
  cache: Map<string, unknown>;

  /** Artifacts produced so far in this run */
  artifacts: Artifact[];

  /**
   * Decrypted secret values available to the workflow.
   * Populated from the organization's secret store at run start.
   */
  secrets: Record<string, string>;

  /** Metadata about the current run and execution position */
  run: RunContext;

  /** Trigger event payload that initiated this run */
  event: EventData;

  /** Active loop contexts keyed by loop block ID */
  loops: Record<string, LoopContext>;

  /**
   * Named filesystem paths (e.g. tempDir, outputDir).
   * Platform-specific — the engine populates these before execution.
   */
  paths: Record<string, string>;

  /**
   * Optional resolver for dynamic template expressions.
   * When present, blocks use this instead of direct state lookups
   * so the engine can intercept and transform references.
   */
  keyResolver?: KeyResolver;
}
