import type { BlockSchema } from "./types.js";

export const AGENT_SCHEMA: BlockSchema = {
  required: ["agent_model", "agent_prompt"],
  optional: {
    agent_type: {
      default: "text",
      enum: ["text", "media", "validation"],
    },
    agent_input: { default: null },
    agent_temperature: { default: null },
    agent_max_tokens: { default: null },
    agent_json_mode: { default: false },
    agent_extended_response: { default: false },
    agent_bind_value: { default: null },
  },
  commonMistakes: {
    model: "agent_model",
    prompt: "agent_prompt",
    input: "agent_input",
    type: "agent_type",
    temperature: "agent_temperature",
    max_tokens: "agent_max_tokens",
    bind_value: "agent_bind_value",
  },
} as const;
