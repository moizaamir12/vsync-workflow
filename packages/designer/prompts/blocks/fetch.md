# HTTP Fetch Block (`fetch`)

Make HTTP requests with retry, timeout, and SSRF protection.

## When to Use
- Calling external APIs (REST, GraphQL)
- Downloading data from the web
- Sending data to webhooks or external services

## Required Fields
- `fetch_url` — The URL to request (supports $state and $keys references)

## Key Optional Fields
| Field | Default | Notes |
|-------|---------|-------|
| `fetch_method` | "GET" | GET, POST, PUT, DELETE, PATCH |
| `fetch_headers` | {} | Key-value pairs for HTTP headers |
| `fetch_body` | null | Request body (for POST/PUT/PATCH) |
| `fetch_timeout_ms` | 30000 | Request timeout in milliseconds |
| `fetch_max_retries` | 1 | Number of retry attempts |
| `fetch_retry_delay_ms` | 1000 | Delay between retries |
| `fetch_backoff_multiplier` | 2 | Exponential backoff factor |
| `fetch_accepted_status_codes` | ["2xx","3xx"] | Status codes to treat as success |
| `fetch_bind_value` | null | State key to store the response |

## Example
```json
{
  "fetch_url": "https://api.example.com/data",
  "fetch_method": "GET",
  "fetch_headers": { "Authorization": "Bearer $keys.API_TOKEN" },
  "fetch_timeout_ms": 10000,
  "fetch_bind_value": "apiResponse"
}
```

## Common Mistakes
- `url` → use `fetch_url`
- `method` → use `fetch_method`
- `body` → use `fetch_body`
- `timeout` → use `fetch_timeout_ms`
