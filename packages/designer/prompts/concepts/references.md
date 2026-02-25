# Variable References

Blocks can reference data from the workflow context using `$` prefixed expressions.

## Available Scopes

### `$state.<key>`
Persistent key-value store that survives across steps within a run.
Blocks write to state using the `<type>_bind_value` field.

Example: A fetch block with `fetch_bind_value: "apiResult"` stores its output at `$state.apiResult`.

### `$cache.<key>`
Ephemeral key-value cache cleared between runs.
Useful for deduplication and intermediate computation results.

### `$artifacts`
Array of files and media produced during the run (images, PDFs, etc.).
Each artifact has: `{ id, name, type, url, size }`.

### `$keys.<name>`
Organization secrets decrypted at run start.
Access API keys, tokens, and passwords securely.
Example: `$keys.OPENAI_API_KEY`

### `$event.<field>`
Trigger event payload that initiated the run.
For API triggers, this contains the request body.
For schedule triggers, this contains the cron metadata.

### `$run`
Metadata about the current run:
- `$run.id` — Run identifier
- `$run.status` — Current lifecycle state
- `$run.workflowId` — Parent workflow
- `$run.triggerType` — How the run was initiated
- `$run.startedAt` — ISO-8601 start time
- `$run.platform` — Execution platform
- `$run.deviceId` — Device identifier
- `$run.blockId` — Currently executing block
- `$run.blockName` — Current block name

### `$loops.<loopId>`
Active loop context within goto-based loops:
- `$loops.<id>.index` — Zero-based iteration counter
- `$loops.<id>.artifact` — Current iteration artifact
