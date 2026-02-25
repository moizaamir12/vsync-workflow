import { tool } from "ai";
import { z } from "zod";
import { validateBlock, getBlockDefaults } from "@vsync/blocks";
import type { Block, BlockType, TriggerType, TriggerConfig } from "@vsync/shared-types";

/**
 * Mutable workflow state managed by the WorkflowDesigner.
 * Tools mutate this directly; the designer emits events for each change.
 */
export interface WorkflowState {
  blocks: Block[];
  triggerType: TriggerType;
  triggerConfig: TriggerConfig;
}

/**
 * add_block — adds a new block to the workflow.
 * Validates against the block schema before accepting.
 */
export function createAddBlockTool(state: WorkflowState) {
  return tool({
    description:
      "Add a new block to the workflow. Provide the block type, name, logic, and optionally conditions and notes. The block is validated before being added.",
    parameters: z.object({
      id: z.string().describe("Unique block identifier (e.g. 'fetch_api_data')"),
      name: z.string().describe("Human-readable block name"),
      type: z.string().describe("Block type (e.g. 'fetch', 'code', 'ui_form')"),
      logic: z
        .record(z.unknown())
        .describe("Block logic — type-specific key-value configuration"),
      conditions: z
        .array(
          z.object({
            left: z.string(),
            operator: z.string(),
            right: z.string(),
          }),
        )
        .optional()
        .describe("Optional guard conditions (AND logic)"),
      notes: z.string().optional().describe("Optional documentation note"),
      order: z
        .number()
        .optional()
        .describe("Execution order (defaults to end of list)"),
    }),
    execute: async ({ id, name, type, logic, conditions, notes, order }) => {
      /* Merge defaults with provided logic */
      const blockType = type as BlockType;
      let mergedLogic: Record<string, unknown>;

      try {
        const defaults = getBlockDefaults(blockType);
        mergedLogic = { ...defaults, ...logic };
      } catch {
        mergedLogic = { ...logic };
      }

      const blockOrder = order ?? state.blocks.length;

      const block: Block = {
        id,
        workflowId: "",
        workflowVersion: 0,
        name,
        type: blockType,
        logic: mergedLogic,
        conditions: conditions as Block["conditions"],
        order: blockOrder,
        notes,
      };

      /* Validate */
      const validation = validateBlock(block);
      if (validation.errors.length > 0) {
        return {
          success: false as const,
          errors: validation.errors,
          warnings: validation.warnings,
          suggestions: validation.suggestions,
        };
      }

      state.blocks.push(block);

      return {
        success: true as const,
        blockId: id,
        warnings: validation.warnings,
        suggestions: validation.suggestions,
      };
    },
  });
}

/**
 * update_block — modifies an existing block's properties.
 */
export function createUpdateBlockTool(state: WorkflowState) {
  return tool({
    description:
      "Update an existing block's properties. Provide the block ID and only the fields you want to change.",
    parameters: z.object({
      blockId: z.string().describe("ID of the block to update"),
      changes: z
        .record(z.unknown())
        .describe("Fields to update in the block's logic"),
      name: z.string().optional().describe("New block name"),
      notes: z.string().optional().describe("New block notes"),
      conditions: z
        .array(
          z.object({
            left: z.string(),
            operator: z.string(),
            right: z.string(),
          }),
        )
        .optional()
        .describe("Replace guard conditions"),
    }),
    execute: async ({ blockId, changes, name, notes, conditions }) => {
      const idx = state.blocks.findIndex((b) => b.id === blockId);
      if (idx === -1) {
        return {
          success: false as const,
          errors: [`Block not found: "${blockId}"`],
        };
      }

      const block = state.blocks[idx];
      const beforeLogic = { ...block.logic };

      /* Apply changes */
      const updatedLogic = { ...block.logic, ...changes };
      const updatedBlock: Block = {
        ...block,
        logic: updatedLogic,
        ...(name !== undefined ? { name } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(conditions !== undefined
          ? { conditions: conditions as Block["conditions"] }
          : {}),
      };

      /* Validate */
      const validation = validateBlock(updatedBlock);
      if (validation.errors.length > 0) {
        return {
          success: false as const,
          errors: validation.errors,
          warnings: validation.warnings,
          suggestions: validation.suggestions,
        };
      }

      state.blocks[idx] = updatedBlock;

      /* Build diff */
      const diff: Record<string, { before: unknown; after: unknown }> = {};
      for (const key of Object.keys(changes)) {
        if (beforeLogic[key] !== updatedLogic[key]) {
          diff[key] = { before: beforeLogic[key], after: updatedLogic[key] };
        }
      }

      return {
        success: true as const,
        blockId,
        diff,
        warnings: validation.warnings,
        suggestions: validation.suggestions,
      };
    },
  });
}

/**
 * remove_block — removes a block from the workflow.
 */
export function createRemoveBlockTool(state: WorkflowState) {
  return tool({
    description: "Remove a block from the workflow by its ID.",
    parameters: z.object({
      blockId: z.string().describe("ID of the block to remove"),
    }),
    execute: async ({ blockId }) => {
      const idx = state.blocks.findIndex((b) => b.id === blockId);
      if (idx === -1) {
        return {
          success: false as const,
          errors: [`Block not found: "${blockId}"`],
        };
      }

      state.blocks.splice(idx, 1);

      /* Re-number remaining blocks */
      state.blocks.forEach((b, i) => {
        b.order = i;
      });

      return { success: true as const };
    },
  });
}

/**
 * reorder_blocks — change the execution order of blocks.
 */
export function createReorderBlocksTool(state: WorkflowState) {
  return tool({
    description:
      "Reorder blocks by providing an array of block IDs in the desired execution order.",
    parameters: z.object({
      blockIds: z
        .array(z.string())
        .describe("Block IDs in desired execution order"),
    }),
    execute: async ({ blockIds }) => {
      const blockMap = new Map(state.blocks.map((b) => [b.id, b]));

      /* Verify all IDs exist */
      const missing = blockIds.filter((id) => !blockMap.has(id));
      if (missing.length > 0) {
        return {
          success: false as const,
          errors: [`Unknown block IDs: ${missing.join(", ")}`],
        };
      }

      /* Reorder */
      const reordered: Block[] = [];
      for (let i = 0; i < blockIds.length; i++) {
        const block = blockMap.get(blockIds[i])!;
        block.order = i;
        reordered.push(block);
      }

      /* Append any blocks not in the list */
      for (const block of state.blocks) {
        if (!blockIds.includes(block.id)) {
          block.order = reordered.length;
          reordered.push(block);
        }
      }

      state.blocks = reordered;

      return { success: true as const };
    },
  });
}

/**
 * set_trigger — configure the workflow trigger.
 */
export function createSetTriggerTool(state: WorkflowState) {
  return tool({
    description:
      "Set the workflow trigger type and configuration. Trigger types: interactive, api, schedule, hook, vision.",
    parameters: z.object({
      triggerType: z
        .enum(["interactive", "api", "schedule", "hook", "vision"])
        .describe("Trigger type"),
      triggerConfig: z
        .record(z.unknown())
        .optional()
        .describe("Trigger-specific config (schedule_cron, hook_url, etc.)"),
    }),
    execute: async ({ triggerType, triggerConfig }) => {
      state.triggerType = triggerType;
      if (triggerConfig) {
        state.triggerConfig = triggerConfig as TriggerConfig;
      }

      return { success: true as const, triggerType };
    },
  });
}
