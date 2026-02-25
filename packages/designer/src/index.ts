/* ── Core ──────────────────────────────────────────────── */

export { WorkflowDesigner } from "./WorkflowDesigner.js";
export type {
  WorkflowDesignerOptions,
  ExistingWorkflow,
} from "./WorkflowDesigner.js";

/* ── Events ───────────────────────────────────────────── */

export type {
  DesignerEvent,
  ThinkingEvent,
  PlanEvent,
  EditEvent,
  CompleteEvent,
  ErrorEvent,
} from "./events.js";

/* ── System prompt ────────────────────────────────────── */

export { buildSystemPrompt, resolveModelId } from "./system-prompt.js";

/* ── Tools ────────────────────────────────────────────── */

export {
  getBlockDocsTool,
  getPatternDocsTool,
  getExampleTool,
} from "./tools/getDocs.js";

export {
  createAddBlockTool,
  createUpdateBlockTool,
  createRemoveBlockTool,
  createReorderBlocksTool,
  createSetTriggerTool,
} from "./tools/editWorkflow.js";

export type { WorkflowState } from "./tools/editWorkflow.js";

export { createPlanTool } from "./tools/createPlan.js";

/* ── Prompt data ──────────────────────────────────────── */

export { CONCEPT_DOCS } from "./prompts/concept-docs.js";
export { PATTERN_DOCS } from "./prompts/pattern-docs.js";
export { EXAMPLE_DOCS } from "./prompts/example-docs.js";
