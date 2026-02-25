import type { Block, WorkflowContext } from "@vsync/shared-types";
import type { BlockResult } from "../types.js";
import { ContextManager } from "../core/ContextManager.js";

/**
 * String block executor.
 *
 * Supports single operation or chained operations via string_operations array.
 * Chained: each op receives the output of the previous as its implicit input.
 */
export async function stringExecutor(
  block: Block,
  context: WorkflowContext,
): Promise<BlockResult> {
  const cm = new ContextManager();
  const logic = block.logic;

  /* Check for chained operations */
  const chainedOps = resolveDynamic(cm, logic.string_operations, context);
  if (Array.isArray(chainedOps) && chainedOps.length > 0) {
    return executeChained(cm, logic, chainedOps, context);
  }

  /* Single operation */
  const operation = resolveDynamic(cm, logic.string_operation, context) as string;
  const input = resolveDynamic(cm, logic.string_input, context);
  const result = executeOperation(cm, operation, String(input ?? ""), logic, context);

  const bindTo = logic.string_bind_value as string | undefined;
  if (bindTo) {
    return { stateDelta: { [extractBindKey(bindTo)]: result } };
  }
  return {};
}

/* ── Chained execution ────────────────────────────────── */

function executeChained(
  cm: ContextManager,
  topLogic: Record<string, unknown>,
  ops: unknown[],
  context: WorkflowContext,
): BlockResult {
  let current: unknown = resolveDynamic(cm, topLogic.string_input, context);
  const stateDelta: Record<string, unknown> = {};

  for (const rawOp of ops) {
    const op = rawOp as Record<string, unknown>;
    const operation = resolveDynamic(cm, op.operation, context) as string;
    const inputStr = String(current ?? "");

    current = executeOperation(cm, operation, inputStr, op, context);

    /* Per-operation binding */
    const bindTo = op.bind_to as string | undefined;
    if (bindTo) {
      stateDelta[extractBindKey(bindTo)] = current;
    }
  }

  /* Top-level binding gets final result */
  const topBind = topLogic.string_bind_value as string | undefined;
  if (topBind) {
    stateDelta[extractBindKey(topBind)] = current;
  }

  return { stateDelta };
}

/* ── Operation dispatch ───────────────────────────────── */

function executeOperation(
  cm: ContextManager,
  operation: string,
  input: string,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): unknown {
  switch (operation) {
    case "slice": return executeSlice(cm, input, logic, context);
    case "extract": return executeExtract(cm, input, logic, context);
    case "format": return executeFormat(cm, input, logic, context);
    case "trim": return input.trim();
    case "pad": return executePad(cm, input, logic, context);
    case "replace": return executeReplace(cm, input, logic, context);
    case "match": return executeMatch(cm, input, logic, context);
    case "length": return input.length;
    case "split": return executeSplit(cm, input, logic, context);
    case "path": return executePath(cm, input, logic, context);
    case "generate": return executeGenerate(cm, logic, context);
    case "checksum": return executeChecksum(cm, input, logic, context);
    default:
      throw new Error(`Unknown string operation: "${operation}"`);
  }
}

/* ── Operations ───────────────────────────────────────── */

function executeSlice(
  cm: ContextManager,
  input: string,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): string {
  const from = resolveDynamic(cm, logic.string_slice_from, context);
  const count = resolveDynamic(cm, logic.string_slice_count, context);
  const start = resolveDynamic(cm, logic.string_slice_start, context);
  const end = resolveDynamic(cm, logic.string_slice_end, context);

  if (from !== undefined && from !== null) {
    const fromIdx = Number(from);
    if (count !== undefined && count !== null) {
      return input.slice(fromIdx, fromIdx + Number(count));
    }
    return input.slice(fromIdx);
  }

  if (start !== undefined && start !== null) {
    return input.slice(Number(start), end !== undefined && end !== null ? Number(end) : undefined);
  }

  return input;
}

