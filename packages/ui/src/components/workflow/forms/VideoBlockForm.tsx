import { useCallback } from "react";
import { cn } from "../../../lib/utils.js";
import { FormField } from "./FormField.js";
import type { DisclosureLevel, WorkflowBlock } from "../../../stores/workflowStore.js";

export interface VideoBlockFormProps {
  block: WorkflowBlock;
  onChange: (logic: Record<string, unknown>) => void;
  level: DisclosureLevel;
}

export function VideoBlockForm({ block, onChange, level }: VideoBlockFormProps) {
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
          value={(logic["video_operation"] as string) ?? "record"}
          onChange={(e) => update("video_operation", e.target.value)}
          className={inputCn}
        >
          <option value="record">Record</option>
          <option value="compress">Compress</option>
          <option value="thumbnail">Extract thumbnail</option>
          <option value="trim">Trim</option>
        </select>
      </FormField>

      {(logic["video_operation"] === "record" || !logic["video_operation"]) && (
        <>
          <FormField label="Max Duration (seconds)" level={level}>
            <input
              type="number"
              value={(logic["video_max_duration"] as number) ?? 30}
              onChange={(e) => update("video_max_duration", Number(e.target.value))}
              min={1}
              max={300}
              className={inputCn}
            />
          </FormField>

          <FormField label="Quality" showAt={["standard", "advanced"]} level={level}>
            <select
              value={(logic["video_quality"] as string) ?? "medium"}
              onChange={(e) => update("video_quality", e.target.value)}
              className={inputCn}
            >
              <option value="low">Low (480p)</option>
              <option value="medium">Medium (720p)</option>
              <option value="high">High (1080p)</option>
            </select>
          </FormField>
        </>
      )}

      {(logic["video_operation"] === "trim") && (
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Start (sec)" level={level}>
            <input
              type="number"
              value={(logic["video_start"] as number) ?? 0}
              onChange={(e) => update("video_start", Number(e.target.value))}
              min={0}
              className={inputCn}
            />
          </FormField>
          <FormField label="End (sec)" level={level}>
            <input
              type="number"
              value={(logic["video_end"] as number) ?? ""}
              onChange={(e) => update("video_end", e.target.value ? Number(e.target.value) : "")}
              min={0}
              className={inputCn}
            />
          </FormField>
        </div>
      )}

      {["compress", "thumbnail", "trim"].includes((logic["video_operation"] as string) ?? "") && (
        <FormField label="Input Video" level={level}>
          <input
            type="text"
            value={(logic["video_input"] as string) ?? ""}
            onChange={(e) => update("video_input", e.target.value)}
            placeholder="$videoData"
            className={inputCn}
          />
        </FormField>
      )}

      <FormField label="Output Variable" level={level}>
        <input
          type="text"
          value={(logic["video_output"] as string) ?? ""}
          onChange={(e) => update("video_output", e.target.value)}
          placeholder="videoResult"
          className={inputCn}
        />
      </FormField>
    </div>
  );
}
