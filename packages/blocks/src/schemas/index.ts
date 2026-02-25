/**
 * Central schema registry — one schema per block type.
 *
 * Each schema declares required fields, optional fields with defaults,
 * and a commonMistakes map for typo detection.
 */
export type { BlockSchema, FieldDef } from "./types.js";

/* ── Data block schemas ────────────────────────────────── */
export { OBJECT_SCHEMA } from "./object.js";
export { STRING_SCHEMA } from "./string.js";
export { ARRAY_SCHEMA } from "./array.js";
export { MATH_SCHEMA } from "./math.js";
export { DATE_SCHEMA } from "./date.js";
export { NORMALIZE_SCHEMA } from "./normalize.js";

/* ── Flow & integration block schemas ──────────────────── */
export { FETCH_SCHEMA } from "./fetch.js";
export { AGENT_SCHEMA } from "./agent.js";
export { GOTO_SCHEMA } from "./goto.js";
export { SLEEP_SCHEMA } from "./sleep.js";
export { LOCATION_SCHEMA } from "./location.js";
export { CODE_SCHEMA } from "./code.js";

/* ── UI block schemas ──────────────────────────────────── */
export { UI_CAMERA_SCHEMA } from "./ui-camera.js";
export { UI_FORM_SCHEMA } from "./ui-form.js";
export { UI_TABLE_SCHEMA } from "./ui-table.js";
export { UI_DETAILS_SCHEMA } from "./ui-details.js";

/* ── Platform block schemas ────────────────────────────── */
export { IMAGE_SCHEMA } from "./image.js";
export { FILESYSTEM_SCHEMA } from "./filesystem.js";
export { FTP_SCHEMA } from "./ftp.js";
export { VIDEO_SCHEMA } from "./video.js";
export { VALIDATION_SCHEMA } from "./validation.js";

/* ── Aggregated lookup ─────────────────────────────────── */
import type { BlockSchema } from "./types.js";
import { OBJECT_SCHEMA } from "./object.js";
import { STRING_SCHEMA } from "./string.js";
import { ARRAY_SCHEMA } from "./array.js";
import { MATH_SCHEMA } from "./math.js";
import { DATE_SCHEMA } from "./date.js";
import { NORMALIZE_SCHEMA } from "./normalize.js";
import { FETCH_SCHEMA } from "./fetch.js";
import { AGENT_SCHEMA } from "./agent.js";
import { GOTO_SCHEMA } from "./goto.js";
import { SLEEP_SCHEMA } from "./sleep.js";
import { LOCATION_SCHEMA } from "./location.js";
import { CODE_SCHEMA } from "./code.js";
import { UI_CAMERA_SCHEMA } from "./ui-camera.js";
import { UI_FORM_SCHEMA } from "./ui-form.js";
import { UI_TABLE_SCHEMA } from "./ui-table.js";
import { UI_DETAILS_SCHEMA } from "./ui-details.js";
import { IMAGE_SCHEMA } from "./image.js";
import { FILESYSTEM_SCHEMA } from "./filesystem.js";
import { FTP_SCHEMA } from "./ftp.js";
import { VIDEO_SCHEMA } from "./video.js";
import { VALIDATION_SCHEMA } from "./validation.js";

/**
 * Map from BlockType → BlockSchema.
 * Used by the validation engine and defaults builder.
 */
export const SCHEMA_MAP: Record<string, BlockSchema> = {
  object: OBJECT_SCHEMA,
  string: STRING_SCHEMA,
  array: ARRAY_SCHEMA,
  math: MATH_SCHEMA,
  date: DATE_SCHEMA,
  normalize: NORMALIZE_SCHEMA,
  fetch: FETCH_SCHEMA,
  agent: AGENT_SCHEMA,
  goto: GOTO_SCHEMA,
  sleep: SLEEP_SCHEMA,
  location: LOCATION_SCHEMA,
  code: CODE_SCHEMA,
  ui_camera: UI_CAMERA_SCHEMA,
  ui_form: UI_FORM_SCHEMA,
  ui_table: UI_TABLE_SCHEMA,
  ui_details: UI_DETAILS_SCHEMA,
  image: IMAGE_SCHEMA,
  filesystem: FILESYSTEM_SCHEMA,
  ftp: FTP_SCHEMA,
  video: VIDEO_SCHEMA,
  validation: VALIDATION_SCHEMA,
};