function executeExtract(
  cm: ContextManager,
  input: string,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): unknown {
  const mode = resolveDynamic(cm, logic.string_extract_mode, context) as string;

  switch (mode) {
    case "before": {
      const delimiter = String(resolveDynamic(cm, logic.string_extract_delimiter, context) ?? "");
      const idx = input.indexOf(delimiter);
      return idx === -1 ? null : input.slice(0, idx);
    }
    case "after": {
      const delimiter = String(resolveDynamic(cm, logic.string_extract_delimiter, context) ?? "");
      const idx = input.indexOf(delimiter);
      return idx === -1 ? null : input.slice(idx + delimiter.length);
    }
    case "between": {
      const startDelim = String(resolveDynamic(cm, logic.string_extract_start_delimiter, context) ?? "");
      const endDelim = String(resolveDynamic(cm, logic.string_extract_end_delimiter, context) ?? "");
      const startIdx = input.indexOf(startDelim);
      if (startIdx === -1) return null;
      const afterStart = startIdx + startDelim.length;
      const endIdx = input.indexOf(endDelim, afterStart);
      if (endIdx === -1) return null;
      return input.slice(afterStart, endIdx);
    }
    case "number": {
      const match = input.match(/-?\d+(\.\d+)?/);
      return match ? Number(match[0]) : null;
    }
    case "regex": {
      const pattern = String(resolveDynamic(cm, logic.string_extract_regex, context) ?? "");
      try {
        const regex = new RegExp(pattern);
        const match = input.match(regex);
        return match ? (match[1] ?? match[0]) : null;
      } catch {
        return null;
      }
    }
    default:
      return null;
  }
}

function executeFormat(
  cm: ContextManager,
  input: string,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): string {
  const format = resolveDynamic(cm, logic.string_format_type, context) as string;

  switch (format) {
    case "upper":
      return input.toUpperCase();
    case "lower":
      return input.toLowerCase();
    case "title":
      return input.replace(/\b\w/g, (c) => c.toUpperCase());
    case "sentence":
      return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
    case "number": {
      const num = Number(input);
      if (Number.isNaN(num)) return input;
      const decimals = Number(resolveDynamic(cm, logic.string_format_decimals, context) ?? 2);
      return num.toFixed(decimals);
    }
    default:
      return input;
  }
}

function executePad(
  cm: ContextManager,
  input: string,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): string {
  const side = resolveDynamic(cm, logic.string_pad_side, context) as string ?? "left";
  const length = Number(resolveDynamic(cm, logic.string_pad_length, context) ?? 0);
  const char = String(resolveDynamic(cm, logic.string_pad_char, context) ?? " ");

  if (side === "right") return input.padEnd(length, char);
  return input.padStart(length, char);
}

function executeReplace(
  cm: ContextManager,
  input: string,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): string {
  const find = String(resolveDynamic(cm, logic.string_replace_find, context) ?? "");
  const replaceWith = String(resolveDynamic(cm, logic.string_replace_with, context) ?? "");
  const all = resolveDynamic(cm, logic.string_replace_all, context);

  if (all) {
    return input.split(find).join(replaceWith);
  }
  return input.replace(find, replaceWith);
}

function executeMatch(
  cm: ContextManager,
  input: string,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): unknown {
  const mode = resolveDynamic(cm, logic.string_match_mode, context) as string ?? "regex";

  if (mode === "fuzzy") {
    const query = String(resolveDynamic(cm, logic.string_match_query, context) ?? "");
    const score = fuzzyScore(input.toLowerCase(), query.toLowerCase());
    return { score, value: input };
  }

  /* Regex mode */
  const pattern = String(resolveDynamic(cm, logic.string_match_pattern, context) ?? "");
  try {
    const regex = new RegExp(pattern);
    const match = input.match(regex);
    return match ? { matched: true, groups: match.slice(1), value: match[0] } : { matched: false, groups: [], value: null };
  } catch {
    return { matched: false, groups: [], value: null };
  }
}

function executeSplit(
  cm: ContextManager,
  input: string,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): string[] {
  const separator = String(resolveDynamic(cm, logic.string_split_separator, context) ?? ",");
  return input.split(separator);
}

function executePath(
  cm: ContextManager,
  input: string,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): string {
  const component = resolveDynamic(cm, logic.string_path_component, context) as string ?? "filename";

  if (component === "extension") {
    const dotIdx = input.lastIndexOf(".");
    return dotIdx === -1 ? "" : input.slice(dotIdx + 1);
  }

  /* filename */
  const slashIdx = Math.max(input.lastIndexOf("/"), input.lastIndexOf("\\"));
  return slashIdx === -1 ? input : input.slice(slashIdx + 1);
}

