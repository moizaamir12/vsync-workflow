/**
 * Design tokens for the vsync design system.
 *
 * All colour values are defined as HSL triplets (without the hsl() wrapper)
 * so they can be injected as CSS custom-properties and consumed by
 * Tailwind's `hsl(var(--<name>))` pattern.
 */

/* ── Colour palette (HSL) ────────────────────────────────────── */

export const colors = {
  /** Brand / primary action colour — zinc-900 */
  primary: "240 5.9% 10%",
  primaryForeground: "0 0% 98%",

  /** Secondary, lower-emphasis surfaces — zinc-100 */
  secondary: "240 4.8% 95.9%",
  secondaryForeground: "240 5.9% 10%",

  /** Accent highlight — zinc-100 */
  accent: "240 4.8% 95.9%",
  accentForeground: "240 5.9% 10%",

  /** App backgrounds */
  background: "0 0% 100%",
  foreground: "240 10% 3.9%",

  /** Muted / disabled surfaces */
  muted: "240 4.8% 95.9%",
  mutedForeground: "240 3.8% 46.1%",

  /** Borders & dividers */
  border: "240 5.9% 90%",

  /** Focus ring */
  ring: "240 5.9% 10%",

  /** Semantic: destructive / error */
  destructive: "0 84.2% 60.2%",
  destructiveForeground: "0 0% 98%",

  /** Semantic: success */
  success: "142.1 76.2% 36.3%",
  successForeground: "0 0% 98%",

  /** Semantic: warning */
  warning: "38 92% 50%",
  warningForeground: "0 0% 98%",

  /** Semantic: info */
  info: "221.2 83.2% 53.3%",
  infoForeground: "0 0% 98%",

  /** Card / popover surfaces */
  card: "0 0% 100%",
  cardForeground: "240 10% 3.9%",
  popover: "0 0% 100%",
  popoverForeground: "240 10% 3.9%",

  /** Chart palette (for DataTable sparklines, etc.) */
  chart1: "220 70% 50%",
  chart2: "160 60% 45%",
  chart3: "30 80% 55%",
  chart4: "280 65% 60%",
  chart5: "340 75% 55%",
} as const;

/** Dark-mode overrides */
export const darkColors = {
  primary: "0 0% 98%",
  primaryForeground: "240 5.9% 10%",
  secondary: "240 3.7% 15.9%",
  secondaryForeground: "0 0% 98%",
  accent: "240 3.7% 15.9%",
  accentForeground: "0 0% 98%",
  background: "240 10% 3.9%",
  foreground: "0 0% 98%",
  muted: "240 3.7% 15.9%",
  mutedForeground: "240 5% 64.9%",
  border: "240 3.7% 15.9%",
  ring: "240 4.9% 83.9%",
  destructive: "0 62.8% 30.6%",
  destructiveForeground: "0 0% 98%",
  success: "142.1 70.6% 45.3%",
  successForeground: "0 0% 98%",
  warning: "38 92% 50%",
  warningForeground: "0 0% 98%",
  info: "217.2 91.2% 59.8%",
  infoForeground: "0 0% 98%",
  card: "240 10% 3.9%",
  cardForeground: "0 0% 98%",
  popover: "240 10% 3.9%",
  popoverForeground: "0 0% 98%",
  chart1: "220 70% 50%",
  chart2: "160 60% 45%",
  chart3: "30 80% 55%",
  chart4: "280 65% 60%",
  chart5: "340 75% 55%",
} as const;

/* ── Spacing (4px base, 0.25rem increments) ──────────────────── */

export const spacing = {
  0: "0px",
  0.5: "0.125rem",  // 2px
  1: "0.25rem",      // 4px
  1.5: "0.375rem",   // 6px
  2: "0.5rem",       // 8px
  2.5: "0.625rem",   // 10px
  3: "0.75rem",      // 12px
  3.5: "0.875rem",   // 14px
  4: "1rem",         // 16px
  5: "1.25rem",      // 20px
  6: "1.5rem",       // 24px
  8: "2rem",         // 32px
  10: "2.5rem",      // 40px
  12: "3rem",        // 48px
  16: "4rem",        // 64px
  20: "5rem",        // 80px
  24: "6rem",        // 96px
} as const;

/* ── Border radius ───────────────────────────────────────────── */

export const borderRadius = {
  none: "0px",
  sm: "4px",   // 0.25rem
  md: "6px",   // calc(0.5rem - 2px) — shadcn default
  lg: "8px",   // 0.5rem
  xl: "12px",  // 0.75rem
  full: "9999px",
} as const;

/* ── Typography ──────────────────────────────────────────────── */

export const fontFamily = {
  sans: '"Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
} as const;

export const fontSize = {
  xs: ["0.75rem", { lineHeight: "1rem" }],
  sm: ["0.875rem", { lineHeight: "1.25rem" }],
  base: ["1rem", { lineHeight: "1.5rem" }],
  lg: ["1.125rem", { lineHeight: "1.75rem" }],
  xl: ["1.25rem", { lineHeight: "1.75rem" }],
  "2xl": ["1.5rem", { lineHeight: "2rem" }],
  "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
} as const;

/* ── Breakpoints ─────────────────────────────────────────────── */

export const breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
} as const;

/* ── Shadow ──────────────────────────────────────────────────── */

export const shadow = {
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
} as const;
