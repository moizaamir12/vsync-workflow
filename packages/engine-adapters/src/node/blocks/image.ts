import sharp from "sharp";
import type { Block, WorkflowContext } from "@vsync/shared-types";
import type { BlockResult } from "@vsync/engine";
import { ContextManager } from "@vsync/engine";

/**
 * Node.js image block executor using sharp.
 *
 * Operations: rotate, flip, crop, resize, compress, extract_barcodes
 * Reads from artifact.filePath, processes, and writes back.
 */
export async function nodeImageExecutor(
  block: Block,
  context: WorkflowContext,
): Promise<BlockResult> {
  const cm = new ContextManager();
  const logic = block.logic;

  const operation = String(cm.resolveValue(logic.image_operation, context) ?? "");
  const source = String(cm.resolveValue(logic.image_source, context) ?? "");

  if (!operation) throw new Error("image_operation is required");
  if (!source) throw new Error("image_source is required");

  /* Resolve source — could be a file path or artifact reference */
  const filePath = resolveImagePath(source, context);

  let result: unknown;

  switch (operation) {
    case "rotate":
      result = await executeRotate(cm, filePath, logic, context);
      break;
    case "flip":
      result = await executeFlip(cm, filePath, logic, context);
      break;
    case "crop":
      result = await executeCrop(cm, filePath, logic, context);
      break;
    case "resize":
      result = await executeResize(cm, filePath, logic, context);
      break;
    case "compress":
      result = await executeCompress(cm, filePath, logic, context);
      break;
    case "extract_barcodes":
      /* Barcode extraction is a stub — requires an external library */
      throw new Error(
        "extract_barcodes is not yet implemented on Node. " +
        "Use a dedicated barcode library or the mobile ui_camera block.",
      );
    default:
      throw new Error(`Unknown image operation: "${operation}"`);
  }

  const bindTo = logic.image_bind_value as string | undefined;
  if (bindTo) {
    return { stateDelta: { [extractBindKey(bindTo)]: result } };
  }
  return {};
}

/* ── Operations ───────────────────────────────────────── */

async function executeRotate(
  cm: ContextManager,
  filePath: string,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): Promise<{ filePath: string; width: number; height: number }> {
  const degrees = Number(cm.resolveValue(logic.image_rotate_degrees, context) ?? 0);

  const output = filePath;
  const buffer = await sharp(filePath).rotate(degrees).toBuffer();
  await sharp(buffer).toFile(output);

  const meta = await sharp(output).metadata();
  return { filePath: output, width: meta.width ?? 0, height: meta.height ?? 0 };
}

async function executeFlip(
  cm: ContextManager,
  filePath: string,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): Promise<{ filePath: string; width: number; height: number }> {
  const direction = String(cm.resolveValue(logic.image_flip_direction, context) ?? "horizontal");

  let pipeline = sharp(filePath);
  if (direction === "vertical") {
    pipeline = pipeline.flip();
  } else {
    pipeline = pipeline.flop();
  }

  const buffer = await pipeline.toBuffer();
  await sharp(buffer).toFile(filePath);

  const meta = await sharp(filePath).metadata();
  return { filePath, width: meta.width ?? 0, height: meta.height ?? 0 };
}

async function executeCrop(
  cm: ContextManager,
  filePath: string,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): Promise<{ filePath: string; width: number; height: number }> {
  const rawCrop = cm.resolveValue(logic.image_crop, context);
  if (!rawCrop || typeof rawCrop !== "object") {
    throw new Error("image_crop must be an object with { left, top, width, height }");
  }

  const crop = rawCrop as Record<string, unknown>;
  const left = Number(crop.left ?? 0);
  const top = Number(crop.top ?? 0);
  const width = Number(crop.width ?? 0);
  const height = Number(crop.height ?? 0);

  if (width <= 0 || height <= 0) {
    throw new Error("image_crop width and height must be positive");
  }

  const buffer = await sharp(filePath)
    .extract({ left, top, width, height })
    .toBuffer();
  await sharp(buffer).toFile(filePath);

  return { filePath, width, height };
}

async function executeResize(
  cm: ContextManager,
  filePath: string,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): Promise<{ filePath: string; width: number; height: number }> {
  const rawResize = cm.resolveValue(logic.image_resize, context);
  if (!rawResize || typeof rawResize !== "object") {
    throw new Error("image_resize must be an object with { width?, height?, fit }");
  }

  const opts = rawResize as Record<string, unknown>;
  const width = opts.width ? Number(opts.width) : undefined;
  const height = opts.height ? Number(opts.height) : undefined;
  const fit = (String(opts.fit ?? "cover")) as keyof sharp.FitEnum;

  if (!width && !height) {
    throw new Error("image_resize requires at least width or height");
  }

  const buffer = await sharp(filePath)
    .resize({ width, height, fit })
    .toBuffer();
  await sharp(buffer).toFile(filePath);

  const meta = await sharp(filePath).metadata();
  return { filePath, width: meta.width ?? 0, height: meta.height ?? 0 };
}

async function executeCompress(
  cm: ContextManager,
  filePath: string,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): Promise<{ filePath: string; size: number }> {
  const quality = Number(cm.resolveValue(logic.image_compress_quality, context) ?? 80);
  const format = String(cm.resolveValue(logic.image_compress_format, context) ?? "jpeg");

  let pipeline = sharp(filePath);

  switch (format) {
    case "jpeg":
    case "jpg":
      pipeline = pipeline.jpeg({ quality });
      break;
    case "png":
      /* PNG quality maps to compression level (1-9 where 9 = most compressed) */
      pipeline = pipeline.png({ compressionLevel: Math.round((100 - quality) / 11) });
      break;
    case "webp":
      pipeline = pipeline.webp({ quality });
      break;
    default:
      throw new Error(`Unsupported compress format: "${format}"`);
  }

  const buffer = await pipeline.toBuffer();
  await sharp(buffer).toFile(filePath);

  return { filePath, size: buffer.length };
}

/* ── Helpers ──────────────────────────────────────────── */

/**
 * Resolve an image source to a file path.
 * Checks artifacts array for a matching reference, otherwise uses path directly.
 */
function resolveImagePath(source: string, context: WorkflowContext): string {
  /* Check if source is an artifact ID */
  const artifact = context.artifacts.find(
    (a) => a.id === source || a.name === source,
  );

  if (artifact?.filePath) return artifact.filePath;

  /* Check state for a path value */
  if (source.startsWith("$state.")) {
    const key = source.slice(7);
    const val = context.state[key];
    if (typeof val === "string") return val;
  }

  /* Use as direct path */
  return source;
}

function extractBindKey(bindTo: string): string {
  if (bindTo.startsWith("$state.")) return bindTo.slice(7);
  return bindTo;
}
