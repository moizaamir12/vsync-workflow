import { tool } from "ai";
import { z } from "zod";
import { BLOCK_REGISTRY, type BlockSchema } from "@vsync/blocks";
import { CONCEPT_DOCS } from "../prompts/concept-docs.js";
import { PATTERN_DOCS } from "../prompts/pattern-docs.js";
import { EXAMPLE_DOCS } from "../prompts/example-docs.js";

/**
 * get_block_docs — returns detailed documentation for a block type.
 * Generated from the block registry and schema.
 */
export const getBlockDocsTool = tool({
  description:
    "Get detailed documentation for a specific block type, including all fields, defaults, and common mistakes. Always call this before creating a block type you haven't used in this conversation.",
  parameters: z.object({
    blockType: z.string().describe("The block type to get docs for (e.g. 'fetch', 'code', 'ui_form')"),
  }),
  execute: async ({ blockType }) => {
    const entry = BLOCK_REGISTRY.get(blockType);
    if (!entry) {
      return { error: `Unknown block type: "${blockType}". Use one of: ${[...BLOCK_REGISTRY.keys()].join(", ")}` };
    }

    return { docs: formatBlockDocs(blockType, entry.name, entry.description, entry.schema, entry.category, entry.platforms as readonly string[]) };
  },
});

/**
 * get_pattern_docs — returns common workflow patterns.
 */
export const getPatternDocsTool = tool({
  description:
    "Get documentation for common workflow patterns (e.g. 'fetch-transform-display', 'barcode-scanning', 'form-collection').",
  parameters: z.object({
    pattern: z.string().describe("Pattern name to look up"),
  }),
  execute: async ({ pattern }) => {
    const key = pattern.toLowerCase().replace(/\s+/g, "-");
    const doc = PATTERN_DOCS[key];
    if (!doc) {
      return {
        error: `Unknown pattern: "${pattern}". Available: ${Object.keys(PATTERN_DOCS).join(", ")}`,
      };
    }
    return { docs: doc };
  },
});

/**
 * get_example — returns an example workflow JSON.
 */
export const getExampleTool = tool({
  description:
    "Get a complete example workflow JSON that can be adapted for the user's needs.",
  parameters: z.object({
    name: z.string().describe("Example name (e.g. 'api-integration', 'barcode-scanner')"),
  }),
  execute: async ({ name }) => {
    const key = name.toLowerCase().replace(/\s+/g, "-");
    const doc = EXAMPLE_DOCS[key];
    if (!doc) {
      return {
        error: `Unknown example: "${name}". Available: ${Object.keys(EXAMPLE_DOCS).join(", ")}`,
      };
    }
    return { docs: doc };
  },
});

/* ── Helpers ───────────────────────────────────────────── */

function formatBlockDocs(
  blockType: string,
  name: string,
  description: string,
  schema: BlockSchema,
  category: string,
  platforms: readonly string[],
): string {
  const lines: string[] = [
    `# ${name} Block (\`${blockType}\`)`,
    "",
    description,
    "",
    `**Category:** ${category} | **Platforms:** ${platforms.join(", ")}`,
    "",
    "## Required Fields",
    "",
  ];

  if (schema.required.length === 0) {
    lines.push("_None_");
  } else {
    for (const field of schema.required) {
      lines.push(`- \`${field}\` — *(required, must be non-empty)*`);
    }
  }

  lines.push("", "## Optional Fields", "");

  const optEntries = Object.entries(schema.optional);
  if (optEntries.length === 0) {
    lines.push("_None_");
  } else {
    lines.push("| Field | Default | Allowed Values |");
    lines.push("|-------|---------|----------------|");
    for (const [field, def] of optEntries) {
      const defaultStr = def.default === null ? "null" : JSON.stringify(def.default);
      const enumStr = def.enum ? def.enum.join(", ") : "—";
      lines.push(`| \`${field}\` | ${defaultStr} | ${enumStr} |`);
    }
  }

  const mistakes = Object.entries(schema.commonMistakes);
  if (mistakes.length > 0) {
    lines.push("", "## Common Mistakes", "");
    for (const [wrong, correct] of mistakes) {
      lines.push(`- \`${wrong}\` → use \`${correct}\` instead`);
    }
  }

  return lines.join("\n");
}
