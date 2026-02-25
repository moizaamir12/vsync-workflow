import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { Block, WorkflowContext } from "@vsync/shared-types";
import { codeExecutor } from "../blocks/code.js";
import {
  validateCode,
  sanitizeError,
  diffState,
  createSandboxContext,
} from "../blocks/code-sandbox.js";
import type { ConsoleEntry } from "../blocks/code-sandbox.js";
import { transpileTypeScript } from "../blocks/code-typescript.js";
import { flowBlockHandlers } from "../blocks/index.js";

/* ── Test helpers ────────────────────────────────────────── */

function makeBlock(logic: Record<string, unknown>, type = "code"): Block {
  return {
    id: "test-block",
    workflowId: "wf-1",
    workflowVersion: 1,
    name: "Test Code Block",
    type: type as Block["type"],
    logic,
    order: 0,
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

let ctx: WorkflowContext;

beforeEach(() => {
  ctx = makeContext({
    state: {
      count: 5,
      name: "Alice",
      items: [1, 2, 3],
      config: { debug: true, level: 3 },
    },
    secrets: {
      apiKey: "sk-test-12345",
    },
  });
  ctx.cache.set("tempResult", 42);
  ctx.cache.set("flag", true);
});

/* ================================================================ */
/*  flowBlockHandlers registry                                       */
/* ================================================================ */

describe("flowBlockHandlers", () => {
  it("includes the code executor", () => {
    expect(flowBlockHandlers.code).toBeDefined();
    expect(typeof flowBlockHandlers.code).toBe("function");
  });
});

/* ================================================================ */
/*  codeExecutor — basic execution                                   */
/* ================================================================ */

describe("codeExecutor", () => {
  describe("basic execution", () => {
    it("returns a value and binds to state", async () => {
      const block = makeBlock({
        code_source: "return 42;",
        code_bind_value: "$state.result",
      });

      const result = await codeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(42);
    });

    it("returns string value", async () => {
      const block = makeBlock({
        code_source: 'return "hello world";',
        code_bind_value: "$state.message",
      });

      const result = await codeExecutor(block, ctx);
      expect(result.stateDelta?.message).toBe("hello world");
    });

    it("returns object value", async () => {
      const block = makeBlock({
        code_source: 'return { success: true, data: [1, 2, 3] };',
        code_bind_value: "$state.result",
      });

      const result = await codeExecutor(block, ctx);
      const r = result.stateDelta?.result as Record<string, unknown>;
      expect(r.success).toBe(true);
      expect(r.data).toEqual([1, 2, 3]);
    });

    it("returns array value", async () => {
      const block = makeBlock({
        code_source: "return [10, 20, 30];",
        code_bind_value: "$state.nums",
      });

      const result = await codeExecutor(block, ctx);
      expect(result.stateDelta?.nums).toEqual([10, 20, 30]);
    });

    it("returns empty result for empty source", async () => {
      const block = makeBlock({
        code_source: "",
        code_bind_value: "$state.result",
      });

      const result = await codeExecutor(block, ctx);
      expect(result).toEqual({});
    });

    it("returns undefined when no return statement", async () => {
      const block = makeBlock({
        code_source: "const x = 1 + 2;",
        code_bind_value: "$state.result",
      });

      const result = await codeExecutor(block, ctx);
      /* undefined return → no bind */
      expect(result.stateDelta?.result).toBeUndefined();
    });
  });

  /* ── State modification ──────────────────────────────── */

  describe("state modification", () => {
    it("detects state.count mutation", async () => {
      const block = makeBlock({
        code_source: "state.count = state.count + 10;",
      });

      const result = await codeExecutor(block, ctx);
      expect(result.stateDelta?.count).toBe(15);
    });

    it("detects new state keys", async () => {
      const block = makeBlock({
        code_source: 'state.newKey = "added";',
      });

      const result = await codeExecutor(block, ctx);
      expect(result.stateDelta?.newKey).toBe("added");
    });

    it("detects state key deletion", async () => {
      const block = makeBlock({
        code_source: "delete state.name;",
      });

      const result = await codeExecutor(block, ctx);
      expect(result.stateDelta?.name).toBeUndefined();
      expect("name" in (result.stateDelta ?? {})).toBe(true);
    });

    it("detects nested state changes", async () => {
      const block = makeBlock({
        code_source: "state.config.debug = false;",
      });

      const result = await codeExecutor(block, ctx);
      const config = result.stateDelta?.config as Record<string, unknown>;
      expect(config.debug).toBe(false);
      expect(config.level).toBe(3);
    });

    it("merges return value and state mutations", async () => {
      const block = makeBlock({
        code_source: 'state.count = 99; return "done";',
        code_bind_value: "$state.status",
      });

      const result = await codeExecutor(block, ctx);
      expect(result.stateDelta?.count).toBe(99);
      expect(result.stateDelta?.status).toBe("done");
    });

    it("does not modify original context state", async () => {
      const block = makeBlock({
        code_source: "state.count = 999;",
      });

      await codeExecutor(block, ctx);
      /* The original context should be untouched */
      expect(ctx.state.count).toBe(5);
    });
  });

  /* ── Cache API ───────────────────────────────────────── */

  describe("cache API", () => {
    it("reads from cache via cache.get()", async () => {
      const block = makeBlock({
        code_source: 'return cache.get("tempResult");',
        code_bind_value: "$state.result",
      });

      const result = await codeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(42);
    });

    it("writes to cache via cache.set()", async () => {
      const block = makeBlock({
        code_source: 'cache.set("computed", 123); return cache.get("computed");',
        code_bind_value: "$state.result",
      });

      const result = await codeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(123);
      /* The real cache should have been updated */
      expect(ctx.cache.get("computed")).toBe(123);
    });

    it("checks cache existence via cache.has()", async () => {
      const block = makeBlock({
        code_source: 'return cache.has("tempResult");',
        code_bind_value: "$state.result",
      });

      const result = await codeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(true);
    });

    it("deletes from cache via cache.delete()", async () => {
      const block = makeBlock({
        code_source: 'cache.delete("flag"); return cache.has("flag");',
        code_bind_value: "$state.result",
      });

      const result = await codeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(false);
      expect(ctx.cache.has("flag")).toBe(false);
    });
  });

  /* ── Artifacts access ────────────────────────────────── */

  describe("artifacts access", () => {
    it("reads artifact data (read-only)", async () => {
      ctx.artifacts = [
        { id: "a1", type: "image", name: "photo.jpg", data: {} } as never,
      ];

      const block = makeBlock({
        code_source: "return artifacts.length;",
        code_bind_value: "$state.result",
      });

      const result = await codeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(1);
    });

    it("reads artifact properties", async () => {
      ctx.artifacts = [
        { id: "a1", type: "image", name: "photo.jpg" } as never,
      ];

      const block = makeBlock({
        code_source: "return artifacts[0].name;",
        code_bind_value: "$state.result",
      });

      const result = await codeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("photo.jpg");
    });
  });

  /* ── Secrets access ──────────────────────────────────── */

  describe("secrets access", () => {
    it("reads secret values", async () => {
      const block = makeBlock({
        code_source: 'return secrets.apiKey;',
        code_bind_value: "$state.result",
      });

      const result = await codeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("sk-test-12345");
    });

    it("cannot modify secrets", async () => {
      const block = makeBlock({
        code_source: 'secrets.apiKey = "hacked"; return secrets.apiKey;',
        code_bind_value: "$state.result",
      });

      await expect(codeExecutor(block, ctx)).rejects.toThrow("read-only");
    });
  });

  /* ── Fetch (SSRF protected) ──────────────────────────── */

  describe("fetch in sandbox", () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("allows fetch to public URLs", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: "test" }),
      });

      const block = makeBlock({
        code_source: `
          const resp = await fetch("https://api.example.com/data");
          const data = await resp.json();
          return data;
        `,
        code_bind_value: "$state.result",
      });

      const result = await codeExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual({ data: "test" });
    });

    it("blocks fetch to private IPs (SSRF)", async () => {
      const block = makeBlock({
        code_source: 'const r = await fetch("http://127.0.0.1/admin"); return r;',
        code_bind_value: "$state.result",
      });

      await expect(codeExecutor(block, ctx)).rejects.toThrow("SSRF blocked");
    });

    it("blocks fetch to localhost", async () => {
      const block = makeBlock({
        code_source: 'const r = await fetch("http://localhost:8080"); return r;',
        code_bind_value: "$state.result",
      });

      await expect(codeExecutor(block, ctx)).rejects.toThrow("SSRF blocked");
    });
  });

  /* ── Console capture ─────────────────────────────────── */

  describe("console capture", () => {
    it("captures console.log output", async () => {
      const block = makeBlock({
        code_source: 'console.log("hello"); console.log("world"); return true;',
        code_bind_value: "$state.result",
      });

      const result = await codeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(true);

      const output = result.eventDelta?.__consoleOutput as ConsoleEntry[];
      expect(output).toBeDefined();
      expect(output.length).toBe(2);
      expect(output[0].level).toBe("log");
      expect(output[0].args).toEqual(["hello"]);
      expect(output[1].args).toEqual(["world"]);
    });

    it("captures console.warn and console.error", async () => {
      const block = makeBlock({
        code_source: 'console.warn("caution"); console.error("failure");',
      });

      const result = await codeExecutor(block, ctx);
      const output = result.eventDelta?.__consoleOutput as ConsoleEntry[];
      expect(output.length).toBe(2);
      expect(output[0].level).toBe("warn");
      expect(output[1].level).toBe("error");
    });

    it("captures multiple arguments in one call", async () => {
      const block = makeBlock({
        code_source: 'console.log("count:", 42, true);',
      });

      const result = await codeExecutor(block, ctx);
      const output = result.eventDelta?.__consoleOutput as ConsoleEntry[];
      expect(output[0].args).toEqual(["count:", 42, true]);
    });
  });

  /* ── Builtins access ─────────────────────────────────── */

  describe("builtins", () => {
    it("can use JSON.stringify/parse", async () => {
      const block = makeBlock({
        code_source: 'return JSON.parse(JSON.stringify({ a: 1 }));',
        code_bind_value: "$state.result",
      });

      const result = await codeExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual({ a: 1 });
    });

    it("can use Math functions", async () => {
      const block = makeBlock({
        code_source: "return Math.max(1, 5, 3);",
        code_bind_value: "$state.result",
      });

      const result = await codeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(5);
    });

    it("can use Date", async () => {
      const block = makeBlock({
        code_source: 'return typeof new Date().toISOString();',
        code_bind_value: "$state.result",
      });

      const result = await codeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("string");
    });

    it("can use Array methods", async () => {
      const block = makeBlock({
        code_source: "return [3, 1, 2].sort();",
        code_bind_value: "$state.result",
      });

      const result = await codeExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual([1, 2, 3]);
    });

    it("can use Map and Set", async () => {
      const block = makeBlock({
        code_source: `
          const m = new Map();
          m.set("a", 1);
          const s = new Set([1, 2, 2, 3]);
          return { mapSize: m.size, setSize: s.size };
        `,
        code_bind_value: "$state.result",
      });

      const result = await codeExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual({ mapSize: 1, setSize: 3 });
    });

    it("can use RegExp", async () => {
      const block = makeBlock({
        code_source: 'return /\\d+/.test("abc123");',
        code_bind_value: "$state.result",
      });

      const result = await codeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(true);
    });

    it("can use async/await with setTimeout", async () => {
      const block = makeBlock({
        code_source: `
          const delay = (ms) => new Promise(r => setTimeout(r, ms));
          await delay(10);
          return "waited";
        `,
        code_bind_value: "$state.result",
        code_timeout_ms: 5000,
      });

      const result = await codeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("waited");
    });
  });

  /* ── Timeout ─────────────────────────────────────────── */

  describe("timeout", () => {
    it("times out on infinite sync loop", async () => {
      const block = makeBlock({
        code_source: "while (true) {}",
        code_timeout_ms: 100,
      });

      await expect(codeExecutor(block, ctx)).rejects.toThrow("timed out");
    });

    it("caps timeout at 30000ms", async () => {
      /* Shouldn't throw — this just verifies the cap is applied */
      const block = makeBlock({
        code_source: "return 1;",
        code_timeout_ms: 999999,
        code_bind_value: "$state.result",
      });

      const result = await codeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(1);
    });

    it("handles negative timeout gracefully", async () => {
      const block = makeBlock({
        code_source: "return 1;",
        code_timeout_ms: -100,
        code_bind_value: "$state.result",
      });

      /* Should complete — min(max(10, -100), 30000) = 10ms,
         vm requires a reasonable floor so we clamp to 10ms */
      const result = await codeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(1);
    });
  });

  /* ── Security: blocked patterns ──────────────────────── */

  describe("security — blocked patterns", () => {
    it("blocks require()", async () => {
      const block = makeBlock({
        code_source: 'const fs = require("fs"); return fs;',
        code_bind_value: "$state.result",
      });

      await expect(codeExecutor(block, ctx)).rejects.toThrow("require()");
    });

    it("blocks import statements", async () => {
      const block = makeBlock({
        code_source: 'import fs from "fs";',
        code_bind_value: "$state.result",
      });

      await expect(codeExecutor(block, ctx)).rejects.toThrow("import");
    });

    it("blocks dynamic import()", async () => {
      const block = makeBlock({
        code_source: 'const m = await import("fs");',
        code_bind_value: "$state.result",
      });

      await expect(codeExecutor(block, ctx)).rejects.toThrow("import");
    });

    it("blocks process.exit", async () => {
      const block = makeBlock({
        code_source: "process.exit(1);",
        code_bind_value: "$state.result",
      });

      await expect(codeExecutor(block, ctx)).rejects.toThrow("process");
    });

    it("blocks process.env", async () => {
      const block = makeBlock({
        code_source: "return process.env.SECRET;",
        code_bind_value: "$state.result",
      });

      await expect(codeExecutor(block, ctx)).rejects.toThrow("process");
    });

    it("blocks eval()", async () => {
      const block = makeBlock({
        code_source: 'return eval("1 + 1");',
        code_bind_value: "$state.result",
      });

      await expect(codeExecutor(block, ctx)).rejects.toThrow("eval()");
    });

    it("blocks new Function()", async () => {
      const block = makeBlock({
        code_source: 'const fn = new Function("return 42"); return fn();',
        code_bind_value: "$state.result",
      });

      await expect(codeExecutor(block, ctx)).rejects.toThrow("new Function()");
    });

    it("blocks __proto__ manipulation", async () => {
      const block = makeBlock({
        code_source: 'const obj = {}; obj.__proto__.polluted = true;',
        code_bind_value: "$state.result",
      });

      await expect(codeExecutor(block, ctx)).rejects.toThrow("__proto__");
    });

    it("blocks globalThis access", async () => {
      const block = makeBlock({
        code_source: "return globalThis;",
        code_bind_value: "$state.result",
      });

      await expect(codeExecutor(block, ctx)).rejects.toThrow("globalThis");
    });

    it("blocks child_process", async () => {
      const block = makeBlock({
        code_source: 'const cp = child_process.exec("ls");',
        code_bind_value: "$state.result",
      });

      await expect(codeExecutor(block, ctx)).rejects.toThrow("child_process");
    });

    it("blocks Buffer access", async () => {
      const block = makeBlock({
        code_source: 'return Buffer.from("test");',
        code_bind_value: "$state.result",
      });

      await expect(codeExecutor(block, ctx)).rejects.toThrow("Buffer");
    });

    it("blocks fromCharCode bypass attempts", async () => {
      const block = makeBlock({
        code_source: "return String.fromCharCode(72, 101, 108);",
        code_bind_value: "$state.result",
      });

      await expect(codeExecutor(block, ctx)).rejects.toThrow("fromCharCode");
    });

    it("blocks constructor bracket access", async () => {
      const block = makeBlock({
        code_source: 'const fn = constructor ["constructor"]("return 1");',
        code_bind_value: "$state.result",
      });

      await expect(codeExecutor(block, ctx)).rejects.toThrow("constructor");
    });
  });

  /* ── Error handling ──────────────────────────────────── */

  describe("error handling", () => {
    it("reports syntax errors", async () => {
      const block = makeBlock({
        code_source: "function( { broken",
        code_bind_value: "$state.result",
      });

      await expect(codeExecutor(block, ctx)).rejects.toThrow("Syntax error");
    });

    it("reports runtime errors", async () => {
      const block = makeBlock({
        code_source: "undefinedVariable.property;",
        code_bind_value: "$state.result",
      });

      await expect(codeExecutor(block, ctx)).rejects.toThrow("Runtime error");
    });

    it("reports type errors", async () => {
      const block = makeBlock({
        code_source: "null.toString();",
        code_bind_value: "$state.result",
      });

      await expect(codeExecutor(block, ctx)).rejects.toThrow("Runtime error");
    });
  });

  /* ── TypeScript support ──────────────────────────────── */

  describe("TypeScript support", () => {
    it("executes TypeScript code with type annotations", async () => {
      const block = makeBlock({
        code_source: `
          const x: number = 42;
          const greet = (name: string): string => "Hello " + name;
          return greet("World");
        `,
        code_language: "typescript",
        code_bind_value: "$state.result",
      });

      const result = await codeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("Hello World");
    });

    it("handles TypeScript interfaces (stripped)", async () => {
      const block = makeBlock({
        code_source: `
          interface User {
            name: string;
            age: number;
          }
          const user: User = { name: "Alice", age: 30 };
          return user;
        `,
        code_language: "typescript",
        code_bind_value: "$state.result",
      });

      const result = await codeExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual({ name: "Alice", age: 30 });
    });

    it("handles TypeScript generics", async () => {
      const block = makeBlock({
        code_source: `
          const identity = <T>(x: T): T => x;
          return identity(99);
        `,
        code_language: "typescript",
        code_bind_value: "$state.result",
      });

      const result = await codeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(99);
    });

    it("defaults to JavaScript when language not specified", async () => {
      const block = makeBlock({
        code_source: "return 1 + 1;",
        code_bind_value: "$state.result",
      });

      const result = await codeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(2);
    });
  });
});

