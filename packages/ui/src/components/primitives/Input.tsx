import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/utils.js";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Label rendered above the input */
  label?: string;
  /** Helper text rendered below the input */
  helperText?: string;
  /** Error message — replaces helper text and styles the border red */
  error?: string;
  /** Optional icon or adornment before the input value */
  startAdornment?: ReactNode;
  /** Optional icon or adornment after the input value */
  endAdornment?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, helperText, error, startAdornment, endAdornment, id, type, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="grid w-full gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium leading-none text-[hsl(var(--foreground))] peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {startAdornment && (
            <div className="pointer-events-none absolute left-3 flex items-center text-[hsl(var(--muted-foreground))]">
              {startAdornment}
            </div>
          )}
          <input
            type={type}
            id={inputId}
            className={cn(
              "flex h-9 w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))] disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-[hsl(var(--destructive))] focus-visible:ring-[hsl(var(--destructive))]",
              startAdornment && "pl-10",
              endAdornment && "pr-10",
              className,
            )}
            ref={ref}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            {...props}
          />
          {endAdornment && (
            <div className="absolute right-3 flex items-center text-[hsl(var(--muted-foreground))]">
              {endAdornment}
            </div>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-[hsl(var(--destructive))]">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={`${inputId}-helper`} className="text-xs text-[hsl(var(--muted-foreground))]">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
