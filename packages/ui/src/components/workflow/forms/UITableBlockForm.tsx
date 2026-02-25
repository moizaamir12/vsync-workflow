import { useCallback } from "react";
import { cn } from "../../../lib/utils.js";
import { FormField, FormSection } from "./FormField.js";
import type { DisclosureLevel, WorkflowBlock } from "../../../stores/workflowStore.js";

export interface UITableBlockFormProps {
  block: WorkflowBlock;
  onChange: (logic: Record<string, unknown>) => void;
  level: DisclosureLevel;
}

export function UITableBlockForm({ block, onChange, level }: UITableBlockFormProps) {
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
      <FormSection title="Data Source">
        <FormField label="Data Array" hint="Variable reference to the data array" level={level}>
          <input
            type="text"
            value={(logic["ui_table_data"] as string) ?? ""}
            onChange={(e) => update("ui_table_data", e.target.value)}
            placeholder="$items"
            className={inputCn}
          />
        </FormField>

        <FormField label="Columns (JSON)" hint='[{"key": "name", "label": "Name"}]' level={level}>
          <textarea
            value={(logic["ui_table_columns"] as string) ?? "[]"}
            onChange={(e) => update("ui_table_columns", e.target.value)}
            rows={4}
            className={inputCn}
          />
        </FormField>
      </FormSection>

      <FormSection title="Options">
        <FormField label="Title" level={level}>
          <input
            type="text"
            value={(logic["ui_table_title"] as string) ?? ""}
            onChange={(e) => update("ui_table_title", e.target.value)}
            placeholder="Table Title"
            className={inputCn}
          />
        </FormField>

        <FormField
          label="Searchable"
          showAt={["standard", "advanced"]}
          level={level}
        >
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(logic["ui_table_searchable"] as boolean) ?? false}
              onChange={(e) => update("ui_table_searchable", e.target.checked)}
              className="rounded border-[hsl(var(--border))]"
            />
            <span className="text-sm text-[hsl(var(--foreground))]">Enable search</span>
          </label>
        </FormField>

        <FormField
          label="Sortable"
          showAt={["standard", "advanced"]}
          level={level}
        >
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(logic["ui_table_sortable"] as boolean) ?? true}
              onChange={(e) => update("ui_table_sortable", e.target.checked)}
              className="rounded border-[hsl(var(--border))]"
            />
            <span className="text-sm text-[hsl(var(--foreground))]">Enable sorting</span>
          </label>
        </FormField>

        <FormField
          label="Selectable"
          hint="Allow row selection"
          showAt={["standard", "advanced"]}
          level={level}
        >
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(logic["ui_table_selectable"] as boolean) ?? false}
              onChange={(e) => update("ui_table_selectable", e.target.checked)}
              className="rounded border-[hsl(var(--border))]"
            />
            <span className="text-sm text-[hsl(var(--foreground))]">Allow selection</span>
          </label>
        </FormField>

        <FormField
          label="Page Size"
          showAt={["advanced"]}
          level={level}
        >
          <input
            type="number"
            value={(logic["ui_table_page_size"] as number) ?? 20}
            onChange={(e) => update("ui_table_page_size", Number(e.target.value))}
            min={5}
            max={200}
            className={inputCn}
          />
        </FormField>
      </FormSection>

      <FormField label="Output Variable" hint="Selected rows will be stored here" level={level}>
        <input
          type="text"
          value={(logic["ui_table_output"] as string) ?? ""}
          onChange={(e) => update("ui_table_output", e.target.value)}
          placeholder="selectedRows"
          className={inputCn}
        />
      </FormField>
    </div>
  );
}
