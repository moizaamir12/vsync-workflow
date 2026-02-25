import { useCallback } from "react";
import { cn } from "../../../lib/utils.js";
import { FormField } from "./FormField.js";
import type { DisclosureLevel, WorkflowBlock } from "../../../stores/workflowStore.js";

/* ── Props ────────────────────────────────────────────────────── */

export interface ObjectBlockFormProps {
  block: WorkflowBlock;
  onChange: (logic: Record<string, unknown>) => void;
  level: DisclosureLevel;
}

/* ── Component ────────────────────────────────────────────────── */

export function ObjectBlockForm({ block, onChange, level }: ObjectBlockFormProps) {
  const logic = block.logic;

  const update = useCallback(
    (key: string, value: unknown) => {
      onChange({ [key]: value });
    },
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
      <FormField label="Mode" level={level}>
        <select
          value={(logic["object_mode"] as string) ?? "set"}
          onChange={(e) => update("object_mode", e.target.value)}
          className={inputCn}
        >
          <option value="set">Set properties</option>
          <option value="merge">Merge objects</option>
          <option value="pick">Pick keys</option>
          <option value="omit">Omit keys</option>
        </select>
      </FormField>

      <FormField label="Properties (JSON)" hint="Use $variable syntax for dynamic values" level={level}>
        <textarea
          value={(logic["object_properties"] as string) ?? "{}"}
          onChange={(e) => update("object_properties", e.target.value)}
          placeholder='{ "key": "value" }'
          rows={4}
          className={inputCn}
        />
      </FormField>

      <FormField label="Output Variable" level={level}>
        <input
          type="text"
          value={(logic["object_output"] as string) ?? ""}
          onChange={(e) => update("object_output", e.target.value)}
          placeholder="result"
          className={inputCn}
        />
      </FormField>

      <FormField
        label="Deep Clone"
        hint="Create a deep copy instead of a shallow reference"
        showAt={["advanced"]}
        level={level}
      >
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={(logic["object_deep_clone"] as boolean) ?? false}
            onChange={(e) => update("object_deep_clone", e.target.checked)}
            className="rounded border-[hsl(var(--border))]"
          />
          <span className="text-sm text-[hsl(var(--foreground))]">Enable deep clone</span>
        </label>
      </FormField>
    </div>
  );
}
