import { Toaster as SonnerToaster, toast } from "sonner";

export interface ToasterProps {
  /** Position on screen */
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "top-center" | "bottom-center";
  /** Expand toasts by default */
  expand?: boolean;
  /** Rich colours for destructive / success variants */
  richColors?: boolean;
}

/**
 * Sonner-based toast notification container.
 *
 * Mount once at app root:
 * ```tsx
 * <ThemeProvider>
 *   <App />
 *   <Toaster />
 * </ThemeProvider>
 * ```
 *
 * Then trigger from anywhere:
 * ```ts
 * import { toast } from "@vsync/ui";
 * toast.success("Workflow saved");
 * toast.error("Something went wrong");
 * ```
 */
function Toaster({
  position = "bottom-right",
  expand = false,
  richColors = true,
}: ToasterProps = {}) {
  return (
    <SonnerToaster
      position={position}
      expand={expand}
      richColors={richColors}
      toastOptions={{
        classNames: {
          toast:
            "group border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] shadow-lg",
          description: "text-[hsl(var(--muted-foreground))]",
          actionButton:
            "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
          cancelButton:
            "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
        },
      }}
    />
  );
}

export { Toaster, toast };
