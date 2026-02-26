/**
 * Exhaustive set of block types supported by the engine.
 * Each type maps to a dedicated adapter in @vsync/engine-adapters
 * that knows how to execute its logic payload.
 */
// TODO: Add "code_typescript" and "code_sandbox" to BlockType union — the engine has handlers for these but they're missing from the type.
export type BlockType =
  | "object"
  | "string"
  | "array"
  | "math"
  | "date"
  | "normalize"
  | "location"
  | "fetch"
  | "agent"
  | "goto"
  | "sleep"
  | "ui_camera"
  | "ui_form"
  | "ui_table"
  | "ui_details"
  | "image"
  | "filesystem"
  | "ftp"
  | "code"
  | "video"
  | "validation";

/**
 * Comparison operators available in block conditions.
 * These cover equality, ordering, string matching, and nullability checks.
 */
export type ConditionOperator =
  | "=="
  | "!="
  | "<"
  | ">"
  | "<="
  | ">="
  | "contains"
  | "startsWith"
  | "endsWith"
  | "in"
  | "isEmpty"
  | "isFalsy"
  | "isNull"
  | "regex";

/**
 * A single predicate evaluated before a block executes.
 * All conditions on a block must pass (AND logic) for execution to proceed.
 */
export interface Condition {
  /** Left-hand operand — typically a JSONPath or template expression */
  left: string;

  /** Comparison operator applied between left and right */
  operator: ConditionOperator;

  /** Right-hand operand — literal value or expression to compare against */
  right: string;
}

/**
 * A discrete unit of work inside a workflow version.
 * Blocks are executed sequentially by order, with optional conditions
 * gating whether each block runs.
 *
 * The `logic` field is intentionally generic — each block type defines
 * its own logic shape. The @vsync/blocks package provides schemas
 * for per-type validation.
 */
export interface Block {
  /** Unique identifier for this block */
  id: string;

  /** Parent workflow this block belongs to */
  workflowId: string;

  /** Version number this block is part of */
  workflowVersion: number;

  /** Human-readable label shown in the designer */
  name: string;

  /** Discriminator that determines which adapter processes this block */
  type: BlockType;

  /**
   * Type-specific configuration payload.
   * Kept as a generic record so the shared-types package stays
   * decoupled from per-block schemas defined in @vsync/blocks.
   */
  logic: Record<string, unknown>;

  /** Optional guard conditions — all must pass for the block to execute */
  conditions?: Condition[];

  /** Zero-based position in the execution sequence */
  order: number;

  /** Free-form notes visible in the designer (documentation, reminders) */
  notes?: string;
}
