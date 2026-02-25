import { useCallback } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { cn } from "../../../lib/utils.js";
import { FormField, FormSection } from "./FormField.js";
import type { DisclosureLevel, WorkflowBlock } from "../../../stores/workflowStore.js";

export interface UIFormBlockFormProps {
  block: WorkflowBlock;
  onChange: (logic: Record<string, unknown>) => void;
  level: DisclosureLevel;
}

interface FormFieldDef {
  id: string;
  name: string;
  type: string;
  label: string;
  required: boolean;
  placeholder?: string;
}

export function UIFormBlockForm({ block, onChange, level }: UIFormBlockFormProps) {
  const logic = block.logic;

  const update = useCallback(
    (key: string, value: unknown) => onChange({ [key]: value }),
    [onChange],
  );

  const fields: FormFieldDef[] = (logic["ui_form_fields"] as FormFieldDef[]) ?? [];

  const addField = useCallback(() => {
    const id = `field_${Date.now().toString(36)}`;
    update("ui_form_fields", [...fields, {
      id, name: "", type: "text", label: "", required: false, placeholder: "",
    }]);
  }, [fields, update]);

  const removeField = useCallback(
    (index: number) => {
      update("ui_form_fields", fields.filter((_, i) => i !== index));
    },
    [fields, update],
  );

  const updateField = useCallback(
    (index: number, patch: Partial<FormFieldDef>) => {
      update("ui_form_fields", fields.map((f, i) =>
        i === index ? { ...f, ...patch } : f,
      ));
    },
    [fields, update],
  );

  const inputCn = cn(
    "w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]",
    "px-3 py-1.5 text-sm font-mono text-[hsl(var(--foreground))]",
    "placeholder:text-[hsl(var(--muted-foreground))]",
    "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]",
  );

  return (
    <div className="space-y-4">
      <FormSection title="Form Settings">
        <FormField label="Title" level={level}>
          <input
            type="text"
            value={(logic["ui_form_title"] as string) ?? ""}
            onChange={(e) => update("ui_form_title", e.target.value)}
            placeholder="Enter Information"
            className={inputCn}
          />
        </FormField>

        <FormField label="Submit Button Text" level={level}>
          <input
            type="text"
            value={(logic["ui_form_submit_text"] as string) ?? ""}
            onChange={(e) => update("ui_form_submit_text", e.target.value)}
            placeholder="Submit"
            className={inputCn}
          />
        </FormField>
      </FormSection>

      <FormSection title="Fields">
        <div className="space-y-2">
          {fields.map((field, i) => (
            <div
              key={field.id}
              className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2.5"
            >
              <div className="mb-2 flex items-center gap-1.5">
                <GripVertical className="h-3.5 w-3.5 cursor-grab text-[hsl(var(--muted-foreground))]" />
                <span className="flex-1 text-xs font-medium text-[hsl(var(--foreground))]">
                  Field {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeField(i)}
                  className="rounded p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={field.name}
                  onChange={(e) => updateField(i, { name: e.target.value })}
                  placeholder="Field name"
                  className={cn(inputCn, "text-xs")}
                />
                <select
                  value={field.type}
                  onChange={(e) => updateField(i, { type: e.target.value })}
                  className={cn(inputCn, "text-xs")}
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="email">Email</option>
                  <option value="tel">Phone</option>
                  <option value="date">Date</option>
                  <option value="textarea">Textarea</option>
                  <option value="select">Select</option>
                  <option value="checkbox">Checkbox</option>
                  <option value="radio">Radio</option>
                </select>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => updateField(i, { label: e.target.value })}
                  placeholder="Label"
                  className={cn(inputCn, "text-xs")}
                />
                <label className="flex items-center gap-1.5 text-xs text-[hsl(var(--foreground))]">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => updateField(i, { required: e.target.checked })}
                    className="rounded border-[hsl(var(--border))]"
                  />
                  Required
                </label>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addField}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 rounded-md border-2 border-dashed",
            "border-[hsl(var(--border))] py-2 text-xs font-medium",
            "text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--ring))] hover:text-[hsl(var(--foreground))]",
          )}
        >
          <Plus className="h-3.5 w-3.5" /> Add Field
        </button>
      </FormSection>

      <FormField label="Output Variable" level={level}>
        <input
          type="text"
          value={(logic["ui_form_output"] as string) ?? ""}
          onChange={(e) => update("ui_form_output", e.target.value)}
          placeholder="formData"
          className={inputCn}
        />
      </FormField>
    </div>
  );
}
