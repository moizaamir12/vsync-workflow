import type { BlockSchema } from "./types.js";

export const UI_TABLE_SCHEMA: BlockSchema = {
  required: ["ui_table_data"],
  optional: {
    ui_table_columns: { default: null },
    ui_table_title: { default: "" },
    ui_table_searchable: { default: false },
    ui_table_selectable: { default: false },
    ui_table_bind_value: { default: null },
    ui_table_row_actions: { default: null },
  },
  commonMistakes: {
    data: "ui_table_data",
    columns: "ui_table_columns",
    rows: "ui_table_data",
    title: "ui_table_title",
    searchable: "ui_table_searchable",
    selectable: "ui_table_selectable",
    bind_value: "ui_table_bind_value",
  },
} as const;
