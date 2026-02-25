import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../../lib/utils.js";

/**
 * Lightweight scroll container with custom scrollbar styling.
 * Uses native CSS overflow instead of a JS-based solution
 * for better performance with large content areas.
 */
export interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  /** Scrollbar axis to show */
  orientation?: "vertical" | "horizontal" | "both";
}

const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, orientation = "vertical", children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative",
        orientation === "vertical" && "overflow-y-auto overflow-x-hidden",
        orientation === "horizontal" && "overflow-x-auto overflow-y-hidden",
        orientation === "both" && "overflow-auto",
        /* Custom scrollbar styling */
        "[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[hsl(var(--border))]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);
ScrollArea.displayName = "ScrollArea";

export { ScrollArea };
