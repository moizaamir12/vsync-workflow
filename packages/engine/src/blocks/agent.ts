import type { Block, WorkflowContext } from "@vsync/shared-types";
import type { BlockResult } from "../types.js";
import { ContextManager } from "../core/ContextManager.js";

/**
 * Configuration passed to PlatformAdapter.runModel().
 * Platform adapters implement this using their preferred AI SDK.
 */
export interface ModelConfig {
  type: "text" | "media" | "validation";
  model: string;
  prompt: string;
  input?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

/**
 * Response shape returned by PlatformAdapter.runModel().
 */
export interface ModelResponse {
  result: string | Record<string, unknown>;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * AI/LLM Agent block executor.
 *
 * Delegates actual model invocation to the platform adapter via
 * context.run.platform. The agent block resolves all dynamic inputs,
 * builds the model config, and formats the response.
 *
 * Binding: agent_bind_value → $state.key
 */
export async function agentExecutor(
  block: Block,
  context: WorkflowContext,
  adapter?: { runModel: (config: ModelConfig) => Promise<ModelResponse> },
): Promise<BlockResult> {
  const cm = new ContextManager();
  const logic = block.logic;

  const agentType = resolveDynamic(cm, logic.agent_type, context) as string ?? "text";
  const model = String(resolveDynamic(cm, logic.agent_model, context) ?? "");
  const prompt = String(resolveDynamic(cm, logic.agent_prompt, context) ?? "");
  const input = resolveDynamic(cm, logic.agent_input, context);
  const temperature = resolveDynamic(cm, logic.agent_temperature, context);
  const maxTokens = resolveDynamic(cm, logic.agent_max_tokens, context);
  const jsonMode = resolveDynamic(cm, logic.agent_json_mode, context) === true;
  const extendedResponse = resolveDynamic(cm, logic.agent_extended_response, context) === true;

  if (!model) throw new Error("agent_model is required");
  if (!prompt) throw new Error("agent_prompt is required");

  if (!adapter) {
    throw new Error(
      "Agent block requires a platform adapter with runModel(). " +
      "No adapter was provided.",
    );
  }

  const config: ModelConfig = {
    type: agentType as ModelConfig["type"],
    model,
    prompt,
    input: input !== undefined && input !== null ? String(input) : undefined,
    temperature: temperature !== undefined && temperature !== null ? Number(temperature) : undefined,
    maxTokens: maxTokens !== undefined && maxTokens !== null ? Number(maxTokens) : undefined,
    jsonMode,
  };

  const response = await adapter.runModel(config);

  /* Format result based on agent type */
  let result: unknown;

  if (agentType === "validation") {
    /* Validation type returns { valid, error? } structure */
    result = response.result;
  } else if (jsonMode && typeof response.result === "string") {
    /* Parse JSON from string response when json_mode is on */
    try {
      result = JSON.parse(response.result);
    } catch {
      result = response.result;
    }
  } else {
    result = response.result;
  }

  /* Optionally include usage metadata */
  if (extendedResponse) {
    result = {
      result,
      usage: response.usage,
    };
  }

  const bindTo = logic.agent_bind_value as string | undefined;
  if (bindTo) {
    return { stateDelta: { [extractBindKey(bindTo)]: result } };
  }
  return {};
}

/* ── Helpers ──────────────────────────────────────────── */

function resolveDynamic(
  cm: ContextManager,
  value: unknown,
  context: WorkflowContext,
): unknown {
  return cm.resolveValue(value, context);
}

function extractBindKey(bindTo: string): string {
  if (bindTo.startsWith("$state.")) return bindTo.slice(7);
  return bindTo;
}
