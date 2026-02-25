import { useCallback } from "react";
import { cn } from "../../../lib/utils.js";
import { FormField } from "./FormField.js";
import type { DisclosureLevel, WorkflowBlock } from "../../../stores/workflowStore.js";

export interface UICameraBlockFormProps {
  block: WorkflowBlock;
  onChange: (logic: Record<string, unknown>) => void;
  level: DisclosureLevel;
}

export function UICameraBlockForm({ block, onChange, level }: UICameraBlockFormProps) {
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
      <FormField label="Camera Source" level={level}>
        <select
          value={(logic["ui_camera_source"] as string) ?? "rear"}
          onChange={(e) => update("ui_camera_source", e.target.value)}
          className={inputCn}
        >
          <option value="rear">Rear camera</option>
          <option value="front">Front camera</option>
          <option value="user_choice">User choice</option>
        </select>
      </FormField>

      <FormField label="Capture Mode" level={level}>
        <select
          value={(logic["ui_camera_mode"] as string) ?? "photo"}
          onChange={(e) => update("ui_camera_mode", e.target.value)}
          className={inputCn}
        >
          <option value="photo">Photo</option>
          <option value="video">Video</option>
          <option value="barcode">Barcode / QR</option>
        </select>
      </FormField>

      <FormField label="Prompt Text" hint="Instructions shown to the user" level={level}>
        <input
          type="text"
          value={(logic["ui_camera_prompt"] as string) ?? ""}
          onChange={(e) => update("ui_camera_prompt", e.target.value)}
          placeholder="Take a photo of the item"
          className={inputCn}
        />
      </FormField>

      <FormField
        label="Quality"
        showAt={["standard", "advanced"]}
        level={level}
      >
        <select
          value={(logic["ui_camera_quality"] as string) ?? "medium"}
          onChange={(e) => update("ui_camera_quality", e.target.value)}
          className={inputCn}
        >
          <option value="low">Low (faster upload)</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </FormField>

      <FormField
        label="Max File Size (MB)"
        showAt={["advanced"]}
        level={level}
      >
        <input
          type="number"
          value={(logic["ui_camera_max_size"] as number) ?? 10}
          onChange={(e) => update("ui_camera_max_size", Number(e.target.value))}
          min={1}
          max={100}
          className={inputCn}
        />
      </FormField>

      <FormField label="Output Variable" level={level}>
        <input
          type="text"
          value={(logic["ui_camera_output"] as string) ?? ""}
          onChange={(e) => update("ui_camera_output", e.target.value)}
          placeholder="capturedImage"
          className={inputCn}
        />
      </FormField>
    </div>
  );
}
