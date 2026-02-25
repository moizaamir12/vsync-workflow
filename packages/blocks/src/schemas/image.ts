import type { BlockSchema } from "./types.js";

export const IMAGE_SCHEMA: BlockSchema = {
  required: ["image_operation"],
  optional: {
    image_source: { default: null },
    image_format: {
      default: "jpeg",
      enum: ["jpeg", "png", "webp", "gif", "bmp", "tiff"],
    },
    image_quality: { default: 80 },
    image_width: { default: null },
    image_height: { default: null },
    image_fit: {
      default: "cover",
      enum: ["cover", "contain", "fill", "inside", "outside"],
    },
    image_rotation: { default: 0 },
    image_crop: { default: null },
    image_watermark: { default: null },
    image_bind_value: { default: null },
  },
  commonMistakes: {
    operation: "image_operation",
    source: "image_source",
    src: "image_source",
    format: "image_format",
    quality: "image_quality",
    width: "image_width",
    height: "image_height",
    bind_value: "image_bind_value",
  },
} as const;
