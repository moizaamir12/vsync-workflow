import type { BlockSchema } from "./types.js";

export const UI_CAMERA_SCHEMA: BlockSchema = {
  required: ["ui_camera_title"],
  optional: {
    ui_camera_instructions: { default: "" },
    ui_camera_mode: {
      default: "photo",
      enum: ["photo", "barcode", "qr", "multi_barcode"],
    },
    ui_camera_bind_value: { default: null },
    ui_camera_overlay: { default: null },
    ui_camera_flash: { default: "auto", enum: ["auto", "on", "off"] },
  },
  commonMistakes: {
    title: "ui_camera_title",
    mode: "ui_camera_mode",
    camera_title: "ui_camera_title",
    flash: "ui_camera_flash",
    overlay: "ui_camera_overlay",
    bind_value: "ui_camera_bind_value",
  },
} as const;
