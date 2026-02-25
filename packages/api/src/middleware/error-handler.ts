import type { ErrorHandler } from "hono";

/**
 * Global error handler that normalises all uncaught exceptions
 * into the standard { data, error, meta } envelope. Maps known
 * error messages to appropriate HTTP status codes so callers get
 * consistent, machine-readable responses.
 */
export const errorHandler: ErrorHandler = (err, c) => {
  const message = err.message ?? "Internal server error";

  /* Derive status from the error's cause or common patterns */
  let status = 500;
  if ("status" in err && typeof err.status === "number") {
    status = err.status;
  } else if (message.includes("not found")) {
    status = 404;
  } else if (message.includes("unauthorized") || message.includes("Authentication required")) {
    status = 401;
  } else if (message.includes("forbidden") || message.includes("Requires")) {
    status = 403;
  } else if (message.includes("conflict") || message.includes("already exists") || message.includes("locked")) {
    status = 409;
  } else if (message.includes("validation") || message.includes("invalid")) {
    status = 400;
  }

  if (status >= 500) {
    console.error(`[api] Unhandled error: ${message}`, err.stack);
  }

  return c.json(
    {
      data: null,
      error: { code: statusToCode(status), message },
      meta: undefined,
    },
    status as 400,
  );
};

function statusToCode(status: number): string {
  switch (status) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 422:
      return "UNPROCESSABLE";
    case 429:
      return "RATE_LIMITED";
    default:
      return "INTERNAL_ERROR";
  }
}
