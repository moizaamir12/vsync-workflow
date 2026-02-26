import type { Block, WorkflowContext } from "@vsync/shared-types";
import type { BlockResult } from "../types.js";
import { ContextManager } from "../core/ContextManager.js";

/**
 * Array block executor.
 *
 * Operations: slice, find, filter, pluck, reverse, sort, flatten,
 * length, add, drop, remove, merge, convert
 * Binding: array_bind_value → $state.key
 */
export async function arrayExecutor(
  block: Block,
  context: WorkflowContext,
): Promise<BlockResult> {
  const cm = new ContextManager();
  const logic = block.logic;
  const operation = resolveDynamic(cm, logic.array_operation, context) as string;
  const input = resolveDynamic(cm, logic.array_input, context);
  const arr = Array.isArray(input) ? input : [];

  let result: unknown;

  switch (operation) {
    case "slice": result = executeSlice(cm, arr, logic, context); break;
    case "find": result = executeFind(cm, arr, logic, context); break;
    case "filter": result = executeFilter(cm, arr, logic, context); break;
    case "pluck": result = executePluck(cm, arr, logic, context); break;
    case "reverse": result = [...arr].reverse(); break;
    case "sort": result = executeSort(cm, arr, logic, context); break;
    case "flatten": result = executeFlatten(arr, logic); break;
    case "length": result = arr.length; break;
    case "add": result = executeAdd(cm, arr, logic, context); break;
    case "drop": result = executeDrop(cm, arr, logic, context); break;
    case "remove": result = executeRemove(cm, arr, logic, context); break;
    case "merge": result = executeMerge(cm, arr, logic, context); break;
    case "convert": result = executeConvert(cm, arr, logic, context); break;
    default:
      throw new Error(`Unknown array operation: "${operation}"`);
  }

  const bindTo = logic.array_bind_value as string | undefined;
  if (bindTo) {
    return { stateDelta: { [extractBindKey(bindTo)]: result } };
  }

  return {};
}

/* ── Operations ───────────────────────────────────────── */

function executeSlice(
  cm: ContextManager,
  arr: unknown[],
  logic: Record<string, unknown>,
  context: WorkflowContext,
): unknown[] {
  const start = Number(resolveDynamic(cm, logic.array_slice_start, context) ?? 0);
  const end = resolveDynamic(cm, logic.array_slice_end, context);
  return arr.slice(start, end !== undefined && end !== null ? Number(end) : undefined);
}

function executeFind(
  cm: ContextManager,
  arr: unknown[],
  logic: Record<string, unknown>,
  context: WorkflowContext,
): unknown {
  const mode = resolveDynamic(cm, logic.array_find_mode, context) as string ?? "match";

  if (mode === "index") {
    const idx = Number(resolveDynamic(cm, logic.array_find_index, context) ?? 0);
    return idx >= 0 && idx < arr.length ? arr[idx] : null;
  }

  /* Match mode */
  const field = resolveDynamic(cm, logic.array_find_field, context) as string | undefined;
  const operator = resolveDynamic(cm, logic.array_find_operator, context) as string ?? "==";
  const value = resolveDynamic(cm, logic.array_find_value, context);

  /* Fuzzy mode */
  if (mode === "fuzzy") {
    const query = String(resolveDynamic(cm, logic.array_find_query, context) ?? "");
    const minScore = Number(resolveDynamic(cm, logic.array_find_min_score, context) ?? 0.5);

    let bestMatch: { item: unknown; score: number } | null = null;
    for (const item of arr) {
      const text = field ? getNestedValue(item, field) : item;
      const score = fuzzyScore(String(text ?? "").toLowerCase(), query.toLowerCase());
      if (score >= minScore && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { item, score };
      }
    }
    return bestMatch?.item ?? null;
  }

  return arr.find((item) => {
    const itemVal = field ? getNestedValue(item, field) : item;
    return matchOperator(itemVal, operator, value);
  }) ?? null;
}

