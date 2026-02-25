import type { Block, WorkflowContext } from "@vsync/shared-types";
import type { BlockHandler, BlockResult, ErrorStrategy } from "../types.js";

/**
 * Routes block execution to registered handlers.
 *
 * Each block type maps to a handler function. The executor
 * looks up the handler by `block.type`, invokes it, and returns
 * the result. If no handler is found, execution fails with a
 * clear error message indicating the missing adapter.
 *
 * Error handling is controlled per-block via the `on_error` logic
 * property: 'continue' logs and moves on, 'abort' halts the run.
 */
export class BlockExecutor {
  private readonly handlers = new Map<string, BlockHandler>();

  /**
   * Register a handler for a specific block type.
   * Overwrites any previously registered handler.
   */
  registerHandler(blockType: string, handler: BlockHandler): void {
    this.handlers.set(blockType, handler);
  }

  /**
   * Check if a handler is registered for a given block type.
   */
  hasHandler(blockType: string): boolean {
    return this.handlers.has(blockType);
  }

  /**
   * Execute a block by delegating to its registered handler.
   *
   * @param block   — the block to execute
   * @param context — the current workflow context
   * @returns the block result with deltas
   * @throws if no handler is registered (and on_error !== 'continue')
   */
  async execute(block: Block, context: WorkflowContext): Promise<BlockResult> {
    const handler = this.handlers.get(block.type);

    if (!handler) {
      throw new Error(
        `No handler registered for block type "${block.type}". ` +
        `Register one via blockExecutor.registerHandler("${block.type}", handler) ` +
        `or use a PlatformAdapter that supports this block type.`,
      );
    }

    const result = await handler(block, context);
    return result ?? {};
  }

  /**
   * Determine the error strategy for a block.
   * Reads from `block.logic.on_error`, defaulting to 'abort'.
   */
  getErrorStrategy(block: Block): ErrorStrategy {
    const strategy = block.logic?.on_error;
    if (strategy === "continue") return "continue";
    return "abort";
  }

  /**
   * Get a list of all registered block types.
   * Useful for debugging and capability reporting.
   */
  getRegisteredTypes(): string[] {
    return [...this.handlers.keys()];
  }
}
