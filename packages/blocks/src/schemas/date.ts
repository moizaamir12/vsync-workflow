import type { BlockSchema } from "./types.js";

export const DATE_SCHEMA: BlockSchema = {
  required: ["date_input", "date_operations"],
  optional: {
    /* Per-operation fields (used inside date_operations array entries) */
    date_unit: {
      default: "day",
      enum: ["year", "month", "week", "day", "hour", "minute", "second", "ms"],
    },
    date_amount: { default: 0 },
    date_period: {
      default: "day",
      enum: ["year", "month", "week", "day", "hour"],
    },
    date_edge: { default: "start", enum: ["start", "end"] },
    date_component: {
      default: "year",
      enum: [
        "year", "month", "day", "weekday", "hour",
        "minute", "second", "ms", "weekNumber", "daysInMonth",
      ],
    },
    date_value: { default: 0 },
    date_format: {
      default: "iso",
      enum: [
        "iso", "millis", "seconds", "date", "time",
        "datetime", "locale", "relative", "object", "custom",
      ],
    },
    date_pattern: { default: "YYYY-MM-DD" },
    date_check: { default: "valid", enum: ["valid", "weekend", "weekday"] },
    date_bind_to: { default: null },
  },
  commonMistakes: {
    input: "date_input",
    operations: "date_operations",
    date: "date_input",
    format: "date_format",
    unit: "date_unit",
    bind_to: "date_bind_to",
  },
} as const;
