import { forwardRef, type HTMLAttributes, type ImgHTMLAttributes } from "react";
import { cn } from "../../lib/utils.js";
import { stringToColor } from "../../lib/utils.js";

/* ── Avatar root ──────────────────────────────────────────────── */

const Avatar = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
        className,
      )}
      {...props}
    />
  ),
);
Avatar.displayName = "Avatar";

/* ── AvatarImage ──────────────────────────────────────────────── */

const AvatarImage = forwardRef<HTMLImageElement, ImgHTMLAttributes<HTMLImageElement>>(
  ({ className, alt, ...props }, ref) => (
    <img
      ref={ref}
      alt={alt}
      className={cn("aspect-square h-full w-full", className)}
      {...props}
    />
  ),
);
AvatarImage.displayName = "AvatarImage";

/* ── AvatarFallback ───────────────────────────────────────────── */

export interface AvatarFallbackProps extends HTMLAttributes<HTMLSpanElement> {
  /** Name used to derive initials and deterministic background colour */
  name?: string;
}

const AvatarFallback = forwardRef<HTMLSpanElement, AvatarFallbackProps>(
  ({ className, name, children, style, ...props }, ref) => {
    const initials = name
      ? name
          .split(" ")
          .map((p) => p[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()
      : undefined;

    const bgColor = name ? `hsl(${stringToColor(name)})` : undefined;

    return (
      <span
        ref={ref}
        className={cn(
          "flex h-full w-full items-center justify-center rounded-full bg-[hsl(var(--muted))] text-sm font-medium",
          className,
        )}
        style={{ ...style, backgroundColor: bgColor }}
        {...props}
      >
        {children ?? initials ?? "?"}
      </span>
    );
  },
);
AvatarFallback.displayName = "AvatarFallback";

export { Avatar, AvatarImage, AvatarFallback };
