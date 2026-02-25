import { streamText, type CoreMessage, type ToolResultPart, type Tool } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { Block, TriggerType, TriggerConfig } from "@vsync/shared-types";
import { buildSystemPrompt, resolveModelId } from "./system-prompt.js";
import { getBlockDocsTool, getPatternDocsTool, getExampleTool } from "./tools/getDocs.js";
import {
  createAddBlockTool,
  createUpdateBlockTool,
  createRemoveBlockTool,
  createReorderBlocksTool,
  createSetTriggerTool,
  type WorkflowState,
} from "./tools/editWorkflow.js";
import { createPlanTool } from "./tools/createPlan.js";
import type { DesignerEvent } from "./events.js";

/* ── Options ──────────────────────────────────────────── */

export interface WorkflowDesignerOptions {
  /** AI provider API key */
  apiKey: string;

  /** Model identifier — defaults to Claude Sonnet */
  model?: string;

  /** Maximum tool-use rounds before stopping */
  maxToolRoundtrips?: number;
}

/** Existing workflow to edit (passed to generateWorkflow). */
export interface ExistingWorkflow {
  blocks: Block[];
  triggerType?: TriggerType;
  triggerConfig?: TriggerConfig;
}

/* ── Designer ─────────────────────────────────────────── */

/**
 * AI-powered workflow designer.
 * Creates, edits, explains, and improves automation workflows
 * using streaming tool-call interactions with an LLM.
 */
export class WorkflowDesigner {
  private readonly apiKey: string;
  private readonly modelId: string;
  private readonly maxToolRoundtrips: number;
  private readonly systemPrompt: string;

  constructor(options: WorkflowDesignerOptions) {
    this.apiKey = options.apiKey;
    this.modelId = resolveModelId(options.model ?? "claude-sonnet-4-20250514");
    this.maxToolRoundtrips = options.maxToolRoundtrips ?? 10;
    this.systemPrompt = buildSystemPrompt();
  }

