# Code Block (`code`)

Execute JavaScript or TypeScript in a sandboxed environment.

## When to Use
- Complex data transformations that other blocks can't handle
- Custom business logic
- Mathematical computations
- String manipulation beyond built-in operations

## Required Fields
- `code_source` — The JavaScript or TypeScript code to execute

## Optional Fields
| Field | Default | Notes |
|-------|---------|-------|
| `code_language` | "javascript" | "javascript" or "typescript" |
| `code_timeout_ms` | 10000 | Execution timeout |
| `code_bind_value` | null | State key to store the return value |

## Example
```json
{
  "code_source": "const items = $state.rawData.filter(i => i.active);\nreturn { count: items.length, items };",
  "code_language": "javascript",
  "code_timeout_ms": 5000,
  "code_bind_value": "processed"
}
```

## Notes
- Code runs in a sandbox with access to `$state`, `$cache`, `$artifacts`, `$event`
- The return value is stored at the `code_bind_value` key in state
- TypeScript is transpiled to JavaScript before execution
