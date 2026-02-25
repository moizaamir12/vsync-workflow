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

/**
 * Cloud / serverless platform adapter.
 *
 * Minimal adapter for Lambda, Cloud Functions, edge workers, etc.
 * Only pure-JS data blocks, fetch, agent, and code are available.
 * No filesystem, no FTP, no image processing, no camera, no UI.
 */
export class CloudAdapter extends PlatformAdapter {
  readonly platform = "cloud";

  readonly capabilities: PlatformCapabilities = {
    hasCamera: false,
    hasFilesystem: false,
    hasFtp: false,
    hasUi: false,
    hasVideo: false,
    hasLocation: false,
  };

  registerBlocks(executor: BlockExecutor): void {
    /* Data blocks — pure JS, run everywhere */
    for (const [type, handler] of Object.entries(dataBlockHandlers)) {
      executor.registerHandler(type, handler);
    }

    /* Flow & integration blocks (fetch, agent, goto, sleep, location, code) */
    for (const [type, handler] of Object.entries(flowBlockHandlers)) {
      executor.registerHandler(type, handler);
    }

    /* Validation — delegates to agent executor with type='validation' */
    executor.registerHandler("validation", createValidationHandler());

    /* Video — not implemented in V1 */
    executor.registerHandler("video", createVideoStub());

    /**
     * Platform-specific stubs for blocks that can't run in cloud.
     * These throw clear errors so callers know why the block failed.
     */
    executor.registerHandler("image", createUnsupportedStub("image", "cloud"));
    executor.registerHandler("filesystem", createUnsupportedStub("filesystem", "cloud"));
    executor.registerHandler("ftp", createUnsupportedStub("ftp", "cloud"));
  }

  /** Cloud has no GPS */
  getLocation(): null {
    return null;
  }

  /** Cloud has no persistent filesystem */
  getFilesystem(): null {
    return null;
  }
}

/* ── Unsupported block stub ──────────────────────────── */

function createUnsupportedStub(
  blockType: string,
  platform: string,
): (block: Block, context: WorkflowContext) => Promise<BlockResult> {
  return async () => {
    throw new Error(
      `"${blockType}" block is not supported on the ${platform} platform. ` +
      "Use the Node.js adapter for filesystem, FTP, and image processing.",
    );
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
