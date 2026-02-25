import type { Block, WorkflowContext } from "@vsync/shared-types";
import type { BlockResult } from "../types.js";
import { ContextManager } from "../core/ContextManager.js";

/**
 * Math block executor.
 *
 * Supports single operation or chained operations via math_operations array.
 * Chained: each op receives the output of the previous as its implicit input.
 * Includes a SAFE recursive descent parser for arbitrary math expressions.
 */
export async function mathExecutor(
  block: Block,
  context: WorkflowContext,
): Promise<BlockResult> {
  const cm = new ContextManager();
  const logic = block.logic;

  /* Check for chained operations */
  const chainedOps = resolveDynamic(cm, logic.math_operations, context);
  if (Array.isArray(chainedOps) && chainedOps.length > 0) {
    return executeChained(cm, logic, chainedOps, context);
  }

  /* Single operation */
  const operation = resolveDynamic(cm, logic.math_operation, context) as string;
  const input = toNumber(resolveDynamic(cm, logic.math_input, context));
  const result = executeOperation(cm, operation, input, logic, context);

  const bindTo = logic.math_bind_value as string | undefined;
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
  let current = toNumber(resolveDynamic(cm, topLogic.math_input, context));
  const stateDelta: Record<string, unknown> = {};

  for (const rawOp of ops) {
    const op = rawOp as Record<string, unknown>;
    const operation = resolveDynamic(cm, op.operation, context) as string;

    current = executeOperation(cm, operation, current, op, context);

    /* Per-operation binding */
    const bindTo = op.bind_to as string | undefined;
    if (bindTo) {
      stateDelta[extractBindKey(bindTo)] = current;
    }
  }

  /* Top-level binding gets final result */
  const topBind = topLogic.math_bind_value as string | undefined;
  if (topBind) {
    stateDelta[extractBindKey(topBind)] = current;
  }

  return { stateDelta };
}

/* ── Operation dispatch ───────────────────────────────── */

function executeOperation(
  cm: ContextManager,
  operation: string,
  input: number,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): number {
  const operand = () => toNumber(resolveDynamic(cm, logic.math_operand, context));

  switch (operation) {
    case "add": return input + operand();
    case "subtract": return input - operand();
    case "multiply": return input * operand();
    case "divide": {
      const d = operand();
      if (d === 0) throw new Error("Division by zero");
      return input / d;
    }
    case "modulo": {
      const d = operand();
      if (d === 0) throw new Error("Modulo by zero");
      return input % d;
    }
    case "power": return Math.pow(input, operand());
    case "round": {
      const decimals = toNumber(resolveDynamic(cm, logic.math_decimals, context) ?? 0);
      const factor = Math.pow(10, decimals);
      return Math.round(input * factor) / factor;
    }
    case "square_root": {
      if (input < 0) throw new Error("Cannot take square root of negative number");
      return Math.sqrt(input);
    }
    case "absolute": return Math.abs(input);
    case "min": {
      const values = resolveValues(cm, logic, context);
      return Math.min(input, ...values);
    }
    case "max": {
      const values = resolveValues(cm, logic, context);
      return Math.max(input, ...values);
    }
    case "clamp": {
      const min = toNumber(resolveDynamic(cm, logic.math_clamp_min, context));
      const max = toNumber(resolveDynamic(cm, logic.math_clamp_max, context));
      return Math.min(Math.max(input, min), max);
    }
    case "average": {
      const values = resolveValues(cm, logic, context);
      const all = [input, ...values];
      return all.reduce((a, b) => a + b, 0) / all.length;
    }
    case "sum": {
      const values = resolveValues(cm, logic, context);
      return [input, ...values].reduce((a, b) => a + b, 0);
    }
    case "random": {
      const min = toNumber(resolveDynamic(cm, logic.math_random_min, context) ?? 0);
      const max = toNumber(resolveDynamic(cm, logic.math_random_max, context) ?? 1);
      return min + Math.random() * (max - min);
    }
    case "expression": {
      const expr = String(resolveDynamic(cm, logic.math_expression, context) ?? "");
      return evaluateExpression(expr);
    }
    default:
      throw new Error(`Unknown math operation: "${operation}"`);
  }
}

/* ── Safe expression parser (recursive descent) ───────── */

/**
 * Parse and evaluate a math expression safely without eval().
 *
 * Supports: +, -, *, /, %, parentheses
 * Functions: Math.floor, Math.ceil, Math.round, Math.abs, Math.sqrt, Math.pow
 * Constants: PI, E
 */
function evaluateExpression(expr: string): number {
  const tokens = tokenize(expr);
  const parser = new ExpressionParser(tokens);
  const result = parser.parseExpression();
  parser.expectEnd();
  return result;
}

