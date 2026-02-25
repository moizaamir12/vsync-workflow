# Form Block (`ui_form`)

Display an input form and collect user responses.

## When to Use
- Collecting structured input from users
- Data entry workflows
- Configuration forms
- Survey/feedback collection

## Required Fields
- `ui_form_fields` — Array of field definitions

## Optional Fields
| Field | Default | Notes |
|-------|---------|-------|
| `ui_form_title` | "" | Form heading text |
| `ui_form_submit_label` | "Submit" | Submit button text |
| `ui_form_bind_value` | null | State key for form data |

## Field Types
text, number, email, password, select, multiselect, checkbox, toggle, date, textarea

## Field Definition Shape
```json
{
  "key": "fieldName",
  "label": "Display Label",
  "type": "text",
  "required": true,
  "placeholder": "Hint text",
  "options": ["Option A", "Option B"]
}
```

## Example
```json
{
  "ui_form_title": "Contact Information",
  "ui_form_fields": [
    { "key": "name", "label": "Full Name", "type": "text", "required": true },
    { "key": "email", "label": "Email", "type": "email", "required": true },
    { "key": "message", "label": "Message", "type": "textarea", "required": false }
  ],
  "ui_form_submit_label": "Send",
  "ui_form_bind_value": "contactForm"
}
```

## Notes
- UI blocks pause workflow execution until the user submits
- Form data is stored as an object with field keys as properties
