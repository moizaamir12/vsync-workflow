import { useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "../../../lib/utils.js";
import { FormField, FormSection } from "./FormField.js";
import type { DisclosureLevel, WorkflowBlock } from "../../../stores/workflowStore.js";

export interface FetchBlockFormProps {
  block: WorkflowBlock;
  onChange: (logic: Record<string, unknown>) => void;
  level: DisclosureLevel;
}

interface HeaderEntry {
  key: string;
  value: string;
}

export function FetchBlockForm({ block, onChange, level }: FetchBlockFormProps) {
  const logic = block.logic;

  const update = useCallback(
    (key: string, value: unknown) => onChange({ [key]: value }),
    [onChange],
  );

  const headers: HeaderEntry[] = (logic["fetch_headers"] as HeaderEntry[]) ?? [];

  const addHeader = useCallback(() => {
    update("fetch_headers", [...headers, { key: "", value: "" }]);
  }, [headers, update]);

  const removeHeader = useCallback(
    (index: number) => {
      update("fetch_headers", headers.filter((_, i) => i !== index));
    },
    [headers, update],
  );

  const updateHeader = useCallback(
    (index: number, field: "key" | "value", val: string) => {
      const next = headers.map((h, i) =>
        i === index ? { ...h, [field]: val } : h,
      );
      update("fetch_headers", next);
    },
    [headers, update],
  );

  const inputCn = cn(
    "w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]",
    "px-3 py-1.5 text-sm font-mono text-[hsl(var(--foreground))]",
    "placeholder:text-[hsl(var(--muted-foreground))]",
    "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]",
  );

  return (
    <div className="space-y-4">
      <FormSection title="Request">
        <FormField label="Method" level={level}>
          <select
            value={(logic["fetch_method"] as string) ?? "GET"}
            onChange={(e) => update("fetch_method", e.target.value)}
            className={inputCn}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
            <option value="HEAD">HEAD</option>
            <option value="OPTIONS">OPTIONS</option>
          </select>
        </FormField>

        <FormField label="URL" level={level}>
          <input
            type="text"
            value={(logic["fetch_url"] as string) ?? ""}
            onChange={(e) => update("fetch_url", e.target.value)}
            placeholder="https://api.example.com/endpoint"
            className={inputCn}
          />
        </FormField>

        {/* Headers */}
        <FormField label="Headers" showAt={["standard", "advanced"]} level={level}>
          <div className="space-y-1.5">
            {headers.map((h, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={h.key}
                  onChange={(e) => updateHeader(i, "key", e.target.value)}
                  placeholder="Header name"
                  className={cn(inputCn, "flex-1")}
                />
                <input
                  type="text"
                  value={h.value}
                  onChange={(e) => updateHeader(i, "value", e.target.value)}
                  placeholder="Value"
                  className={cn(inputCn, "flex-1")}
                />
                <button
                  type="button"
                  onClick={() => removeHeader(i)}
                  className="shrink-0 rounded-md p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addHeader}
              className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            >
              <Plus className="h-3 w-3" /> Add header
            </button>
          </div>
        </FormField>

        {/* Body */}
        {["POST", "PUT", "PATCH"].includes((logic["fetch_method"] as string) ?? "GET") && (
          <>
            <FormField label="Content Type" level={level}>
              <select
                value={(logic["fetch_content_type"] as string) ?? "application/json"}
                onChange={(e) => update("fetch_content_type", e.target.value)}
                className={inputCn}
              >
                <option value="application/json">JSON</option>
                <option value="application/x-www-form-urlencoded">Form URL-Encoded</option>
                <option value="multipart/form-data">Multipart Form Data</option>
                <option value="text/plain">Plain Text</option>
              </select>
            </FormField>

            <FormField label="Body" level={level}>
              <textarea
                value={(logic["fetch_body"] as string) ?? ""}
                onChange={(e) => update("fetch_body", e.target.value)}
                placeholder='{"key": "value"}'
                rows={4}
                className={inputCn}
              />
            </FormField>
          </>
        )}
      </FormSection>

      <FormSection title="Response">
        <FormField
          label="Timeout (ms)"
          showAt={["standard", "advanced"]}
          level={level}
        >
          <input
            type="number"
            value={(logic["fetch_timeout"] as number) ?? 10000}
            onChange={(e) => update("fetch_timeout", Number(e.target.value))}
            min={100}
            max={120000}
            className={inputCn}
          />
        </FormField>

        <FormField
          label="Retry Count"
          showAt={["advanced"]}
          level={level}
        >
          <input
            type="number"
            value={(logic["fetch_retries"] as number) ?? 0}
            onChange={(e) => update("fetch_retries", Number(e.target.value))}
            min={0}
            max={5}
            className={inputCn}
          />
        </FormField>

        <FormField
          label="Response Path"
          hint="JSONPath to extract from response (e.g. data.items)"
          showAt={["standard", "advanced"]}
          level={level}
        >
          <input
            type="text"
            value={(logic["fetch_response_path"] as string) ?? ""}
            onChange={(e) => update("fetch_response_path", e.target.value)}
            placeholder="data"
            className={inputCn}
          />
        </FormField>

        <FormField label="Output Variable" level={level}>
          <input
            type="text"
            value={(logic["fetch_output"] as string) ?? ""}
            onChange={(e) => update("fetch_output", e.target.value)}
            placeholder="response"
            className={inputCn}
          />
        </FormField>
      </FormSection>
    </div>
  );
}
