/**
 * Concept documentation served by the get_pattern_docs and get_block_docs tools.
 * Keyed by concept slug.
 */

const REFERENCES_DOC = `# Variable References

Blocks can reference data from the workflow context using \`$\` prefixed expressions.

## Available Scopes

### \`$state.<key>\`
Persistent key-value store that survives across steps within a run.
Blocks write to state using the \`<type>_bind_value\` field.

Example: A fetch block with \`fetch_bind_value: "apiResult"\` stores its output at \`$state.apiResult\`.

### \`$cache.<key>\`
Ephemeral key-value cache cleared between runs.
Useful for deduplication and intermediate computation results.

### \`$artifacts\`
Array of files and media produced during the run (images, PDFs, etc.).
Each artifact has: \`{ id, name, type, url, size }\`.

### \`$keys.<name>\`
Organization secrets decrypted at run start.
Access API keys, tokens, and passwords securely.
Example: \`$keys.OPENAI_API_KEY\`

### \`$event.<field>\`
Trigger event payload that initiated the run.
For API triggers, this contains the request body.
For schedule triggers, this contains the cron metadata.

### \`$run\`
Metadata about the current run:
- \`$run.id\` — Run identifier
- \`$run.status\` — Current lifecycle state
- \`$run.workflowId\` — Parent workflow
- \`$run.triggerType\` — How the run was initiated
- \`$run.startedAt\` — ISO-8601 start time
- \`$run.platform\` — Execution platform
- \`$run.deviceId\` — Device identifier
- \`$run.blockId\` — Currently executing block
- \`$run.blockName\` — Current block name

### \`$loops.<loopId>\`
Active loop context within goto-based loops:
- \`$loops.<id>.index\` — Zero-based iteration counter
- \`$loops.<id>.artifact\` — Current iteration artifact
`;

const EVENTS_DOC = `# Events & Triggers

## Trigger Types

### interactive
User manually triggers the workflow from the UI.
No configuration needed.

### api
External systems call the workflow via REST API.
The request body becomes \`$event\`.

### schedule
Time-based execution using cron expressions.
Config: \`schedule_cron\` (e.g. "0 9 * * MON" = every Monday at 9am)

### hook
Inbound webhook from external services.
Config: \`hook_url\` (auto-generated), \`hook_secret\` (HMAC verification)

### vision
Computer vision pipeline triggers on visual events.
Config: \`vision_model\`, \`vision_config\`

## Event Flow

1. Trigger fires → creates a run with \`$event\` payload
2. Blocks execute sequentially by \`order\`
3. Each block reads from context (\`$state\`, \`$event\`, etc.)
4. Each block writes results via \`*_bind_value\` → \`$state\`
5. UI blocks (ui_*) pause execution until user responds
6. Run completes with status: completed | failed | awaiting_action
`;

const ARTIFACTS_DOC = `# Artifacts

Artifacts are files and media produced during a workflow run.

## Creating Artifacts

Blocks that produce files automatically add them to \`$artifacts\`:
- **image** block: Processed images (resize, crop, watermark)
- **ui_camera** block: Captured photos
- **fetch** block: Downloaded files (when response is binary)
- **code** block: Files created in the sandbox

## Artifact Shape

Each artifact contains:
\`\`\`json
{
  "id": "art_abc123",
  "name": "processed-image.jpg",
  "type": "image/jpeg",
  "url": "https://storage.vsync.io/...",
  "size": 102400
}
\`\`\`

## Referencing Artifacts

- \`$artifacts\` — Full array of all artifacts
- \`$artifacts[0]\` — First artifact
- Use the array block to filter/find specific artifacts
`;

const CONDITIONS_DOC = `# Conditions

Conditions are guard clauses that determine whether a block executes.

## Structure

Each condition has three parts:
- **left**: The value to test (usually a \`$state\` reference)
- **operator**: Comparison operator
- **right**: The value to compare against

## Operators

| Operator | Description | Example |
|----------|-------------|---------|
| == | Equal | \`$state.status\` == \`"active"\` |
| != | Not equal | \`$state.count\` != \`0\` |
| < | Less than | \`$state.retries\` < \`3\` |
| > | Greater than | \`$state.score\` > \`80\` |
| <= | Less or equal | \`$state.age\` <= \`65\` |
| >= | Greater or equal | \`$state.total\` >= \`100\` |
| contains | String/array contains | \`$state.tags\` contains \`"urgent"\` |
| startsWith | String starts with | \`$state.url\` startsWith \`"https"\` |
| endsWith | String ends with | \`$state.file\` endsWith \`".pdf"\` |
| in | Value in list | \`$state.role\` in \`["admin","mod"]\` |
| isEmpty | Value is empty | \`$state.items\` isEmpty |
| isFalsy | Value is falsy | \`$state.error\` isFalsy |
| isNull | Value is null | \`$state.result\` isNull |
| regex | Regex match | \`$state.email\` regex \`"@company\\\\.com$"\` |

## AND Logic

Multiple conditions on a block are AND-gated — ALL must pass for the block to execute.
If any condition fails, the block is skipped.
`;

export const CONCEPT_DOCS: Record<string, string> = {
  references: REFERENCES_DOC,
  events: EVENTS_DOC,
  artifacts: ARTIFACTS_DOC,
  conditions: CONDITIONS_DOC,
};
