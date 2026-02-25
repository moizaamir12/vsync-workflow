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
import { nodeImageExecutor } from "./blocks/image.js";
import { nodeFilesystemExecutor } from "./blocks/filesystem.js";
import { nodeFtpExecutor } from "./blocks/ftp.js";

/**
 * Node.js / server-side platform adapter.
 *
 * Provides all data blocks, flow blocks, image processing (sharp),
 * filesystem (Node fs), FTP (basic-ftp), and validation (via agent).
 * No camera, no UI, no GPS.
 */
export class NodeAdapter extends PlatformAdapter {
  readonly platform = "node";

  readonly capabilities: PlatformCapabilities = {
    hasCamera: false,
    hasFilesystem: true,
    hasFtp: true,
    hasUi: false,
    hasVideo: false,
    hasLocation: false,
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
    executor.registerHandler("image", nodeImageExecutor);
    executor.registerHandler("filesystem", nodeFilesystemExecutor);
    executor.registerHandler("ftp", nodeFtpExecutor);

    /* Validation — delegates to agent executor with type='validation' */
    executor.registerHandler("validation", createValidationHandler());

    /* Video — not implemented in V1 */
    executor.registerHandler("video", createVideoStub());
  }

  /** Node.js has no GPS — return null */
  getLocation(): null {
    return null;
  }

  /** Node.js filesystem adapter is built into the filesystem block */
  getFilesystem(): typeof import("node:fs/promises") | null {
    /* Return the module reference; callers can use it for advanced ops */
    return null;
  }
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
