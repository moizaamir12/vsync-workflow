import type { BlockType } from "@vsync/shared-types";
import type { BlockHandler } from "../types.js";
import type { BlockExecutor } from "./BlockExecutor.js";

/**
 * Platform capabilities that an adapter can declare.
 * The engine uses these to determine which blocks are
 * available on the current platform.
 */
export interface PlatformCapabilities {
  /** Whether the platform has a camera (mobile, desktop with webcam) */
  hasCamera: boolean;

  /** Whether the platform has filesystem access */
  hasFilesystem: boolean;

  /** Whether the platform supports FTP operations */
  hasFtp: boolean;

  /** Whether the platform supports UI interactions */
  hasUi: boolean;

  /** Whether the platform supports video capture/processing */
  hasVideo: boolean;

  /** Whether the platform supports geolocation */
  hasLocation: boolean;
}

/**
 * Abstract adapter that bridges the engine to a specific platform.
 *
 * Each target platform (web, desktop, iOS, Android, server) extends
 * this class and registers platform-specific block handlers. The engine
 * calls `registerBlocks()` during initialization to let the adapter
 * populate the BlockExecutor with handlers it can provide.
 *
 * Usage:
 * ```ts
 * class DesktopAdapter extends PlatformAdapter {
 *   readonly platform = "desktop";
 *   readonly capabilities = { hasCamera: true, hasFilesystem: true, ... };
 *
 *   registerBlocks(executor: BlockExecutor): void {
 *     executor.registerHandler("filesystem", this.handleFilesystem);
 *     executor.registerHandler("ui_camera", this.handleCamera);
 *   }
 * }
 * ```
 */
export abstract class PlatformAdapter {
  /** Platform identifier (e.g. "web", "desktop", "ios", "android", "server") */
  abstract readonly platform: string;

  /** Declared capabilities for this platform */
  abstract readonly capabilities: PlatformCapabilities;

  /**
   * Register all block handlers this platform supports.
   * Called once during engine initialization.
   */
  abstract registerBlocks(executor: BlockExecutor): void;

  /**
   * Check whether this platform supports a given block type.
   * Uses the capabilities map to make the determination.
   */
  supports(blockType: BlockType): boolean {
    const capMap: Partial<Record<BlockType, keyof PlatformCapabilities>> = {
      ui_camera: "hasCamera",
      ui_form: "hasUi",
      ui_table: "hasUi",
      ui_details: "hasUi",
      filesystem: "hasFilesystem",
      ftp: "hasFtp",
      video: "hasVideo",
      location: "hasLocation",
    };

    const requiredCap = capMap[blockType];

    /* Blocks not in the capability map are universally supported */
    if (!requiredCap) return true;

    return this.capabilities[requiredCap];
  }
}
