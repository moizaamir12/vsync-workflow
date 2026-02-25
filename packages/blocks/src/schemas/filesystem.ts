import type { BlockSchema } from "./types.js";

export const FILESYSTEM_SCHEMA: BlockSchema = {
  required: ["filesystem_operation"],
  optional: {
    filesystem_path: { default: null },
    filesystem_content: { default: null },
    filesystem_destination: { default: null },
    filesystem_encoding: {
      default: "utf-8",
      enum: ["utf-8", "ascii", "base64", "binary", "hex"],
    },
    filesystem_recursive: { default: false },
    filesystem_overwrite: { default: false },
    filesystem_pattern: { default: null },
    filesystem_bind_value: { default: null },
  },
  commonMistakes: {
    operation: "filesystem_operation",
    path: "filesystem_path",
    file: "filesystem_path",
    content: "filesystem_content",
    destination: "filesystem_destination",
    encoding: "filesystem_encoding",
    bind_value: "filesystem_bind_value",
  },
} as const;
