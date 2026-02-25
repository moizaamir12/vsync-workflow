import type { BlockSchema } from "./types.js";

export const GOTO_SCHEMA: BlockSchema = {
  required: ["goto_target_block_id"],
  optional: {
    goto_defer: { default: false },
    goto_max_concurrent: { default: 10 },
    goto_loop_name: { default: null },
  },
  commonMistakes: {
    target: "goto_target_block_id",
    target_block: "goto_target_block_id",
    block_id: "goto_target_block_id",
    defer: "goto_defer",
    max_concurrent: "goto_max_concurrent",
    loop_name: "goto_loop_name",
  },
} as const;
