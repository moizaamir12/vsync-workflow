# String Block (`string`)

Slice, extract, format, replace, and generate strings.

## When to Use
- Text manipulation and formatting
- Extracting substrings or patterns
- Template string generation
- Checksums and hashing

## Required Fields
- `string_input` — The input string to operate on

## Operations (via `string_operation`)
slice, extract, format, trim, pad, replace, match, length, split, path, generate, checksum

## Key Optional Fields
| Field | Default | Notes |
|-------|---------|-------|
| `string_operation` | "format" | Operation to perform |
| `string_format_type` | null | "template", "uppercase", "lowercase", "camelCase", etc. |
| `string_format_template` | null | Template string with {{placeholders}} |
| `string_replace_search` | null | Search string for replace |
| `string_replace_value` | null | Replacement string |
| `string_bind_value` | null | State key for the result |

## Example
```json
{
  "string_input": "$state.rawText",
  "string_operation": "replace",
  "string_replace_search": "http://",
  "string_replace_value": "https://",
  "string_bind_value": "secureUrl"
}
```
