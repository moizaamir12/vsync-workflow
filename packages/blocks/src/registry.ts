import type { BlockType } from "@vsync/shared-types";
import type { BlockSchema } from "./schemas/types.js";
import { SCHEMA_MAP } from "./schemas/index.js";

/* ── Types ─────────────────────────────────────────────── */

/** Platform identifiers that limit where a block can run. */
export type Platform = "web" | "mobile" | "server" | "desktop";

/** Organisational categories for the block palette in the designer. */
export type BlockCategory = "data" | "flow" | "integration" | "ui" | "platform";

/** Everything the designer and runtime need to know about a block type. */
export interface BlockRegistryEntry {
  /** Internal key — matches BlockType union */
  type: BlockType;
  /** Human-readable display name */
  name: string;
  /** Short description shown in the block palette */
  description: string;
  /** Icon identifier (emoji or icon-library key) */
  icon: string;
  /** Organisational category */
  category: BlockCategory;
  /** Platforms that support this block */
  platforms: readonly Platform[];
  /** Associated schema for validation / defaults */
  schema: BlockSchema;
}

/* ── Registry data ─────────────────────────────────────── */

const ALL: readonly Platform[] = ["web", "mobile", "server", "desktop"];
const SERVER_ONLY: readonly Platform[] = ["server"];
const MOBILE_ONLY: readonly Platform[] = ["mobile"];
const NON_MOBILE: readonly Platform[] = ["web", "server", "desktop"];