type Token =
  | { type: "number"; value: number }
  | { type: "op"; value: string }
  | { type: "paren"; value: "(" | ")" }
  | { type: "func"; value: string }
  | { type: "const"; value: string }
  | { type: "comma" };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = expr.replace(/\s+/g, "");

  while (i < s.length) {
    /* Numbers (including decimals) */
    if (s[i] >= "0" && s[i] <= "9" || (s[i] === "." && i + 1 < s.length && s[i + 1] >= "0" && s[i + 1] <= "9")) {
      let num = "";
      while (i < s.length && ((s[i] >= "0" && s[i] <= "9") || s[i] === ".")) {
        num += s[i];
        i++;
      }
      tokens.push({ type: "number", value: Number(num) });
      continue;
    }

    /* Operators */
    if ("+-*/%".includes(s[i])) {
      tokens.push({ type: "op", value: s[i] });
      i++;
      continue;
    }

    /* Parentheses */
    if (s[i] === "(" || s[i] === ")") {
      tokens.push({ type: "paren", value: s[i] as "(" | ")" });
      i++;
      continue;
    }

    /* Comma */
    if (s[i] === ",") {
      tokens.push({ type: "comma" });
      i++;
      continue;
    }

    /* Math functions and constants */
    if (s.slice(i, i + 10) === "Math.floor") { tokens.push({ type: "func", value: "floor" }); i += 10; continue; }
    if (s.slice(i, i + 9) === "Math.ceil") { tokens.push({ type: "func", value: "ceil" }); i += 9; continue; }
    if (s.slice(i, i + 10) === "Math.round") { tokens.push({ type: "func", value: "round" }); i += 10; continue; }
    if (s.slice(i, i + 8) === "Math.abs") { tokens.push({ type: "func", value: "abs" }); i += 8; continue; }
    if (s.slice(i, i + 9) === "Math.sqrt") { tokens.push({ type: "func", value: "sqrt" }); i += 9; continue; }
    if (s.slice(i, i + 8) === "Math.pow") { tokens.push({ type: "func", value: "pow" }); i += 8; continue; }

    /* Constants */
    if (s.slice(i, i + 2) === "PI") { tokens.push({ type: "const", value: "PI" }); i += 2; continue; }
    if (s[i] === "E" && (i + 1 >= s.length || !isAlpha(s[i + 1]))) { tokens.push({ type: "const", value: "E" }); i += 1; continue; }

    throw new Error(`Unexpected character in expression: '${s[i]}' at position ${i}`);
  }

  return tokens;
}

function isAlpha(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z");
}

class ExpressionParser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  parseExpression(): number {
    return this.parseAddSub();
  }

  expectEnd(): void {
    if (this.pos < this.tokens.length) {
      throw new Error(`Unexpected token at end of expression`);
    }
  }

  private parseAddSub(): number {
    let left = this.parseMulDivMod();

    while (this.pos < this.tokens.length) {
      const token = this.tokens[this.pos];
      if (token.type === "op" && (token.value === "+" || token.value === "-")) {
        this.pos++;
        const right = this.parseMulDivMod();
        left = token.value === "+" ? left + right : left - right;
      } else {
        break;
      }
    }

    return left;
  }

  private parseMulDivMod(): number {
    let left = this.parseUnary();

    while (this.pos < this.tokens.length) {
      const token = this.tokens[this.pos];
      if (token.type === "op" && (token.value === "*" || token.value === "/" || token.value === "%")) {
        this.pos++;
        const right = this.parseUnary();
        if (token.value === "*") left = left * right;
        else if (token.value === "/") {
          if (right === 0) throw new Error("Division by zero in expression");
          left = left / right;
        } else {
          if (right === 0) throw new Error("Modulo by zero in expression");
          left = left % right;
        }
      } else {
        break;
      }
    }

    return left;
  }

  private parseUnary(): number {
    if (this.pos < this.tokens.length) {
      const token = this.tokens[this.pos];
      if (token.type === "op" && token.value === "-") {
        this.pos++;
        return -this.parsePrimary();
      }
      if (token.type === "op" && token.value === "+") {
        this.pos++;
        return this.parsePrimary();
      }
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    if (this.pos >= this.tokens.length) {
      throw new Error("Unexpected end of expression");
    }

    const token = this.tokens[this.pos];

    /* Number literal */
    if (token.type === "number") {
      this.pos++;
      return token.value;
    }

    /* Constants */
    if (token.type === "const") {
      this.pos++;
      if (token.value === "PI") return Math.PI;
      if (token.value === "E") return Math.E;
      throw new Error(`Unknown constant: ${token.value}`);
    }

    /* Function call */
    if (token.type === "func") {
      this.pos++;
      this.expect("paren", "(");
      const args = this.parseArgs();
      this.expect("paren", ")");
      return this.applyFunction(token.value, args);
    }

    /* Parenthesized expression */
    if (token.type === "paren" && token.value === "(") {
      this.pos++;
      const value = this.parseExpression();
      this.expect("paren", ")");
      return value;
    }

    throw new Error(`Unexpected token: ${JSON.stringify(token)}`);
  }

  private parseArgs(): number[] {
    const args: number[] = [];
    if (this.pos < this.tokens.length && !(this.tokens[this.pos].type === "paren" && (this.tokens[this.pos] as { value: string }).value === ")")) {
      args.push(this.parseExpression());
      while (this.pos < this.tokens.length && this.tokens[this.pos].type === "comma") {
        this.pos++;
        args.push(this.parseExpression());
      }
    }
    return args;
  }

  private expect(type: string, value: string): void {
    if (this.pos >= this.tokens.length) {
      throw new Error(`Expected ${value} but reached end of expression`);
    }
    const token = this.tokens[this.pos];
    if (token.type !== type || (token as { value: unknown }).value !== value) {
      throw new Error(`Expected ${value} but got ${JSON.stringify(token)}`);
    }
    this.pos++;
  }

  private applyFunction(name: string, args: number[]): number {
    switch (name) {
      case "floor": return Math.floor(args[0]);
      case "ceil": return Math.ceil(args[0]);
      case "round": return Math.round(args[0]);
      case "abs": return Math.abs(args[0]);
      case "sqrt": {
        if (args[0] < 0) throw new Error("Cannot take sqrt of negative number");
        return Math.sqrt(args[0]);
      }
      case "pow": return Math.pow(args[0], args[1] ?? 1);
      default:
        throw new Error(`Unknown function: ${name}`);
    }
  }
}

/* ── Helpers ──────────────────────────────────────────── */

function resolveValues(
  cm: ContextManager,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): number[] {
  const raw = resolveDynamic(cm, logic.math_values, context);
  if (Array.isArray(raw)) return raw.map(toNumber);
  return [];
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
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
