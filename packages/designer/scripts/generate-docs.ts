/**
 * Auto-generate block documentation from @vsync/blocks schemas.
 *
 * Reads the BLOCK_REGISTRY and generates:
 *   1. Markdown files in prompts/blocks/*.md (human-readable)
 *   2. Console output with statistics
 *
 * Run: npx tsx scripts/generate-docs.ts
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BLOCK_REGISTRY,
  getBlockDefaults,
  type BlockRegistryEntry,
  type BlockSchema,
} from "@vsync/blocks";
import type { BlockType } from "@vsync/shared-types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(__dirname, "..", "prompts", "blocks");

/* Ensure output directory exists */
mkdirSync(PROMPTS_DIR, { recursive: true });

let generated = 0;

for (const entry of BLOCK_REGISTRY.values()) {
  const md = generateBlockDoc(entry);
  const filePath = join(PROMPTS_DIR, `${entry.type}.md`);
  writeFileSync(filePath, md, "utf-8");
  generated++;
  console.log(`  ✓ ${entry.type}.md`);
}

console.log(`\nGenerated ${generated} block documentation files in prompts/blocks/`);

/* ── Generator ──────────────────────────────────────── */

function generateBlockDoc(entry: BlockRegistryEntry): string {
  const { type, name, description, schema, category, platforms } = entry;
  const lines: string[] = [];

  /* Header */
  lines.push(`# ${name} Block (\`${type}\`)`);
  lines.push("");
  lines.push(description);
  lines.push("");
  lines.push(`**Category:** ${category} | **Platforms:** ${(platforms as readonly string[]).join(", ")}`);
  lines.push("");

  /* When to Use */
  lines.push("## When to Use");
  lines.push("");
  lines.push(`Use the ${name} block when you need to ${description.toLowerCase()}.`);
  lines.push("");

  /* Required Fields */
  lines.push("## Required Fields");
  lines.push("");
  if (schema.required.length === 0) {
    lines.push("_None_");
  } else {
    for (const field of schema.required) {
      lines.push(`- \`${field}\` — *(required, must be non-empty)*`);
    }
  }
  lines.push("");

  /* Optional Fields Table */
  lines.push("## Optional Fields");
  lines.push("");

  const optEntries = Object.entries(schema.optional);
  if (optEntries.length === 0) {
    lines.push("_None_");
  } else {
    lines.push("| Field | Default | Allowed Values |");
    lines.push("|-------|---------|----------------|");
    for (const [field, def] of optEntries) {
      const defaultStr = formatDefault(def.default);
      const enumStr = def.enum ? def.enum.join(", ") : "—";
      lines.push(`| \`${field}\` | ${defaultStr} | ${enumStr} |`);
    }
  }
  lines.push("");

  /* Example */
  lines.push("## Example");
  lines.push("");
  lines.push("```json");
  try {
    const defaults = getBlockDefaults(type as BlockType);
    lines.push(JSON.stringify(defaults, null, 2));
  } catch {
    lines.push("{}");
  }
  lines.push("```");
  lines.push("");

  /* Common Mistakes */
  const mistakes = Object.entries(schema.commonMistakes);
  if (mistakes.length > 0) {
    lines.push("## Common Mistakes");
    lines.push("");
    for (const [wrong, correct] of mistakes) {
      lines.push(`- \`${wrong}\` → use \`${correct}\` instead`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function formatDefault(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}
