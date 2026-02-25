import { describe, it, expect } from "vitest";
import {
  buildSystemPrompt,
  resolveModelId,
} from "../system-prompt.js";
import {
  createAddBlockTool,
  createUpdateBlockTool,
  createRemoveBlockTool,
  createReorderBlocksTool,
  createSetTriggerTool,
  type WorkflowState,
} from "../tools/editWorkflow.js";
import { createPlanTool } from "../tools/createPlan.js";
import { getBlockDocsTool, getPatternDocsTool, getExampleTool } from "../tools/getDocs.js";
import { CONCEPT_DOCS } from "../prompts/concept-docs.js";
import { PATTERN_DOCS } from "../prompts/pattern-docs.js";
import { EXAMPLE_DOCS } from "../prompts/example-docs.js";
import { BLOCK_REGISTRY } from "@vsync/blocks";
import type { Block } from "@vsync/shared-types";

/* ── System prompt tests ─────────────────────────────── */

describe("buildSystemPrompt", () => {
  it("includes all registered block types", () => {
    const prompt = buildSystemPrompt();

    for (const type of BLOCK_REGISTRY.keys()) {
      expect(prompt).toContain(`**${type}**`);
    }
  });

  it("includes key documentation sections", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain("Field naming");
    expect(prompt).toContain("Variable references");
    expect(prompt).toContain("Conditions syntax");
    expect(prompt).toContain("Response Modes");
    expect(prompt).toContain("Tool Usage");
    expect(prompt).toContain("Constraints");
  });

  it("includes category headings", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain("### Data");
    expect(prompt).toContain("### Flow");
    expect(prompt).toContain("### Integration");
    expect(prompt).toContain("### Ui");
    expect(prompt).toContain("### Platform");
  });

  it("stays under reasonable token count", () => {
    const prompt = buildSystemPrompt();
    /* Rough estimate: 1 token ≈ 4 characters */
    const estimatedTokens = Math.ceil(prompt.length / 4);
    expect(estimatedTokens).toBeLessThan(5000);
  });
});

describe("resolveModelId", () => {
  it("resolves shorthand aliases", () => {
    expect(resolveModelId("claude-sonnet")).toBe("claude-sonnet-4-20250514");
    expect(resolveModelId("claude-opus")).toBe("claude-opus-4-20250514");
    expect(resolveModelId("gpt-4o")).toBe("gpt-4o");
  });

  it("passes through full model IDs unchanged", () => {
    expect(resolveModelId("claude-sonnet-4-20250514")).toBe("claude-sonnet-4-20250514");
    expect(resolveModelId("custom-model-v1")).toBe("custom-model-v1");
  });
});

/* ── getDocs tool tests ──────────────────────────────── */

describe("getBlockDocsTool", () => {
  it("returns docs for a valid block type", async () => {
    const result = await getBlockDocsTool.execute(
      { blockType: "fetch" },
      { toolCallId: "test", messages: [], abortSignal: undefined as unknown as AbortSignal },
    );

    expect(result).toHaveProperty("docs");
    expect((result as { docs: string }).docs).toContain("fetch");
    expect((result as { docs: string }).docs).toContain("fetch_url");
    expect((result as { docs: string }).docs).toContain("Required Fields");
    expect((result as { docs: string }).docs).toContain("Optional Fields");
  });

  it("returns error for an unknown block type", async () => {
    const result = await getBlockDocsTool.execute(
      { blockType: "nonexistent" },
      { toolCallId: "test", messages: [], abortSignal: undefined as unknown as AbortSignal },
    );

    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("Unknown block type");
  });

  it("returns docs that include common mistakes", async () => {
    const result = await getBlockDocsTool.execute(
      { blockType: "fetch" },
      { toolCallId: "test", messages: [], abortSignal: undefined as unknown as AbortSignal },
    );

    expect((result as { docs: string }).docs).toContain("Common Mistakes");
    expect((result as { docs: string }).docs).toContain("fetch_url");
  });
});

