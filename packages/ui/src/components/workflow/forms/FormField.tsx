import { cn } from "../../../lib/utils.js";
import type { DisclosureLevel } from "../../../stores/workflowStore.js";

/* ── Types ────────────────────────────────────────────────────── */

export interface FormFieldProps {
  /** Field label */
  label: string;
  /** Optional helper text */
  hint?: string;
  /** Error message */
  error?: string;
  /** Which disclosure levels show this field */
  showAt?: DisclosureLevel[];
  /** Current disclosure level */
  level?: DisclosureLevel;
  /** Field content */
  children: React.ReactNode;
  /** Additional class names */
  className?: string;
}

/* ── Disclosure ordering for comparison ──────────────────────── */

const disclosureOrder: Record<DisclosureLevel, number> = {
  simple: 0,
  standard: 1,
  advanced: 2,
};

/* ── Component ────────────────────────────────────────────────── */

/**
 * A labeled form field wrapper with disclosure-level gating.
 * Fields with `showAt` only appear when the current level is included.
 */
export function FormField({
  label,
  hint,
  error,
  showAt,
  level = "standard",
  children,
  className,
}: FormFieldProps) {
  /* Gate by disclosure level */
  if (showAt && !showAt.includes(level)) {
    /* Check if any showAt level is <= current level (inclusive fallback) */
    const currentOrder = disclosureOrder[level];
    const isVisible = showAt.some((s) => disclosureOrder[s] <= currentOrder);
    if (!isVisible) return null;
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))]">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{hint}</p>
      )}
      {error && (
        <p className="text-[10px] text-[hsl(var(--destructive))]">{error}</p>
      )}
    </div>
  );
}

/* ── Section divider ─────────────────────────────────────────── */

export interface FormSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({ title, children, className }: FormSectionProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <h4 className="border-b border-[hsl(var(--border))] pb-1 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {title}
      </h4>
      {children}
    </div>
  );
}
