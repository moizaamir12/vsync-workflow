import type { BlockSchema } from "./types.js";

export const UI_DETAILS_SCHEMA: BlockSchema = {
  required: ["ui_details_data"],
  optional: {
    ui_details_title: { default: "" },
    ui_details_layout: {
      default: "list",
      enum: ["list", "grid", "card"],
    },
    ui_details_fields: { default: null },
  },
  commonMistakes: {
    data: "ui_details_data",
    title: "ui_details_title",
    details_data: "ui_details_data",
    layout: "ui_details_layout",
    fields: "ui_details_fields",
  },
} as const;
