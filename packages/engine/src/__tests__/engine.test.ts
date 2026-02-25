import { describe, it, expect, beforeEach } from "vitest";
import type {
  Block,
  Condition,
  WorkflowContext,
  WorkflowVersion,
} from "@vsync/shared-types";
import { ContextManager } from "../core/ContextManager.js";
import { ConditionEvaluator } from "../core/ConditionEvaluator.js";
import { RunBuilder } from "../core/RunBuilder.js";
import { BlockExecutor } from "../core/BlockExecutor.js";
import { Interpreter } from "../core/Interpreter.js";
import type { RunConfig, BlockResult, BlockHandler } from "../types.js";

/* ── Test helpers ────────────────────────────────────────── */

function makeBlock(overrides: Partial<Block> & { id: string; name: string; order: number }): Block {
  return {
    workflowId: "wf-1",
    workflowVersion: 1,
    type: "object",
    logic: {},
    ...overrides,
  };
}

function makeContext(overrides?: Partial<WorkflowContext>): WorkflowContext {
  return {
    state: {},
    cache: new Map(),
    artifacts: [],
    secrets: {},
    run: {
      id: "run-1",
      workflowId: "wf-1",
      versionId: "wf-1:v1",
      status: "running",
      triggerType: "interactive",
      startedAt: new Date().toISOString(),
      platform: "test",
      deviceId: "test-device",
    },
    event: {},
    loops: {},
    paths: {},
    ...overrides,
  };
}

