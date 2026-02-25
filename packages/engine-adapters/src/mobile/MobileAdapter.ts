import type { PlatformCapabilities } from "@vsync/engine";
import {
  PlatformAdapter,
  BlockExecutor,
  dataBlockHandlers,
  flowBlockHandlers,
  agentExecutor,
} from "@vsync/engine";
import type { Block, WorkflowContext } from "@vsync/shared-types";
import type { BlockResult } from "@vsync/engine";
import { mobileImageExecutor } from "./blocks/image.js";
import { mobileLocationExecutor } from "./blocks/location.js";

/**
 * React Native / Expo platform adapter.
 *
 * Provides all pure-JS data blocks, flow blocks, image processing
 * (expo-image-manipulator), location (expo-location), and UI blocks.
 * No filesystem access, no FTP.
 */
export class MobileAdapter extends PlatformAdapter {
  readonly platform = "mobile";

  readonly capabilities: PlatformCapabilities = {
    hasCamera: true,
    hasFilesystem: false,
    hasFtp: false,
    hasUi: true,
    hasVideo: false,
    hasLocation: true,
  };

  registerBlocks(executor: BlockExecutor): void {
    /* Data blocks — pure JS, run everywhere */
    for (const [type, handler] of Object.entries(dataBlockHandlers)) {
      executor.registerHandler(type, handler);
    }

    /* Flow & integration blocks */
    for (const [type, handler] of Object.entries(flowBlockHandlers)) {
      executor.registerHandler(type, handler);
    }

    /* Platform-specific blocks */
    executor.registerHandler("image", mobileImageExecutor);
    executor.registerHandler("location", mobileLocationExecutor);

    /**
     * UI blocks — registered as passthroughs.
     * The Interpreter handles UI block pausing natively (isUiBlock check).
     * These handlers exist so the BlockExecutor knows the types are valid.
     */
    executor.registerHandler("ui_camera", createUiPassthrough());
    executor.registerHandler("ui_form", createUiPassthrough());
    executor.registerHandler("ui_table", createUiPassthrough());
    executor.registerHandler("ui_details", createUiPassthrough());

    /* Validation — delegates to agent executor with type='validation' */
    executor.registerHandler("validation", createValidationHandler());

    /* Video — not implemented in V1 */
    executor.registerHandler("video", createVideoStub());
  }

  /** Mobile has GPS via expo-location */
  getLocation(): "expo-location" {
    return "expo-location";
  }

  /** Mobile has no filesystem */
  getFilesystem(): null {
    return null;
  }
}

/* ── UI passthrough (Interpreter pauses on ui_* blocks) ── */

function createUiPassthrough(): (
  block: Block,
  context: WorkflowContext,
) => Promise<BlockResult> {
  return async () => {
    /**
     * UI blocks are intercepted by the Interpreter before reaching
     * the BlockExecutor. If we get here, something bypassed the
     * normal flow — return empty result as a safety net.
     */
    return {};
  };
}

/* ── Validation handler (syntactic sugar for agent) ──── */

function createValidationHandler(): (
  block: Block,
  context: WorkflowContext,
) => Promise<BlockResult> {
  return async (block, context) => {
    /* Transform validation block into agent block with type='validation' */
    const wrappedBlock: Block = {
      ...block,
      type: "agent",
      logic: {
        ...block.logic,
        agent_type: "validation",
        agent_model: block.logic.validation_model ?? block.logic.agent_model ?? "",
        agent_prompt: block.logic.validation_rules ?? block.logic.agent_prompt ?? "",
        agent_input: block.logic.validation_input ?? block.logic.agent_input,
        agent_bind_value: block.logic.validation_bind_value ?? block.logic.agent_bind_value,
      },
    };

    return agentExecutor(wrappedBlock, context) as Promise<BlockResult>;
  };
}

/* ── Video stub ──────────────────────────────────────── */

function createVideoStub(): (
  block: Block,
  context: WorkflowContext,
) => Promise<BlockResult> {
  return async () => {
    throw new Error("Video block is planned for a future release");
  };
}
