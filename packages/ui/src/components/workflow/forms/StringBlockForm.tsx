import { useCallback } from "react";
import { cn } from "../../../lib/utils.js";
import { FormField } from "./FormField.js";
import type { DisclosureLevel, WorkflowBlock } from "../../../stores/workflowStore.js";

export interface StringBlockFormProps {
  block: WorkflowBlock;
  onChange: (logic: Record<string, unknown>) => void;
  level: DisclosureLevel;
}

export function StringBlockForm({ block, onChange, level }: StringBlockFormProps) {
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
          value={(logic["string_operation"] as string) ?? "template"}
          onChange={(e) => update("string_operation", e.target.value)}
          className={inputCn}
        >
          <option value="template">Template interpolation</option>
          <option value="concat">Concatenate</option>
          <option value="replace">Find & replace</option>
          <option value="split">Split</option>
          <option value="trim">Trim</option>
          <option value="case">Change case</option>
          <option value="pad">Pad</option>
          <option value="slice">Slice</option>
        </select>
      </FormField>

      <FormField label="Template / Input" hint="Use ${'{'}variable{'}'} for interpolation" level={level}>
        <textarea
          value={(logic["string_template"] as string) ?? ""}
          onChange={(e) => update("string_template", e.target.value)}
          placeholder="Hello, ${'{'}name{'}'}!"
          rows={3}
          className={inputCn}
        />
      </FormField>

      {(logic["string_operation"] === "replace") && (
        <>
          <FormField label="Find" level={level}>
            <input
              type="text"
              value={(logic["string_find"] as string) ?? ""}
              onChange={(e) => update("string_find", e.target.value)}
              className={inputCn}
            />
          </FormField>
          <FormField label="Replace with" level={level}>
            <input
              type="text"
              value={(logic["string_replace"] as string) ?? ""}
              onChange={(e) => update("string_replace", e.target.value)}
              className={inputCn}
            />
          </FormField>
        </>
      )}

      {(logic["string_operation"] === "case") && (
        <FormField label="Case Type" level={level}>
          <select
            value={(logic["string_case"] as string) ?? "upper"}
            onChange={(e) => update("string_case", e.target.value)}
            className={inputCn}
          >
            <option value="upper">UPPERCASE</option>
            <option value="lower">lowercase</option>
            <option value="title">Title Case</option>
            <option value="camel">camelCase</option>
            <option value="snake">snake_case</option>
            <option value="kebab">kebab-case</option>
          </select>
        </FormField>
      )}

      <FormField label="Output Variable" level={level}>
        <input
          type="text"
          value={(logic["string_output"] as string) ?? ""}
          onChange={(e) => update("string_output", e.target.value)}
          placeholder="result"
          className={inputCn}
        />
      </FormField>
    </div>
  );
}
