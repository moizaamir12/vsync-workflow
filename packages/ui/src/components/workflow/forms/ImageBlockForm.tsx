import { useCallback } from "react";
import { cn } from "../../../lib/utils.js";
import { FormField } from "./FormField.js";
import type { DisclosureLevel, WorkflowBlock } from "../../../stores/workflowStore.js";

export interface ImageBlockFormProps {
  block: WorkflowBlock;
  onChange: (logic: Record<string, unknown>) => void;
  level: DisclosureLevel;
}

export function ImageBlockForm({ block, onChange, level }: ImageBlockFormProps) {
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
          value={(logic["image_operation"] as string) ?? "resize"}
          onChange={(e) => update("image_operation", e.target.value)}
          className={inputCn}
        >
          <option value="resize">Resize</option>
          <option value="crop">Crop</option>
          <option value="compress">Compress</option>
          <option value="rotate">Rotate</option>
          <option value="watermark">Watermark</option>
          <option value="convert">Convert format</option>
          <option value="thumbnail">Generate thumbnail</option>
        </select>
      </FormField>

      <FormField label="Input Image" level={level}>
        <input
          type="text"
          value={(logic["image_input"] as string) ?? ""}
          onChange={(e) => update("image_input", e.target.value)}
          placeholder="$imageData"
          className={inputCn}
        />
      </FormField>

      {(logic["image_operation"] === "resize" || !logic["image_operation"]) && (
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Width" level={level}>
            <input
              type="number"
              value={(logic["image_width"] as number) ?? ""}
              onChange={(e) => update("image_width", e.target.value ? Number(e.target.value) : "")}
              placeholder="800"
              className={inputCn}
            />
          </FormField>
          <FormField label="Height" level={level}>
            <input
              type="number"
              value={(logic["image_height"] as number) ?? ""}
              onChange={(e) => update("image_height", e.target.value ? Number(e.target.value) : "")}
              placeholder="600"
              className={inputCn}
            />
          </FormField>
        </div>
      )}

      {(logic["image_operation"] === "compress") && (
        <FormField label="Quality (%)" level={level}>
          <input
            type="range"
            min={1}
            max={100}
            value={(logic["image_quality"] as number) ?? 80}
            onChange={(e) => update("image_quality", Number(e.target.value))}
            className="w-full"
          />
          <span className="text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
            {(logic["image_quality"] as number) ?? 80}%
          </span>
        </FormField>
      )}

      {(logic["image_operation"] === "convert") && (
        <FormField label="Target Format" level={level}>
          <select
            value={(logic["image_format"] as string) ?? "png"}
            onChange={(e) => update("image_format", e.target.value)}
            className={inputCn}
          >
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
            <option value="webp">WebP</option>
            <option value="avif">AVIF</option>
          </select>
        </FormField>
      )}

      <FormField label="Output Variable" level={level}>
        <input
          type="text"
          value={(logic["image_output"] as string) ?? ""}
          onChange={(e) => update("image_output", e.target.value)}
          placeholder="processedImage"
          className={inputCn}
        />
      </FormField>
    </div>
  );
}
