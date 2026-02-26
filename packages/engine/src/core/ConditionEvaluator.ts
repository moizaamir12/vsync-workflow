import type { Condition, WorkflowContext } from "@vsync/shared-types";
import type { ContextManager } from "./ContextManager.js";

/**
 * Evaluates block conditions using AND logic.
 *
 * All conditions on a block must pass for the block to execute.
 * Both left and right operands are resolved through ContextManager
 * so they can reference workflow state, cache, secrets, etc.
 *
 * Supports 14 operators matching the ConditionOperator type:
 * ==, !=, <, >, <=, >=, contains, startsWith, endsWith,
 * in, isEmpty, isFalsy, isNull, regex
 */
export class ConditionEvaluator {
  constructor(private readonly contextManager: ContextManager) {}

  /**
   * Evaluate all conditions on a block. Returns true if ALL pass (AND logic).
   * Returns true if the conditions array is empty or undefined.
   */
  evaluateAll(conditions: Condition[] | undefined, context: WorkflowContext): boolean {
    if (!conditions || conditions.length === 0) return true;
    return conditions.every((c) => this.evaluate(c, context));
  }

  /**
   * Evaluate a single condition by resolving both sides
   * and applying the operator.
   */
  evaluate(condition: Condition, context: WorkflowContext): boolean {
    const left = this.contextManager.resolveValue(condition.left, context);
    const right = this.contextManager.resolveValue(condition.right, context);

    return this.applyOperator(condition.operator, left, right);
  }

  /* ── Operator dispatch ──────────────────────────────── */

  private applyOperator(operator: string, left: unknown, right: unknown): boolean {
    switch (operator) {
      case "==":
        return this.looseEqual(left, right);

      case "!=":
        return !this.looseEqual(left, right);

      case "<":
        return this.compare(left, right) < 0;

      case ">":
        return this.compare(left, right) > 0;

      case "<=":
        return this.compare(left, right) <= 0;

      case ">=":
        return this.compare(left, right) >= 0;

      case "contains":
        return this.contains(left, right);

      case "startsWith":
        return typeof left === "string" && typeof right === "string"
          ? left.startsWith(right)
          : false;

      case "endsWith":
        return typeof left === "string" && typeof right === "string"
          ? left.endsWith(right)
          : false;

      case "in":
        return this.isIn(left, right);

      case "isEmpty":
        return this.isEmpty(left);

      case "isFalsy":
        return this.isFalsy(left);

      case "isNull":
        return left === null || left === undefined;

      case "regex":
        return this.matchesRegex(left, right);

      default:
        throw new Error(`Unknown condition operator: "${operator}"`);
    }
  }

  /* ── Operator implementations ───────────────────────── */

  /** Loose equality — coerces both sides to string for comparison */
  private looseEqual(left: unknown, right: unknown): boolean {
    if (left === right) return true;
    if (left === null || left === undefined) return right === null || right === undefined;
    return String(left) === String(right);
  }

  /** Numeric comparison — falls back to string comparison */
  private compare(left: unknown, right: unknown): number {
    const numLeft = Number(left);
    const numRight = Number(right);

    if (!Number.isNaN(numLeft) && !Number.isNaN(numRight)) {
      return numLeft - numRight;
    }

    return String(left).localeCompare(String(right));
  }

  /** Check if left contains right (string or array) */
  private contains(left: unknown, right: unknown): boolean {
    if (typeof left === "string" && typeof right === "string") {
      return left.includes(right);
    }
    if (Array.isArray(left)) {
      return left.includes(right);
    }
    // TODO: Implement "contains" check for objects — currently always returns false for non-string/array values.
    return false;
  }

  /** Check if left is in the right-hand collection (array or comma-separated string) */
  private isIn(left: unknown, right: unknown): boolean {
    if (Array.isArray(right)) {
      return right.some((item) => this.looseEqual(item, left));
    }
    if (typeof right === "string") {
      /* Support comma-separated string: "a,b,c" */
      const items = right.split(",").map((s) => s.trim());
      return items.some((item) => this.looseEqual(item, left));
    }
    return false;
  }

  /** Check if a value is empty (null, undefined, empty string, empty array, empty object) */
  private isEmpty(value: unknown): boolean {
    if (value === null || value === undefined || value === "") return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === "object") return Object.keys(value).length === 0;
    return false;
  }

  /** Check if a value is falsy */
  private isFalsy(value: unknown): boolean {
    return !value;
  }

  /** Test left against a regex pattern from right */
  private matchesRegex(left: unknown, right: unknown): boolean {
    if (typeof right !== "string") return false;
    try {
      const regex = new RegExp(right);
      return regex.test(String(left));
    } catch {
      return false;
    }
  }
}
