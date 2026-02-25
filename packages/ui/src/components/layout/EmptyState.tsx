import { type ReactNode, type HTMLAttributes } from "react";
import { cn } from "../../lib/utils.js";

/**
 * Empty-state placeholder shown when a list/table/page has no content.
 *
 * ```tsx
 * <EmptyState
 *   icon={<Inbox className="h-12 w-12" />}
 *   title="No workflows yet"
 *   description="Create your first workflow to get started."
 *   action={<Button>Create Workflow</Button>}
 * />
 * ```
 */
export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  /** Large illustrative icon or SVG */
  icon?: ReactNode;
  /** Headline */
  title: string;
  /** Supporting copy */
  description?: string;
  /** Primary CTA (e.g. a Button) */
  action?: ReactNode;
}

function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-16 text-center",
        className,
      )}
      {...props}
    >
      {icon && (
        <div className="text-[hsl(var(--muted-foreground))]">{icon}</div>
      )}
      <div className="space-y-1.5">
        <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">
          {title}
        </h3>
        {description && (
          <p className="max-w-md text-sm text-[hsl(var(--muted-foreground))]">
            {description}
          </p>
        )}
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

export { EmptyState };