function executeGenerate(
  cm: ContextManager,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): string {
  const genType = resolveDynamic(cm, logic.string_generate_type, context) as string;

  switch (genType) {
    case "short_id":
      return generateShortId();
    case "uuid":
      return generateUuid();
    case "ocr_confusables":
      return checkOcrConfusables(
        String(resolveDynamic(cm, logic.string_generate_input, context) ?? ""),
      );
    default:
      throw new Error(`Unknown generate type: "${genType}"`);
  }
}

function executeChecksum(
  cm: ContextManager,
  input: string,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): string | null {
  const algorithm = resolveDynamic(cm, logic.string_checksum_algorithm, context) as string;
  const digits = input.replace(/\D/g, "");

  if (digits.length === 0) return null;

  switch (algorithm) {
    case "luhn":
    case "mod10":
      return luhnCheckDigit(digits);
    case "mod11":
      return mod11CheckDigit(digits);
    case "weighted": {
      const weights = resolveDynamic(cm, logic.string_checksum_weights, context) as number[];
      if (!Array.isArray(weights)) return null;
      return weightedCheckDigit(digits, weights);
    }
    default:
      throw new Error(`Unknown checksum algorithm: "${algorithm}"`);
  }
}

/* ── Checksum algorithms ──────────────────────────────── */

function luhnCheckDigit(digits: string): string {
  const nums = digits.split("").map(Number);
  let sum = 0;
  let alt = true;

  for (let i = nums.length - 1; i >= 0; i--) {
    let n = nums[i];
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }

  return String((10 - (sum % 10)) % 10);
}

function mod11CheckDigit(digits: string): string {
  const nums = digits.split("").map(Number);
  let weight = 2;
  let sum = 0;

  for (let i = nums.length - 1; i >= 0; i--) {
    sum += nums[i] * weight;
    weight++;
    if (weight > 7) weight = 2;
  }

  const remainder = sum % 11;
  if (remainder === 0) return "0";
  if (remainder === 1) return "0";
  return String(11 - remainder);
}

function weightedCheckDigit(digits: string, weights: number[]): string {
  const nums = digits.split("").map(Number);
  let sum = 0;

  for (let i = 0; i < nums.length; i++) {
    sum += nums[i] * (weights[i % weights.length]);
  }

  return String(sum % 10);
}

/* ── Fuzzy matching ───────────────────────────────────── */

function fuzzyScore(text: string, query: string): number {
  if (query.length === 0) return 1;
  if (text.length === 0) return 0;
  if (text === query) return 1;
  if (text.includes(query)) return 0.9;

  let queryIdx = 0;
  let matched = 0;

  for (let i = 0; i < text.length && queryIdx < query.length; i++) {
    if (text[i] === query[queryIdx]) {
      matched++;
      queryIdx++;
    }
  }

  if (queryIdx < query.length) return 0;
  return matched / Math.max(text.length, query.length);
}

/* ── Generators ───────────────────────────────────────── */

function generateShortId(): string {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function generateUuid(): string {
  /* RFC 4122 v4 UUID */
  const hex = "0123456789abcdef";
  let uuid = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += "-";
    } else if (i === 14) {
      uuid += "4";
    } else if (i === 19) {
      uuid += hex[(Math.floor(Math.random() * 4) + 8)];
    } else {
      uuid += hex[Math.floor(Math.random() * 16)];
    }
  }
  return uuid;
}

/** Flag OCR-confusable characters (0/O, 1/l/I, 5/S, 8/B) */
function checkOcrConfusables(input: string): string {
  const confusables: Record<string, string> = {
    "0": "O", "O": "0",
    "1": "l/I", "l": "1/I", "I": "1/l",
    "5": "S", "S": "5",
    "8": "B", "B": "8",
  };

  const flags: string[] = [];
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (confusables[ch]) {
      flags.push(`'${ch}' at position ${i} (confusable with ${confusables[ch]})`);
    }
  }

  return flags.length > 0 ? flags.join("; ") : "no confusables found";
}

/* ── Helpers ──────────────────────────────────────────── */

function resolveDynamic(
  cm: ContextManager,
  value: unknown,
  context: WorkflowContext,
): unknown {
  return cm.resolveValue(value, context);
}

function extractBindKey(bindTo: string): string {
  if (bindTo.startsWith("$state.")) return bindTo.slice(7);
  return bindTo;
}