  /**
   * Generate or edit a workflow from a natural-language prompt.
   * Yields DesignerEvents as the AI works so the UI can show live progress.
   */
  async *generateWorkflow(
    prompt: string,
    existingWorkflow?: ExistingWorkflow,
  ): AsyncGenerator<DesignerEvent> {
    /* Mutable state the AI tools mutate */
    const state: WorkflowState = {
      blocks: existingWorkflow?.blocks ? structuredClone(existingWorkflow.blocks) : [],
      triggerType: existingWorkflow?.triggerType ?? "interactive",
      triggerConfig: existingWorkflow?.triggerConfig ?? {},
    };

    /* Build the tool set — edit tools are closures over state */
    const tools: Record<string, Tool> = {
      get_block_docs: getBlockDocsTool,
      get_pattern_docs: getPatternDocsTool,
      get_example: getExampleTool,
      create_plan: createPlanTool,
      add_block: createAddBlockTool(state),
      update_block: createUpdateBlockTool(state),
      remove_block: createRemoveBlockTool(state),
      reorder_blocks: createReorderBlocksTool(state),
      set_trigger: createSetTriggerTool(state),
    };

    /* Build messages */
    const messages: CoreMessage[] = [];

    if (existingWorkflow) {
      messages.push({
        role: "user",
        content: `Here is the current workflow:\n\`\`\`json\n${JSON.stringify(
          {
            triggerType: state.triggerType,
            triggerConfig: state.triggerConfig,
            blocks: state.blocks,
          },
          null,
          2,
        )}\n\`\`\`\n\nRequest: ${prompt}`,
      });
    } else {
      messages.push({ role: "user", content: prompt });
    }

    /* Resolve the AI provider */
    const model = this.resolveModel();

    /* Streaming tool-use loop */
    let roundtrip = 0;
    let blocksModified = 0;

    while (roundtrip < this.maxToolRoundtrips) {
      roundtrip++;

      const result = streamText({
        model,
        system: this.systemPrompt,
        messages,
        tools,
        maxSteps: 1,
      });

      let hasToolCalls = false;
      let assistantText = "";

      /* Stream text chunks as "thinking" events */
      for await (const part of result.textStream) {
        if (part) {
          assistantText += part;
          yield { type: "thinking", data: { text: part } };
        }
      }

      /* Process tool calls from the full result */
      const fullResult = await result;
      const responseMessages = await fullResult.response;
      const lastMessage = responseMessages.messages[responseMessages.messages.length - 1];

      if (!lastMessage || lastMessage.role !== "assistant") {
        break;
      }

      /* Check for tool calls in the assistant message */
      const toolCallParts = Array.isArray(lastMessage.content)
        ? lastMessage.content.filter(
            (p): p is { type: "tool-call"; toolCallId: string; toolName: string; args: Record<string, unknown> } =>
              typeof p === "object" && p !== null && "type" in p && p.type === "tool-call",
          )
        : [];

      if (toolCallParts.length === 0) {
        /* No tool calls — AI is done */
        break;
      }

      hasToolCalls = true;

      /* Add assistant message to history */
      messages.push(lastMessage);

      /* Execute tool calls and yield events */
      const toolResults: ToolResultPart[] = [];

      for (const tc of toolCallParts) {
        /* Emit events based on tool type */
        if (tc.toolName === "create_plan") {
          const planResult = tc.args as unknown as { planId: string; steps: string[] };
          yield {
            type: "plan",
            data: { planId: planResult.planId ?? `plan_${Date.now()}`, steps: planResult.steps ?? [] },
          };
        }

        if (
          tc.toolName === "add_block" ||
          tc.toolName === "update_block" ||
          tc.toolName === "remove_block" ||
          tc.toolName === "reorder_blocks" ||
          tc.toolName === "set_trigger"
        ) {
          blocksModified++;
          yield {
            type: "edit",
            data: {
              operation: tc.toolName as "add_block" | "update_block" | "remove_block" | "reorder_blocks" | "set_trigger",
              blockId: (tc.args as Record<string, unknown>).blockId as string | undefined,
              blockType: (tc.args as Record<string, unknown>).type as string | undefined,
              changes: (tc.args as Record<string, unknown>).changes as
                | Record<string, unknown>
                | undefined,
            },
          };
        }

        /* The AI SDK tool execution already happened in streamText via `execute`.
         * But since we're manually managing the roundtrip loop, we need to
         * find the tool result from the response messages. */
        const toolResultMsg = responseMessages.messages.find(
          (m) =>
            m.role === "tool" &&
            Array.isArray(m.content) &&
            m.content.some(
              (c) =>
                typeof c === "object" &&
                c !== null &&
                "type" in c &&
                c.type === "tool-result" &&
                "toolCallId" in c &&
                c.toolCallId === tc.toolCallId,
            ),
        );

        if (toolResultMsg && Array.isArray(toolResultMsg.content)) {
          /* Add the tool result message to conversation */
          messages.push(toolResultMsg);
        }
      }

      if (!hasToolCalls) {
        break;
      }
    }

    /* Final event */
    yield {
      type: "complete",
      data: {
        summary: `Workflow updated: ${state.blocks.length} blocks, trigger: ${state.triggerType}`,
        blocksModified,
      },
    };
  }

  /**
   * Get the current state of the workflow after generation.
   * Call this after consuming the generateWorkflow generator.
   */
  getTools(state: WorkflowState): Record<string, Tool> {
    return {
      get_block_docs: getBlockDocsTool,
      get_pattern_docs: getPatternDocsTool,
      get_example: getExampleTool,
      create_plan: createPlanTool,
      add_block: createAddBlockTool(state),
      update_block: createUpdateBlockTool(state),
      remove_block: createRemoveBlockTool(state),
      reorder_blocks: createReorderBlocksTool(state),
      set_trigger: createSetTriggerTool(state),
    };
  }

  /* ── Provider resolution ────────────────────────────── */

  private resolveModel() {
    if (this.modelId.startsWith("claude") || this.modelId.startsWith("anthropic")) {
      const anthropic = createAnthropic({ apiKey: this.apiKey });
      return anthropic(this.modelId);
    }

    if (this.modelId.startsWith("gpt") || this.modelId.startsWith("o1") || this.modelId.startsWith("o3")) {
      const openai = createOpenAI({ apiKey: this.apiKey });
      return openai(this.modelId);
    }

    /* Default to Anthropic */
    const anthropic = createAnthropic({ apiKey: this.apiKey });
    return anthropic(this.modelId);
  }
}
