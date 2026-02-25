import { useCallback } from "react";
import { cn } from "../../../lib/utils.js";
import { FormField } from "./FormField.js";
import type { DisclosureLevel, WorkflowBlock } from "../../../stores/workflowStore.js";

export interface ArrayBlockFormProps {
  block: WorkflowBlock;
  onChange: (logic: Record<string, unknown>) => void;
  level: DisclosureLevel;
}

export function ArrayBlockForm({ block, onChange, level }: ArrayBlockFormProps) {
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
          value={(logic["array_operation"] as string) ?? "map"}
          onChange={(e) => update("array_operation", e.target.value)}
          className={inputCn}
        >
          <option value="map">Map</option>
          <option value="filter">Filter</option>
          <option value="reduce">Reduce</option>
          <option value="sort">Sort</option>
          <option value="find">Find</option>
          <option value="flatten">Flatten</option>
          <option value="unique">Unique</option>
          <option value="slice">Slice</option>
          <option value="concat">Concat</option>
          <option value="group_by">Group By</option>
          <option value="pluck">Pluck</option>
        </select>
      </FormField>

      <FormField label="Input Array" hint="Variable reference to the source array" level={level}>
        <input
          type="text"
          value={(logic["array_input"] as string) ?? ""}
          onChange={(e) => update("array_input", e.target.value)}
          placeholder="$items"
          className={inputCn}
        />
      </FormField>

      {["map", "filter", "find", "sort", "group_by", "pluck"].includes(
        (logic["array_operation"] as string) ?? "map",
      ) && (
        <FormField
          label="Expression / Key"
          hint="JavaScript expression — use `item` for each element"
          level={level}
        >
          <textarea
            value={(logic["array_expression"] as string) ?? ""}
            onChange={(e) => update("array_expression", e.target.value)}
            placeholder="item.name"
            rows={2}
            className={inputCn}
          />
        </FormField>
      )}

      {(logic["array_operation"] === "reduce") && (
        <>
          <FormField label="Reducer Expression" level={level}>
            <textarea
              value={(logic["array_reducer"] as string) ?? ""}
              onChange={(e) => update("array_reducer", e.target.value)}
              placeholder="acc + item"
              rows={2}
              className={inputCn}
            />
          </FormField>
          <FormField label="Initial Value" level={level}>
            <input
              type="text"
              value={(logic["array_initial"] as string) ?? "0"}
              onChange={(e) => update("array_initial", e.target.value)}
              className={inputCn}
            />
          </FormField>
        </>
      )}

      {(logic["array_operation"] === "slice") && (
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Start" level={level}>
            <input
              type="number"
              value={(logic["array_start"] as number) ?? 0}
              onChange={(e) => update("array_start", Number(e.target.value))}
              className={inputCn}
            />
          </FormField>
          <FormField label="End" level={level}>
            <input
              type="number"
              value={(logic["array_end"] as number) ?? ""}
              onChange={(e) => update("array_end", e.target.value ? Number(e.target.value) : "")}
              placeholder="∞"
              className={inputCn}
            />
          </FormField>
        </div>
      )}

      <FormField label="Output Variable" level={level}>
        <input
          type="text"
          value={(logic["array_output"] as string) ?? ""}
          onChange={(e) => update("array_output", e.target.value)}
          placeholder="result"
          className={inputCn}
        />
      </FormField>
    </div>
  );
}
