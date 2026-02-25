import type { Block, WorkflowContext } from "@vsync/shared-types";
import type { BlockResult } from "../types.js";
import { ContextManager } from "../core/ContextManager.js";

/**
 * Normalize block executor.
 *
 * Operations: normalize_country, normalize_currency, normalize_weight,
 * normalize_length, normalize_uom, normalize_vertices
 * Binding: normalize_bind_value_to → $state.key
 */
export async function normalizeExecutor(
  block: Block,
  context: WorkflowContext,
): Promise<BlockResult> {
  const cm = new ContextManager();
  const logic = block.logic;
  const operation = resolveDynamic(cm, logic.normalize_operation, context) as string;
  const input = resolveDynamic(cm, logic.normalize_input, context);

  let result: unknown;

  switch (operation) {
    case "normalize_country":
      result = normalizeCountry(String(input ?? ""));
      break;
    case "normalize_currency":
      result = normalizeCurrency(String(input ?? ""));
      break;
    case "normalize_weight":
      result = normalizeWeight(cm, String(input ?? ""), logic, context);
      break;
    case "normalize_length":
      result = normalizeLength(cm, String(input ?? ""), logic, context);
      break;
    case "normalize_uom":
      result = normalizeUom(cm, String(input ?? ""), logic, context);
      break;
    case "normalize_vertices":
      result = normalizeVertices(input);
      break;
    default:
      throw new Error(`Unknown normalize operation: "${operation}"`);
  }

  const bindTo = logic.normalize_bind_value_to as string | undefined;
  if (bindTo) {
    return { stateDelta: { [extractBindKey(bindTo)]: result } };
  }
  return {};
}

/* ── Country normalization ────────────────────────────── */

/** ISO 3166-1: Map common representations → alpha-2 */
const COUNTRY_MAP: Record<string, string> = {
  /* Alpha-3 → Alpha-2 */
  "USA": "US", "GBR": "GB", "CAN": "CA", "AUS": "AU", "DEU": "DE",
  "FRA": "FR", "JPN": "JP", "CHN": "CN", "IND": "IN", "BRA": "BR",
  "MEX": "MX", "KOR": "KR", "ESP": "ES", "ITA": "IT", "RUS": "RU",
  "NLD": "NL", "CHE": "CH", "SWE": "SE", "NOR": "NO", "DNK": "DK",
  "FIN": "FI", "POL": "PL", "AUT": "AT", "BEL": "BE", "PRT": "PT",
  "GRC": "GR", "IRL": "IE", "NZL": "NZ", "SGP": "SG", "HKG": "HK",
  "TWN": "TW", "THA": "TH", "MYS": "MY", "PHL": "PH", "IDN": "ID",
  "VNM": "VN", "ARE": "AE", "SAU": "SA", "ZAF": "ZA", "EGY": "EG",
  "NGA": "NG", "KEN": "KE", "ARG": "AR", "COL": "CO", "CHL": "CL",
  "PER": "PE", "ISR": "IL", "TUR": "TR", "UKR": "UA", "CZE": "CZ",
  "HUN": "HU", "ROU": "RO", "BGR": "BG", "HRV": "HR", "SVK": "SK",
  /* Numeric → Alpha-2 */
  "840": "US", "826": "GB", "124": "CA", "036": "AU", "276": "DE",
  "250": "FR", "392": "JP", "156": "CN", "356": "IN", "076": "BR",
  "484": "MX", "410": "KR", "724": "ES", "380": "IT", "643": "RU",
  "528": "NL", "756": "CH", "752": "SE", "578": "NO", "208": "DK",
  /* Common names → Alpha-2 */
  "UNITED STATES": "US", "UNITED STATES OF AMERICA": "US",
  "UNITED KINGDOM": "GB", "GREAT BRITAIN": "GB", "ENGLAND": "GB",
  "CANADA": "CA", "AUSTRALIA": "AU", "GERMANY": "DE", "FRANCE": "FR",
  "JAPAN": "JP", "CHINA": "CN", "INDIA": "IN", "BRAZIL": "BR",
  "MEXICO": "MX", "SOUTH KOREA": "KR", "SPAIN": "ES", "ITALY": "IT",
  "RUSSIA": "RU", "NETHERLANDS": "NL", "SWITZERLAND": "CH",
  "SWEDEN": "SE", "NORWAY": "NO", "DENMARK": "DK", "FINLAND": "FI",
  "IRELAND": "IE", "NEW ZEALAND": "NZ", "SINGAPORE": "SG",
  "SOUTH AFRICA": "ZA", "ARGENTINA": "AR", "COLOMBIA": "CO",
  "ISRAEL": "IL", "TURKEY": "TR", "UKRAINE": "UA",
};

/** All valid alpha-2 codes */
const VALID_ALPHA2 = new Set([
  "US", "GB", "CA", "AU", "DE", "FR", "JP", "CN", "IN", "BR",
  "MX", "KR", "ES", "IT", "RU", "NL", "CH", "SE", "NO", "DK",
  "FI", "PL", "AT", "BE", "PT", "GR", "IE", "NZ", "SG", "HK",
  "TW", "TH", "MY", "PH", "ID", "VN", "AE", "SA", "ZA", "EG",
  "NG", "KE", "AR", "CO", "CL", "PE", "IL", "TR", "UA", "CZ",
  "HU", "RO", "BG", "HR", "SK",
]);

function normalizeCountry(input: string): string | null {
  const trimmed = input.trim().toUpperCase();
  if (VALID_ALPHA2.has(trimmed)) return trimmed;
  return COUNTRY_MAP[trimmed] ?? null;
}

/* ── Currency normalization ───────────────────────────── */

