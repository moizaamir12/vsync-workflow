import type { BlockSchema } from "./types.js";

export const OBJECT_SCHEMA: BlockSchema = {
  required: ["object_operation"],
  optional: {
    object_value: { default: null },
    object_target: { default: null },
    object_sources: { default: null },
    object_keys: { default: null },
    object_delete_path: { default: null },
    object_bind_value: { default: null },
  },
  commonMistakes: {
    operation: "object_operation",
    value: "object_value",
    target: "object_target",
    keys: "object_keys",
    sources: "object_sources",
    bind_value: "object_bind_value",
  },
} as const;
