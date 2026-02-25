import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils.js";

/* ── Header root ──────────────────────────────────────────────── */

export interface HeaderProps extends HTMLAttributes<HTMLElement> {
  /** Content rendered on the left (breadcrumb, title, etc.) */
  left?: ReactNode;
  /** Content rendered on the right (user menu, actions, etc.) */
  right?: ReactNode;
}

const Header = forwardRef<HTMLElement, HeaderProps>(
  ({ className, left, right, children, ...props }, ref) => (
    <header
      ref={ref}
      className={cn(
        "flex h-14 items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] px-6",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-4">
        {left}
        {children}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </header>
  ),
);
Header.displayName = "Header";

/* ── Breadcrumb ───────────────────────────────────────────────── */

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface BreadcrumbProps extends HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
}

function Breadcrumb({ items, className, ...props }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center", className)} {...props}>
      <ol className="flex items-center gap-1 text-sm">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;

          return (
            <li key={`${item.label}-${idx}`} className="flex items-center gap-1">
              {idx > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              )}
              {isLast ? (
                <span className="font-medium text-[hsl(var(--foreground))]">
                  {item.label}
                </span>
              ) : item.onClick ? (
                <button
                  type="button"
                  onClick={item.onClick}
                  className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                >
                  {item.label}
                </button>
              ) : item.href ? (
                <a
                  href={item.href}
                  className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                >
                  {item.label}
                </a>
              ) : (
                <span className="text-[hsl(var(--muted-foreground))]">
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export { Header, Breadcrumb };
