# Table Block (`ui_table`)

Display tabular data with search, selection, and actions.

## When to Use
- Showing lists of records
- Data review and selection
- Search and filter interfaces

## Required Fields
- `ui_table_data` — Array of objects to display

## Optional Fields
| Field | Default | Notes |
|-------|---------|-------|
| `ui_table_columns` | null | Column definitions (auto-detected if null) |
| `ui_table_title` | "" | Table heading |
| `ui_table_searchable` | false | Enable search filtering |
| `ui_table_selectable` | false | Enable row selection |
| `ui_table_bind_value` | null | State key for selected rows |
| `ui_table_row_actions` | null | Action buttons per row |

## Column Definition Shape
```json
{ "key": "fieldName", "label": "Display Header", "width": 200 }
```

## Example
```json
{
  "ui_table_data": "$state.employees",
  "ui_table_title": "Team Members",
  "ui_table_columns": [
    { "key": "name", "label": "Name" },
    { "key": "role", "label": "Role" },
    { "key": "email", "label": "Email" }
  ],
  "ui_table_searchable": true,
  "ui_table_selectable": true,
  "ui_table_bind_value": "selectedEmployees"
}
```
