import { useCallback } from "react";
import { cn } from "../../../lib/utils.js";
import { FormField, FormSection } from "./FormField.js";
import type { DisclosureLevel, WorkflowBlock } from "../../../stores/workflowStore.js";

export interface AgentBlockFormProps {
  block: WorkflowBlock;
  onChange: (logic: Record<string, unknown>) => void;
  level: DisclosureLevel;
}

export function AgentBlockForm({ block, onChange, level }: AgentBlockFormProps) {
  const logic = block.logic;

  const update = useCallback(
    (key: string, value: unknown) => onChange({ [key]: value }),
    [onChange],
  );

  const inputCn = cn(
    "w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]",
    "px-3 py-1.5 text-sm font-mono text-[hsl(var(--foreground))]",
    "placeholder:text-[hsl(var(--muted-foreground))]",
    "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]",
  );

  return (
    <div className="space-y-4">
      <FormSection title="Model">
        <FormField label="Provider" level={level}>
          <select
            value={(logic["agent_provider"] as string) ?? "openai"}
            onChange={(e) => update("agent_provider", e.target.value)}
            className={inputCn}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="custom">Custom endpoint</option>
          </select>
        </FormField>

        <FormField label="Model" level={level}>
          <input
            type="text"
            value={(logic["agent_model"] as string) ?? ""}
            onChange={(e) => update("agent_model", e.target.value)}
            placeholder="gpt-4o / claude-3-opus"
            className={inputCn}
          />
        </FormField>

        <FormField
          label="API Key Variable"
          hint="Reference to a secure key — e.g. $secrets.openai_key"
          level={level}
        >
          <input
            type="text"
            value={(logic["agent_api_key"] as string) ?? ""}
            onChange={(e) => update("agent_api_key", e.target.value)}
            placeholder="$secrets.api_key"
            className={inputCn}
          />
        </FormField>
      </FormSection>

      <FormSection title="Prompt">
        <FormField label="System Prompt" level={level}>
          <textarea
            value={(logic["agent_system_prompt"] as string) ?? ""}
            onChange={(e) => update("agent_system_prompt", e.target.value)}
            placeholder="You are a helpful assistant..."
            rows={3}
            className={inputCn}
          />
        </FormField>

        <FormField label="User Prompt" level={level}>
          <textarea
            value={(logic["agent_user_prompt"] as string) ?? ""}
            onChange={(e) => update("agent_user_prompt", e.target.value)}
            placeholder="Analyze the following data: ${'{'}data{'}'}"
            rows={4}
            className={inputCn}
          />
        </FormField>
      </FormSection>

      <FormSection title="Parameters">
        <FormField
          label="Temperature"
          showAt={["standard", "advanced"]}
          level={level}
        >
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={(logic["agent_temperature"] as number) ?? 0.7}
              onChange={(e) => update("agent_temperature", Number(e.target.value))}
              className="flex-1"
            />
            <span className="w-8 text-right text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
              {((logic["agent_temperature"] as number) ?? 0.7).toFixed(1)}
            </span>
          </div>
        </FormField>

        <FormField
          label="Max Tokens"
          showAt={["standard", "advanced"]}
          level={level}
        >
          <input
            type="number"
            value={(logic["agent_max_tokens"] as number) ?? 1024}
            onChange={(e) => update("agent_max_tokens", Number(e.target.value))}
            min={1}
            max={128000}
            className={inputCn}
          />
        </FormField>

        <FormField
          label="Response Format"
          showAt={["advanced"]}
          level={level}
        >
          <select
            value={(logic["agent_response_format"] as string) ?? "text"}
            onChange={(e) => update("agent_response_format", e.target.value)}
            className={inputCn}
          >
            <option value="text">Text</option>
            <option value="json">JSON</option>
          </select>
        </FormField>

        <FormField
          label="Timeout (ms)"
          showAt={["advanced"]}
          level={level}
        >
          <input
            type="number"
            value={(logic["agent_timeout"] as number) ?? 60000}
            onChange={(e) => update("agent_timeout", Number(e.target.value))}
            min={1000}
            max={300000}
            className={inputCn}
          />
        </FormField>
      </FormSection>

      <FormField label="Output Variable" level={level}>
        <input
          type="text"
          value={(logic["agent_output"] as string) ?? ""}
          onChange={(e) => update("agent_output", e.target.value)}
          placeholder="response"
          className={inputCn}
        />
      </FormField>
    </div>
  );
}
