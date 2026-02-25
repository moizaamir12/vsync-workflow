/**
 * Categories of binary assets produced or consumed by workflows.
 * Used to select the right storage backend and thumbnail pipeline.
 */
export type ArtifactType = "image" | "video" | "document" | "data" | "audio";

/**
 * A visual annotation overlaid on an artifact (typically an image).
 * Used by vision blocks to mark detected barcodes, text regions,
 * and custom UI markers.
 *
 * Vertices use normalized 0-1 coordinates with a top-left origin
 * in clockwise order. Barcodes are represented as overlays where
 * `type === 'barcode'` — there is no separate barcode field.
 */
export interface Overlay {
  /** Discriminator for the overlay kind */
  type: "barcode" | "text" | "ui_marker";

  /** Decoded payload (barcode data, OCR text, or marker label) */
  value: string;

  /**
   * Bounding polygon as [x, y] pairs in normalized 0-1 coordinates.
   * Origin is top-left, vertices ordered clockwise.
   * Typically four points for a rectangle, but polygons are allowed.
   */
  vertices: [number, number][];

  /** Barcode symbology (e.g. "QR_CODE", "CODE_128") — only for barcode overlays */
  symbology?: string;

  /** Detection confidence between 0 and 1 — set by the vision model */
  confidence?: number;

  /** Optional human-readable label for display in the designer */
  label?: string;
}

/**
 * A binary asset produced or consumed during workflow execution.
 * Artifacts are the primary mechanism for passing files between
 * blocks and persisting outputs for downstream consumption.
 */
export interface Artifact {
  /** Unique identifier */
  id: string;

  /** Run that produced this artifact (null for pre-seeded assets) */
  runId?: string;

  /** Workflow this artifact is associated with */
  workflowId: string;

  /** Category — drives storage, thumbnailing, and UI rendering */
  type: ArtifactType;

  /** Human-readable file or asset name */
  name: string;

  /** Local filesystem path (device-side storage) */
  filePath?: string;

  /** Remote URL for cloud-hosted artifacts */
  fileUrl?: string;

  /** Size in bytes — used for quota enforcement and progress bars */
  fileSize?: number;

  /** MIME type (e.g. "image/png", "application/pdf") */
  mimeType?: string;

  /** Arbitrary key-value metadata (EXIF, custom tags, etc.) */
  metadata?: Record<string, unknown>;

  /** Human-readable origin description (e.g. "ui_camera block", "upload") */
  source?: string;

  /** Block that produced this artifact, if any */
  blockId?: string;

  /** Pixel width — only meaningful for image and video artifacts */
  width?: number;

  /** Pixel height — only meaningful for image and video artifacts */
  height?: number;

  /** Visual annotations detected or applied to this artifact */
  overlays?: Overlay[];

  /** Path to a smaller preview image for list/grid views */
  thumbnailPath?: string;

  /** ISO-8601 timestamp of creation */
  createdAt: string;
}
