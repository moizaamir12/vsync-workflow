import type { MiddlewareHandler } from "hono";
import { err } from "../lib/response.js";

/**
 * In-memory sliding window rate limiter for public workflow runs.
 *
 * Uses a Map of IP hashes → timestamp arrays. Entries older than the
 * window are pruned on each check. This is intentionally simple and
 * memory-efficient for single-process deployments. For multi-process
 * or serverless, replace with Redis-backed rate limiting.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

/** Prune entries older than `windowMs` from a timestamps array. */
function pruneOld(timestamps: number[], windowMs: number, now: number): number[] {
  const cutoff = now - windowMs;
  return timestamps.filter((t) => t > cutoff);
}

/** Periodically clean up stale entries to avoid memory leaks. */
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      const fresh = pruneOld(entry.timestamps, 120_000, now);
      if (fresh.length === 0) {
        store.delete(key);
      } else {
        entry.timestamps = fresh;
      }
    }
  }, 60_000);
  /* Allow the process to exit even if the interval is still running */
  if (typeof cleanupInterval === "object" && "unref" in cleanupInterval) {
    cleanupInterval.unref();
  }
}

/**
 * Sliding window rate limiter middleware for public API routes.
 *
 * @param maxRequests - Maximum requests per window.
 * @param windowMs   - Window duration in milliseconds (default 60s).
 *
 * Reads the client IP from the X-Forwarded-For header (reverse proxy)
 * or falls back to the connecting address. Returns 429 Too Many Requests
 * with a Retry-After header when the limit is exceeded.
 */
export function publicRateLimit(
  maxRequests = 10,
  windowMs = 60_000,
): MiddlewareHandler {
  ensureCleanup();

  return async (c, next) => {
    const forwarded = c.req.header("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";

    /* Combine IP with slug for per-slug rate limiting */
    const slug = c.req.param("slug") ?? "global";
    const key = `${ip}:${slug}`;

    const now = Date.now();
    const entry = store.get(key) ?? { timestamps: [] };

    /* Prune expired timestamps */
    entry.timestamps = pruneOld(entry.timestamps, windowMs, now);

    if (entry.timestamps.length >= maxRequests) {
      const oldestInWindow = entry.timestamps[0] ?? now;
      const retryAfterSec = Math.ceil((oldestInWindow + windowMs - now) / 1000);

      c.header("Retry-After", String(retryAfterSec));
      c.header("X-RateLimit-Limit", String(maxRequests));
      c.header("X-RateLimit-Remaining", "0");
      c.header("X-RateLimit-Reset", String(Math.ceil((oldestInWindow + windowMs) / 1000)));

      return err(c, "RATE_LIMITED", "Too many requests. Please try again later.", 429);
    }

    /* Record this request */
    entry.timestamps.push(now);
    store.set(key, entry);

    /* Set rate limit headers */
    c.header("X-RateLimit-Limit", String(maxRequests));
    c.header("X-RateLimit-Remaining", String(maxRequests - entry.timestamps.length));

    await next();
  };
}
