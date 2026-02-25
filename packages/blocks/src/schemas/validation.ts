import type { BlockSchema } from "./types.js";

export const VALIDATION_SCHEMA: BlockSchema = {
  required: ["validation_rules"],
  optional: {
    validation_input: { default: null },
    validation_fail_fast: { default: false },
    validation_bind_value: { default: null },
  },
  commonMistakes: {
    rules: "validation_rules",
    input: "validation_input",
    data: "validation_input",
    fail_fast: "validation_fail_fast",
    bind_value: "validation_bind_value",
  },
} as const;
