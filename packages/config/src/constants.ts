// ── Workflow limits ──────────────────────────────────────────────────

/** Maximum characters allowed in a workflow name. */
export const MAX_WORKFLOW_NAME_LENGTH = 100;

/** Maximum number of blocks a single workflow version can contain. */
export const MAX_BLOCK_COUNT = 200;

/** Hard ceiling for a single run's wall-clock duration (10 minutes). */
export const MAX_RUN_DURATION_MS = 600_000;

/** Longest a sleep block is allowed to pause execution (5 minutes). */
export const MAX_SLEEP_DURATION_MS = 300_000;

/** HTTP timeout for fetch blocks — keeps workflows from stalling on slow APIs. */
export const MAX_FETCH_TIMEOUT_MS = 60_000;

/** Maximum parallel deferred iterations to prevent resource exhaustion. */
export const MAX_CONCURRENT_DEFERRED = 10;

/** Maximum goto-chain depth before the engine aborts to prevent infinite loops. */
export const MAX_GOTO_DEPTH = 50;

// ── Pagination ──────────────────────────────────────────────────────

/** Default page size when the client doesn't specify one. */
export const PAGINATION_DEFAULT_SIZE = 50;

/** Maximum page size to prevent overly large responses. */
export const PAGINATION_MAX_SIZE = 250;

// ── Tier limits ─────────────────────────────────────────────────────

/** Resource limits for each plan tier. `-1` means unlimited. */
export interface TierLimits {
  /** Maximum number of workflows (-1 = unlimited) */
  workflows: number;
  /** Maximum runs per billing period (-1 = unlimited) */
  runsPerMonth: number;
  /** Maximum AI/agent requests per billing period (-1 = unlimited) */
  aiRequestsPerMonth: number;
}

/** Free tier — restrictive limits to encourage upgrades. */
export const FREE_TIER_LIMITS: TierLimits = {
  workflows: 5,
  runsPerMonth: 500,
  aiRequestsPerMonth: 50,
};

/** Pro tier — generous limits for individual power users and small teams. */
export const PRO_TIER_LIMITS: TierLimits = {
  workflows: -1,
  runsPerMonth: 10_000,
  aiRequestsPerMonth: 1_000,
};

/**
 * Enterprise tier — effectively unlimited across all dimensions.
 * Uses `Infinity` so comparisons like `usage < limit` always pass.
 */
export const ENTERPRISE_TIER_LIMITS: TierLimits = {
  workflows: Infinity,
  runsPerMonth: Infinity,
  aiRequestsPerMonth: Infinity,
};

// ── Reserved variable prefixes ──────────────────────────────────────

/**
 * Prefixes reserved by the engine for built-in context namespaces.
 * User-defined variables must not start with any of these —
 * the designer validates this on save to prevent collisions.
 */
export const RESERVED_VARIABLE_PREFIXES: readonly string[] = [
  "$state",
  "$cache",
  "$artifacts",
  "$secrets",
  "$paths",
  "$event",
  "$run",
  "$error",
  "$now",
  "$loop",
  "$row",
  "$item",
  "$index",
  "$keys",
  "$block",
] as const;
