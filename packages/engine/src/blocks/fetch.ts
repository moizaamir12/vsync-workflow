import type { Block, WorkflowContext } from "@vsync/shared-types";
import type { BlockResult } from "../types.js";
import { ContextManager } from "../core/ContextManager.js";

/**
 * HTTP Fetch block executor.
 *
 * Performs HTTP requests with retry logic, exponential backoff,
 * timeout via AbortController, SSRF protection, and status code validation.
 *
 * Binding: fetch_bind_value → $state.key
 */
export async function fetchExecutor(
  block: Block,
  context: WorkflowContext,
): Promise<BlockResult> {
  const cm = new ContextManager();
  const logic = block.logic;

  const url = String(resolveDynamic(cm, logic.fetch_url, context) ?? "");
  const method = String(resolveDynamic(cm, logic.fetch_method, context) ?? "GET").toUpperCase();
  const rawBody = resolveDynamic(cm, logic.fetch_body, context);
  const rawHeaders = resolveDynamic(cm, logic.fetch_headers, context);
  const acceptedCodes = resolveDynamic(cm, logic.fetch_accepted_status_codes, context);
  const timeoutMs = Number(resolveDynamic(cm, logic.fetch_timeout_ms, context) ?? 30_000);
  const maxRetries = Number(resolveDynamic(cm, logic.fetch_max_retries, context) ?? 1);
  const retryDelayMs = Number(resolveDynamic(cm, logic.fetch_retry_delay_ms, context) ?? 1_000);
  const backoffMultiplier = Number(resolveDynamic(cm, logic.fetch_backoff_multiplier, context) ?? 2);

  /* Validate URL */
  if (!url) throw new Error("fetch_url is required");

  /* SSRF protection: block private/internal IPs */
  assertSafeUrl(url);

  /* Build headers */
  const headers: Record<string, string> = {};
  if (rawHeaders !== null && typeof rawHeaders === "object" && !Array.isArray(rawHeaders)) {
    for (const [key, val] of Object.entries(rawHeaders as Record<string, unknown>)) {
      headers[key] = String(val);
    }
  }

  /* Build body */
  let body: string | undefined;
  if (rawBody !== undefined && rawBody !== null) {
    body = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody);
  }

  /* Build accepted status code patterns */
  const patterns = parseAcceptedCodes(acceptedCodes);

  /* Execute with retry */
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = retryDelayMs * Math.pow(backoffMultiplier, attempt - 1);
      await sleep(delay);
    }

    try {
      const result = await executeRequest(url, method, headers, body, timeoutMs);

      /* Validate status code */
      if (!matchesStatusCode(result.status, patterns)) {
        throw new Error(
          `HTTP ${result.status} ${result.statusText} — status not in accepted codes`,
        );
      }

      const bindTo = logic.fetch_bind_value as string | undefined;
      if (bindTo) {
        return { stateDelta: { [extractBindKey(bindTo)]: result } };
      }
      return {};
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      /* Don't retry on SSRF errors or validation errors */
      if (lastError.message.includes("SSRF") || lastError.message.includes("status not in accepted")) {
        /* On last attempt for status mismatch, still throw */
        if (lastError.message.includes("SSRF")) throw lastError;
        if (attempt === maxRetries - 1) throw lastError;
      }
    }
  }

  throw lastError ?? new Error("Fetch failed after retries");
}

/* ── Request execution ───────────────────────────────── */

interface FetchResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
}

async function executeRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | undefined,
  timeoutMs: number,
): Promise<FetchResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: method !== "GET" && method !== "HEAD" ? body : undefined,
      signal: controller.signal,
    });

    /* Extract response headers */
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    /* Auto-parse JSON if content-type indicates it */
    const contentType = response.headers.get("content-type") ?? "";
    let responseBody: unknown;

    if (contentType.includes("application/json")) {
      responseBody = await response.json();
    } else {
      responseBody = await response.text();
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
    };
  } finally {
    clearTimeout(timer);
  }
}

/* ── SSRF protection ─────────────────────────────────── */

/**
 * Block list for private/internal IP ranges:
 * 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16,
 * 169.254.0.0/16, 0.0.0.0/8, ::1, fc00::/7, fe80::/10
 */
const PRIVATE_IP_PATTERNS: RegExp[] = [
  /* IPv4 loopback */
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /* IPv4 Class A private */
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /* IPv4 172.16.0.0/12 */
  /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/,
  /* IPv4 Class C private */
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  /* IPv4 link-local */
  /^169\.254\.\d{1,3}\.\d{1,3}$/,
  /* IPv4 zero network */
  /^0\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /* IPv6 loopback */
  /^::1$/,
  /* IPv6 unique local (fc00::/7) */
  /^f[cd][0-9a-f]{2}:/i,
  /* IPv6 link-local (fe80::/10) */
  /^fe[89ab][0-9a-f]:/i,
];

/**
 * Check if an IP address is in the private/internal block list.
 * Exported for testing.
 */
export function isPrivateIp(ip: string): boolean {
  const trimmed = ip.trim();
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Validate that a URL does not point to a private/internal address.
 * Checks the hostname directly (catches IP literals in URLs).
 */
function assertSafeUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: "${url}"`);
  }

  const hostname = parsed.hostname;

  /* Strip IPv6 brackets if present */
  const cleanHost = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;

  /* Block localhost by name */
  if (cleanHost === "localhost" || cleanHost.endsWith(".local")) {
    throw new Error(`SSRF blocked: hostname "${cleanHost}" resolves to a local address`);
  }

  /* Check IP patterns */
  if (isPrivateIp(cleanHost)) {
    throw new Error(`SSRF blocked: "${cleanHost}" is a private/internal IP`);
  }
}

/* ── Status code matching ────────────────────────────── */

/**
 * Parse accepted status code patterns.
 * Patterns can be exact ("404"), partial wildcards ("2xx", "20x"), etc.
 * 'x' is a wildcard matching any single digit.
 */
function parseAcceptedCodes(raw: unknown): string[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map(String);
  }
  /* Default: accept all 2xx */
  return ["2xx"];
}

/**
 * Check if a status code matches any of the accepted patterns.
 * Pattern: each 'x' (case-insensitive) matches any single digit.
 */
export function matchesStatusCode(status: number, patterns: string[]): boolean {
  const statusStr = String(status);
  return patterns.some((pattern) => {
    const p = pattern.toLowerCase();
    if (p.length !== statusStr.length) return false;
    for (let i = 0; i < p.length; i++) {
      if (p[i] === "x") continue;
      if (p[i] !== statusStr[i]) return false;
    }
    return true;
  });
}

/* ── Helpers ──────────────────────────────────────────── */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
