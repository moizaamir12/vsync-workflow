import type { BlockSchema } from "./types.js";

export const NORMALIZE_SCHEMA: BlockSchema = {
  required: ["normalize_operation", "normalize_input"],
  optional: {
    normalize_bind_value_to: { default: null },
    normalize_target_unit: { default: null },
    normalize_category: {
      default: null,
      enum: ["weight", "length"],
    },
  },
  commonMistakes: {
    operation: "normalize_operation",
    input: "normalize_input",
    target_unit: "normalize_target_unit",
    unit: "normalize_target_unit",
    bind_value: "normalize_bind_value_to",
    category: "normalize_category",
  },
} as const;