function executeFilter(
  cm: ContextManager,
  arr: unknown[],
  logic: Record<string, unknown>,
  context: WorkflowContext,
): unknown[] {
  const mode = resolveDynamic(cm, logic.array_filter_mode, context) as string ?? "match";

  switch (mode) {
    case "truthy":
      return arr.filter((item) =>
        item !== null && item !== undefined && item !== "" && item !== 0 && item !== false,
      );

    case "unique": {
      const field = resolveDynamic(cm, logic.array_filter_field, context) as string | undefined;
      if (field) {
        const seen = new Set<unknown>();
        return arr.filter((item) => {
          const val = getNestedValue(item, field);
          if (seen.has(val)) return false;
          seen.add(val);
          return true;
        });
      }
      return [...new Set(arr)];
    }

    case "fuzzy": {
      const field = resolveDynamic(cm, logic.array_filter_field, context) as string | undefined;
      const query = String(resolveDynamic(cm, logic.array_filter_query, context) ?? "");
      const minScore = Number(resolveDynamic(cm, logic.array_filter_min_score, context) ?? 0.5);

      return arr.filter((item) => {
        const text = field ? getNestedValue(item, field) : item;
        return fuzzyScore(String(text ?? "").toLowerCase(), query.toLowerCase()) >= minScore;
      });
    }

    case "artifact_type": {
      const artifactType = resolveDynamic(cm, logic.array_filter_artifact_type, context) as string;
      return arr.filter((item) => {
        if (item !== null && typeof item === "object") {
          return (item as Record<string, unknown>).type === artifactType;
        }
        return false;
      });
    }

    case "match":
    default: {
      const field = resolveDynamic(cm, logic.array_filter_field, context) as string | undefined;
      const operator = resolveDynamic(cm, logic.array_filter_operator, context) as string ?? "==";
      const value = resolveDynamic(cm, logic.array_filter_value, context);

      return arr.filter((item) => {
        const itemVal = field ? getNestedValue(item, field) : item;
        return matchOperator(itemVal, operator, value);
      });
    }
  }
}

function executePluck(
  cm: ContextManager,
  arr: unknown[],
  logic: Record<string, unknown>,
  context: WorkflowContext,
): unknown[] {
  const field = resolveDynamic(cm, logic.array_pluck_field, context) as string;
  if (!field) return [];
  return arr.map((item) => getNestedValue(item, field));
}

function executeSort(
  cm: ContextManager,
  arr: unknown[],
  logic: Record<string, unknown>,
  context: WorkflowContext,
): unknown[] {
  const field = resolveDynamic(cm, logic.array_sort_field, context) as string | undefined;
  const direction = resolveDynamic(cm, logic.array_sort_direction, context) as string ?? "asc";
  const multiplier = direction === "desc" ? -1 : 1;

  const copy = [...arr];
  copy.sort((a, b) => {
    const aVal = field ? getNestedValue(a, field) : a;
    const bVal = field ? getNestedValue(b, field) : b;

    const aNum = Number(aVal);
    const bNum = Number(bVal);

    if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
      return (aNum - bNum) * multiplier;
    }

    return String(aVal ?? "").localeCompare(String(bVal ?? "")) * multiplier;
  });

  return copy;
}

function executeFlatten(
  arr: unknown[],
  logic: Record<string, unknown>,
): unknown[] {
  const depth = Number(logic.array_flatten_depth ?? 1);
  return arr.flat(depth);
}

function executeAdd(
  cm: ContextManager,
  arr: unknown[],
  logic: Record<string, unknown>,
  context: WorkflowContext,
): unknown[] {
  const item = resolveDynamic(cm, logic.array_add_item, context);
  const position = resolveDynamic(cm, logic.array_add_position, context) as string ?? "end";
  const copy = [...arr];

  if (position === "start") {
    copy.unshift(item);
  } else {
    copy.push(item);
  }

  return copy;
}

function executeDrop(
  cm: ContextManager,
  arr: unknown[],
  logic: Record<string, unknown>,
  context: WorkflowContext,
): unknown[] {
  const position = resolveDynamic(cm, logic.array_drop_position, context) as string ?? "end";
  const count = Number(resolveDynamic(cm, logic.array_drop_count, context) ?? 1);
  const copy = [...arr];

  if (position === "start") {
    return copy.slice(count);
  }
  return copy.slice(0, Math.max(0, copy.length - count));
}

