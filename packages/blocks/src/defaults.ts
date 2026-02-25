import type { BlockType } from "@vsync/shared-types";
import { SCHEMA_MAP } from "./schemas/index.js";

/**
 * Return the fully-populated default logic for a given block type.
 *
 * Every required field is set to `""` (empty placeholder) and every
 * optional field is set to its declared default value. This is used
 * by the workflow builder when a user adds a new block to a canvas.
 */
export function getBlockDefaults(
  blockType: BlockType,
): Record<string, unknown> {
  const schema = SCHEMA_MAP[blockType];
  if (!schema) {
    throw new Error(`No schema found for block type: "${blockType}"`);
  }

  const defaults: Record<string, unknown> = {};

  /* Required fields → empty placeholder */
  for (const field of schema.required) {
    defaults[field] = "";
  }

  /* Optional fields → declared default */
  for (const [field, def] of Object.entries(schema.optional)) {
    defaults[field] = structuredCloneValue(def.default);
  }

  return defaults;
}

/**
 * Return all known block types that have schemas.
 * Useful for iterating over every type in the registry.
 */
export function getSchemaBlockTypes(): string[] {
  return Object.keys(SCHEMA_MAP);
}

/* ── Helpers ──────────────────────────────────────────── */

/**
 * Safe deep clone for default values.
 * structuredClone handles most values; primitives and null
 * pass through without copying.
 */
function structuredCloneValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  return structuredClone(value);
}
