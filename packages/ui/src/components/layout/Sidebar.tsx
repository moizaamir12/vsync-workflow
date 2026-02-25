import {
  useState,
  createContext,
  useContext,
  forwardRef,
  type ReactNode,
  type HTMLAttributes,
  type ButtonHTMLAttributes,
} from "react";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { cn } from "../../lib/utils.js";

/* ── Context ──────────────────────────────────────────────────── */

interface SidebarContextValue {
  collapsed: boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  toggle: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

/* ── SidebarProvider ──────────────────────────────────────────── */

export interface SidebarProviderProps {
  /** Start collapsed */
  defaultCollapsed?: boolean;
  children: ReactNode;
}

export function SidebarProvider({
  defaultCollapsed = false,
  children,
}: SidebarProviderProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const toggle = () => setCollapsed((c) => !c);

  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

/* ── Sidebar root ─────────────────────────────────────────────── */

export interface SidebarProps extends HTMLAttributes<HTMLElement> {
  /** Fixed width when expanded (default 256px) */
  width?: number;
  /** Fixed width when collapsed (default 64px) */
  collapsedWidth?: number;
}

const Sidebar = forwardRef<HTMLElement, SidebarProps>(
  ({ className, width = 256, collapsedWidth = 64, children, style, ...props }, ref) => {
    const { collapsed } = useSidebar();
    const currentWidth = collapsed ? collapsedWidth : width;

    return (
      <aside
        ref={ref}
        style={{ ...style, width: currentWidth }}
        className={cn(
          "flex h-full flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--background))] transition-[width] duration-200",
          className,
        )}
        {...props}
      >
        {children}
      </aside>
    );
  },
);
Sidebar.displayName = "Sidebar";

/* ── SidebarHeader ────────────────────────────────────────────── */

const SidebarHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex h-14 items-center border-b border-[hsl(var(--border))] px-4", className)}
      {...props}
    />
  ),
);
SidebarHeader.displayName = "SidebarHeader";

/* ── SidebarContent (scrollable area) ─────────────────────────── */

const SidebarContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex-1 overflow-y-auto px-3 py-2", className)}
      {...props}
    />
  ),
);
SidebarContent.displayName = "SidebarContent";

/* ── SidebarFooter ────────────────────────────────────────────── */

const SidebarFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("border-t border-[hsl(var(--border))] p-3", className)}
      {...props}
    />
  ),
);
SidebarFooter.displayName = "SidebarFooter";

/* ── SidebarToggle button ─────────────────────────────────────── */

function SidebarToggle({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { collapsed, toggle } = useSidebar();
  const Icon = collapsed ? PanelLeft : PanelLeftClose;

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]",
        className,
      )}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      {...props}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

/* ── SidebarNavItem ───────────────────────────────────────────── */

export interface SidebarNavItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  label: string;
  active?: boolean;
}

function SidebarNavItem({
  icon,
  label,
  active = false,
  className,
  ...props
}: SidebarNavItemProps) {
  const { collapsed } = useSidebar();

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"
          : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]",
        collapsed && "justify-center px-0",
        className,
      )}
      title={collapsed ? label : undefined}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

/* ── SidebarGroup ─────────────────────────────────────────────── */

export interface SidebarGroupProps extends HTMLAttributes<HTMLDivElement> {
  label?: string;
}

function SidebarGroup({ label, className, children, ...props }: SidebarGroupProps) {
  const { collapsed } = useSidebar();

  return (
    <div className={cn("py-2", className)} {...props}>
      {label && !collapsed && (
        <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          {label}
        </div>
      )}
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarToggle,
  SidebarNavItem,
  SidebarGroup,
};
