import type { BlockSchema } from "./types.js";

export const ARRAY_SCHEMA: BlockSchema = {
  required: ["array_operation", "array_input"],
  optional: {
    array_bind_value: { default: null },
    /* slice */
    array_slice_start: { default: 0 },
    array_slice_end: { default: null },
    /* find */
    array_find_mode: { default: "match", enum: ["match", "index", "fuzzy"] },
    array_find_index: { default: 0 },
    array_find_field: { default: null },
    array_find_operator: { default: "==" },
    array_find_value: { default: null },
    array_find_query: { default: "" },
    array_find_min_score: { default: 0.5 },
    /* filter */
    array_filter_mode: {
      default: "match",
      enum: ["match", "truthy", "unique", "fuzzy", "artifact_type"],
    },
    array_filter_field: { default: null },
    array_filter_operator: { default: "==" },
    array_filter_value: { default: null },
    array_filter_query: { default: "" },
    array_filter_min_score: { default: 0.5 },
    array_filter_artifact_type: { default: null },
    /* pluck */
    array_pluck_field: { default: null },
    /* sort */
    array_sort_field: { default: null },
    array_sort_direction: { default: "asc", enum: ["asc", "desc"] },
    /* flatten */
    array_flatten_depth: { default: 1 },
    /* add */
    array_add_item: { default: null },
    array_add_position: { default: "end", enum: ["start", "end"] },
    /* drop */
    array_drop_position: { default: "end", enum: ["start", "end"] },
    array_drop_count: { default: 1 },
    /* remove */
    array_remove_field: { default: null },
    array_remove_value: { default: null },
    /* merge */
    array_merge_source: { default: null },
    /* convert */
    array_convert_format: { default: "csv", enum: ["csv", "json"] },
    array_convert_delimiter: { default: "," },
    array_convert_has_headers: { default: true },
    array_convert_input: { default: null },
  },
  commonMistakes: {
    input: "array_input",
    operation: "array_operation",
    items: "array_input",
    list: "array_input",
    bind_value: "array_bind_value",
    field: "array_pluck_field",
    sort: "array_sort_field",
  },
} as const;
