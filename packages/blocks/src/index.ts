/* ── Schemas ───────────────────────────────────────────── */
export type { BlockSchema, FieldDef } from "./schemas/types.js";
export {
  SCHEMA_MAP,
  /* Data */
  OBJECT_SCHEMA,
  STRING_SCHEMA,
  ARRAY_SCHEMA,
  MATH_SCHEMA,
  DATE_SCHEMA,
  NORMALIZE_SCHEMA,
  /* Flow & integration */
  FETCH_SCHEMA,
  AGENT_SCHEMA,
  GOTO_SCHEMA,
  SLEEP_SCHEMA,
  LOCATION_SCHEMA,
  CODE_SCHEMA,
  /* UI */
  UI_CAMERA_SCHEMA,
  UI_FORM_SCHEMA,
  UI_TABLE_SCHEMA,
  UI_DETAILS_SCHEMA,
  /* Platform */
  IMAGE_SCHEMA,
  FILESYSTEM_SCHEMA,
  FTP_SCHEMA,
  VIDEO_SCHEMA,
  VALIDATION_SCHEMA,
} from "./schemas/index.js";

/* ── Validation ────────────────────────────────────────── */
export { validateBlock } from "./validate.js";
export type { ValidationResult } from "./validate.js";

/* ── Defaults ──────────────────────────────────────────── */
export { getBlockDefaults, getSchemaBlockTypes } from "./defaults.js";

/* ── Registry ──────────────────────────────────────────── */
export {
  BLOCK_REGISTRY,
  getRegistryEntry,
  getBlocksByCategory,
  getBlocksByPlatform,
  getAllBlockTypes,
} from "./registry.js";

export type {
  BlockRegistryEntry,
  BlockCategory,
  Platform,
} from "./registry.js";
