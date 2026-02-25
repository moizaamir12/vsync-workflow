import { useCallback } from "react";
import { cn } from "../../../lib/utils.js";
import { FormField } from "./FormField.js";
import type { DisclosureLevel, WorkflowBlock } from "../../../stores/workflowStore.js";

export interface NormalizeBlockFormProps {
  block: WorkflowBlock;
  onChange: (logic: Record<string, unknown>) => void;
  level: DisclosureLevel;
}

export function NormalizeBlockForm({ block, onChange, level }: NormalizeBlockFormProps) {
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
    <div className="space-y-3">
      <FormField label="Input" level={level}>
        <input
          type="text"
          value={(logic["normalize_input"] as string) ?? ""}
          onChange={(e) => update("normalize_input", e.target.value)}
          placeholder="$data"
          className={inputCn}
        />
      </FormField>

      <FormField label="Rules" hint="JSON array of normalize rules" level={level}>
        <textarea
          value={(logic["normalize_rules"] as string) ?? "[]"}
          onChange={(e) => update("normalize_rules", e.target.value)}
          placeholder='[{"field": "email", "transform": "lowercase"}]'
          rows={4}
          className={inputCn}
        />
      </FormField>

      <FormField
        label="Remove Nulls"
        showAt={["standard", "advanced"]}
        level={level}
      >
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={(logic["normalize_remove_nulls"] as boolean) ?? true}
            onChange={(e) => update("normalize_remove_nulls", e.target.checked)}
            className="rounded border-[hsl(var(--border))]"
          />
          <span className="text-sm text-[hsl(var(--foreground))]">Strip null/undefined values</span>
        </label>
      </FormField>

      <FormField
        label="Trim Strings"
        showAt={["standard", "advanced"]}
        level={level}
      >
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={(logic["normalize_trim"] as boolean) ?? true}
            onChange={(e) => update("normalize_trim", e.target.checked)}
            className="rounded border-[hsl(var(--border))]"
          />
          <span className="text-sm text-[hsl(var(--foreground))]">Trim whitespace from strings</span>
        </label>
      </FormField>

      <FormField label="Output Variable" level={level}>
        <input
          type="text"
          value={(logic["normalize_output"] as string) ?? ""}
          onChange={(e) => update("normalize_output", e.target.value)}
          placeholder="result"
          className={inputCn}
        />
      </FormField>
    </div>
  );
}
