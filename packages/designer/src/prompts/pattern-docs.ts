/**
 * Common workflow pattern documentation served by get_pattern_docs.
 * Keyed by pattern slug.
 */

const FETCH_TRANSFORM_DISPLAY = `# Fetch → Transform → Display

The most common workflow pattern: fetch data from an API, transform it, and display results.

## Blocks

1. **fetch** — Make HTTP request to external API
   - \`fetch_url\`: API endpoint (can use \`$keys\` for auth)
   - \`fetch_method\`: GET (usually)
   - \`fetch_headers\`: { "Authorization": "Bearer $keys.API_TOKEN" }
   - \`fetch_bind_value\`: "apiData"

2. **object** or **array** — Transform the response
   - Extract needed fields, reshape data
   - \`object_operation\`: "pick" or "get"
   - \`object_bind_value\`: "transformed"

3. **ui_table** or **ui_details** — Show results to user
   - \`ui_table_data\`: "$state.transformed"
   - \`ui_table_columns\`: [{ key: "name", label: "Name" }, ...]

## Example Use Cases
- Dashboard showing live metrics
- Product lookup from inventory API
- Customer data retrieval
`;

const BARCODE_SCANNING = `# Barcode Scanning

Mobile-first pattern for scanning barcodes and looking up data.

## Blocks

1. **ui_camera** — Scan barcode/QR code
   - \`ui_camera_mode\`: "barcode" or "qr"
   - \`ui_camera_title\`: "Scan Product"
   - \`ui_camera_bind_value\`: "scanResult"

2. **fetch** — Look up scanned code
   - \`fetch_url\`: "https://api.example.com/products/$state.scanResult.data"
   - \`fetch_bind_value\`: "product"

3. **ui_details** — Display product info
   - \`ui_details_data\`: "$state.product"
   - \`ui_details_layout\`: "card"

## Notes
- ui_camera is mobile-only
- Use "multi_barcode" mode for scanning multiple items in sequence
`;

const FORM_COLLECTION = `# Form Data Collection

Collect structured input from users and process it.

## Blocks

1. **ui_form** — Collect user input
   - \`ui_form_title\`: "Enter Details"
   - \`ui_form_fields\`: Array of field definitions
   - \`ui_form_bind_value\`: "formData"

2. **validation** — Validate the input
   - \`validation_input\`: "$state.formData"
   - \`validation_rules\`: Array of validation rules
   - \`validation_bind_value\`: "validationResult"

3. **fetch** — Submit to backend (conditional on validation passing)
   - Condition: \`$state.validationResult.valid\` == true
   - \`fetch_url\`: API endpoint
   - \`fetch_method\`: "POST"
   - \`fetch_body\`: "$state.formData"

## Form Field Types
text, number, email, password, select, multiselect, checkbox, toggle, date, textarea

## Field Definition Shape
\`\`\`json
{
  "key": "email",
  "label": "Email Address",
  "type": "email",
  "required": true,
  "placeholder": "user@example.com"
}
\`\`\`
`;

const DATA_PIPELINE = `# Data Pipeline

Process and transform data through multiple steps.

## Blocks

1. **fetch** — Get raw data
   - \`fetch_url\`: Data source URL
   - \`fetch_bind_value\`: "rawData"

2. **array** — Filter/sort data
   - \`array_operation\`: "filter"
   - \`array_input\`: "$state.rawData.items"
   - \`array_filter_field\`: "status"
   - \`array_filter_value\`: "active"
   - \`array_bind_value\`: "filtered"

3. **array** — Pluck needed fields
   - \`array_operation\`: "pluck"
   - \`array_input\`: "$state.filtered"
   - \`array_pluck_fields\`: ["name", "email", "score"]
   - \`array_bind_value\`: "cleaned"

4. **math** — Calculate aggregate
   - \`math_operation\`: "average"
   - \`math_input\`: "$state.cleaned"
   - \`math_bind_value\`: "avgScore"

5. **ui_table** — Display results
   - \`ui_table_data\`: "$state.cleaned"
   - \`ui_table_title\`: "Active Users (Avg: $state.avgScore)"
`;

const AI_PROCESSING = `# AI Processing

Use LLM/AI models within workflows.

## Blocks

1. **fetch** or **ui_form** — Get input data

2. **agent** — Process with AI
   - \`agent_model\`: "gpt-4o" or "claude-sonnet-4-20250514"
   - \`agent_prompt\`: "Analyze the following data and extract key insights: $state.inputData"
   - \`agent_type\`: "text" (default), "media", or "validation"
   - \`agent_json_mode\`: true (for structured output)
   - \`agent_bind_value\`: "aiResult"

3. **ui_details** — Show AI results
   - \`ui_details_data\`: "$state.aiResult"

## Tips
- Use \`agent_json_mode: true\` when you need structured output
- Set \`agent_temperature\` for controlling creativity (0 = deterministic)
- Use \`agent_max_tokens\` to limit response length
`;

const SCHEDULED_TASK = `# Scheduled Task

Run workflows on a recurring schedule.

## Setup

Set trigger:
- \`triggerType\`: "schedule"
- \`triggerConfig.schedule_cron\`: Cron expression

## Common Cron Expressions
- \`"0 9 * * MON"\` — Every Monday at 9 AM
- \`"*/15 * * * *"\` — Every 15 minutes
- \`"0 0 1 * *"\` — First day of each month
- \`"0 8,17 * * MON-FRI"\` — 8 AM and 5 PM on weekdays

## Blocks

1. **fetch** — Pull fresh data
2. **code** — Custom processing logic
3. **fetch** — Push results / send notifications
`;

export const PATTERN_DOCS: Record<string, string> = {
  "fetch-transform-display": FETCH_TRANSFORM_DISPLAY,
  "barcode-scanning": BARCODE_SCANNING,
  "form-collection": FORM_COLLECTION,
  "data-pipeline": DATA_PIPELINE,
  "ai-processing": AI_PROCESSING,
  "scheduled-task": SCHEDULED_TASK,
};
