import { type HTMLAttributes } from "react";
import { cn } from "../../lib/utils.js";

/**
 * Animated placeholder for loading states.
 * Takes the shape of its container via className.
 */
function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-[hsl(var(--primary))]/10",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
