import { useCallback } from "react";
import { cn } from "../../../lib/utils.js";
import { FormField } from "./FormField.js";
import type { DisclosureLevel, WorkflowBlock } from "../../../stores/workflowStore.js";

export interface FilesystemBlockFormProps {
  block: WorkflowBlock;
  onChange: (logic: Record<string, unknown>) => void;
  level: DisclosureLevel;
}

export function FilesystemBlockForm({ block, onChange, level }: FilesystemBlockFormProps) {
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
          value={(logic["filesystem_operation"] as string) ?? "read"}
          onChange={(e) => update("filesystem_operation", e.target.value)}
          className={inputCn}
        >
          <option value="read">Read file</option>
          <option value="write">Write file</option>
          <option value="append">Append to file</option>
          <option value="delete">Delete file</option>
          <option value="exists">Check exists</option>
          <option value="list">List directory</option>
          <option value="mkdir">Create directory</option>
          <option value="copy">Copy</option>
          <option value="move">Move</option>
        </select>
      </FormField>

      <FormField label="Path" level={level}>
        <input
          type="text"
          value={(logic["filesystem_path"] as string) ?? ""}
          onChange={(e) => update("filesystem_path", e.target.value)}
          placeholder="/data/output.json"
          className={inputCn}
        />
      </FormField>

      {["write", "append"].includes((logic["filesystem_operation"] as string) ?? "") && (
        <FormField label="Content" level={level}>
          <textarea
            value={(logic["filesystem_content"] as string) ?? ""}
            onChange={(e) => update("filesystem_content", e.target.value)}
            placeholder="File content or $variable"
            rows={3}
            className={inputCn}
          />
        </FormField>
      )}

      {["copy", "move"].includes((logic["filesystem_operation"] as string) ?? "") && (
        <FormField label="Destination" level={level}>
          <input
            type="text"
            value={(logic["filesystem_destination"] as string) ?? ""}
            onChange={(e) => update("filesystem_destination", e.target.value)}
            placeholder="/data/backup/"
            className={inputCn}
          />
        </FormField>
      )}

      <FormField
        label="Encoding"
        showAt={["advanced"]}
        level={level}
      >
        <select
          value={(logic["filesystem_encoding"] as string) ?? "utf-8"}
          onChange={(e) => update("filesystem_encoding", e.target.value)}
          className={inputCn}
        >
          <option value="utf-8">UTF-8</option>
          <option value="ascii">ASCII</option>
          <option value="base64">Base64</option>
          <option value="binary">Binary</option>
        </select>
      </FormField>

      <FormField label="Output Variable" level={level}>
        <input
          type="text"
          value={(logic["filesystem_output"] as string) ?? ""}
          onChange={(e) => update("filesystem_output", e.target.value)}
          placeholder="fileContent"
          className={inputCn}
        />
      </FormField>
    </div>
  );
}