/** Map symbols and common names → ISO 4217 */
const CURRENCY_MAP: Record<string, string> = {
  "$": "USD", "US$": "USD", "USD": "USD", "DOLLAR": "USD", "DOLLARS": "USD",
  "£": "GBP", "GBP": "GBP", "POUND": "GBP", "POUNDS": "GBP",
  "€": "EUR", "EUR": "EUR", "EURO": "EUR", "EUROS": "EUR",
  "¥": "JPY", "JPY": "JPY", "YEN": "JPY",
  "C$": "CAD", "CA$": "CAD", "CAD": "CAD",
  "A$": "AUD", "AU$": "AUD", "AUD": "AUD",
  "CHF": "CHF", "FRANC": "CHF", "FRANCS": "CHF",
  "元": "CNY", "CN¥": "CNY", "CNY": "CNY", "RMB": "CNY", "YUAN": "CNY",
  "₹": "INR", "INR": "INR", "RUPEE": "INR", "RUPEES": "INR",
  "R$": "BRL", "BRL": "BRL", "REAL": "BRL",
  "₩": "KRW", "KRW": "KRW", "WON": "KRW",
  "MXN": "MXN", "MX$": "MXN", "PESO": "MXN", "PESOS": "MXN",
  "SEK": "SEK", "NOK": "NOK", "DKK": "DKK",
  "PLN": "PLN", "ZŁ": "PLN",
  "SGD": "SGD", "S$": "SGD",
  "HKD": "HKD", "HK$": "HKD",
  "NZD": "NZD", "NZ$": "NZD",
  "ZAR": "ZAR",
  "TRY": "TRY", "₺": "TRY",
  "THB": "THB", "฿": "THB",
  "AED": "AED",
  "SAR": "SAR",
};

function normalizeCurrency(input: string): string | null {
  const trimmed = input.trim().toUpperCase();
  return CURRENCY_MAP[trimmed] ?? CURRENCY_MAP[input.trim()] ?? null;
}

/* ── Weight normalization ─────────────────────────────── */

const WEIGHT_TO_GRAMS: Record<string, number> = {
  "mg": 0.001,
  "g": 1,
  "kg": 1000,
  "t": 1_000_000,
  "oz": 28.3495,
  "lb": 453.592,
  "lbs": 453.592,
  "ton": 907_185,
};

function normalizeWeight(
  cm: ContextManager,
  input: string,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): number | null {
  const targetUnit = String(resolveDynamic(cm, logic.normalize_target_unit, context) ?? "g");
  const parsed = parseUnitValue(input, WEIGHT_TO_GRAMS);
  if (parsed === null) return null;

  const targetFactor = WEIGHT_TO_GRAMS[targetUnit];
  if (!targetFactor) return null;

  return parsed / targetFactor;
}

/* ── Length normalization ─────────────────────────────── */

const LENGTH_TO_MM: Record<string, number> = {
  "mm": 1,
  "cm": 10,
  "m": 1000,
  "km": 1_000_000,
  "in": 25.4,
  "ft": 304.8,
  "yd": 914.4,
  "mi": 1_609_344,
};

function normalizeLength(
  cm: ContextManager,
  input: string,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): number | null {
  const targetUnit = String(resolveDynamic(cm, logic.normalize_target_unit, context) ?? "mm");
  const parsed = parseUnitValue(input, LENGTH_TO_MM);
  if (parsed === null) return null;

  const targetFactor = LENGTH_TO_MM[targetUnit];
  if (!targetFactor) return null;

  return parsed / targetFactor;
}

/* ── Generic UOM normalization ────────────────────────── */

function normalizeUom(
  cm: ContextManager,
  input: string,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): number | null {
  const category = resolveDynamic(cm, logic.normalize_category, context) as string;

  if (category === "weight") return normalizeWeight(cm, input, logic, context);
  if (category === "length") return normalizeLength(cm, input, logic, context);

  throw new Error(`Unknown UOM category: "${category}"`);
}

/* ── Vertex normalization ─────────────────────────────── */

function normalizeVertices(input: unknown): [number, number][] | null {
  if (!Array.isArray(input)) return null;

  /* Find bounds */
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  const points: [number, number][] = [];

  for (const point of input) {
    if (!Array.isArray(point) || point.length < 2) return null;
    const x = Number(point[0]);
    const y = Number(point[1]);
    if (Number.isNaN(x) || Number.isNaN(y)) return null;

    points.push([x, y]);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  if (points.length === 0) return [];

  const rangeX = maxX - minX;
  const rangeY = maxY - minY;

  /* Avoid division by zero when all points share a coordinate */
  if (rangeX === 0 && rangeY === 0) {
    return points.map(() => [0.5, 0.5]);
  }

  return points.map(([x, y]) => [
    rangeX === 0 ? 0.5 : (x - minX) / rangeX,
    rangeY === 0 ? 0.5 : (y - minY) / rangeY,
  ]);
}

/* ── Helpers ──────────────────────────────────────────── */

/**
 * Parse a string like "1000g" or "2.5 kg" into base units (grams/mm).
 * Returns the value in base units, or null if unparseable.
 */
function parseUnitValue(
  input: string,
  unitTable: Record<string, number>,
): number | null {
  const trimmed = input.trim().toLowerCase();

  /* Try matching number + unit */
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*([a-z]+)$/);
  if (!match) return null;

  const value = Number(match[1]);
  const unit = match[2];
  const factor = unitTable[unit];

  if (factor === undefined) return null;
  return value * factor;
}

function resolveDynamic(
  cm: ContextManager,
  value: unknown,
  context: WorkflowContext,
): unknown {
  return cm.resolveValue(value, context);
}

function extractBindKey(bindTo: string): string {
  if (bindTo.startsWith("$state.")) return bindTo.slice(7);
  return bindTo;
}
