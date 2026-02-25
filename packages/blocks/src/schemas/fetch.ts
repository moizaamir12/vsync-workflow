import type { BlockSchema } from "./types.js";

export const FETCH_SCHEMA: BlockSchema = {
  required: ["fetch_url"],
  optional: {
    fetch_method: {
      default: "GET",
      enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    },
    fetch_headers: { default: {} },
    fetch_body: { default: null },
    fetch_timeout_ms: { default: 30000 },
    fetch_max_retries: { default: 1 },
    fetch_retry_delay_ms: { default: 1000 },
    fetch_backoff_multiplier: { default: 2 },
    fetch_accepted_status_codes: { default: ["2xx", "3xx"] },
    fetch_bind_value: { default: null },
  },
  commonMistakes: {
    url: "fetch_url",
    method: "fetch_method",
    body: "fetch_body",
    headers: "fetch_headers",
    timeout: "fetch_timeout_ms",
    retries: "fetch_max_retries",
    bind_value: "fetch_bind_value",
  },
} as const;
