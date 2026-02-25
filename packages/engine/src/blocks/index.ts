import type { BlockHandler } from "../types.js";
import { objectExecutor } from "./object.js";
import { stringExecutor } from "./string.js";
import { arrayExecutor } from "./array.js";
import { mathExecutor } from "./math.js";
import { dateExecutor } from "./date.js";
import { normalizeExecutor } from "./normalize.js";
import { fetchExecutor } from "./fetch.js";
import { agentExecutor } from "./agent.js";
import { gotoExecutor } from "./goto.js";
import { sleepExecutor } from "./sleep.js";
import { locationExecutor } from "./location.js";
import { codeExecutor } from "./code.js";

/**
 * Map of block type → executor function for all data blocks.
 * Register these with the BlockExecutor to enable execution.
 */
export const dataBlockHandlers: Record<string, BlockHandler> = {
  object: objectExecutor,
  string: stringExecutor,
  array: arrayExecutor,
  math: mathExecutor,
  date: dateExecutor,
  normalize: normalizeExecutor,
};

/**
 * Map of block type → executor function for flow control and integration blocks.
 * These blocks interact with external services or control execution flow.
 */
export const flowBlockHandlers: Record<string, BlockHandler> = {
  fetch: fetchExecutor,
  agent: agentExecutor as BlockHandler,
  goto: gotoExecutor,
  sleep: sleepExecutor,
  location: locationExecutor as BlockHandler,
  code: codeExecutor,
};

export {
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
};
