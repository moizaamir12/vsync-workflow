import type { BlockSchema } from "./types.js";

export const VIDEO_SCHEMA: BlockSchema = {
  required: ["video_operation"],
  optional: {
    video_source: { default: null },
    video_format: {
      default: "mp4",
      enum: ["mp4", "webm", "avi", "mov", "mkv"],
    },
    video_quality: {
      default: "medium",
      enum: ["low", "medium", "high", "original"],
    },
    video_start_time: { default: null },
    video_end_time: { default: null },
    video_width: { default: null },
    video_height: { default: null },
    video_fps: { default: null },
    video_thumbnail_time: { default: 0 },
    video_bind_value: { default: null },
  },
  commonMistakes: {
    operation: "video_operation",
    source: "video_source",
    src: "video_source",
    format: "video_format",
    quality: "video_quality",
    start: "video_start_time",
    end: "video_end_time",
    bind_value: "video_bind_value",
  },
} as const;
