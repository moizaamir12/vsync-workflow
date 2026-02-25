import type { Block, WorkflowContext } from "@vsync/shared-types";
import type { BlockResult } from "@vsync/engine";
import { ContextManager } from "@vsync/engine";

/**
 * Type stubs for expo-image-manipulator.
 * At build time, expo-image-manipulator is an optional peer dep
 * that must be installed in the host React Native project.
 */
interface ManipulateAction {
  rotate?: number;
  flip?: { horizontal?: boolean; vertical?: boolean };
  crop?: { originX: number; originY: number; width: number; height: number };
  resize?: { width?: number; height?: number };
}

interface SaveOptions {
  compress?: number;
  format?: string;
}

interface ManipulateResult {
  uri: string;
  width: number;
  height: number;
}

/**
 * Mobile image block executor using expo-image-manipulator.
 *
 * Operations: rotate, flip, crop, resize, compress
 * NO extract_barcodes — handled by ui_camera barcode mode.
 *
 * Uses ImageManipulator.manipulateAsync() with action arrays.
 * Input: artifact.fileUrl (content:// or file:// URI)
 * Output: temp file URI.
 */
export async function mobileImageExecutor(
  block: Block,
  context: WorkflowContext,
): Promise<BlockResult> {
  const cm = new ContextManager();
  const logic = block.logic;

  const operation = String(cm.resolveValue(logic.image_operation, context) ?? "");
  const source = String(cm.resolveValue(logic.image_source, context) ?? "");

  if (!operation) throw new Error("image_operation is required");
  if (!source) throw new Error("image_source is required");

  const fileUri = resolveImageUri(source, context);

  if (operation === "extract_barcodes") {
    throw new Error(
      "extract_barcodes is not supported on mobile. " +
      "Use the ui_camera block with barcode mode instead.",
    );
  }

  /* Dynamically import expo-image-manipulator at runtime */
  let ImageManipulator: {
    manipulateAsync: (
      uri: string,
      actions: ManipulateAction[],
      saveOptions?: SaveOptions,
    ) => Promise<ManipulateResult>;
  };
  try {
    ImageManipulator = await import("expo-image-manipulator");
  } catch {
    throw new Error(
      "expo-image-manipulator is required for mobile image processing. " +
      "Install it with: npx expo install expo-image-manipulator",
    );
  }

  const actions: ManipulateAction[] = [];
  const saveOptions: SaveOptions = {};

  switch (operation) {
    case "rotate": {
      const degrees = Number(cm.resolveValue(logic.image_rotate_degrees, context) ?? 0);
      actions.push({ rotate: degrees });
      break;
    }
    case "flip": {
      const direction = String(
        cm.resolveValue(logic.image_flip_direction, context) ?? "horizontal",
      );
      actions.push({
        flip: {
          horizontal: direction === "horizontal",
          vertical: direction === "vertical",
        },
      });
      break;
    }
    case "crop": {
      const rawCrop = cm.resolveValue(logic.image_crop, context);
      if (!rawCrop || typeof rawCrop !== "object") {
        throw new Error("image_crop must be an object with { left, top, width, height }");
      }
      const crop = rawCrop as Record<string, unknown>;
      actions.push({
        crop: {
          originX: Number(crop.left ?? 0),
          originY: Number(crop.top ?? 0),
          width: Number(crop.width ?? 0),
          height: Number(crop.height ?? 0),
        },
      });
      break;
    }
    case "resize": {
      const rawResize = cm.resolveValue(logic.image_resize, context);
      if (!rawResize || typeof rawResize !== "object") {
        throw new Error("image_resize must be an object with { width?, height? }");
      }
      const opts = rawResize as Record<string, unknown>;
      actions.push({
        resize: {
          width: opts.width ? Number(opts.width) : undefined,
          height: opts.height ? Number(opts.height) : undefined,
        },
      });
      break;
    }
    case "compress": {
      const quality = Number(cm.resolveValue(logic.image_compress_quality, context) ?? 80);
      const format = String(cm.resolveValue(logic.image_compress_format, context) ?? "jpeg");
      saveOptions.compress = quality / 100;
      saveOptions.format = format;
      break;
    }
    default:
      throw new Error(`Unknown image operation: "${operation}"`);
  }

  const result = await ImageManipulator.manipulateAsync(fileUri, actions, saveOptions);

  const bindTo = logic.image_bind_value as string | undefined;
  if (bindTo) {
    return {
      stateDelta: {
        [extractBindKey(bindTo)]: {
          fileUrl: result.uri,
          width: result.width,
          height: result.height,
        },
      },
    };
  }
  return {};
}

/* ── Helpers ──────────────────────────────────────────── */

function resolveImageUri(source: string, context: WorkflowContext): string {
  const artifact = context.artifacts.find(
    (a) => a.id === source || a.name === source,
  );
  if (artifact?.fileUrl) return artifact.fileUrl;

  if (source.startsWith("$state.")) {
    const key = source.slice(7);
    const val = context.state[key];
    if (typeof val === "string") return val;
  }

  return source;
}

function extractBindKey(bindTo: string): string {
  if (bindTo.startsWith("$state.")) return bindTo.slice(7);
  return bindTo;
}
