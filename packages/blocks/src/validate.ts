import type { Block, ConditionOperator } from "@vsync/shared-types";
import type { BlockSchema } from "./schemas/types.js";
import { SCHEMA_MAP } from "./schemas/index.js";

/* ── Result shape ──────────────────────────────────────── */

export interface ValidationResult {
  /** Hard failures — the block will not execute correctly */
  errors: string[];
  /** Potential issues — the block may not behave as intended */
  warnings: string[];
  /** Helpful hints (e.g. typo corrections from commonMistakes) */
  suggestions: string[];
}

/* ── Valid condition operators (from shared-types) ──────── */

const VALID_OPERATORS: ReadonlySet<string> = new Set<ConditionOperator>([
  "==", "!=", "<", ">", "<=", ">=",
  "contains", "startsWith", "endsWith",
  "in", "isEmpty", "isFalsy", "isNull", "regex",
]);

/* ── Public API ────────────────────────────────────────── */

/**
 * Validate a block's configuration against its schema.
 *
 * Checks:
 *  1. Block type has a known schema
 *  2. Required fields are present and non-empty
 *  3. Enum fields contain valid values
 *  4. Common typos are flagged as suggestions
 *  5. Unknown fields trigger warnings
 *  6. Conditions syntax is validated
 */
export function validateBlock(block: Block): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  /* 1 — Schema lookup */
  const schema = SCHEMA_MAP[block.type];
  if (!schema) {
    errors.push(`Unknown block type: "${block.type}"`);
    return { errors, warnings, suggestions };
  }

  const logic = block.logic ?? {};

  /* 2 — Required fields */
  checkRequired(schema, logic, errors);

  /* 3 — Enum validation */
  checkEnums(schema, logic, errors);

  /* 4 — Common mistakes → suggestions */
  checkMistakes(schema, logic, suggestions);

  /* 5 — Unknown fields → warnings */
  checkUnknown(schema, logic, block.type, warnings);

  /* 6 — Conditions syntax */
  if (block.conditions) {
    checkConditions(block.conditions, errors);
  }

  return { errors, warnings, suggestions };
}

/* ── Internal checkers ─────────────────────────────────── */

function checkRequired(
  schema: BlockSchema,
  logic: Record<string, unknown>,
  errors: string[],
): void {
  for (const field of schema.required) {
    const value = logic[field];
    if (value === undefined || value === null || value === "") {
      errors.push(`Missing required field: "${field}"`);
    }
  }
}

function checkEnums(
  schema: BlockSchema,
  logic: Record<string, unknown>,
  errors: string[],
): void {
  for (const [field, def] of Object.entries(schema.optional)) {
    if (!def.enum) continue;

    const value = logic[field];
    /* Only validate if the field is actually provided */
    if (value === undefined || value === null) continue;

    const strValue = String(value);
    if (!def.enum.includes(strValue)) {
      errors.push(
        `Invalid value "${strValue}" for field "${field}". ` +
        `Allowed: ${def.enum.join(", ")}`,
      );
    }
  }
}

function checkMistakes(
  schema: BlockSchema,
  logic: Record<string, unknown>,
  suggestions: string[],
): void {
  for (const [wrong, correct] of Object.entries(schema.commonMistakes)) {
    if (wrong in logic && !(correct in logic)) {
      suggestions.push(
        `Did you mean "${correct}" instead of "${wrong}"?`,
      );
    }
  }
}

function checkUnknown(
  schema: BlockSchema,
  logic: Record<string, unknown>,
  blockType: string,
  warnings: string[],
): void {
  /* Build set of all known fields */
  const knownFields = new Set<string>([
    ...schema.required,
    ...Object.keys(schema.optional),
  ]);

  /* Also allow commonMistakes keys (they are flagged as suggestions, not warnings) */
  const mistakeKeys = new Set(Object.keys(schema.commonMistakes));

  for (const field of Object.keys(logic)) {
    if (knownFields.has(field)) continue;
    if (mistakeKeys.has(field)) continue;

    warnings.push(
      `Unknown field "${field}" on ${blockType} block`,
    );
  }
}

function checkConditions(
  conditions: { left: string; operator: string; right: string }[],
  errors: string[],
): void {
  for (let i = 0; i < conditions.length; i++) {
    const cond = conditions[i];

    if (!cond.left && cond.left !== "") {
      errors.push(`Condition[${i}]: missing "left" operand`);
    }

    if (!VALID_OPERATORS.has(cond.operator)) {
      errors.push(
        `Condition[${i}]: invalid operator "${cond.operator}". ` +
        `Valid: ${[...VALID_OPERATORS].join(", ")}`,
      );
    }

    /* Unary operators don't require a right operand */
    const unary = new Set(["isEmpty", "isFalsy", "isNull"]);
    if (!unary.has(cond.operator) && cond.right === undefined) {
      errors.push(`Condition[${i}]: missing "right" operand for operator "${cond.operator}"`);
    }
  }
}
