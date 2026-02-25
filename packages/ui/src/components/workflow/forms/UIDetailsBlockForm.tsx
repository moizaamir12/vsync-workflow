import { useCallback } from "react";
import { cn } from "../../../lib/utils.js";
import { FormField, FormSection } from "./FormField.js";
import type { DisclosureLevel, WorkflowBlock } from "../../../stores/workflowStore.js";

export interface UIDetailsBlockFormProps {
  block: WorkflowBlock;
  onChange: (logic: Record<string, unknown>) => void;
  level: DisclosureLevel;
}

export function UIDetailsBlockForm({ block, onChange, level }: UIDetailsBlockFormProps) {
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
      <FormSection title="Content">
        <FormField label="Title" level={level}>
          <input
            type="text"
            value={(logic["ui_details_title"] as string) ?? ""}
            onChange={(e) => update("ui_details_title", e.target.value)}
            placeholder="Item Details"
            className={inputCn}
          />
        </FormField>

        <FormField label="Data Source" hint="Variable reference to the object to display" level={level}>
          <input
            type="text"
            value={(logic["ui_details_data"] as string) ?? ""}
            onChange={(e) => update("ui_details_data", e.target.value)}
            placeholder="$item"
            className={inputCn}
          />
        </FormField>

        <FormField label="Fields (JSON)" hint='[{"key": "name", "label": "Name"}]' level={level}>
          <textarea
            value={(logic["ui_details_fields"] as string) ?? "[]"}
            onChange={(e) => update("ui_details_fields", e.target.value)}
            rows={4}
            className={inputCn}
          />
        </FormField>
      </FormSection>

      <FormSection title="Layout">
        <FormField label="Layout Mode" showAt={["standard", "advanced"]} level={level}>
          <select
            value={(logic["ui_details_layout"] as string) ?? "vertical"}
            onChange={(e) => update("ui_details_layout", e.target.value)}
            className={inputCn}
          >
            <option value="vertical">Vertical list</option>
            <option value="grid">Grid</option>
            <option value="card">Card</option>
          </select>
        </FormField>

        <FormField label="Show Header Image" showAt={["standard", "advanced"]} level={level}>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(logic["ui_details_show_image"] as boolean) ?? false}
              onChange={(e) => update("ui_details_show_image", e.target.checked)}
              className="rounded border-[hsl(var(--border))]"
            />
            <span className="text-sm text-[hsl(var(--foreground))]">Display header image</span>
          </label>
        </FormField>

        {(logic["ui_details_show_image"] as boolean) && (
          <FormField label="Image Field" level={level}>
            <input
              type="text"
              value={(logic["ui_details_image_field"] as string) ?? ""}
              onChange={(e) => update("ui_details_image_field", e.target.value)}
              placeholder="imageUrl"
              className={inputCn}
            />
          </FormField>
        )}
      </FormSection>

      <FormSection title="Actions">
        <FormField label="Action Buttons (JSON)" hint='[{"label": "Edit", "action": "edit"}]' showAt={["standard", "advanced"]} level={level}>
          <textarea
            value={(logic["ui_details_actions"] as string) ?? "[]"}
            onChange={(e) => update("ui_details_actions", e.target.value)}
            rows={3}
            className={inputCn}
          />
        </FormField>
      </FormSection>

      <FormField label="Output Variable" hint="User action result" level={level}>
        <input
          type="text"
          value={(logic["ui_details_output"] as string) ?? ""}
          onChange={(e) => update("ui_details_output", e.target.value)}
          placeholder="actionResult"
          className={inputCn}
        />
      </FormField>
    </div>
  );
}
