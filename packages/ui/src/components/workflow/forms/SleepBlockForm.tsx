import { useCallback } from "react";
import { cn } from "../../../lib/utils.js";
import { FormField } from "./FormField.js";
import type { DisclosureLevel, WorkflowBlock } from "../../../stores/workflowStore.js";

export interface SleepBlockFormProps {
  block: WorkflowBlock;
  onChange: (logic: Record<string, unknown>) => void;
  level: DisclosureLevel;
}

export function SleepBlockForm({ block, onChange, level }: SleepBlockFormProps) {
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
      <FormField label="Duration" level={level}>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={(logic["sleep_duration"] as number) ?? 1}
            onChange={(e) => update("sleep_duration", Number(e.target.value))}
            min={0}
            className={cn(inputCn, "flex-1")}
          />
          <select
            value={(logic["sleep_unit"] as string) ?? "seconds"}
            onChange={(e) => update("sleep_unit", e.target.value)}
            className={cn(inputCn, "w-32")}
          >
            <option value="milliseconds">ms</option>
            <option value="seconds">sec</option>
            <option value="minutes">min</option>
            <option value="hours">hr</option>
          </select>
        </div>
      </FormField>

      <FormField
        label="Dynamic Duration"
        hint="Override with a variable — e.g. $waitTime"
        showAt={["advanced"]}
        level={level}
      >
        <input
          type="text"
          value={(logic["sleep_dynamic"] as string) ?? ""}
          onChange={(e) => update("sleep_dynamic", e.target.value)}
          placeholder="$waitTime"
          className={inputCn}
        />
      </FormField>

      <FormField
        label="Cancellable"
        hint="Allow the wait to be cancelled by external events"
        showAt={["advanced"]}
        level={level}
      >
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={(logic["sleep_cancellable"] as boolean) ?? true}
            onChange={(e) => update("sleep_cancellable", e.target.checked)}
            className="rounded border-[hsl(var(--border))]"
          />
          <span className="text-sm text-[hsl(var(--foreground))]">Allow cancellation</span>
        </label>
      </FormField>
    </div>
  );
}
