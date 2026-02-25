import type { BlockSchema } from "./types.js";

export const SLEEP_SCHEMA: BlockSchema = {
  required: ["sleep_duration_ms"],
  optional: {},
  commonMistakes: {
    duration: "sleep_duration_ms",
    delay: "sleep_duration_ms",
    timeout: "sleep_duration_ms",
    ms: "sleep_duration_ms",
    wait: "sleep_duration_ms",
  },
} as const;
