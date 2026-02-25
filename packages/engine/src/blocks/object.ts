import type { Block, WorkflowContext } from "@vsync/shared-types";
import type { BlockResult } from "../types.js";
import { ContextManager } from "../core/ContextManager.js";

/**
 * Object block executor.
 *
 * Operations: set, merge, keys, values, pick, omit, delete
 * Binding: object_bind_value → $state.key
 */
export async function objectExecutor(
  block: Block,
  context: WorkflowContext,
): Promise<BlockResult> {
  const cm = new ContextManager();
  const logic = block.logic;
  const operation = resolveDynamic(cm, logic.object_operation, context) as string;
  const bindTo = logic.object_bind_value as string | undefined;

  let result: unknown;

  switch (operation) {
    case "set":
      result = executeSet(cm, logic, context);
      break;
    case "merge":
      result = executeMerge(cm, logic, context);
      break;
    case "keys":
      result = executeKeys(cm, logic, context);
      break;
    case "values":
      result = executeValues(cm, logic, context);
      break;
    case "pick":
      result = executePick(cm, logic, context);
      break;
    case "omit":
      result = executeOmit(cm, logic, context);
      break;
    case "delete":
      result = executeDelete(cm, logic, context);
      break;
    default:
      throw new Error(`Unknown object operation: "${operation}"`);
  }

  if (bindTo) {
    const key = extractBindKey(bindTo);
    return { stateDelta: { [key]: result } };
  }

  return {};
}

/* ── Operations ───────────────────────────────────────── */

function executeSet(
  cm: ContextManager,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): unknown {
  const rawValue = resolveDynamic(cm, logic.object_value, context);

  /* If value is a string, try to parse as JSON first */
  if (typeof rawValue === "string") {
    try {
      const parsed = JSON.parse(rawValue);
      return resolveDeep(cm, parsed, context);
    } catch {
      /* Not JSON — resolve as template string */
      return rawValue;
    }
  }

  /* If value is an object/array, resolve templates inside */
  if (rawValue !== null && typeof rawValue === "object") {
    return resolveDeep(cm, rawValue, context);
  }

  return rawValue;
}

function executeMerge(
  cm: ContextManager,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): Record<string, unknown> {
  const sources = resolveDynamic(cm, logic.object_sources, context);
  if (!Array.isArray(sources)) {
    throw new Error("object_sources must be an array of objects");
  }

  const result: Record<string, unknown> = {};
  for (const source of sources) {
    const resolved = resolveDynamic(cm, source, context);
    if (resolved !== null && typeof resolved === "object" && !Array.isArray(resolved)) {
      Object.assign(result, resolved);
    }
  }
  return result;
}

function executeKeys(
  cm: ContextManager,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): string[] {
  const target = resolveTarget(cm, logic, context);
  if (target === null || typeof target !== "object" || Array.isArray(target)) {
    return [];
  }
  return Object.keys(target);
}

function executeValues(
  cm: ContextManager,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): unknown[] {
  const target = resolveTarget(cm, logic, context);
  if (target === null || typeof target !== "object" || Array.isArray(target)) {
    return [];
  }
  return Object.values(target);
}

function executePick(
  cm: ContextManager,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): Record<string, unknown> {
  const target = resolveTarget(cm, logic, context);
  if (target === null || typeof target !== "object" || Array.isArray(target)) {
    return {};
  }

  const pickKeys = resolveDynamic(cm, logic.object_keys, context);
  if (!Array.isArray(pickKeys)) return {};

  const result: Record<string, unknown> = {};
  const obj = target as Record<string, unknown>;
  for (const key of pickKeys) {
    const k = String(key);
    if (k in obj) {
      result[k] = obj[k];
    }
  }
  return result;
}

function executeOmit(
  cm: ContextManager,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): Record<string, unknown> {
  const target = resolveTarget(cm, logic, context);
  if (target === null || typeof target !== "object" || Array.isArray(target)) {
    return {};
  }

  const omitKeys = resolveDynamic(cm, logic.object_keys, context);
  const omitSet = new Set(
    Array.isArray(omitKeys) ? omitKeys.map(String) : [],
  );

  const result: Record<string, unknown> = {};
  const obj = target as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (!omitSet.has(key)) {
      result[key] = obj[key];
    }
  }
  return result;
}

function executeDelete(
  cm: ContextManager,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): Record<string, unknown> {
  const target = resolveTarget(cm, logic, context);
  if (target === null || typeof target !== "object" || Array.isArray(target)) {
    return {};
  }

  const deletePath = resolveDynamic(cm, logic.object_delete_path, context) as string;
  if (!deletePath) return { ...(target as Record<string, unknown>) };

  const clone = structuredCloneObj(target as Record<string, unknown>);
  const segments = deletePath.split(".");
  let current: Record<string, unknown> = clone;

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (current[seg] === null || typeof current[seg] !== "object") {
      return clone;
    }
    current = current[seg] as Record<string, unknown>;
  }

  delete current[segments[segments.length - 1]];
  return clone;
}

/* ── Helpers ──────────────────────────────────────────── */

function resolveDynamic(
  cm: ContextManager,
  value: unknown,
  context: WorkflowContext,
): unknown {
  return cm.resolveValue(value, context);
}

function resolveTarget(
  cm: ContextManager,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): unknown {
  return resolveDynamic(cm, logic.object_target, context);
}

/** Recursively resolve template expressions inside objects/arrays */
function resolveDeep(
  cm: ContextManager,
  value: unknown,
  context: WorkflowContext,
): unknown {
  if (typeof value === "string") {
    return cm.resolveValue(value, context);
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveDeep(cm, item, context));
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = resolveDeep(cm, val, context);
    }
    return result;
  }
  return value;
}

function extractBindKey(bindTo: string): string {
  if (bindTo.startsWith("$state.")) return bindTo.slice(7);
  return bindTo;
}

function structuredCloneObj(obj: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(obj)) as Record<string, unknown>;
}