function executeRemove(
  cm: ContextManager,
  arr: unknown[],
  logic: Record<string, unknown>,
  context: WorkflowContext,
): unknown[] {
  const field = resolveDynamic(cm, logic.array_remove_field, context) as string | undefined;
  const value = resolveDynamic(cm, logic.array_remove_value, context);

  return arr.filter((item) => {
    const itemVal = field ? getNestedValue(item, field) : item;
    return !looseEqual(itemVal, value);
  });
}

function executeMerge(
  cm: ContextManager,
  arr: unknown[],
  logic: Record<string, unknown>,
  context: WorkflowContext,
): unknown[] {
  const other = resolveDynamic(cm, logic.array_merge_source, context);
  if (!Array.isArray(other)) return arr;
  return [...arr, ...other];
}

function executeConvert(
  cm: ContextManager,
  arr: unknown[],
  logic: Record<string, unknown>,
  context: WorkflowContext,
): unknown {
  const format = resolveDynamic(cm, logic.array_convert_format, context) as string;
  const delimiter = String(resolveDynamic(cm, logic.array_convert_delimiter, context) ?? ",");
  const hasHeaders = resolveDynamic(cm, logic.array_convert_has_headers, context) !== false;

  if (format === "csv") {
    /* JSON array of objects → CSV string */
    if (arr.length === 0) return "";

    const firstRow = arr[0];
    if (firstRow === null || typeof firstRow !== "object" || Array.isArray(firstRow)) {
      /* Array of primitives → single column */
      return arr.map((item) => String(item ?? "")).join("\n");
    }

    const headers = Object.keys(firstRow as Record<string, unknown>);
    const lines: string[] = [];

    if (hasHeaders) {
      lines.push(headers.join(delimiter));
    }

    for (const row of arr) {
      const obj = row as Record<string, unknown>;
      lines.push(headers.map((h) => escapeCsvField(String(obj[h] ?? ""), delimiter)).join(delimiter));
    }

    return lines.join("\n");
  }

  if (format === "json") {
    /* CSV string → JSON array of objects */
    const csvInput = resolveDynamic(cm, logic.array_convert_input, context);
    if (typeof csvInput !== "string") return [];

    const lines = csvInput.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];

    if (hasHeaders) {
      const headers = parseCsvLine(lines[0], delimiter);
      return lines.slice(1).map((line) => {
        const values = parseCsvLine(line, delimiter);
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => {
          obj[h] = values[i] ?? "";
        });
        return obj;
      });
    }

    return lines.map((line) => parseCsvLine(line, delimiter));
  }

  return arr;
}

/* ── Helpers ──────────────────────────────────────────── */

function getNestedValue(obj: unknown, path: string): unknown {
  const segments = path.split(".");
  let current: unknown = obj;

  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function matchOperator(itemVal: unknown, operator: string, value: unknown): boolean {
  switch (operator) {
    case "==": return looseEqual(itemVal, value);
    case "!=": return !looseEqual(itemVal, value);
    case "<": return Number(itemVal) < Number(value);
    case "<=": return Number(itemVal) <= Number(value);
    case ">": return Number(itemVal) > Number(value);
    case ">=": return Number(itemVal) >= Number(value);
    case "contains":
      if (typeof itemVal === "string" && typeof value === "string") {
        return itemVal.includes(value);
      }
      if (Array.isArray(itemVal)) return itemVal.includes(value);
      return false;
    default:
      return looseEqual(itemVal, value);
  }
}

function looseEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || a === undefined) return b === null || b === undefined;
  return String(a) === String(b);
}

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

  // TODO: Fix fuzzy score returning 0 incorrectly when query partially matches.
  if (queryIdx < query.length) return 0;
  return matched / Math.max(text.length, query.length);
}

function escapeCsvField(field: string, delimiter: string): string {
  if (field.includes(delimiter) || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

// TODO: Fix multi-character delimiter handling — current implementation only checks delimiter[0].
function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter[0] && line.slice(i, i + delimiter.length) === delimiter) {
      result.push(current);
      current = "";
      i += delimiter.length - 1;
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

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
