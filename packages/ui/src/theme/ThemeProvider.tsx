import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import {
  lightTheme,
  darkTheme,
  themeToCSS,
  type ThemeTokens,
} from "./tokens.js";

/* ── Org-level theme overrides ────────────────────────────────── */

/**
 * Per-org branding overrides configured in Settings → Appearance.
 * Values are optional — anything omitted falls back to the default theme.
 */
export interface OrgTheme {
  primaryColor?: string;
  accentColor?: string;
  logoUrl?: string;
  darkMode?: boolean;
}

/* ── Context ──────────────────────────────────────────────────── */

interface ThemeContextValue {
  theme: ThemeTokens;
  orgTheme: OrgTheme;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  orgTheme: {},
  isDark: false,
});

/* ── Helpers ──────────────────────────────────────────────────── */

/**
 * Convert a hex colour (e.g. "#3b82f6") to an HSL triplet string
 * suitable for CSS custom-property injection.
 */
function hexToHSL(hex: string): string {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.substring(0, 2), 16) / 255;
  const g = parseInt(cleaned.substring(2, 4), 16) / 255;
  const b = parseInt(cleaned.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return `0 0% ${Math.round(l * 100)}%`;
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Derive a foreground colour (light or dark) for a given hex background.
 * Uses the relative-luminance formula to decide between white and black.
 */
function foregroundForHex(hex: string): string {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "240 5.9% 10%" : "0 0% 98%";
}

/**
 * Merge the base theme with org overrides.
 */
function buildMergedTheme(base: ThemeTokens, org: OrgTheme): ThemeTokens {
  const merged = { ...base, colors: { ...base.colors } };

  if (org.primaryColor) {
    merged.colors["primary"] = hexToHSL(org.primaryColor);
    merged.colors["primaryForeground"] = foregroundForHex(org.primaryColor);
    merged.colors["ring"] = hexToHSL(org.primaryColor);
  }

  if (org.accentColor) {
    merged.colors["accent"] = hexToHSL(org.accentColor);
    merged.colors["accentForeground"] = foregroundForHex(org.accentColor);
  }

  return merged;
}

/* ── Provider component ───────────────────────────────────────── */

export interface ThemeProviderProps {
  /** Org-level overrides from the API */
  theme?: OrgTheme;
  children: ReactNode;
}

/**
 * Reads org theme, merges with the default token set, and injects
 * CSS custom-properties into a wrapper `<div>` so every child
 * component picks up the correct design tokens.
 */
export function ThemeProvider({ theme: orgTheme = {}, children }: ThemeProviderProps) {
  const isDark = orgTheme.darkMode ?? false;
  const base = isDark ? darkTheme : lightTheme;

  const merged = useMemo(
    () => buildMergedTheme(base, orgTheme),
    [base, orgTheme],
  );

  const cssVars = useMemo(() => themeToCSS(merged), [merged]);

  const ctxValue = useMemo<ThemeContextValue>(
    () => ({ theme: merged, orgTheme, isDark }),
    [merged, orgTheme, isDark],
  );

  return (
    <ThemeContext.Provider value={ctxValue}>
      <div style={cssVars as React.CSSProperties} className={isDark ? "dark" : ""}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

/* ── Hook ─────────────────────────────────────────────────────── */

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
