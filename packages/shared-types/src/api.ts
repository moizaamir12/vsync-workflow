/**
 * Structured error returned by all API endpoints.
 * Consumers can programmatically react to `code` while
 * displaying `message` to end users.
 */
export interface ApiError {
  /** Machine-readable error code (e.g. "WORKFLOW_NOT_FOUND", "RATE_LIMITED") */
  code: string;

  /** Human-readable error description */
  message: string;

  /** Optional additional context (validation errors, upstream responses, etc.) */
  details?: unknown;
}

/**
 * Pagination metadata included in list responses.
 * Supports both offset-based and cursor-based pagination
 * so consumers can choose the pattern that fits their UI.
 */
export interface ApiMeta {
  /** Current page number (1-based, offset pagination) */
  page?: number;

  /** Number of items per page */
  pageSize?: number;

  /** Total number of items across all pages */
  total?: number;

  /** Opaque cursor for fetching the next page (cursor pagination) */
  cursor?: string;
}

/**
 * Canonical envelope for every API response.
 * All endpoints — success or failure — return this shape
 * so clients can use a single deserialization path.
 *
 * @typeParam T - The type of the `data` payload
 */
export interface ApiResponse<T> {
  /** Response payload — present on success */
  data: T;

  /** Structured error — present on failure */
  error?: ApiError;

  /** Pagination and other metadata */
  meta?: ApiMeta;
}

/**
 * Query parameters accepted by paginated list endpoints.
 * Supports both offset and cursor strategies — supply either
 * `page`/`pageSize` or `cursor`, not both.
 */
export interface PaginationParams {
  /** Desired page number (1-based) */
  page?: number;

  /** Number of items per page */
  pageSize?: number;

  /** Opaque cursor from a previous response's `meta.cursor` */
  cursor?: string;
}
