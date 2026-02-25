import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { cn } from "../../lib/utils.js";

/* ── Types ────────────────────────────────────────────────────── */

export interface VariableOption {
  /** Full variable path, e.g. "block_1.output.name" */
  path: string;
  /** Display label */
  label: string;
  /** Optional type badge (string, number, object, array) */
  type?: string;
  /** Source block name */
  source?: string;
}

export interface SmartInputProps {
  /** Current value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Available variables for autocomplete */
  variables?: VariableOption[];
  /** Placeholder text */
  placeholder?: string;
  /** Whether to render as a textarea */
  multiline?: boolean;
  /** Additional class names */
  className?: string;
  /** Trigger character — defaults to "$" */
  trigger?: string;
  /** Label for the field */
  label?: string;
  /** Error message */
  error?: string;
  /** Disable the input */
  disabled?: boolean;
}

/* ── Type badge colours ──────────────────────────────────────── */

const typeBadgeColors: Record<string, string> = {
  string: "bg-blue-100 text-blue-700",
  number: "bg-green-100 text-green-700",
  boolean: "bg-yellow-100 text-yellow-700",
  object: "bg-purple-100 text-purple-700",
  array: "bg-pink-100 text-pink-700",
};

/* ── Fuzzy match helper ──────────────────────────────────────── */

function fuzzyMatch(pattern: string, text: string): boolean {
  const p = pattern.toLowerCase();
  const t = text.toLowerCase();
  let pi = 0;
  for (let ti = 0; ti < t.length && pi < p.length; ti++) {
    if (t[ti] === p[pi]) {
      pi++;
    }
  }
  return pi === p.length;
}

/* ── Component ────────────────────────────────────────────────── */

/**
 * A text input that shows variable autocomplete when the user types "$".
 * Supports fuzzy search, keyboard navigation, and type badges.
 */
export function SmartInput({
  value,
  onChange,
  variables = [],
  placeholder,
  multiline = false,
  className,
  trigger = "$",
  label,
  error,
  disabled,
}: SmartInputProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  /* ── Filtered variable list ────────────────── */

  const filtered = useMemo(() => {
    if (!query) return variables;
    return variables.filter(
      (v) => fuzzyMatch(query, v.path) || fuzzyMatch(query, v.label),
    );
  }, [variables, query]);

  /* ── Reset active index when filtered list changes */

  useEffect(() => {
    setActiveIndex(0);
  }, [filtered.length]);

  /* ── Extract the current trigger context ───── */

  const getTriggerContext = useCallback(
    (text: string, cursorPos: number) => {
      /* Walk backwards from cursor to find the trigger character */
      for (let i = cursorPos - 1; i >= 0; i--) {
        if (text[i] === trigger) {
          /* Found trigger — check it's not escaped */
          if (i > 0 && text[i - 1] === "\\") return null;
          return {
            start: i,
            query: text.slice(i + 1, cursorPos),
          };
        }
        /* Stop if we hit whitespace or another special char */
        if (/\s/.test(text[i] ?? "")) return null;
      }
      return null;
    },
    [trigger],
  );

  /* ── Input change handler ──────────────────── */

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      onChange(newValue);

      const cursorPos = e.target.selectionStart ?? newValue.length;
      const ctx = getTriggerContext(newValue, cursorPos);

      if (ctx) {
        setQuery(ctx.query);
        setShowDropdown(true);
      } else {
        setShowDropdown(false);
        setQuery("");
      }
    },
    [onChange, getTriggerContext],
  );

  /* ── Insert variable at cursor ─────────────── */

  const insertVariable = useCallback(
    (variable: VariableOption) => {
      const el = inputRef.current;
      if (!el) return;

      const cursorPos = el.selectionStart ?? value.length;
      const ctx = getTriggerContext(value, cursorPos);
      if (!ctx) return;

      /* Replace from trigger through query with the full path wrapped in braces */
      const before = value.slice(0, ctx.start);
      const after = value.slice(cursorPos);
      const insertion = `${trigger}{${variable.path}}`;
      const newValue = before + insertion + after;

      onChange(newValue);
      setShowDropdown(false);
      setQuery("");

      /* Restore focus after React re-render */
      requestAnimationFrame(() => {
        el.focus();
        const newPos = before.length + insertion.length;
        el.setSelectionRange(newPos, newPos);
      });
    },
    [value, onChange, getTriggerContext, trigger],
  );

  /* ── Keyboard navigation ───────────────────── */

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!showDropdown || filtered.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((i) => (i + 1) % filtered.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
          break;
        case "Enter":
        case "Tab": {
          e.preventDefault();
          const selected = filtered[activeIndex];
          if (selected) insertVariable(selected);
          break;
        }
        case "Escape":
          e.preventDefault();
          setShowDropdown(false);
          break;
      }
    },
    [showDropdown, filtered, activeIndex, insertVariable],
  );

  /* ── Close dropdown on outside click ───────── */

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as HTMLElement) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as HTMLElement)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  /* ── Scroll active item into view ──────────── */

  useEffect(() => {
    if (!showDropdown || !dropdownRef.current) return;
    const el = dropdownRef.current.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, showDropdown]);

  /* ── Shared input props ────────────────────── */

  const sharedProps = {
    ref: inputRef as React.RefObject<HTMLInputElement>,
    value,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    placeholder,
    disabled,
    className: cn(
      "w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]",
      "px-3 py-2 text-sm text-[hsl(var(--foreground))] font-mono",
      "placeholder:text-[hsl(var(--muted-foreground))]",
      "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]",
      "disabled:cursor-not-allowed disabled:opacity-50",
      error && "border-[hsl(var(--destructive))]",
      className,
    ),
  };

  return (
    <div className="relative">
      {label && (
        <label className="mb-1.5 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
          {label}
        </label>
      )}

      {multiline ? (
        <textarea
          {...(sharedProps as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          rows={3}
        />
      ) : (
        <input {...sharedProps} type="text" />
      )}

      {error && (
        <p className="mt-1 text-xs text-[hsl(var(--destructive))]">{error}</p>
      )}

      {/* Autocomplete dropdown */}
      {showDropdown && filtered.length > 0 && (
        <div
          ref={dropdownRef}
          className={cn(
            "absolute left-0 top-full z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md",
            "border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg",
          )}
        >
          {filtered.map((v, i) => {
            const badgeColor = typeBadgeColors[v.type ?? ""] ?? "bg-gray-100 text-gray-700";
            return (
              <button
                key={v.path}
                type="button"
                onClick={() => insertVariable(v)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                  "transition-colors hover:bg-[hsl(var(--muted))]",
                  i === activeIndex && "bg-[hsl(var(--muted))]",
                )}
              >
                <span className="font-mono text-xs text-[hsl(var(--foreground))]">
                  {v.path}
                </span>
                {v.type && (
                  <span
                    className={cn(
                      "rounded-sm px-1.5 py-0.5 text-[10px] font-medium",
                      badgeColor,
                    )}
                  >
                    {v.type}
                  </span>
                )}
                {v.source && (
                  <span className="ml-auto truncate text-[10px] text-[hsl(var(--muted-foreground))]">
                    {v.source}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
