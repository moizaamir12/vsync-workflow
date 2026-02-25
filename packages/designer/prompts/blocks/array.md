# Array Block (`array`)

Slice, filter, sort, pluck, merge, and convert arrays.

## When to Use
- Filtering lists of items
- Sorting data
- Extracting specific fields from array of objects
- Combining multiple arrays

## Required Fields
- `array_operation` — The operation to perform
- `array_input` — The input array

## Operations
slice, find, filter, pluck, sort, flatten, add, drop, remove, merge, convert

## Key Optional Fields
| Field | Default | Notes |
|-------|---------|-------|
| `array_filter_mode` | "equals" | Filter comparison mode |
| `array_filter_field` | null | Field to filter on |
| `array_filter_value` | null | Value to filter for |
| `array_sort_field` | null | Field to sort by |
| `array_sort_direction` | "asc" | "asc" or "desc" |
| `array_pluck_fields` | null | Fields to extract |
| `array_bind_value` | null | State key for the result |

## Example
```json
{
  "array_operation": "filter",
  "array_input": "$state.users",
  "array_filter_mode": "equals",
  "array_filter_field": "role",
  "array_filter_value": "admin",
  "array_bind_value": "admins"
}
```