function makeVersion(blocks: Block[]): WorkflowVersion {
  return {
    workflowId: "wf-1",
    version: 1,
    status: "published",
    triggerType: "interactive",
    triggerConfig: {},
    executionEnvironments: ["test"],
    blocks,
    groups: [],
    changelog: "test",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeRunConfig(blocks: Block[], overrides?: Partial<RunConfig>): RunConfig {
  return {
    runId: "run-1",
    orgId: "org-1",
    deviceId: "test-device",
    workflowVersion: makeVersion(blocks),
    event: {},
    ...overrides,
  };
}

/* ================================================================ */
/*  ContextManager                                                   */
/* ================================================================ */

describe("ContextManager", () => {
  let cm: ContextManager;
  let ctx: WorkflowContext;

  beforeEach(() => {
    cm = new ContextManager();
    ctx = makeContext({
      state: { name: "Alice", nested: { deep: { value: 42 } }, items: [10, 20, 30] },
      secrets: { apiKey: "sk-123" },
      paths: { tempDir: "/tmp" },
      event: { type: "webhook", payload: { action: "push" } },
    });
    ctx.cache.set("temp", "cached-value");
    ctx.cache.set("counter", 5);
  });

  /* ── $state ──────────────────────────────────────────── */

  it("resolves $state.name", () => {
    expect(cm.resolve("$state.name", ctx)).toBe("Alice");
  });

  it("resolves nested state paths", () => {
    expect(cm.resolve("$state.nested.deep.value", ctx)).toBe(42);
  });

  it("resolves array indices via bracket notation", () => {
    expect(cm.resolve("$state.items[1]", ctx)).toBe(20);
  });

  it("resolves bracket notation with quotes", () => {
    expect(cm.resolve('$state["name"]', ctx)).toBe("Alice");
  });

  it("returns undefined for missing state keys", () => {
    expect(cm.resolve("$state.nonexistent", ctx)).toBeUndefined();
  });

  /* ── $cache ──────────────────────────────────────────── */

  it("resolves $cache.temp", () => {
    expect(cm.resolve("$cache.temp", ctx)).toBe("cached-value");
  });

  it("resolves $cache.counter", () => {
    expect(cm.resolve("$cache.counter", ctx)).toBe(5);
  });

  /* ── $secrets ────────────────────────────────────────── */

  it("resolves $secrets.apiKey", () => {
    expect(cm.resolve("$secrets.apiKey", ctx)).toBe("sk-123");
  });

  /* ── $paths ──────────────────────────────────────────── */

  it("resolves $paths.tempDir", () => {
    expect(cm.resolve("$paths.tempDir", ctx)).toBe("/tmp");
  });

  /* ── $event ──────────────────────────────────────────── */

  it("resolves $event.type", () => {
    expect(cm.resolve("$event.type", ctx)).toBe("webhook");
  });

  it("resolves nested event paths", () => {
    expect(cm.resolve("$event.payload.action", ctx)).toBe("push");
  });

  /* ── $run ────────────────────────────────────────────── */

  it("resolves $run.id", () => {
    expect(cm.resolve("$run.id", ctx)).toBe("run-1");
  });

  it("resolves $run.status", () => {
    expect(cm.resolve("$run.status", ctx)).toBe("running");
  });

  /* ── $now ────────────────────────────────────────────── */

  it("resolves $now to an ISO timestamp", () => {
    const result = cm.resolve("$now", ctx);
    expect(typeof result).toBe("string");
    expect(() => new Date(result as string)).not.toThrow();
  });

  /* ── $error ──────────────────────────────────────────── */

  it("resolves $error.message when error is set", () => {
    cm.setLastError({ message: "boom", blockId: "b1", blockName: "Block1" });
    expect(cm.resolve("$error.message", ctx)).toBe("boom");
  });

  it("resolves $error to empty object when no error", () => {
    expect(cm.resolve("$error.message", ctx)).toBeUndefined();
  });

  /* ── $keys ───────────────────────────────────────────── */

  it("resolves $keys via keyResolver", () => {
    const ctxWithResolver = makeContext({
      keyResolver: (key: string) => `resolved-${key}`,
    });
    expect(cm.resolve("$keys.my_api_key", ctxWithResolver)).toBe("resolved-my_api_key");
  });

  it("resolves dotted $keys references", () => {
    const ctxWithResolver = makeContext({
      keyResolver: (key: string) => `resolved-${key}`,
    });
    expect(cm.resolve("$keys.cloud.my_key", ctxWithResolver)).toBe("resolved-cloud.my_key");
  });

  /* ── $loop ───────────────────────────────────────────── */

  it("resolves $loop.<id>.index", () => {
    const ctxWithLoop = makeContext({
      loops: { loop1: { index: 3 } },
    });
    expect(cm.resolve("$loop.loop1.index", ctxWithLoop)).toBe(3);
  });

  /* ── $row / $item / $index aliases ───────────────────── */

  it("resolves $index from the active loop", () => {
    const ctxWithLoop = makeContext({
      loops: { loop1: { index: 7 } },
    });
    expect(cm.resolve("$index", ctxWithLoop)).toBe(7);
  });

  /* ── Template interpolation ──────────────────────────── */

  it("interpolates {{$state.name}}", () => {
    expect(cm.interpolate("Hello {{$state.name}}!", ctx)).toBe("Hello Alice!");
  });

  it("interpolates multiple expressions", () => {
    const result = cm.interpolate(
      "{{$state.name}} has key {{$secrets.apiKey}}",
      ctx,
    );
    expect(result).toBe("Alice has key sk-123");
  });

  it("replaces unresolvable expressions with empty string", () => {
    expect(cm.interpolate("val={{$state.missing}}", ctx)).toBe("val=");
  });

  /* ── resolveValue ────────────────────────────────────── */

  it("resolveValue passes through non-strings", () => {
    expect(cm.resolveValue(42, ctx)).toBe(42);
    expect(cm.resolveValue(true, ctx)).toBe(true);
    expect(cm.resolveValue(null, ctx)).toBeNull();
  });

  it("resolveValue resolves $ expressions", () => {
    expect(cm.resolveValue("$state.name", ctx)).toBe("Alice");
  });

  it("resolveValue interpolates templates", () => {
    expect(cm.resolveValue("Hi {{$state.name}}", ctx)).toBe("Hi Alice");
  });

  it("resolveValue returns plain strings as-is", () => {
    expect(cm.resolveValue("hello", ctx)).toBe("hello");
  });
});

/* ================================================================ */
/*  ConditionEvaluator                                               */
/* ================================================================ */

describe("ConditionEvaluator", () => {
  let evaluator: ConditionEvaluator;
  let ctx: WorkflowContext;

  beforeEach(() => {
    const cm = new ContextManager();
    evaluator = new ConditionEvaluator(cm);
    ctx = makeContext({
      state: {
        count: 10,
        name: "Alice",
        email: "alice@example.com",
        tags: ["admin", "user"],
        emptyStr: "",
        nullVal: null,
        status: "active",
      },
    });
  });

  /* ── Equality ────────────────────────────────────────── */

  it("evaluates == (equal)", () => {
    const cond: Condition = { left: "$state.count", operator: "==", right: "10" };
    expect(evaluator.evaluate(cond, ctx)).toBe(true);
  });

  it("evaluates != (not equal)", () => {
    const cond: Condition = { left: "$state.count", operator: "!=", right: "5" };
    expect(evaluator.evaluate(cond, ctx)).toBe(true);
  });

  /* ── Comparison ──────────────────────────────────────── */

  it("evaluates < (less than)", () => {
    const cond: Condition = { left: "$state.count", operator: "<", right: "20" };
    expect(evaluator.evaluate(cond, ctx)).toBe(true);
  });

  it("evaluates > (greater than)", () => {
    const cond: Condition = { left: "$state.count", operator: ">", right: "5" };
    expect(evaluator.evaluate(cond, ctx)).toBe(true);
  });

  it("evaluates <= (less than or equal)", () => {
    const cond: Condition = { left: "$state.count", operator: "<=", right: "10" };
    expect(evaluator.evaluate(cond, ctx)).toBe(true);
  });

  it("evaluates >= (greater than or equal)", () => {
    const cond: Condition = { left: "$state.count", operator: ">=", right: "10" };
    expect(evaluator.evaluate(cond, ctx)).toBe(true);
  });

  /* ── String operators ───────────────────────────────── */

  it("evaluates contains (string)", () => {
    const cond: Condition = { left: "$state.email", operator: "contains", right: "@example" };
    expect(evaluator.evaluate(cond, ctx)).toBe(true);
  });

  it("evaluates contains (array)", () => {
    const cond: Condition = { left: "$state.tags", operator: "contains", right: "admin" };
    expect(evaluator.evaluate(cond, ctx)).toBe(true);
  });

  it("evaluates startsWith", () => {
    const cond: Condition = { left: "$state.email", operator: "startsWith", right: "alice" };
    expect(evaluator.evaluate(cond, ctx)).toBe(true);
  });

  it("evaluates endsWith", () => {
    const cond: Condition = { left: "$state.email", operator: "endsWith", right: ".com" };
    expect(evaluator.evaluate(cond, ctx)).toBe(true);
  });

  /* ── in operator ────────────────────────────────────── */

  it("evaluates in (comma-separated string)", () => {
    const cond: Condition = { left: "$state.status", operator: "in", right: "active,inactive,pending" };
    expect(evaluator.evaluate(cond, ctx)).toBe(true);
  });

  /* ── Nullability checks ─────────────────────────────── */

  it("evaluates isEmpty on empty string", () => {
    const cond: Condition = { left: "$state.emptyStr", operator: "isEmpty", right: "" };
    expect(evaluator.evaluate(cond, ctx)).toBe(true);
  });

  it("evaluates isEmpty on non-empty string", () => {
    const cond: Condition = { left: "$state.name", operator: "isEmpty", right: "" };
    expect(evaluator.evaluate(cond, ctx)).toBe(false);
  });

  it("evaluates isFalsy on null", () => {
    const cond: Condition = { left: "$state.nullVal", operator: "isFalsy", right: "" };
    expect(evaluator.evaluate(cond, ctx)).toBe(true);
  });

  it("evaluates isNull", () => {
    const cond: Condition = { left: "$state.nullVal", operator: "isNull", right: "" };
    expect(evaluator.evaluate(cond, ctx)).toBe(true);
  });

  it("evaluates isNull (false case)", () => {
    const cond: Condition = { left: "$state.name", operator: "isNull", right: "" };
    expect(evaluator.evaluate(cond, ctx)).toBe(false);
  });

  /* ── regex ──────────────────────────────────────────── */

  it("evaluates regex match", () => {
    const cond: Condition = { left: "$state.email", operator: "regex", right: "^alice@.*\\.com$" };
    expect(evaluator.evaluate(cond, ctx)).toBe(true);
  });

  it("evaluates regex non-match", () => {
    const cond: Condition = { left: "$state.name", operator: "regex", right: "^Bob" };
    expect(evaluator.evaluate(cond, ctx)).toBe(false);
  });

  /* ── AND logic ──────────────────────────────────────── */

  it("evaluateAll returns true when all conditions pass", () => {
    const conditions: Condition[] = [
      { left: "$state.name", operator: "==", right: "Alice" },
      { left: "$state.count", operator: ">", right: "5" },
    ];
    expect(evaluator.evaluateAll(conditions, ctx)).toBe(true);
  });

  it("evaluateAll returns false when any condition fails", () => {
    const conditions: Condition[] = [
      { left: "$state.name", operator: "==", right: "Alice" },
      { left: "$state.count", operator: ">", right: "50" },
    ];
    expect(evaluator.evaluateAll(conditions, ctx)).toBe(false);
  });

  it("evaluateAll returns true for empty conditions", () => {
    expect(evaluator.evaluateAll([], ctx)).toBe(true);
    expect(evaluator.evaluateAll(undefined, ctx)).toBe(true);
  });
});

/* ================================================================ */
/*  RunBuilder                                                       */
/* ================================================================ */

describe("RunBuilder", () => {
  let builder: RunBuilder;
  let block: Block;

  beforeEach(() => {
    builder = new RunBuilder();
    block = makeBlock({ id: "b1", name: "Test Block", order: 0 });
  });

  it("creates a step with running status", () => {
    const step = builder.createStep(block);
    expect(step.status).toBe("running");
    expect(step.blockId).toBe("b1");
    expect(step.blockName).toBe("Test Block");
    expect(step.executionOrder).toBe(0);
  });

  it("increments execution order", () => {
    builder.createStep(block);
    const step2 = builder.createStep(
      makeBlock({ id: "b2", name: "Block 2", order: 1 }),
    );
    expect(step2.executionOrder).toBe(1);
    expect(builder.getExecutionCount()).toBe(2);
  });

  it("completes a step with deltas", () => {
    const step = builder.createStep(block);
    const result: BlockResult = {
      stateDelta: { foo: "bar" },
      cacheDelta: { temp: 1 },
    };
    builder.completeStep(step, result);

    expect(step.status).toBe("completed");
    expect(step.stateDelta).toEqual({ foo: "bar" });
    expect(step.cacheDelta).toEqual({ temp: 1 });
    expect(step.endedAt).toBeTruthy();
  });

  it("fails a step with error", () => {
    const step = builder.createStep(block);
    builder.failStep(step, {
      message: "boom",
      blockId: "b1",
      blockName: "Test Block",
    });

    expect(step.status).toBe("failed");
    expect(step.error?.message).toBe("boom");
  });

  it("skips a step", () => {
    const step = builder.createStep(block);
    builder.skipStep(step);
    expect(step.status).toBe("skipped");
  });

  it("creates a deferred step", () => {
    const step = builder.createDeferredStep(block, "iter-1");
    expect(step.isDeferred).toBe(true);
    expect(step.deferIterationId).toBe("iter-1");
  });

  it("calculates delta between snapshots", () => {
    const before = { a: 1, b: "hello" };
    const after = { a: 1, b: "world", c: true };

    const delta = builder.calculateDelta(before, after);
    expect(delta).toEqual({ b: "world", c: true });
  });

  it("returns empty delta when nothing changed", () => {
    const before = { a: 1 };
    const after = { a: 1 };
    expect(builder.calculateDelta(before, after)).toEqual({});
  });

  it("applyDeltas merges state and cache", () => {
    const ctx = makeContext();
    const result: BlockResult = {
      stateDelta: { x: 10 },
      cacheDelta: { y: 20 },
    };

    builder.applyDeltas(ctx, result);
    expect(ctx.state.x).toBe(10);
    expect(ctx.cache.get("y")).toBe(20);
  });

  it("getSteps returns a copy of all steps", () => {
    builder.createStep(block);
    builder.createStep(makeBlock({ id: "b2", name: "B2", order: 1 }));

    const steps = builder.getSteps();
    expect(steps.length).toBe(2);

    /* Modifying returned array doesn't affect internal state */
    steps.pop();
    expect(builder.getSteps().length).toBe(2);
  });
});

/* ================================================================ */
/*  BlockExecutor                                                    */
/* ================================================================ */

describe("BlockExecutor", () => {
  let executor: BlockExecutor;

  beforeEach(() => {
    executor = new BlockExecutor();
  });

  it("registers and executes a handler", async () => {
    const handler: BlockHandler = async (_block, _ctx) => ({
      stateDelta: { result: "ok" },
    });

    executor.registerHandler("object", handler);
    expect(executor.hasHandler("object")).toBe(true);

    const block = makeBlock({ id: "b1", name: "Obj", order: 0, type: "object" });
    const ctx = makeContext();
    const result = await executor.execute(block, ctx);
    expect(result.stateDelta).toEqual({ result: "ok" });
  });

  it("throws for unregistered block type", async () => {
    const block = makeBlock({ id: "b1", name: "Unknown", order: 0, type: "ftp" });
    const ctx = makeContext();

    await expect(executor.execute(block, ctx)).rejects.toThrow(
      /No handler registered for block type "ftp"/,
    );
  });

  it("returns empty result for void handlers", async () => {
    executor.registerHandler("string", async () => {
      /* side-effect only */
    });

    const block = makeBlock({ id: "b1", name: "Str", order: 0, type: "string" });
    const result = await executor.execute(block, makeContext());
    expect(result).toEqual({});
  });

  it("reads on_error strategy from block logic", () => {
    const abortBlock = makeBlock({
      id: "b1",
      name: "B1",
      order: 0,
      logic: { on_error: "abort" },
    });
    const continueBlock = makeBlock({
      id: "b2",
      name: "B2",
      order: 1,
      logic: { on_error: "continue" },
    });
    const defaultBlock = makeBlock({ id: "b3", name: "B3", order: 2 });

    expect(executor.getErrorStrategy(abortBlock)).toBe("abort");
    expect(executor.getErrorStrategy(continueBlock)).toBe("continue");
    expect(executor.getErrorStrategy(defaultBlock)).toBe("abort");
  });

  it("lists registered block types", () => {
    executor.registerHandler("object", async () => ({}));
    executor.registerHandler("string", async () => ({}));

    const types = executor.getRegisteredTypes();
    expect(types).toContain("object");
    expect(types).toContain("string");
    expect(types.length).toBe(2);
  });
});

/* ================================================================ */
/*  Interpreter — Full execution loop                                */
/* ================================================================ */

describe("Interpreter", () => {
  let interpreter: Interpreter;

  beforeEach(() => {
    interpreter = new Interpreter();
  });

  /* ── Simple sequential execution ────────────────────── */

  it("executes blocks in order", async () => {
    const blocks: Block[] = [
      makeBlock({
        id: "b1",
        name: "Set Name",
        order: 0,
        type: "object",
        logic: { object_key: "greeting", object_value: "hello" },
      }),
      makeBlock({
        id: "b2",
        name: "Set Count",
        order: 1,
        type: "object",
        logic: { object_key: "count", object_value: 42 },
      }),
    ];

    /* Register a handler that reads logic and writes to state */
    interpreter.blockExecutor.registerHandler("object", async (block, ctx) => {
      const key = block.logic.object_key as string;
      const value = block.logic.object_value;
      return { stateDelta: { [key]: value } };
    });

    const result = await interpreter.executeRun(makeRunConfig(blocks));

    expect(result.status).toBe("completed");
    expect(result.steps.length).toBe(2);
    expect(result.context.state.greeting).toBe("hello");
    expect(result.context.state.count).toBe(42);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  /* ── Block skipping via conditions ──────────────────── */

  it("skips blocks whose conditions fail", async () => {
    const blocks: Block[] = [
      makeBlock({
        id: "b1",
        name: "Always Runs",
        order: 0,
        type: "object",
        logic: {},
      }),
      makeBlock({
        id: "b2",
        name: "Never Runs",
        order: 1,
        type: "object",
        logic: {},
        conditions: [{ left: "$state.skip", operator: "==", right: "false" }],
      }),
    ];

    interpreter.blockExecutor.registerHandler("object", async () => ({
      stateDelta: { skip: "true" },
    }));

    const result = await interpreter.executeRun(makeRunConfig(blocks));

    expect(result.status).toBe("completed");
    expect(result.steps.length).toBe(2);
    expect(result.steps[0].status).toBe("completed");
    expect(result.steps[1].status).toBe("skipped");
  });

  /* ── UI blocks pause execution ──────────────────────── */

  it("pauses on ui_ blocks with awaiting_action status", async () => {
    const blocks: Block[] = [
      makeBlock({
        id: "b1",
        name: "Form",
        order: 0,
        type: "ui_form",
        logic: {},
      }),
      makeBlock({
        id: "b2",
        name: "After Form",
        order: 1,
        type: "object",
        logic: {},
      }),
    ];

    interpreter.blockExecutor.registerHandler("object", async () => ({}));

    const result = await interpreter.executeRun(makeRunConfig(blocks));

    expect(result.status).toBe("awaiting_action");
    /* Only the form step is recorded */
    expect(result.steps.length).toBe(1);
    expect(result.steps[0].blockType).toBe("ui_form");
  });

  /* ── Resume after UI block ──────────────────────────── */

  it("resumes execution after UI block", async () => {
    const blocks: Block[] = [
      makeBlock({
        id: "b1",
        name: "Form",
        order: 0,
        type: "ui_form",
        logic: {},
      }),
      makeBlock({
        id: "b2",
        name: "Process",
        order: 1,
        type: "object",
        logic: {},
      }),
    ];

    interpreter.blockExecutor.registerHandler("object", async () => ({
      stateDelta: { processed: true },
    }));

    /* First run pauses at ui_form */
    const firstResult = await interpreter.executeRun(makeRunConfig(blocks));
    expect(firstResult.status).toBe("awaiting_action");

    /* Resume from block index 1 (after the form) */
    const config = makeRunConfig(blocks);
    const resumeResult = await interpreter.resumeRun(config, 1, firstResult.context);

    expect(resumeResult.status).toBe("completed");
    expect(resumeResult.context.state.processed).toBe(true);
  });

  /* ── Goto (non-deferred) ────────────────────────────── */

  it("handles goto to jump to a named block", async () => {
    const blocks: Block[] = [
      makeBlock({
        id: "b1",
        name: "Start",
        order: 0,
        type: "object",
        logic: {},
      }),
      makeBlock({
        id: "b2",
        name: "Jump",
        order: 1,
        type: "goto",
        logic: { goto_target: "End" },
      }),
      makeBlock({
        id: "b3",
        name: "Skipped By Jump",
        order: 2,
        type: "object",
        logic: {},
      }),
      makeBlock({
        id: "b4",
        name: "End",
        order: 3,
        type: "object",
        logic: {},
      }),
    ];

    let executionLog: string[] = [];

    interpreter.blockExecutor.registerHandler("object", async (block) => {
      executionLog.push(block.name);
      return {};
    });

    const result = await interpreter.executeRun(makeRunConfig(blocks));

    expect(result.status).toBe("completed");
    /* Start, Jump (goto step), End, then End executes forward to end of blocks */
    expect(executionLog).toContain("Start");
    expect(executionLog).toContain("End");
    /* "Skipped By Jump" was jumped over */
    expect(executionLog).not.toContain("Skipped By Jump");
  });

  /* ── Goto with defer ────────────────────────────────── */

  it("handles goto with defer — deferred steps are marked", async () => {
    const blocks: Block[] = [
      makeBlock({
        id: "b1",
        name: "Setup",
        order: 0,
        type: "object",
        logic: {},
      }),
      makeBlock({
        id: "b2",
        name: "Defer Jump",
        order: 1,
        type: "goto",
        logic: { goto_target: "Target", goto_defer: true },
      }),
      makeBlock({
        id: "b3",
        name: "After Defer",
        order: 2,
        type: "object",
        logic: {},
      }),
      makeBlock({
        id: "b4",
        name: "Target",
        order: 3,
        type: "object",
        logic: {},
      }),
    ];

    interpreter.blockExecutor.registerHandler("object", async (block) => ({
      stateDelta: { [`executed_${block.name.replace(/\s/g, "_")}`]: true },
    }));

    const result = await interpreter.executeRun(makeRunConfig(blocks));

    expect(result.status).toBe("completed");

    /* Deferred steps should be marked */
    const deferredSteps = result.steps.filter((s) => s.isDeferred);
    expect(deferredSteps.length).toBeGreaterThan(0);

    /* "After Defer" should also run (it comes after the goto in normal flow) */
    const afterDeferStep = result.steps.find(
      (s) => s.blockName === "After Defer" && !s.isDeferred,
    );
    expect(afterDeferStep).toBeTruthy();
  });

  /* ── Error handling: abort strategy ─────────────────── */

  it("aborts run on block failure with abort strategy", async () => {
    const blocks: Block[] = [
      makeBlock({
        id: "b1",
        name: "Succeeds",
        order: 0,
        type: "object",
        logic: {},
      }),
      makeBlock({
        id: "b2",
        name: "Fails",
        order: 1,
        type: "object",
        logic: {},
      }),
      makeBlock({
        id: "b3",
        name: "Never Reached",
        order: 2,
        type: "object",
        logic: {},
      }),
    ];

    let callCount = 0;
    interpreter.blockExecutor.registerHandler("object", async (block) => {
      callCount++;
      if (block.name === "Fails") {
        throw new Error("Something went wrong");
      }
      return {};
    });

    const result = await interpreter.executeRun(makeRunConfig(blocks));

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toMatch(/Something went wrong/);
    expect(callCount).toBe(2); // Only Succeeds and Fails
  });

  /* ── Error handling: continue strategy ──────────────── */

  it("continues on block failure with continue strategy", async () => {
    const blocks: Block[] = [
      makeBlock({
        id: "b1",
        name: "Fails",
        order: 0,
        type: "object",
        logic: { on_error: "continue" },
      }),
      makeBlock({
        id: "b2",
        name: "Still Runs",
        order: 1,
        type: "object",
        logic: {},
      }),
    ];

    interpreter.blockExecutor.registerHandler("object", async (block) => {
      if (block.name === "Fails") {
        throw new Error("Recoverable error");
      }
      return { stateDelta: { reached: true } };
    });

    const result = await interpreter.executeRun(makeRunConfig(blocks));

    expect(result.status).toBe("completed");
    expect(result.steps[0].status).toBe("failed");
    expect(result.steps[0].error?.message).toBe("Recoverable error");
    expect(result.steps[1].status).toBe("completed");
    expect(result.context.state.reached).toBe(true);
  });

  /* ── Step limit enforcement ─────────────────────────── */

  it("enforces step limit", async () => {
    const interp = new Interpreter({ maxSteps: 3 });

    const blocks: Block[] = [
      makeBlock({ id: "b1", name: "A", order: 0, type: "object", logic: {} }),
      makeBlock({ id: "b2", name: "B", order: 1, type: "object", logic: {} }),
      makeBlock({ id: "b3", name: "C", order: 2, type: "object", logic: {} }),
      makeBlock({ id: "b4", name: "D", order: 3, type: "object", logic: {} }),
    ];

    interp.blockExecutor.registerHandler("object", async () => ({}));

    const result = await interp.executeRun(makeRunConfig(blocks));

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toMatch(/Step limit reached/);
  });

  /* ── Initial state and secrets ──────────────────────── */

  it("seeds initial state and secrets from RunConfig", async () => {
    const blocks: Block[] = [
      makeBlock({ id: "b1", name: "Check", order: 0, type: "object", logic: {} }),
    ];

    interpreter.blockExecutor.registerHandler("object", async (_block, ctx) => ({
      stateDelta: {
        hasName: ctx.state.name === "preset",
        hasSecret: ctx.secrets.token === "secret-123",
      },
    }));

    const config = makeRunConfig(blocks, {
      initialState: { name: "preset" },
      secrets: { token: "secret-123" },
    });

    const result = await interpreter.executeRun(config);

    expect(result.status).toBe("completed");
    expect(result.context.state.hasName).toBe(true);
    expect(result.context.state.hasSecret).toBe(true);
  });

  /* ── Goto to unknown target ─────────────────────────── */

  it("fails when goto references unknown target", async () => {
    const blocks: Block[] = [
      makeBlock({
        id: "b1",
        name: "Bad Jump",
        order: 0,
        type: "goto",
        logic: { goto_target: "NonExistent" },
      }),
    ];

    const result = await interpreter.executeRun(makeRunConfig(blocks));

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toMatch(/unknown target "NonExistent"/);
  });

  /* ── Goto without target ────────────────────────────── */

  it("fails when goto has no goto_target", async () => {
    const blocks: Block[] = [
      makeBlock({
        id: "b1",
        name: "Bad Goto",
        order: 0,
        type: "goto",
        logic: {},
      }),
    ];

    const result = await interpreter.executeRun(makeRunConfig(blocks));

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toMatch(/missing goto_target/);
  });

  /* ── Empty workflow ─────────────────────────────────── */

  it("completes immediately for empty block list", async () => {
    const result = await interpreter.executeRun(makeRunConfig([]));

    expect(result.status).toBe("completed");
    expect(result.steps.length).toBe(0);
  });

  /* ── Context variables accessible during execution ──── */

  it("provides $run context to block handlers", async () => {
    const blocks: Block[] = [
      makeBlock({ id: "b1", name: "Read Run", order: 0, type: "object", logic: {} }),
    ];

    interpreter.blockExecutor.registerHandler("object", async (_block, ctx) => ({
      stateDelta: {
        runId: ctx.run.id,
        platform: ctx.run.platform,
      },
    }));

    const result = await interpreter.executeRun(makeRunConfig(blocks));

    expect(result.context.state.runId).toBe("run-1");
    expect(result.context.state.platform).toBe("test-device");
  });

  /* ── Multiple conditions gate execution ─────────────── */

  it("evaluates multiple conditions as AND", async () => {
    const blocks: Block[] = [
      makeBlock({
        id: "b1",
        name: "Seeder",
        order: 0,
        type: "object",
        logic: {},
      }),
      makeBlock({
        id: "b2",
        name: "Gated",
        order: 1,
        type: "object",
        logic: {},
        conditions: [
          { left: "$state.x", operator: "==", right: "10" },
          { left: "$state.y", operator: ">", right: "5" },
        ],
      }),
    ];

    interpreter.blockExecutor.registerHandler("object", async (block) => {
      if (block.name === "Seeder") {
        return { stateDelta: { x: 10, y: 3 } };
      }
      return { stateDelta: { gated: true } };
    });

    const result = await interpreter.executeRun(makeRunConfig(blocks));

    /* x==10 passes, but y>5 fails → Gated is skipped */
    expect(result.steps[1].status).toBe("skipped");
    expect(result.context.state.gated).toBeUndefined();
  });

  /* ── $error available after block failure ────────────── */

  it("makes $error available after a failed block", async () => {
    const blocks: Block[] = [
      makeBlock({
        id: "b1",
        name: "Fails",
        order: 0,
        type: "object",
        logic: { on_error: "continue" },
      }),
      makeBlock({
        id: "b2",
        name: "Reads Error",
        order: 1,
        type: "object",
        logic: {},
      }),
    ];

    interpreter.blockExecutor.registerHandler("object", async (block, ctx) => {
      if (block.name === "Fails") {
        throw new Error("test error");
      }
      /* Read the error from the context manager */
      const errorMsg = interpreter.contextManager.resolve("$error.message", ctx);
      return { stateDelta: { capturedError: errorMsg } };
    });

    const result = await interpreter.executeRun(makeRunConfig(blocks));

    expect(result.status).toBe("completed");
    expect(result.context.state.capturedError).toBe("test error");
  });
});