describe("getPatternDocsTool", () => {
  it("returns docs for a valid pattern", async () => {
    const result = await getPatternDocsTool.execute(
      { pattern: "fetch-transform-display" },
      { toolCallId: "test", messages: [], abortSignal: undefined as unknown as AbortSignal },
    );

    expect(result).toHaveProperty("docs");
    expect((result as { docs: string }).docs).toContain("Fetch");
  });

  it("returns error for an unknown pattern", async () => {
    const result = await getPatternDocsTool.execute(
      { pattern: "nonexistent" },
      { toolCallId: "test", messages: [], abortSignal: undefined as unknown as AbortSignal },
    );

    expect(result).toHaveProperty("error");
  });
});

describe("getExampleTool", () => {
  it("returns example for a valid name", async () => {
    const result = await getExampleTool.execute(
      { name: "api-integration" },
      { toolCallId: "test", messages: [], abortSignal: undefined as unknown as AbortSignal },
    );

    expect(result).toHaveProperty("docs");
    expect((result as { docs: string }).docs).toContain("blocks");
  });

  it("returns error for an unknown example", async () => {
    const result = await getExampleTool.execute(
      { name: "nonexistent" },
      { toolCallId: "test", messages: [], abortSignal: undefined as unknown as AbortSignal },
    );

    expect(result).toHaveProperty("error");
  });
});

/* ── editWorkflow tool tests ─────────────────────────── */

describe("add_block tool", () => {
  function freshState(): WorkflowState {
    return { blocks: [], triggerType: "interactive", triggerConfig: {} };
  }

  it("adds a valid block", async () => {
    const state = freshState();
    const addTool = createAddBlockTool(state);

    const result = await addTool.execute(
      {
        id: "fetch_data",
        name: "Fetch Data",
        type: "fetch",
        logic: { fetch_url: "https://api.example.com/data" },
      },
      { toolCallId: "test", messages: [], abortSignal: undefined as unknown as AbortSignal },
    );

    expect(result.success).toBe(true);
    expect(state.blocks).toHaveLength(1);
    expect(state.blocks[0].id).toBe("fetch_data");
    expect(state.blocks[0].type).toBe("fetch");
    expect(state.blocks[0].logic.fetch_url).toBe("https://api.example.com/data");
  });

  it("rejects a block with missing required fields", async () => {
    const state = freshState();
    const addTool = createAddBlockTool(state);

    const result = await addTool.execute(
      {
        id: "bad_fetch",
        name: "Bad Fetch",
        type: "fetch",
        logic: {}, /* missing fetch_url */
      },
      { toolCallId: "test", messages: [], abortSignal: undefined as unknown as AbortSignal },
    );

    expect(result.success).toBe(false);
    expect(result.errors!.length).toBeGreaterThan(0);
    expect(state.blocks).toHaveLength(0);
  });

  it("merges defaults with provided logic", async () => {
    const state = freshState();
    const addTool = createAddBlockTool(state);

    await addTool.execute(
      {
        id: "fetch_data",
        name: "Fetch Data",
        type: "fetch",
        logic: { fetch_url: "https://api.example.com" },
      },
      { toolCallId: "test", messages: [], abortSignal: undefined as unknown as AbortSignal },
    );

    expect(state.blocks[0].logic.fetch_method).toBe("GET");
    expect(state.blocks[0].logic.fetch_timeout_ms).toBe(30000);
  });

  it("assigns order automatically when not provided", async () => {
    const state = freshState();
    const addTool = createAddBlockTool(state);

    await addTool.execute(
      {
        id: "block_0",
        name: "First",
        type: "fetch",
        logic: { fetch_url: "https://a.com" },
      },
      { toolCallId: "test", messages: [], abortSignal: undefined as unknown as AbortSignal },
    );

    await addTool.execute(
      {
        id: "block_1",
        name: "Second",
        type: "fetch",
        logic: { fetch_url: "https://b.com" },
      },
      { toolCallId: "test", messages: [], abortSignal: undefined as unknown as AbortSignal },
    );

    expect(state.blocks[0].order).toBe(0);
    expect(state.blocks[1].order).toBe(1);
  });
});

