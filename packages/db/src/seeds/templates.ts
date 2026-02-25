import { readFileSync, readdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createPostgresClient } from "../client.js";
import {
  workflows,
  workflowVersions,
  blocks,
} from "../schema/workflows.js";
import { organizations } from "../schema/organizations.js";

/* ── Types ──────────────────────────────────────────────────────── */

interface TemplateBlock {
  id: string;
  name: string;
  type: string;
  logic: Record<string, unknown>;
  order: number;
  notes?: string;
}

interface TemplateJson {
  name: string;
  description?: string;
  category?: string;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  executionEnvironments?: string[];
  blocks: TemplateBlock[];
}

/* ── Constants ──────────────────────────────────────────────────── */

const SYSTEM_ORG_SLUG = "vsync-system";
const SYSTEM_ORG_NAME = "V Sync Templates";

const EXAMPLES_DIR = resolve(
  import.meta.dirname ?? ".",
  "../../../designer/prompts/examples",
);

/* ── Helpers ────────────────────────────────────────────────────── */

/** Converts a filename like "hello-api.json" into a slug "tpl-hello-api". */
function fileToSlug(filename: string): string {
  return `tpl-${basename(filename, ".json")}`;
}

/* ── Main ───────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const db = createPostgresClient(url);

  // Ensure a system org exists for template ownership
  const [systemOrg] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, SYSTEM_ORG_SLUG))
    .limit(1);

  let orgId: string;

  if (systemOrg) {
    orgId = systemOrg.id;
    console.log(`Using existing system org: ${orgId}`);
  } else {
    const [created] = await db
      .insert(organizations)
      .values({ name: SYSTEM_ORG_NAME, slug: SYSTEM_ORG_SLUG })
      .returning({ id: organizations.id });
    orgId = created!.id;
    console.log(`Created system org: ${orgId}`);
  }

  // Read all template JSON files
  const files = readdirSync(EXAMPLES_DIR).filter((f) => f.endsWith(".json"));
  console.log(`Found ${files.length} template files`);

  for (const file of files) {
    const slug = fileToSlug(file);

    // Idempotent: skip if this template already exists
    const [existing] = await db
      .select({ id: workflows.id })
      .from(workflows)
      .where(eq(workflows.publicSlug, slug))
      .limit(1);

    if (existing) {
      console.log(`  Skipping "${file}" — already seeded (${slug})`);
      continue;
    }

    const raw = readFileSync(resolve(EXAMPLES_DIR, file), "utf-8");
    const template: TemplateJson = JSON.parse(raw);

    // 1. Create the workflow
    const workflowId = nanoid();
    await db.insert(workflows).values({
      id: workflowId,
      orgId,
      name: template.name,
      description: template.description ?? null,
      isPublic: true,
      publicSlug: slug,
      publicAccessMode: "view",
      activeVersion: 1,
    });

    // 2. Create version 1 (published)
    await db.insert(workflowVersions).values({
      workflowId,
      version: 1,
      status: "published",
      triggerType: template.triggerType,
      triggerConfig: template.triggerConfig,
      executionEnvironments: template.executionEnvironments ?? ["cloud"],
    });

    // 3. Create blocks with fresh IDs
    for (const block of template.blocks) {
      await db.insert(blocks).values({
        id: nanoid(),
        workflowId,
        workflowVersion: 1,
        name: block.name,
        type: block.type,
        logic: block.logic,
        order: block.order,
        notes: block.notes ?? null,
      });
    }

    console.log(
      `  Seeded "${template.name}" (${slug}) — ${template.blocks.length} blocks`,
    );
  }

  console.log("Template seeding complete");
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error("Template seeding failed:", err);
  process.exit(1);
});
