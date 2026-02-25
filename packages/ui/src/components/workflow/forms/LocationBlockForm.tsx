import { useCallback } from "react";
import { cn } from "../../../lib/utils.js";
import { FormField } from "./FormField.js";
import type { DisclosureLevel, WorkflowBlock } from "../../../stores/workflowStore.js";

export interface LocationBlockFormProps {
  block: WorkflowBlock;
  onChange: (logic: Record<string, unknown>) => void;
  level: DisclosureLevel;
}

export function LocationBlockForm({ block, onChange, level }: LocationBlockFormProps) {
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
          value={(logic["location_operation"] as string) ?? "get_current"}
          onChange={(e) => update("location_operation", e.target.value)}
          className={inputCn}
        >
          <option value="get_current">Get current location</option>
          <option value="geocode">Geocode address</option>
          <option value="reverse_geocode">Reverse geocode</option>
          <option value="distance">Calculate distance</option>
          <option value="watch">Watch location changes</option>
        </select>
      </FormField>

      {(logic["location_operation"] === "geocode") && (
        <FormField label="Address" level={level}>
          <input
            type="text"
            value={(logic["location_address"] as string) ?? ""}
            onChange={(e) => update("location_address", e.target.value)}
            placeholder="123 Main St, City, Country"
            className={inputCn}
          />
        </FormField>
      )}

      {(logic["location_operation"] === "reverse_geocode") && (
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Latitude" level={level}>
            <input
              type="text"
              value={(logic["location_lat"] as string) ?? ""}
              onChange={(e) => update("location_lat", e.target.value)}
              placeholder="40.7128"
              className={inputCn}
            />
          </FormField>
          <FormField label="Longitude" level={level}>
            <input
              type="text"
              value={(logic["location_lng"] as string) ?? ""}
              onChange={(e) => update("location_lng", e.target.value)}
              placeholder="-74.0060"
              className={inputCn}
            />
          </FormField>
        </div>
      )}

      {(logic["location_operation"] === "distance") && (
        <>
          <FormField label="Origin" hint="Coordinates or variable" level={level}>
            <input
              type="text"
              value={(logic["location_origin"] as string) ?? ""}
              onChange={(e) => update("location_origin", e.target.value)}
              placeholder="$originCoords"
              className={inputCn}
            />
          </FormField>
          <FormField label="Destination" level={level}>
            <input
              type="text"
              value={(logic["location_destination"] as string) ?? ""}
              onChange={(e) => update("location_destination", e.target.value)}
              placeholder="$destCoords"
              className={inputCn}
            />
          </FormField>
        </>
      )}

      <FormField
        label="Accuracy"
        showAt={["standard", "advanced"]}
        level={level}
      >
        <select
          value={(logic["location_accuracy"] as string) ?? "balanced"}
          onChange={(e) => update("location_accuracy", e.target.value)}
          className={inputCn}
        >
          <option value="high">High (GPS)</option>
          <option value="balanced">Balanced</option>
          <option value="low">Low (network)</option>
        </select>
      </FormField>

      <FormField
        label="Timeout (ms)"
        showAt={["advanced"]}
        level={level}
      >
        <input
          type="number"
          value={(logic["location_timeout"] as number) ?? 15000}
          onChange={(e) => update("location_timeout", Number(e.target.value))}
          min={1000}
          max={60000}
          className={inputCn}
        />
      </FormField>

      <FormField label="Output Variable" level={level}>
        <input
          type="text"
          value={(logic["location_output"] as string) ?? ""}
          onChange={(e) => update("location_output", e.target.value)}
          placeholder="location"
          className={inputCn}
        />
      </FormField>
    </div>
  );
}
