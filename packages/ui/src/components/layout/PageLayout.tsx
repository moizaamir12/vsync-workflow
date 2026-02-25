import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/utils.js";

/**
 * Full-page layout: sidebar + header + scrollable content area.
 *
 * Usage:
 * ```tsx
 * <SidebarProvider>
 *   <PageLayout
 *     sidebar={<Sidebar>…</Sidebar>}
 *     header={<Header left={<Breadcrumb items={…} />} />}
 *   >
 *     <div className="p-6">Page content here</div>
 *   </PageLayout>
 * </SidebarProvider>
 * ```
 */
export interface PageLayoutProps extends HTMLAttributes<HTMLDivElement> {
  sidebar?: ReactNode;
  header?: ReactNode;
}

const PageLayout = forwardRef<HTMLDivElement, PageLayoutProps>(
  ({ sidebar, header, children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex h-screen overflow-hidden bg-[hsl(var(--background))]", className)}
      {...props}
    >
      {/* Sidebar column */}
      {sidebar}

      {/* Main area: header + content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {header}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  ),
);
PageLayout.displayName = "PageLayout";

export { PageLayout };
