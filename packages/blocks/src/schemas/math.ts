import type { BlockSchema } from "./types.js";

export const MATH_SCHEMA: BlockSchema = {
  required: ["math_input"],
  optional: {
    math_operation: {
      default: null,
      enum: [
        "add", "subtract", "multiply", "divide", "modulo",
        "power", "round", "square_root", "absolute",
        "min", "max", "clamp", "average", "sum",
        "random", "expression",
      ],
    },
    math_operations: { default: null },
    math_bind_value: { default: null },
    math_operand: { default: null },
    math_decimals: { default: 0 },
    math_values: { default: null },
    math_clamp_min: { default: null },
    math_clamp_max: { default: null },
    math_random_min: { default: 0 },
    math_random_max: { default: 1 },
    math_expression: { default: null },
  },
  commonMistakes: {
    input: "math_input",
    operation: "math_operation",
    value: "math_input",
    number: "math_input",
    operand: "math_operand",
    bind_value: "math_bind_value",
    expression: "math_expression",
  },
} as const;