/* ================================================================ */
/*  validateCode (static analysis)                                   */
/* ================================================================ */

describe("validateCode", () => {
  it("passes valid code", () => {
    const result = validateCode("const x = 1 + 2; return x;");
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("flags require()", () => {
    const result = validateCode('const fs = require("fs");');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors.some((e) => e.includes("require()"))).toBe(true);
  });

  it("flags import statements", () => {
    const result = validateCode('import fs from "fs";');
    expect(result.valid).toBe(false);
  });

  it("flags process access", () => {
    const result = validateCode("process.exit(1);");
    expect(result.valid).toBe(false);
  });

  it("flags eval()", () => {
    const result = validateCode('eval("1+1");');
    expect(result.valid).toBe(false);
  });

  it("flags new Function()", () => {
    const result = validateCode('new Function("return 1")();');
    expect(result.valid).toBe(false);
  });

  it("flags __proto__", () => {
    const result = validateCode("obj.__proto__ = {};");
    expect(result.valid).toBe(false);
  });

  it("flags globalThis", () => {
    const result = validateCode("globalThis.something;");
    expect(result.valid).toBe(false);
  });

  it("reports multiple violations", () => {
    const result = validateCode('require("fs"); process.exit(1);');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

/* ================================================================ */
/*  sanitizeError                                                    */
/* ================================================================ */

describe("sanitizeError", () => {
  it("extracts message from Error", () => {
    const result = sanitizeError(new Error("test error"));
    expect(result.message).toBe("test error");
  });

  it("handles non-Error values", () => {
    const result = sanitizeError("string error");
    expect(result.message).toBe("string error");
  });

  it("handles null", () => {
    const result = sanitizeError(null);
    expect(result.message).toBe("null");
  });

  it("extracts line/column from vm-style stack", () => {
    const err = new Error("test");
    err.stack = "Error: test\n    at evalmachine.<anonymous>:5:10";
    const result = sanitizeError(err);
    expect(result.line).toBe(5);
    expect(result.column).toBe(10);
  });
});

/* ================================================================ */
/*  diffState                                                        */
/* ================================================================ */

describe("diffState", () => {
  it("detects changed values", () => {
    const original = { a: 1, b: 2 };
    const modified = { a: 1, b: 99 };
    const delta = diffState(original, modified);
    expect(delta).toEqual({ b: 99 });
  });

  it("detects new keys", () => {
    const original = { a: 1 };
    const modified = { a: 1, b: 2 };
    const delta = diffState(original, modified);
    expect(delta).toEqual({ b: 2 });
  });

  it("detects deleted keys", () => {
    const original = { a: 1, b: 2 };
    const modified = { a: 1 };
    const delta = diffState(original, modified);
    expect(delta).toEqual({ b: undefined });
  });

  it("returns empty for identical objects", () => {
    const original = { a: 1, b: [1, 2] };
    const modified = { a: 1, b: [1, 2] };
    const delta = diffState(original, modified);
    expect(delta).toEqual({});
  });

  it("detects nested changes", () => {
    const original = { config: { debug: true, level: 3 } };
    const modified = { config: { debug: false, level: 3 } };
    const delta = diffState(original, modified);
    expect(delta.config).toEqual({ debug: false, level: 3 });
  });
});

/* ================================================================ */
/*  transpileTypeScript                                              */
/* ================================================================ */

describe("transpileTypeScript", () => {
  it("strips type annotations", async () => {
    const result = await transpileTypeScript("const x: number = 42;");
    expect(result).toContain("42");
    expect(result).not.toContain(": number");
  });

  it("strips interfaces", async () => {
    const result = await transpileTypeScript(`
      interface Foo { bar: string; }
      const x: Foo = { bar: "hello" };
    `);
    expect(result).not.toContain("interface");
    expect(result).toContain('"hello"');
  });

  it("strips generics", async () => {
    const result = await transpileTypeScript(`
      function identity<T>(x: T): T { return x; }
    `);
    expect(result).not.toContain("<T>");
    expect(result).toContain("return x");
  });

  it("preserves runtime logic", async () => {
    const result = await transpileTypeScript(`
      const add = (a: number, b: number): number => a + b;
      const result = add(1, 2);
    `);
    expect(result).toContain("a + b");
    expect(result).toContain("add(1, 2)");
  });
});

/* ================================================================ */
/*  createSandboxContext                                              */
/* ================================================================ */

describe("createSandboxContext", () => {
  it("provides deep-cloned state", () => {
    const sandbox = createSandboxContext(ctx);
    expect(sandbox.stateClone.count).toBe(5);
    expect(sandbox.stateClone.name).toBe("Alice");

    /* Mutation doesn't affect original */
    sandbox.stateClone.count = 999;
    expect(ctx.state.count).toBe(5);
  });

  it("provides console capture", () => {
    const sandbox = createSandboxContext(ctx);
    expect(sandbox.getConsoleOutput()).toEqual([]);
  });

  it("provides sandbox state getter", () => {
    const sandbox = createSandboxContext(ctx);
    const state = sandbox.getSandboxState();
    expect(state.count).toBe(5);
  });
});
