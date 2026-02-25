/**
 * Theme token definitions and CSS variable generation.
 *
 * Produces a Record<string, string> of `--<variable>: <value>` pairs
 * that can be applied to the document root (or a wrapper div) at runtime.
 */

import {
  colors,
  darkColors,
  borderRadius,
  fontFamily,
} from "../styles/tokens.js";

/* ── Types ───────────────────────────────────────────────────── */

export interface ThemeTokens {
  /** HSL triplet strings keyed by semantic name */
  colors: Record<string, string>;
  radius: string;
  fontSans: string;
  fontMono: string;
}

/* ── Default themes ──────────────────────────────────────────── */

export const lightTheme: ThemeTokens = {
  colors: { ...colors },
  radius: borderRadius.md,
  fontSans: fontFamily.sans,
  fontMono: fontFamily.mono,
};

export const darkTheme: ThemeTokens = {
  colors: { ...darkColors },
  radius: borderRadius.md,
  fontSans: fontFamily.sans,
  fontMono: fontFamily.mono,
};

/* ── CSS variable generation ─────────────────────────────────── */

/**
 * Convert a camelCase key to a kebab-case CSS variable name.
 * e.g. "primaryForeground" → "primary-foreground"
 */
function toKebab(key: string): string {
  return key.replace(/([A-Z])/g, "-$1").toLowerCase();
}

/**
 * Generate a flat record of CSS custom-property assignments from a ThemeTokens.
 * Returns entries like `{ "--primary": "240 5.9% 10%", "--radius": "6px", ... }`.
 */
export function themeToCSS(theme: ThemeTokens): Record<string, string> {
  const vars: Record<string, string> = {};

  for (const [key, value] of Object.entries(theme.colors)) {
    vars[`--${toKebab(key)}`] = value;
  }

  vars["--radius"] = theme.radius;
  vars["--font-sans"] = theme.fontSans;
  vars["--font-mono"] = theme.fontMono;

  return vars;
}

/**
 * Build a CSS string that can be injected into a `<style>` tag.
 *
 * @param selector — The CSS selector to scope variables to (default `:root`).
 */
export function themeToStyleString(
  theme: ThemeTokens,
  selector = ":root",
): string {
  const vars = themeToCSS(theme);
  const entries = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  return `${selector} {\n${entries}\n}`;
}
