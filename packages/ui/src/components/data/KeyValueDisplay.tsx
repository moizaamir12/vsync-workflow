import { type HTMLAttributes } from "react";
import { cn } from "../../lib/utils.js";

/* ── Types ────────────────────────────────────────────────────── */

export interface KeyValuePair {
  key: string;
  value: unknown;
  /** Optional label override (defaults to key) */
  label?: string;
}

export interface KeyValueDisplayProps extends HTMLAttributes<HTMLDivElement> {
  /** Array of key-value pairs to display */
  items: KeyValuePair[];
  /** Layout orientation */
  orientation?: "horizontal" | "vertical";
  /** Max depth for nested object rendering */
  maxDepth?: number;
}

/* ── Value renderer ───────────────────────────────────────────── */

function renderValue(value: unknown, depth: number, maxDepth: number): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;

  if (depth >= maxDepth) return "[...]";

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[${value.map((v) => renderValue(v, depth + 1, maxDepth)).join(", ")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    return `{ ${entries
      .map(([k, v]) => `${k}: ${renderValue(v, depth + 1, maxDepth)}`)
      .join(", ")} }`;
  }

  return String(value);
}

/* ── Component ────────────────────────────────────────────────── */

/**
 * Displays a list of labelled key-value pairs, useful for
 * showing object properties, run metadata, config fields, etc.
 *
 * ```tsx
 * <KeyValueDisplay
 *   items={[
 *     { key: "status", value: "completed" },
 *     { key: "durationMs", value: 1234, label: "Duration" },
 *     { key: "steps", value: 5 },
 *   ]}
 * />
 * ```
 */
function KeyValueDisplay({
  items,
  orientation = "vertical",
  maxDepth = 3,
  className,
  ...props
}: KeyValueDisplayProps) {
  return (
    <div
      className={cn(
        orientation === "vertical"
          ? "grid gap-3"
          : "flex flex-wrap gap-x-8 gap-y-3",
        className,
      )}
      {...props}
    >
      {items.map((item) => (
        <div
          key={item.key}
          className={cn(
            orientation === "vertical" ? "grid gap-0.5" : "flex flex-col",
          )}
        >
          <dt className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            {item.label ?? item.key}
          </dt>
          <dd className="text-sm text-[hsl(var(--foreground))] break-words font-mono">
            {renderValue(item.value, 0, maxDepth)}
          </dd>
        </div>
      ))}
    </div>
  );
}

export { KeyValueDisplay };
