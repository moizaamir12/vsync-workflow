/**
 * Events emitted by the WorkflowDesigner during streaming.
 * The UI consumes these to display real-time AI progress.
 */

/** AI is reasoning about the request before acting. */
export interface ThinkingEvent {
  type: "thinking";
  data: { text: string };
}

/** AI has created a multi-step plan for a complex request. */
export interface PlanEvent {
  type: "plan";
  data: {
    planId: string;
    steps: string[];
  };
}

/** AI has made a workflow edit (add, update, remove, reorder, set_trigger). */
export interface EditEvent {
  type: "edit";
  data: {
    operation: "add_block" | "update_block" | "remove_block" | "reorder_blocks" | "set_trigger";
    blockId?: string;
    blockType?: string;
    changes?: Record<string, unknown>;
    diff?: Record<string, { before: unknown; after: unknown }>;
  };
}

/** AI has finished processing the request. */
export interface CompleteEvent {
  type: "complete";
  data: {
    summary: string;
    blocksModified: number;
  };
}

/** An error occurred during AI processing. */
export interface ErrorEvent {
  type: "error";
  data: {
    message: string;
    recoverable: boolean;
  };
}

/** Union of all designer events. */
export type DesignerEvent =
  | ThinkingEvent
  | PlanEvent
  | EditEvent
  | CompleteEvent
  | ErrorEvent;
