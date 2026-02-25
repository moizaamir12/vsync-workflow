/* ── Core ──────────────────────────────────────────────── */

export { Interpreter } from "./core/Interpreter.js";
export { BlockExecutor } from "./core/BlockExecutor.js";
export { ContextManager } from "./core/ContextManager.js";
export { ConditionEvaluator } from "./core/ConditionEvaluator.js";
export { RunBuilder } from "./core/RunBuilder.js";
export { PlatformAdapter } from "./core/PlatformAdapter.js";

/* ── Types ─────────────────────────────────────────────── */

export type {
  InterpreterConfig,
  RunConfig,
  RunResult,
  BlockResult,
  BlockHandler,
  ErrorStrategy,
} from "./types.js";

export type { PlatformCapabilities } from "./core/PlatformAdapter.js";

export type { ModelConfig, ModelResponse } from "./blocks/agent.js";
export type { GotoResult } from "./blocks/goto.js";
export type { ConsoleEntry, SanitizedError } from "./blocks/code-sandbox.js";

/* ── Block executors ───────────────────────────────────── */

export {
  dataBlockHandlers,
  flowBlockHandlers,
  objectExecutor,
  stringExecutor,
  arrayExecutor,
  mathExecutor,
  dateExecutor,
  normalizeExecutor,
  fetchExecutor,
  agentExecutor,
  gotoExecutor,
  sleepExecutor,
  locationExecutor,
  codeExecutor,
} from "./blocks/index.js";

/* ── Utilities (for testing / advanced usage) ─────────── */

export { isPrivateIp, matchesStatusCode } from "./blocks/fetch.js";
export { haversineDistance } from "./blocks/location.js";
export { MAX_SLEEP_DURATION_MS } from "./blocks/sleep.js";
export { validateCode, sanitizeError, diffState } from "./blocks/code-sandbox.js";
export { transpileTypeScript } from "./blocks/code-typescript.js";
