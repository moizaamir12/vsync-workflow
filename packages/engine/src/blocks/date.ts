import type { Block, WorkflowContext } from "@vsync/shared-types";
import type { BlockResult } from "../types.js";
import { ContextManager } from "../core/ContextManager.js";

/**
 * Date block executor.
 *
 * Chained via date_operations array. Each operation transforms the date.
 * Methods: adjust, boundary, set
 * Outputs: format, get, check
 * Binding: date_bind_to per operation in chain
 */
export async function dateExecutor(
  block: Block,
  context: WorkflowContext,
): Promise<BlockResult> {
  const cm = new ContextManager();
  const logic = block.logic;

  const rawInput = resolveDynamic(cm, logic.date_input, context);
  let current = parseDate(rawInput);

  const ops = resolveDynamic(cm, logic.date_operations, context);
  if (!Array.isArray(ops) || ops.length === 0) {
    return {};
  }

  const stateDelta: Record<string, unknown> = {};

  for (const rawOp of ops) {
    const op = rawOp as Record<string, unknown>;
    const method = resolveDynamic(cm, op.method, context) as string;

    const result = executeDateOp(cm, method, current, op, context);

    /* Transform ops return a new Date; output ops return a value */
    if (result.date) {
      current = result.date;
    }

    const bindTo = op.date_bind_to as string | undefined;
    if (bindTo && result.output !== undefined) {
      stateDelta[extractBindKey(bindTo)] = result.output;
    } else if (bindTo && result.date) {
      stateDelta[extractBindKey(bindTo)] = result.date.toISOString();
    }
  }

  return { stateDelta };
}

/* ── Operation dispatch ───────────────────────────────── */

interface DateOpResult {
  date?: Date;
  output?: unknown;
}

function executeDateOp(
  cm: ContextManager,
  method: string,
  date: Date,
  op: Record<string, unknown>,
  context: WorkflowContext,
): DateOpResult {
  switch (method) {
    case "adjust": return { date: executeAdjust(cm, date, op, context) };
    case "boundary": return { date: executeBoundary(cm, date, op, context) };
    case "set": return { date: executeSet(cm, date, op, context) };
    case "format": return { output: executeFormat(cm, date, op, context) };
    case "get": return { output: executeGet(cm, date, op, context) };
    case "check": return { output: executeCheck(cm, date, op, context) };
    default:
      throw new Error(`Unknown date method: "${method}"`);
  }
}

/* ── Transform methods ────────────────────────────────── */

function executeAdjust(
  cm: ContextManager,
  date: Date,
  op: Record<string, unknown>,
  context: WorkflowContext,
): Date {
  const unit = resolveDynamic(cm, op.date_unit, context) as string;
  const amount = Number(resolveDynamic(cm, op.date_amount, context) ?? 0);
  const d = new Date(date.getTime());

  switch (unit) {
    case "year": d.setUTCFullYear(d.getUTCFullYear() + amount); break;
    case "month": d.setUTCMonth(d.getUTCMonth() + amount); break;
    case "week": d.setUTCDate(d.getUTCDate() + amount * 7); break;
    case "day": d.setUTCDate(d.getUTCDate() + amount); break;
    case "hour": d.setUTCHours(d.getUTCHours() + amount); break;
    case "minute": d.setUTCMinutes(d.getUTCMinutes() + amount); break;
    case "second": d.setUTCSeconds(d.getUTCSeconds() + amount); break;
    case "ms": d.setUTCMilliseconds(d.getUTCMilliseconds() + amount); break;
    default: throw new Error(`Unknown date unit: "${unit}"`);
  }

  return d;
}

function executeBoundary(
  cm: ContextManager,
  date: Date,
  op: Record<string, unknown>,
  context: WorkflowContext,
): Date {
  const period = resolveDynamic(cm, op.date_period, context) as string;
  const edge = resolveDynamic(cm, op.date_edge, context) as string ?? "start";
  const d = new Date(date.getTime());

  if (edge === "start") {
    switch (period) {
      case "year": return new Date(Date.UTC(d.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
      case "month": return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
      case "week": {
        const day = d.getUTCDay();
        const diff = day === 0 ? 6 : day - 1; // Monday = start
        d.setUTCDate(d.getUTCDate() - diff);
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
      }
      case "day": return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
      case "hour": return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), 0, 0, 0));
      default: throw new Error(`Unknown boundary period: "${period}"`);
    }
  }

  /* end edge */
  switch (period) {
    case "year": return new Date(Date.UTC(d.getUTCFullYear(), 11, 31, 23, 59, 59, 999));
    case "month": return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    case "week": {
      const day = d.getUTCDay();
      const diff = day === 0 ? 0 : 7 - day; // Sunday = end
      d.setUTCDate(d.getUTCDate() + diff);
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
    }
    case "day": return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
    case "hour": return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), 59, 59, 999));
    default: throw new Error(`Unknown boundary period: "${period}"`);
  }
}

