import type { BlockSchema } from "./types.js";

export const STRING_SCHEMA: BlockSchema = {
  required: ["string_input"],
  optional: {
    string_operation: {
      default: null,
      enum: [
        "slice", "extract", "format", "trim", "pad",
        "replace", "match", "length", "split", "path",
        "generate", "checksum",
      ],
    },
    string_operations: { default: null },
    string_bind_value: { default: null },
    /* slice */
    string_slice_from: { default: null },
    string_slice_count: { default: null },
    string_slice_start: { default: null },
    string_slice_end: { default: null },
    /* extract */
    string_extract_mode: {
      default: "before",
      enum: ["before", "after", "between", "number", "regex"],
    },
    string_extract_delimiter: { default: null },
    string_extract_start_delimiter: { default: null },
    string_extract_end_delimiter: { default: null },
    string_extract_regex: { default: null },
    /* format */
    string_format_type: {
      default: "upper",
      enum: ["upper", "lower", "title", "sentence", "number"],
    },
    string_format_decimals: { default: 2 },
    /* pad */
    string_pad_side: { default: "left", enum: ["left", "right"] },
    string_pad_length: { default: 0 },
    string_pad_char: { default: " " },
    /* replace */
    string_replace_find: { default: "" },
    string_replace_with: { default: "" },
    string_replace_all: { default: false },
    /* match */
    string_match_mode: { default: "regex", enum: ["regex", "fuzzy"] },
    string_match_pattern: { default: "" },
    string_match_query: { default: "" },
    /* split */
    string_split_separator: { default: "," },
    /* path */
    string_path_component: { default: "filename", enum: ["filename", "extension"] },
    /* generate */
    string_generate_type: {
      default: "short_id",
      enum: ["short_id", "uuid", "ocr_confusables"],
    },
    string_generate_input: { default: "" },
    /* checksum */
    string_checksum_algorithm: {
      default: "luhn",
      enum: ["luhn", "mod10", "mod11", "weighted"],
    },
    string_checksum_weights: { default: null },
  },
  commonMistakes: {
    input: "string_input",
    operation: "string_operation",
    text: "string_input",
    value: "string_input",
    bind_value: "string_bind_value",
    format: "string_format_type",
    separator: "string_split_separator",
  },
} as const;