/** Flat array so consumers can iterate, filter, group, etc. */
const ENTRIES: readonly BlockRegistryEntry[] = [
  /* ── Data ──────────────────────────────────────────── */
  {
    type: "object",
    name: "Object",
    description: "Create, merge, pick, omit, and manipulate objects",
    icon: "braces",
    category: "data",
    platforms: ALL,
    schema: SCHEMA_MAP.object,
  },
  {
    type: "string",
    name: "String",
    description: "Slice, extract, format, replace, and generate strings",
    icon: "type",
    category: "data",
    platforms: ALL,
    schema: SCHEMA_MAP.string,
  },
  {
    type: "array",
    name: "Array",
    description: "Slice, filter, sort, pluck, merge, and convert arrays",
    icon: "list",
    category: "data",
    platforms: ALL,
    schema: SCHEMA_MAP.array,
  },
  {
    type: "math",
    name: "Math",
    description: "Arithmetic, rounding, clamping, and expression evaluation",
    icon: "calculator",
    category: "data",
    platforms: ALL,
    schema: SCHEMA_MAP.math,
  },
  {
    type: "date",
    name: "Date",
    description: "Adjust, format, extract components, and check dates",
    icon: "calendar",
    category: "data",
    platforms: ALL,
    schema: SCHEMA_MAP.date,
  },
  {
    type: "normalize",
    name: "Normalize",
    description: "Standardize countries, currencies, weights, and lengths",
    icon: "scale",
    category: "data",
    platforms: ALL,
    schema: SCHEMA_MAP.normalize,
  },

  /* ── Flow ──────────────────────────────────────────── */
  {
    type: "goto",
    name: "Goto",
    description: "Jump to another block or create loops",
    icon: "arrow-right",
    category: "flow",
    platforms: ALL,
    schema: SCHEMA_MAP.goto,
  },
  {
    type: "sleep",
    name: "Sleep",
    description: "Pause execution for a specified duration",
    icon: "clock",
    category: "flow",
    platforms: ALL,
    schema: SCHEMA_MAP.sleep,
  },
  {
    type: "code",
    name: "Code",
    description: "Execute JavaScript or TypeScript in a sandboxed environment",
    icon: "code",
    category: "flow",
    platforms: ALL,
    schema: SCHEMA_MAP.code,
  },
  {
    type: "validation",
    name: "Validation",
    description: "Validate data against a set of rules",
    icon: "shield-check",
    category: "flow",
    platforms: ALL,
    schema: SCHEMA_MAP.validation,
  },

  /* ── Integration ───────────────────────────────────── */
  {
    type: "fetch",
    name: "HTTP Fetch",
    description: "Make HTTP requests with retry, timeout, and SSRF protection",
    icon: "globe",
    category: "integration",
    platforms: ALL,
    schema: SCHEMA_MAP.fetch,
  },
  {
    type: "agent",
    name: "AI Agent",
    description: "Invoke an AI/LLM model for text, media, or validation",
    icon: "bot",
    category: "integration",
    platforms: ALL,
    schema: SCHEMA_MAP.agent,
  },
  {
    type: "location",
    name: "Location",
    description: "Get coordinates, calculate distance, verify radius",
    icon: "map-pin",
    category: "integration",
    platforms: ALL,
    schema: SCHEMA_MAP.location,
  },
  {
    type: "ftp",
    name: "FTP",
    description: "Upload and download files via FTP/SFTP",
    icon: "hard-drive",
    category: "integration",
    platforms: SERVER_ONLY,
    schema: SCHEMA_MAP.ftp,
  },

  /* ── UI ────────────────────────────────────────────── */
  {
    type: "ui_camera",
    name: "Camera",
    description: "Capture photos, barcodes, and QR codes",
    icon: "camera",
    category: "ui",
    platforms: MOBILE_ONLY,
    schema: SCHEMA_MAP.ui_camera,
  },
  {
    type: "ui_form",
    name: "Form",
    description: "Display an input form and collect user responses",
    icon: "file-text",
    category: "ui",
    platforms: ALL,
    schema: SCHEMA_MAP.ui_form,
  },
  {
    type: "ui_table",
    name: "Table",
    description: "Display tabular data with search, selection, and actions",
    icon: "table",
    category: "ui",
    platforms: ALL,
    schema: SCHEMA_MAP.ui_table,
  },
  {
    type: "ui_details",
    name: "Details",
    description: "Display structured data in list, grid, or card layout",
    icon: "layout",
    category: "ui",
    platforms: ALL,
    schema: SCHEMA_MAP.ui_details,
  },

  /* ── Platform ──────────────────────────────────────── */
  {
    type: "image",
    name: "Image",
    description: "Resize, crop, rotate, watermark, and convert images",
    icon: "image",
    category: "platform",
    platforms: ALL,
    schema: SCHEMA_MAP.image,
  },
  {
    type: "filesystem",
    name: "Filesystem",
    description: "Read, write, copy, and list files on the server",
    icon: "folder",
    category: "platform",
    platforms: NON_MOBILE,
    schema: SCHEMA_MAP.filesystem,
  },
  {
    type: "video",
    name: "Video",
    description: "Transcode, trim, resize, and extract thumbnails from video",
    icon: "video",
    category: "platform",
    platforms: NON_MOBILE,
    schema: SCHEMA_MAP.video,
  },
];

/* ── Indexed lookup ────────────────────────────────────── */

/**
 * O(1) lookup map: blockType → BlockRegistryEntry.
 */
export const BLOCK_REGISTRY: ReadonlyMap<string, BlockRegistryEntry> = new Map(
  ENTRIES.map((entry) => [entry.type, entry]),
);

/**
 * Get the registry entry for a given block type.
 * Returns `undefined` if the type is not registered.
 */
export function getRegistryEntry(
  blockType: string,
): BlockRegistryEntry | undefined {
  return BLOCK_REGISTRY.get(blockType);
}

/**
 * Filter registry entries by category.
 */
export function getBlocksByCategory(
  category: BlockCategory,
): BlockRegistryEntry[] {
  return ENTRIES.filter((e) => e.category === category);
}

/**
 * Filter registry entries by platform.
 */
export function getBlocksByPlatform(
  platform: Platform,
): BlockRegistryEntry[] {
  return ENTRIES.filter((e) => e.platforms.includes(platform));
}

/**
 * Get all registered block types.
 */
export function getAllBlockTypes(): readonly BlockRegistryEntry[] {
  return ENTRIES;
}