describe("update_block tool", () => {
  function stateWithBlock(): WorkflowState {
    return {
      blocks: [
        {
          id: "fetch_data",
          workflowId: "",
          workflowVersion: 0,
          name: "Fetch Data",
          type: "fetch",
          logic: { fetch_url: "https://old.com", fetch_method: "GET" },
          order: 0,
        },
      ],
      triggerType: "interactive",
      triggerConfig: {},
    };
  }

  it("updates block logic", async () => {
    const state = stateWithBlock();
    const updateTool = createUpdateBlockTool(state);

    const result = await updateTool.execute(
      {
        blockId: "fetch_data",
        changes: { fetch_url: "https://new.com", fetch_method: "POST" },
      },
      { toolCallId: "test", messages: [], abortSignal: undefined as unknown as AbortSignal },
    );

    expect(result.success).toBe(true);
    expect(state.blocks[0].logic.fetch_url).toBe("https://new.com");
    expect(state.blocks[0].logic.fetch_method).toBe("POST");
  });

  it("returns diff of changes", async () => {
    const state = stateWithBlock();
    const updateTool = createUpdateBlockTool(state);

    const result = await updateTool.execute(
      {
        blockId: "fetch_data",
        changes: { fetch_url: "https://new.com" },
      },
      { toolCallId: "test", messages: [], abortSignal: undefined as unknown as AbortSignal },
    );

    expect(result.success).toBe(true);
    const diff = (result as { diff: Record<string, { before: unknown; after: unknown }> }).diff;
    expect(diff.fetch_url.before).toBe("https://old.com");
    expect(diff.fetch_url.after).toBe("https://new.com");
  });

  it("returns error for unknown block ID", async () => {
    const state = stateWithBlock();
    const updateTool = createUpdateBlockTool(state);

    const result = await updateTool.execute(
      {
        blockId: "nonexistent",
        changes: { fetch_url: "https://new.com" },
      },
      { toolCallId: "test", messages: [], abortSignal: undefined as unknown as AbortSignal },
    );

    expect(result.success).toBe(false);
  });
});

describe("remove_block tool", () => {
  it("removes an existing block and re-numbers", async () => {
    const state: WorkflowState = {
      blocks: [
        { id: "a", workflowId: "", workflowVersion: 0, name: "A", type: "fetch", logic: { fetch_url: "x" }, order: 0 },
        { id: "b", workflowId: "", workflowVersion: 0, name: "B", type: "fetch", logic: { fetch_url: "y" }, order: 1 },
        { id: "c", workflowId: "", workflowVersion: 0, name: "C", type: "fetch", logic: { fetch_url: "z" }, order: 2 },
      ],
      triggerType: "interactive",
      triggerConfig: {},
    };

    const removeTool = createRemoveBlockTool(state);
    const result = await removeTool.execute(
      { blockId: "b" },
      { toolCallId: "test", messages: [], abortSignal: undefined as unknown as AbortSignal },
    );

    expect(result.success).toBe(true);
    expect(state.blocks).toHaveLength(2);
    expect(state.blocks[0].id).toBe("a");
    expect(state.blocks[0].order).toBe(0);
    expect(state.blocks[1].id).toBe("c");
    expect(state.blocks[1].order).toBe(1);
  });
});

