import type { BlockSchema } from "./types.js";

export const UI_FORM_SCHEMA: BlockSchema = {
  required: ["ui_form_fields"],
  optional: {
    ui_form_title: { default: "" },
    ui_form_submit_label: { default: "Submit" },
    ui_form_bind_value: { default: null },
  },
  commonMistakes: {
    fields: "ui_form_fields",
    title: "ui_form_title",
    form_fields: "ui_form_fields",
    submit_label: "ui_form_submit_label",
    bind_value: "ui_form_bind_value",
  },
} as const;
