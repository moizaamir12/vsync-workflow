import { useCallback } from "react";
import { cn } from "../../../lib/utils.js";
import { FormField } from "./FormField.js";
import type { DisclosureLevel, WorkflowBlock } from "../../../stores/workflowStore.js";

export interface DateBlockFormProps {
  block: WorkflowBlock;
  onChange: (logic: Record<string, unknown>) => void;
  level: DisclosureLevel;
}

export function DateBlockForm({ block, onChange, level }: DateBlockFormProps) {
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
      <FormField label="Operation" level={level}>
        <select
          value={(logic["date_operation"] as string) ?? "now"}
          onChange={(e) => update("date_operation", e.target.value)}
          className={inputCn}
        >
          <option value="now">Current date/time</option>
          <option value="parse">Parse date string</option>
          <option value="format">Format date</option>
          <option value="add">Add duration</option>
          <option value="subtract">Subtract duration</option>
          <option value="diff">Difference between dates</option>
          <option value="start_of">Start of period</option>
          <option value="end_of">End of period</option>
        </select>
      </FormField>

      {["parse", "format", "add", "subtract", "start_of", "end_of"].includes(
        (logic["date_operation"] as string) ?? "",
      ) && (
        <FormField label="Input Date" level={level}>
          <input
            type="text"
            value={(logic["date_input"] as string) ?? ""}
            onChange={(e) => update("date_input", e.target.value)}
            placeholder="$timestamp or ISO string"
            className={inputCn}
          />
        </FormField>
      )}

      {(logic["date_operation"] === "format") && (
        <FormField label="Format Pattern" hint="e.g. YYYY-MM-DD HH:mm:ss" level={level}>
          <input
            type="text"
            value={(logic["date_format"] as string) ?? ""}
            onChange={(e) => update("date_format", e.target.value)}
            placeholder="YYYY-MM-DD"
            className={inputCn}
          />
        </FormField>
      )}

      {["add", "subtract"].includes((logic["date_operation"] as string) ?? "") && (
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Amount" level={level}>
            <input
              type="number"
              value={(logic["date_amount"] as number) ?? 1}
              onChange={(e) => update("date_amount", Number(e.target.value))}
              className={inputCn}
            />
          </FormField>
          <FormField label="Unit" level={level}>
            <select
              value={(logic["date_unit"] as string) ?? "days"}
              onChange={(e) => update("date_unit", e.target.value)}
              className={inputCn}
            >
              <option value="seconds">Seconds</option>
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
              <option value="weeks">Weeks</option>
              <option value="months">Months</option>
              <option value="years">Years</option>
            </select>
          </FormField>
        </div>
      )}

      {(logic["date_operation"] === "diff") && (
        <>
          <FormField label="Start Date" level={level}>
            <input
              type="text"
              value={(logic["date_start"] as string) ?? ""}
              onChange={(e) => update("date_start", e.target.value)}
              placeholder="$startDate"
              className={inputCn}
            />
          </FormField>
          <FormField label="End Date" level={level}>
            <input
              type="text"
              value={(logic["date_end"] as string) ?? ""}
              onChange={(e) => update("date_end", e.target.value)}
              placeholder="$endDate"
              className={inputCn}
            />
          </FormField>
          <FormField label="Diff Unit" level={level}>
            <select
              value={(logic["date_diff_unit"] as string) ?? "days"}
              onChange={(e) => update("date_diff_unit", e.target.value)}
              className={inputCn}
            >
              <option value="milliseconds">Milliseconds</option>
              <option value="seconds">Seconds</option>
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </FormField>
        </>
      )}

      <FormField
        label="Timezone"
        showAt={["advanced"]}
        level={level}
      >
        <input
          type="text"
          value={(logic["date_timezone"] as string) ?? ""}
          onChange={(e) => update("date_timezone", e.target.value)}
          placeholder="UTC, America/New_York, etc."
          className={inputCn}
        />
      </FormField>

      <FormField label="Output Variable" level={level}>
        <input
          type="text"
          value={(logic["date_output"] as string) ?? ""}
          onChange={(e) => update("date_output", e.target.value)}
          placeholder="result"
          className={inputCn}
        />
      </FormField>
    </div>
  );
}
