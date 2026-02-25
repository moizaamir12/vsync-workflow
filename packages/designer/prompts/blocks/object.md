# Object Block (`object`)

Create, merge, pick, omit, and manipulate objects.

## When to Use
- Creating new objects from existing data
- Extracting specific fields from API responses
- Merging data from multiple sources
- Reshaping data structures

## Required Fields
- `object_operation` — The operation to perform

## Operations
- **create**: Build a new object from scratch
- **merge**: Combine multiple objects
- **pick**: Select specific keys from an object
- **omit**: Remove specific keys from an object
- **get**: Get a nested value by path
- **set**: Set a nested value by path
- **delete**: Remove a nested value by path

## Key Optional Fields
| Field | Default | Notes |
|-------|---------|-------|
| `object_value` | null | The object value or template |
| `object_target` | null | Target object for merge/set/delete |
| `object_sources` | null | Array of objects to merge |
| `object_keys` | null | Array of keys for pick/omit |
| `object_delete_path` | null | Dot-path for delete operation |
| `object_bind_value` | null | State key for the result |

## Example
```json
{
  "object_operation": "create",
  "object_value": {
    "name": "$state.user.firstName",
    "email": "$state.user.email",
    "timestamp": "$run.startedAt"
  },
  "object_bind_value": "summary"
}
```
