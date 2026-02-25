import type { BlockSchema } from "./types.js";

export const CODE_SCHEMA: BlockSchema = {
  required: ["code_source"],
  optional: {
    code_language: {
      default: "javascript",
      enum: ["javascript", "typescript"],
    },
    code_timeout_ms: { default: 10000 },
    code_bind_value: { default: null },
  },
  commonMistakes: {
    source: "code_source",
    script: "code_source",
    code: "code_source",
    language: "code_language",
    timeout: "code_timeout_ms",
    bind_value: "code_bind_value",
  },
} as const;