function executeSet(
  cm: ContextManager,
  date: Date,
  op: Record<string, unknown>,
  context: WorkflowContext,
): Date {
  const component = resolveDynamic(cm, op.date_component, context) as string;
  const value = Number(resolveDynamic(cm, op.date_value, context) ?? 0);
  const d = new Date(date.getTime());

  switch (component) {
    case "year": d.setUTCFullYear(value); break;
    case "month": d.setUTCMonth(value - 1); break; // 1-indexed input
    case "day": d.setUTCDate(value); break;
    case "hour": d.setUTCHours(value); break;
    case "minute": d.setUTCMinutes(value); break;
    case "second": d.setUTCSeconds(value); break;
    case "ms": d.setUTCMilliseconds(value); break;
    default: throw new Error(`Unknown date component: "${component}"`);
  }

  return d;
}

/* ── Output methods ───────────────────────────────────── */

function executeFormat(
  cm: ContextManager,
  date: Date,
  op: Record<string, unknown>,
  context: WorkflowContext,
): unknown {
  const format = resolveDynamic(cm, op.date_format, context) as string ?? "iso";

  switch (format) {
    case "iso": return date.toISOString();
    case "millis": return date.getTime();
    case "seconds": return Math.floor(date.getTime() / 1000);
    case "date": return date.toISOString().split("T")[0];
    case "time": return date.toISOString().split("T")[1].replace("Z", "");
    case "datetime": return date.toISOString().replace("T", " ").replace("Z", "");
    case "locale": return date.toLocaleString();
    case "relative": return formatRelative(date);
    case "object": return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      second: date.getUTCSeconds(),
      ms: date.getUTCMilliseconds(),
    };
    case "custom": {
      const pattern = String(resolveDynamic(cm, op.date_pattern, context) ?? "YYYY-MM-DD");
      return formatCustom(date, pattern);
    }
    default: return date.toISOString();
  }
}

function executeGet(
  cm: ContextManager,
  date: Date,
  op: Record<string, unknown>,
  context: WorkflowContext,
): number {
  const component = resolveDynamic(cm, op.date_component, context) as string;

  switch (component) {
    case "year": return date.getUTCFullYear();
    case "month": return date.getUTCMonth() + 1;
    case "day": return date.getUTCDate();
    case "weekday": return date.getUTCDay();
    case "hour": return date.getUTCHours();
    case "minute": return date.getUTCMinutes();
    case "second": return date.getUTCSeconds();
    case "weekNumber": return getWeekNumber(date);
    case "daysInMonth": return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    default: throw new Error(`Unknown date component: "${component}"`);
  }
}

function executeCheck(
  cm: ContextManager,
  date: Date,
  op: Record<string, unknown>,
  context: WorkflowContext,
): boolean {
  const check = resolveDynamic(cm, op.date_check, context) as string;

  switch (check) {
    case "valid": return !Number.isNaN(date.getTime());
    case "weekend": return date.getUTCDay() === 0 || date.getUTCDay() === 6;
    case "weekday": return date.getUTCDay() > 0 && date.getUTCDay() < 6;
    default: throw new Error(`Unknown date check: "${check}"`);
  }
}

/* ── Formatting helpers ───────────────────────────────── */

function formatRelative(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const absDiff = Math.abs(diff);
  const future = diff < 0;

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let label: string;
  if (seconds < 60) label = `${seconds} second${seconds !== 1 ? "s" : ""}`;
  else if (minutes < 60) label = `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  else if (hours < 24) label = `${hours} hour${hours !== 1 ? "s" : ""}`;
  else label = `${days} day${days !== 1 ? "s" : ""}`;

  return future ? `in ${label}` : `${label} ago`;
}

function formatCustom(date: Date, pattern: string): string {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const pad4 = (n: number) => String(n).padStart(4, "0");

  return pattern
    .replace("YYYY", pad4(date.getUTCFullYear()))
    .replace("MM", pad2(date.getUTCMonth() + 1))
    .replace("DD", pad2(date.getUTCDate()))
    .replace("HH", pad2(date.getUTCHours()))
    .replace("mm", pad2(date.getUTCMinutes()))
    .replace("ss", pad2(date.getUTCSeconds()));
}

// TODO: Fix UTC consistency — this function mixes getFullYear() (local) with UTC date operations.
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/* ── Helpers ──────────────────────────────────────────── */

function parseDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
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
