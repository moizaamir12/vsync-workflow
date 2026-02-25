/**
 * Cursor-based pagination utilities.
 *
 * Cursors are base64-encoded JSON containing the sort field value
 * and the row's primary key, making them opaque to the client while
 * giving the server everything it needs for a keyset query.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 250;

/** Shape of the decoded cursor payload. */
export interface CursorPayload {
  id: string;
  sortField: string;
  sortValue: string;
}

/** Pagination metadata included in every list response. */
export interface PaginationMeta {
  cursor: string | null;
  hasMore: boolean;
  total?: number;
}

/** Clamp the requested limit to [1, MAX_LIMIT]. */
export function clampLimit(raw?: string | number): number {
  const n = typeof raw === "string" ? parseInt(raw, 10) : (raw ?? DEFAULT_LIMIT);
  if (Number.isNaN(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

/** Encode a cursor payload to an opaque base64 string. */
export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

/**
 * Decode an opaque cursor string back to its payload.
 * Returns null when the cursor is missing or malformed —
 * callers treat null as "start from the beginning".
 */
export function decodeCursor(raw?: string | null): CursorPayload | null {
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, "base64url").toString("utf-8");
    const parsed = JSON.parse(json) as CursorPayload;
    if (!parsed.id || !parsed.sortField) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Build the pagination meta object from a result set.
 * We fetch limit + 1 rows to know if there's a next page.
 */
export function buildPaginationMeta<T extends { id: string }>(
  rows: T[],
  limit: number,
  sortField: string,
  getSortValue: (row: T) => string,
  total?: number,
): { items: T[]; meta: PaginationMeta } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const lastItem = items[items.length - 1];

  const cursor = lastItem && hasMore
    ? encodeCursor({ id: lastItem.id, sortField, sortValue: getSortValue(lastItem) })
    : null;

  return {
    items,
    meta: { cursor, hasMore, total },
  };
}