describe("reorder_blocks tool", () => {
  it("reorders blocks by ID list", async () => {
    const state: WorkflowState = {
      blocks: [
        { id: "a", workflowId: "", workflowVersion: 0, name: "A", type: "fetch", logic: { fetch_url: "x" }, order: 0 },
        { id: "b", workflowId: "", workflowVersion: 0, name: "B", type: "fetch", logic: { fetch_url: "y" }, order: 1 },
        { id: "c", workflowId: "", workflowVersion: 0, name: "C", type: "fetch", logic: { fetch_url: "z" }, order: 2 },
      ],
      triggerType: "interactive",
      triggerConfig: {},
    };

    const reorderTool = createReorderBlocksTool(state);
    const result = await reorderTool.execute(
      { blockIds: ["c", "a", "b"] },
      { toolCallId: "test", messages: [], abortSignal: undefined as unknown as AbortSignal },
    );

    expect(result.success).toBe(true);
    expect(state.blocks[0].id).toBe("c");
    expect(state.blocks[0].order).toBe(0);
    expect(state.blocks[1].id).toBe("a");
    expect(state.blocks[1].order).toBe(1);
    expect(state.blocks[2].id).toBe("b");
    expect(state.blocks[2].order).toBe(2);
  });
});

describe("set_trigger tool", () => {
  it("updates trigger type and config", async () => {
    const state: WorkflowState = {
      blocks: [],
      triggerType: "interactive",
      triggerConfig: {},
    };

    const triggerTool = createSetTriggerTool(state);
    const result = await triggerTool.execute(
      {
        triggerType: "schedule",
        triggerConfig: { schedule_cron: "0 9 * * MON" },
      },
      { toolCallId: "test", messages: [], abortSignal: undefined as unknown as AbortSignal },
    );

    expect(result.success).toBe(true);
    expect(state.triggerType).toBe("schedule");
    expect(state.triggerConfig.schedule_cron).toBe("0 9 * * MON");
  });
});

/* ── createPlan tool tests ───────────────────────────── */

describe("create_plan tool", () => {
  it("creates a plan with steps", async () => {
    const result = await createPlanTool.execute(
      { steps: ["Fetch data from API", "Transform the response", "Display in table"] },
      { toolCallId: "test", messages: [], abortSignal: undefined as unknown as AbortSignal },
    );

    expect(result.planId).toBeDefined();
    expect(result.steps).toHaveLength(3);
    expect(result.steps[0]).toBe("Fetch data from API");
  });
});

/* ── Prompt data tests ───────────────────────────────── */

describe("prompt documentation", () => {
  it("concept docs have all required sections", () => {
    expect(CONCEPT_DOCS).toHaveProperty("references");
    expect(CONCEPT_DOCS).toHaveProperty("events");
    expect(CONCEPT_DOCS).toHaveProperty("artifacts");
    expect(CONCEPT_DOCS).toHaveProperty("conditions");

    expect(CONCEPT_DOCS.references).toContain("$state");
    expect(CONCEPT_DOCS.references).toContain("$cache");
    expect(CONCEPT_DOCS.references).toContain("$artifacts");
    expect(CONCEPT_DOCS.references).toContain("$keys");
    expect(CONCEPT_DOCS.references).toContain("$event");
    expect(CONCEPT_DOCS.references).toContain("$run");
  });

  it("pattern docs have required patterns", () => {
    expect(PATTERN_DOCS).toHaveProperty("fetch-transform-display");
    expect(PATTERN_DOCS).toHaveProperty("barcode-scanning");
    expect(PATTERN_DOCS).toHaveProperty("form-collection");
    expect(PATTERN_DOCS).toHaveProperty("data-pipeline");
    expect(PATTERN_DOCS).toHaveProperty("ai-processing");
    expect(PATTERN_DOCS).toHaveProperty("scheduled-task");
  });

  it("example docs have required examples", () => {
    expect(EXAMPLE_DOCS).toHaveProperty("api-integration");
    expect(EXAMPLE_DOCS).toHaveProperty("barcode-scanner");

    /* Verify examples are valid JSON */
    for (const [name, doc] of Object.entries(EXAMPLE_DOCS)) {
      expect(() => JSON.parse(doc)).not.toThrow();
      const parsed = JSON.parse(doc);
      expect(parsed).toHaveProperty("blocks");
      expect(parsed).toHaveProperty("triggerType");
    }
  });
});
