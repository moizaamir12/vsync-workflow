import { useCallback } from "react";
import { cn } from "../../../lib/utils.js";
import { FormField } from "./FormField.js";
import { useWorkflowStore } from "../../../stores/workflowStore.js";
import type { DisclosureLevel, WorkflowBlock } from "../../../stores/workflowStore.js";

export interface GotoBlockFormProps {
  block: WorkflowBlock;
  onChange: (logic: Record<string, unknown>) => void;
  level: DisclosureLevel;
}

export function GotoBlockForm({ block, onChange, level }: GotoBlockFormProps) {
  const logic = block.logic;
  const blocks = useWorkflowStore((s) => s.blocks);

  const update = useCallback(
    (key: string, value: unknown) => onChange({ [key]: value }),
    [onChange],
  );

  /* Filter out the current block from the target list */
  const targetOptions = blocks.filter((b) => b.id !== block.id);

  const inputCn = cn(
    "w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]",
    "px-3 py-1.5 text-sm font-mono text-[hsl(var(--foreground))]",
    "placeholder:text-[hsl(var(--muted-foreground))]",
    "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]",
  );

  return (
    <div className="space-y-3">
      <FormField label="Target Block" hint="The block to jump to" level={level}>
        <select
          value={(logic["goto_target"] as string) ?? ""}
          onChange={(e) => update("goto_target", e.target.value)}
          className={inputCn}
        >
          <option value="">Select a block…</option>
          {targetOptions.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.type})
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        label="Max Iterations"
        hint="Prevent infinite loops by limiting jumps"
        showAt={["standard", "advanced"]}
        level={level}
      >
        <input
          type="number"
          value={(logic["goto_max_iterations"] as number) ?? 100}
          onChange={(e) => update("goto_max_iterations", Number(e.target.value))}
          min={1}
          max={10000}
          className={inputCn}
        />
      </FormField>

      <FormField
        label="Reset Context"
        hint="Clear block outputs when jumping back"
        showAt={["advanced"]}
        level={level}
      >
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={(logic["goto_reset_context"] as boolean) ?? false}
            onChange={(e) => update("goto_reset_context", e.target.checked)}
            className="rounded border-[hsl(var(--border))]"
          />
          <span className="text-sm text-[hsl(var(--foreground))]">Reset context on jump</span>
        </label>
      </FormField>
    </div>
  );
}
