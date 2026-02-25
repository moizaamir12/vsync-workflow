import { describe, it, expect, beforeEach } from "vitest";
import type { Block, WorkflowContext } from "@vsync/shared-types";
import { objectExecutor } from "../blocks/object.js";
import { stringExecutor } from "../blocks/string.js";
import { arrayExecutor } from "../blocks/array.js";
import { mathExecutor } from "../blocks/math.js";
import { dateExecutor } from "../blocks/date.js";
import { normalizeExecutor } from "../blocks/normalize.js";
import { dataBlockHandlers } from "../blocks/index.js";

/* ── Test helpers ────────────────────────────────────────── */

function makeBlock(logic: Record<string, unknown>, type = "object"): Block {
  return {
    id: "test-block",
    workflowId: "wf-1",
    workflowVersion: 1,
    name: "Test Block",
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

/* ================================================================ */
/*  Block index                                                      */
/* ================================================================ */

describe("dataBlockHandlers", () => {
  it("exports all 6 data block handlers", () => {
    expect(Object.keys(dataBlockHandlers)).toEqual(
      expect.arrayContaining(["object", "string", "array", "math", "date", "normalize"]),
    );
    expect(Object.keys(dataBlockHandlers).length).toBe(6);
  });

  it("all handlers are functions", () => {
    for (const handler of Object.values(dataBlockHandlers)) {
      expect(typeof handler).toBe("function");
    }
  });
});

/* ================================================================ */
/*  Object executor                                                  */
/* ================================================================ */

describe("objectExecutor", () => {
  let ctx: WorkflowContext;

  beforeEach(() => {
    ctx = makeContext({ state: { user: { name: "Alice", age: 30, tags: ["admin"] } } });
  });

  /* ── set ─────────────────────────────────────────────── */

  describe("set", () => {
    it("sets a plain value", async () => {
      const block = makeBlock({
        object_operation: "set",
        object_value: "hello",
        object_bind_value: "$state.greeting",
      });
      const result = await objectExecutor(block, ctx);
      expect(result.stateDelta?.greeting).toBe("hello");
    });

    it("parses JSON string values", async () => {
      const block = makeBlock({
        object_operation: "set",
        object_value: '{"a": 1, "b": 2}',
        object_bind_value: "$state.obj",
      });
      const result = await objectExecutor(block, ctx);
      expect(result.stateDelta?.obj).toEqual({ a: 1, b: 2 });
    });

    it("resolves templates inside set value", async () => {
      const block = makeBlock({
        object_operation: "set",
        object_value: { greeting: "Hi {{$state.user.name}}" },
        object_bind_value: "$state.result",
      });
      const result = await objectExecutor(block, ctx);
      expect((result.stateDelta?.result as Record<string, string>).greeting).toBe("Hi Alice");
    });

    it("handles null value", async () => {
      const block = makeBlock({
        object_operation: "set",
        object_value: null,
        object_bind_value: "$state.nothing",
      });
      const result = await objectExecutor(block, ctx);
      expect(result.stateDelta?.nothing).toBeNull();
    });
  });

  /* ── merge ───────────────────────────────────────────── */

  describe("merge", () => {
    it("merges multiple objects", async () => {
      const block = makeBlock({
        object_operation: "merge",
        object_sources: [{ a: 1 }, { b: 2 }, { c: 3 }],
        object_bind_value: "$state.merged",
      });
      const result = await objectExecutor(block, ctx);
      expect(result.stateDelta?.merged).toEqual({ a: 1, b: 2, c: 3 });
    });

    it("later objects overwrite earlier ones", async () => {
      const block = makeBlock({
        object_operation: "merge",
        object_sources: [{ x: 1 }, { x: 2 }],
        object_bind_value: "$state.merged",
      });
      const result = await objectExecutor(block, ctx);
      expect(result.stateDelta?.merged).toEqual({ x: 2 });
    });

    it("skips non-object sources in array", async () => {
      const block = makeBlock({
        object_operation: "merge",
        object_sources: [{ a: 1 }, "not-obj", { b: 2 }],
        object_bind_value: "$state.merged",
      });
      const result = await objectExecutor(block, ctx);
      expect(result.stateDelta?.merged).toEqual({ a: 1, b: 2 });
    });
  });

  /* ── keys ────────────────────────────────────────────── */

  describe("keys", () => {
    it("returns object keys", async () => {
      const block = makeBlock({
        object_operation: "keys",
        object_target: "$state.user",
        object_bind_value: "$state.result",
      });
      const result = await objectExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual(["name", "age", "tags"]);
    });

    it("returns empty array for non-object", async () => {
      const block = makeBlock({
        object_operation: "keys",
        object_target: "not an object",
        object_bind_value: "$state.result",
      });
      const result = await objectExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual([]);
    });

    it("returns empty array for null target", async () => {
      const block = makeBlock({
        object_operation: "keys",
        object_target: null,
        object_bind_value: "$state.result",
      });
      const result = await objectExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual([]);
    });
  });

  /* ── values ──────────────────────────────────────────── */

  describe("values", () => {
    it("returns object values", async () => {
      ctx.state.simple = { x: 10, y: 20 };
      const block = makeBlock({
        object_operation: "values",
        object_target: "$state.simple",
        object_bind_value: "$state.result",
      });
      const result = await objectExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual([10, 20]);
    });

    it("returns empty array for array input", async () => {
      const block = makeBlock({
        object_operation: "values",
        object_target: [1, 2, 3],
        object_bind_value: "$state.result",
      });
      const result = await objectExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual([]);
    });
  });

  /* ── pick ────────────────────────────────────────────── */

  describe("pick", () => {
    it("picks specified keys", async () => {
      const block = makeBlock({
        object_operation: "pick",
        object_target: "$state.user",
        object_keys: ["name", "age"],
        object_bind_value: "$state.result",
      });
      const result = await objectExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual({ name: "Alice", age: 30 });
    });

    it("ignores missing keys", async () => {
      const block = makeBlock({
        object_operation: "pick",
        object_target: "$state.user",
        object_keys: ["name", "nonexistent"],
        object_bind_value: "$state.result",
      });
      const result = await objectExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual({ name: "Alice" });
    });

    it("returns empty object for null target", async () => {
      const block = makeBlock({
        object_operation: "pick",
        object_target: null,
        object_keys: ["name"],
        object_bind_value: "$state.result",
      });
      const result = await objectExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual({});
    });
  });

  /* ── omit ────────────────────────────────────────────── */

  describe("omit", () => {
    it("omits specified keys", async () => {
      const block = makeBlock({
        object_operation: "omit",
        object_target: "$state.user",
        object_keys: ["tags"],
        object_bind_value: "$state.result",
      });
      const result = await objectExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual({ name: "Alice", age: 30 });
    });

    it("returns full object if no keys match", async () => {
      const block = makeBlock({
        object_operation: "omit",
        object_target: "$state.user",
        object_keys: ["nonexistent"],
        object_bind_value: "$state.result",
      });
      const result = await objectExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual({ name: "Alice", age: 30, tags: ["admin"] });
    });
  });

  /* ── delete ──────────────────────────────────────────── */

  describe("delete", () => {
    it("deletes a top-level key", async () => {
      const block = makeBlock({
        object_operation: "delete",
        object_target: "$state.user",
        object_delete_path: "age",
        object_bind_value: "$state.result",
      });
      const result = await objectExecutor(block, ctx);
      const r = result.stateDelta?.result as Record<string, unknown>;
      expect(r.name).toBe("Alice");
      expect("age" in r).toBe(false);
    });

    it("deletes a nested path", async () => {
      ctx.state.data = { metadata: { tags: ["a", "b"], id: 1 } };
      const block = makeBlock({
        object_operation: "delete",
        object_target: "$state.data",
        object_delete_path: "metadata.tags",
        object_bind_value: "$state.result",
      });
      const result = await objectExecutor(block, ctx);
      const r = result.stateDelta?.result as Record<string, unknown>;
      expect((r.metadata as Record<string, unknown>).id).toBe(1);
      expect("tags" in (r.metadata as Record<string, unknown>)).toBe(false);
    });

    it("returns unchanged object for missing path", async () => {
      const block = makeBlock({
        object_operation: "delete",
        object_target: "$state.user",
        object_delete_path: "nonexistent.deep",
        object_bind_value: "$state.result",
      });
      const result = await objectExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual(ctx.state.user);
    });
  });

  /* ── dynamic input resolution ───────────────────────── */

  describe("dynamic input", () => {
    it("resolves $state references in operation inputs", async () => {
      ctx.state.opName = "keys";
      const block = makeBlock({
        object_operation: "$state.opName",
        object_target: "$state.user",
        object_bind_value: "$state.result",
      });
      const result = await objectExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual(["name", "age", "tags"]);
    });
  });
});

/* ================================================================ */
/*  String executor                                                  */
/* ================================================================ */

describe("stringExecutor", () => {
  let ctx: WorkflowContext;

  beforeEach(() => {
    ctx = makeContext({ state: { greeting: "Hello World" } });
  });

  /* ── slice ───────────────────────────────────────────── */

  describe("slice", () => {
    it("slices with from/count", async () => {
      const block = makeBlock({
        string_operation: "slice",
        string_input: "Hello World",
        string_slice_from: 0,
        string_slice_count: 5,
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("Hello");
    });

    it("slices with start/end", async () => {
      const block = makeBlock({
        string_operation: "slice",
        string_input: "Hello World",
        string_slice_start: 6,
        string_slice_end: 11,
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("World");
    });

    it("slices from offset to end", async () => {
      const block = makeBlock({
        string_operation: "slice",
        string_input: "Hello World",
        string_slice_from: 6,
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("World");
    });
  });

  /* ── extract ─────────────────────────────────────────── */

  describe("extract", () => {
    it("extracts text before delimiter", async () => {
      const block = makeBlock({
        string_operation: "extract",
        string_input: "user@example.com",
        string_extract_mode: "before",
        string_extract_delimiter: "@",
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("user");
    });

    it("extracts text after delimiter", async () => {
      const block = makeBlock({
        string_operation: "extract",
        string_input: "user@example.com",
        string_extract_mode: "after",
        string_extract_delimiter: "@",
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("example.com");
    });

    it("extracts text between delimiters", async () => {
      const block = makeBlock({
        string_operation: "extract",
        string_input: "start[middle]end",
        string_extract_mode: "between",
        string_extract_start_delimiter: "[",
        string_extract_end_delimiter: "]",
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("middle");
    });

    it("extracts number from text", async () => {
      const block = makeBlock({
        string_operation: "extract",
        string_input: "Price is $42.99",
        string_extract_mode: "number",
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(42.99);
    });

    it("extracts negative number", async () => {
      const block = makeBlock({
        string_operation: "extract",
        string_input: "Temperature: -15 degrees",
        string_extract_mode: "number",
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(-15);
    });

    it("returns null when no number found", async () => {
      const block = makeBlock({
        string_operation: "extract",
        string_input: "no numbers here",
        string_extract_mode: "number",
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toBeNull();
    });

    it("extracts via regex", async () => {
      const block = makeBlock({
        string_operation: "extract",
        string_input: "Order #12345 confirmed",
        string_extract_mode: "regex",
        string_extract_regex: "#(\\d+)",
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("12345");
    });

    it("returns null when before delimiter not found", async () => {
      const block = makeBlock({
        string_operation: "extract",
        string_input: "no delimiter here",
        string_extract_mode: "before",
        string_extract_delimiter: "@",
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toBeNull();
    });
  });

  /* ── format ──────────────────────────────────────────── */

  describe("format", () => {
    it("converts to uppercase", async () => {
      const block = makeBlock({
        string_operation: "format",
        string_input: "hello",
        string_format_type: "upper",
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("HELLO");
    });

    it("converts to title case", async () => {
      const block = makeBlock({
        string_operation: "format",
        string_input: "hello world",
        string_format_type: "title",
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("Hello World");
    });

    it("converts to sentence case", async () => {
      const block = makeBlock({
        string_operation: "format",
        string_input: "HELLO WORLD",
        string_format_type: "sentence",
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("Hello world");
    });

    it("formats number with decimals", async () => {
      const block = makeBlock({
        string_operation: "format",
        string_input: "3.14159",
        string_format_type: "number",
        string_format_decimals: 2,
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("3.14");
    });
  });

  /* ── trim, pad, replace ──────────────────────────────── */

  describe("trim", () => {
    it("trims whitespace", async () => {
      const block = makeBlock({
        string_operation: "trim",
        string_input: "  hello  ",
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("hello");
    });
  });

  describe("pad", () => {
    it("pads left", async () => {
      const block = makeBlock({
        string_operation: "pad",
        string_input: "42",
        string_pad_side: "left",
        string_pad_length: 5,
        string_pad_char: "0",
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("00042");
    });

    it("pads right", async () => {
      const block = makeBlock({
        string_operation: "pad",
        string_input: "hi",
        string_pad_side: "right",
        string_pad_length: 5,
        string_pad_char: ".",
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("hi...");
    });
  });

  describe("replace", () => {
    it("replaces first occurrence", async () => {
      const block = makeBlock({
        string_operation: "replace",
        string_input: "foo bar foo",
        string_replace_find: "foo",
        string_replace_with: "baz",
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("baz bar foo");
    });

    it("replaces all occurrences", async () => {
      const block = makeBlock({
        string_operation: "replace",
        string_input: "foo bar foo",
        string_replace_find: "foo",
        string_replace_with: "baz",
        string_replace_all: true,
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("baz bar baz");
    });
  });

  /* ── match, length, split, path ─────────────────────── */

  describe("match", () => {
    it("matches regex", async () => {
      const block = makeBlock({
        string_operation: "match",
        string_input: "abc123",
        string_match_mode: "regex",
        string_match_pattern: "(\\d+)",
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      const r = result.stateDelta?.result as Record<string, unknown>;
      expect(r.matched).toBe(true);
      expect(r.value).toBe("123");
    });

    it("returns fuzzy score", async () => {
      const block = makeBlock({
        string_operation: "match",
        string_input: "JavaScript",
        string_match_mode: "fuzzy",
        string_match_query: "java",
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      const r = result.stateDelta?.result as Record<string, unknown>;
      expect(typeof r.score).toBe("number");
      expect(r.score).toBeGreaterThan(0);
    });
  });

  describe("length", () => {
    it("returns string length", async () => {
      const block = makeBlock({
        string_operation: "length",
        string_input: "hello",
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(5);
    });

    it("returns 0 for empty string", async () => {
      const block = makeBlock({
        string_operation: "length",
        string_input: "",
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(0);
    });
  });

  describe("split", () => {
    it("splits by separator", async () => {
      const block = makeBlock({
        string_operation: "split",
        string_input: "a,b,c",
        string_split_separator: ",",
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual(["a", "b", "c"]);
    });
  });

  describe("path", () => {
    it("extracts filename", async () => {
      const block = makeBlock({
        string_operation: "path",
        string_input: "/home/user/document.pdf",
        string_path_component: "filename",
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("document.pdf");
    });

    it("extracts extension", async () => {
      const block = makeBlock({
        string_operation: "path",
        string_input: "/home/user/document.pdf",
        string_path_component: "extension",
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("pdf");
    });

    it("returns empty string when no extension", async () => {
      const block = makeBlock({
        string_operation: "path",
        string_input: "noext",
        string_path_component: "extension",
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("");
    });
  });

  /* ── generate ────────────────────────────────────────── */

  describe("generate", () => {
    it("generates a short_id", async () => {
      const block = makeBlock({
        string_operation: "generate",
        string_generate_type: "short_id",
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      const id = result.stateDelta?.result as string;
      expect(typeof id).toBe("string");
      expect(id.length).toBe(8);
    });

    it("generates a uuid", async () => {
      const block = makeBlock({
        string_operation: "generate",
        string_generate_type: "uuid",
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      const uuid = result.stateDelta?.result as string;
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it("checks OCR confusables", async () => {
      const block = makeBlock({
        string_operation: "generate",
        string_generate_type: "ocr_confusables",
        string_generate_input: "O0l1",
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toContain("confusable");
    });
  });

  /* ── checksum ────────────────────────────────────────── */

  describe("checksum", () => {
    it("calculates Luhn check digit", async () => {
      const block = makeBlock({
        string_operation: "checksum",
        string_input: "7992739871",
        string_checksum_algorithm: "luhn",
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("3");
    });

    it("calculates mod11 check digit", async () => {
      const block = makeBlock({
        string_operation: "checksum",
        string_input: "12345",
        string_checksum_algorithm: "mod11",
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(typeof result.stateDelta?.result).toBe("string");
    });

    it("returns null for empty input", async () => {
      const block = makeBlock({
        string_operation: "checksum",
        string_input: "",
        string_checksum_algorithm: "luhn",
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toBeNull();
    });

    it("calculates weighted check digit", async () => {
      const block = makeBlock({
        string_operation: "checksum",
        string_input: "12345",
        string_checksum_algorithm: "weighted",
        string_checksum_weights: [1, 3, 1, 3, 1],
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(typeof result.stateDelta?.result).toBe("string");
    });
  });

  /* ── chained operations ─────────────────────────────── */

  describe("chained", () => {
    it("chains trim → upper", async () => {
      const block = makeBlock({
        string_input: "  hello world  ",
        string_operations: [
          { operation: "trim" },
          { operation: "format", string_format_type: "upper" },
        ],
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("HELLO WORLD");
    });

    it("chains with per-op binding", async () => {
      const block = makeBlock({
        string_input: "  Hello  ",
        string_operations: [
          { operation: "trim", bind_to: "$state.trimmed" },
          { operation: "format", string_format_type: "upper", bind_to: "$state.upper" },
        ],
        string_bind_value: "$state.final",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.trimmed).toBe("Hello");
      expect(result.stateDelta?.upper).toBe("HELLO");
      expect(result.stateDelta?.final).toBe("HELLO");
    });

    it("chains replace → split", async () => {
      const block = makeBlock({
        string_input: "a.b.c",
        string_operations: [
          { operation: "replace", string_replace_find: ".", string_replace_with: ",", string_replace_all: true },
          { operation: "split", string_split_separator: "," },
        ],
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual(["a", "b", "c"]);
    });
  });

  /* ── dynamic input resolution ───────────────────────── */

  describe("dynamic input", () => {
    it("resolves $state in input", async () => {
      const block = makeBlock({
        string_operation: "format",
        string_input: "$state.greeting",
        string_format_type: "upper",
        string_bind_value: "$state.result",
      }, "string");
      const result = await stringExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("HELLO WORLD");
    });
  });
});

/* ================================================================ */
/*  Array executor                                                   */
/* ================================================================ */

describe("arrayExecutor", () => {
  let ctx: WorkflowContext;

  beforeEach(() => {
    ctx = makeContext({
      state: {
        nums: [3, 1, 4, 1, 5, 9],
        users: [
          { name: "Alice", age: 30 },
          { name: "Bob", age: 25 },
          { name: "Charlie", age: 35 },
        ],
      },
    });
  });

  /* ── slice ───────────────────────────────────────────── */

  describe("slice", () => {
    it("slices from start to end", async () => {
      const block = makeBlock({
        array_operation: "slice",
        array_input: "$state.nums",
        array_slice_start: 1,
        array_slice_end: 4,
        array_bind_value: "$state.result",
      }, "array");
      const result = await arrayExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual([1, 4, 1]);
    });

    it("slices from start to end of array", async () => {
      const block = makeBlock({
        array_operation: "slice",
        array_input: "$state.nums",
        array_slice_start: 4,
        array_bind_value: "$state.result",
      }, "array");
      const result = await arrayExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual([5, 9]);
    });

    it("returns empty for out of bounds", async () => {
      const block = makeBlock({
        array_operation: "slice",
        array_input: "$state.nums",
        array_slice_start: 100,
        array_bind_value: "$state.result",
      }, "array");
      const result = await arrayExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual([]);
    });
  });

  /* ── find ────────────────────────────────────────────── */

  describe("find", () => {
    it("finds by field match", async () => {
      const block = makeBlock({
        array_operation: "find",
        array_input: "$state.users",
        array_find_mode: "match",
        array_find_field: "name",
        array_find_operator: "==",
        array_find_value: "Bob",
        array_bind_value: "$state.result",
      }, "array");
      const result = await arrayExecutor(block, ctx);
      expect((result.stateDelta?.result as Record<string, unknown>)?.name).toBe("Bob");
    });

    it("finds by index", async () => {
      const block = makeBlock({
        array_operation: "find",
        array_input: "$state.nums",
        array_find_mode: "index",
        array_find_index: 2,
        array_bind_value: "$state.result",
      }, "array");
      const result = await arrayExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(4);
    });

    it("returns null for out of bounds index", async () => {
      const block = makeBlock({
        array_operation: "find",
        array_input: "$state.nums",
        array_find_mode: "index",
        array_find_index: 100,
        array_bind_value: "$state.result",
      }, "array");
      const result = await arrayExecutor(block, ctx);
      expect(result.stateDelta?.result).toBeNull();
    });

    it("finds with > operator", async () => {
      const block = makeBlock({
        array_operation: "find",
        array_input: "$state.users",
        array_find_mode: "match",
        array_find_field: "age",
        array_find_operator: ">",
        array_find_value: 30,
        array_bind_value: "$state.result",
      }, "array");
      const result = await arrayExecutor(block, ctx);
      expect((result.stateDelta?.result as Record<string, unknown>)?.name).toBe("Charlie");
    });
  });

  /* ── filter ──────────────────────────────────────────── */

  describe("filter", () => {
    it("filters by match", async () => {
      const block = makeBlock({
        array_operation: "filter",
        array_input: "$state.users",
        array_filter_mode: "match",
        array_filter_field: "age",
        array_filter_operator: ">=",
        array_filter_value: "30",
        array_bind_value: "$state.result",
      }, "array");
      const result = await arrayExecutor(block, ctx);
      expect((result.stateDelta?.result as unknown[]).length).toBe(2);
    });

    it("filters truthy values", async () => {
      ctx.state.mixed = [0, 1, "", "hello", null, true, false, undefined];
      const block = makeBlock({
        array_operation: "filter",
        array_input: "$state.mixed",
        array_filter_mode: "truthy",
        array_bind_value: "$state.result",
      }, "array");
      const result = await arrayExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual([1, "hello", true]);
    });

    it("filters unique values", async () => {
      ctx.state.dups = [1, 2, 2, 3, 3, 3];
      const block = makeBlock({
        array_operation: "filter",
        array_input: "$state.dups",
        array_filter_mode: "unique",
        array_bind_value: "$state.result",
      }, "array");
      const result = await arrayExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual([1, 2, 3]);
    });

    it("filters unique by field", async () => {
      ctx.state.items = [
        { type: "a", id: 1 },
        { type: "a", id: 2 },
        { type: "b", id: 3 },
      ];
      const block = makeBlock({
        array_operation: "filter",
        array_input: "$state.items",
        array_filter_mode: "unique",
        array_filter_field: "type",
        array_bind_value: "$state.result",
      }, "array");
      const result = await arrayExecutor(block, ctx);
      expect((result.stateDelta?.result as unknown[]).length).toBe(2);
    });

    it("filters by artifact_type", async () => {
      ctx.state.artifacts = [
        { type: "image", name: "a.jpg" },
        { type: "barcode", name: "b.png" },
        { type: "image", name: "c.jpg" },
      ];
      const block = makeBlock({
        array_operation: "filter",
        array_input: "$state.artifacts",
        array_filter_mode: "artifact_type",
        array_filter_artifact_type: "image",
        array_bind_value: "$state.result",
      }, "array");
      const result = await arrayExecutor(block, ctx);
      expect((result.stateDelta?.result as unknown[]).length).toBe(2);
    });
  });

  /* ── pluck, reverse, sort, flatten, length ──────────── */

  describe("pluck", () => {
    it("plucks a field from each element", async () => {
      const block = makeBlock({
        array_operation: "pluck",
        array_input: "$state.users",
        array_pluck_field: "name",
        array_bind_value: "$state.result",
      }, "array");
      const result = await arrayExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual(["Alice", "Bob", "Charlie"]);
    });
  });

  describe("reverse", () => {
    it("reverses array", async () => {
      const block = makeBlock({
        array_operation: "reverse",
        array_input: [1, 2, 3],
        array_bind_value: "$state.result",
      }, "array");
      const result = await arrayExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual([3, 2, 1]);
    });
  });

  describe("sort", () => {
    it("sorts numbers ascending", async () => {
      const block = makeBlock({
        array_operation: "sort",
        array_input: "$state.nums",
        array_sort_direction: "asc",
        array_bind_value: "$state.result",
      }, "array");
      const result = await arrayExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual([1, 1, 3, 4, 5, 9]);
    });

    it("sorts by field descending", async () => {
      const block = makeBlock({
        array_operation: "sort",
        array_input: "$state.users",
        array_sort_field: "age",
        array_sort_direction: "desc",
        array_bind_value: "$state.result",
      }, "array");
      const result = await arrayExecutor(block, ctx);
      const r = result.stateDelta?.result as Array<Record<string, unknown>>;
      expect(r[0].name).toBe("Charlie");
      expect(r[2].name).toBe("Bob");
    });

    it("does not mutate original array", async () => {
      const block = makeBlock({
        array_operation: "sort",
        array_input: "$state.nums",
        array_sort_direction: "asc",
        array_bind_value: "$state.result",
      }, "array");
      await arrayExecutor(block, ctx);
      expect(ctx.state.nums).toEqual([3, 1, 4, 1, 5, 9]);
    });
  });

  describe("flatten", () => {
    it("flattens nested arrays", async () => {
      const block = makeBlock({
        array_operation: "flatten",
        array_input: [[1, 2], [3, 4], [5]],
        array_bind_value: "$state.result",
      }, "array");
      const result = await arrayExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe("length", () => {
    it("returns array length", async () => {
      const block = makeBlock({
        array_operation: "length",
        array_input: "$state.nums",
        array_bind_value: "$state.result",
      }, "array");
      const result = await arrayExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(6);
    });

    it("returns 0 for empty array", async () => {
      const block = makeBlock({
        array_operation: "length",
        array_input: [],
        array_bind_value: "$state.result",
      }, "array");
      const result = await arrayExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(0);
    });
  });

  /* ── add, drop, remove, merge ───────────────────────── */

  describe("add", () => {
    it("adds item to end", async () => {
      const block = makeBlock({
        array_operation: "add",
        array_input: [1, 2],
        array_add_item: 3,
        array_add_position: "end",
        array_bind_value: "$state.result",
      }, "array");
      const result = await arrayExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual([1, 2, 3]);
    });

    it("adds item to start", async () => {
      const block = makeBlock({
        array_operation: "add",
        array_input: [2, 3],
        array_add_item: 1,
        array_add_position: "start",
        array_bind_value: "$state.result",
      }, "array");
      const result = await arrayExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual([1, 2, 3]);
    });
  });

  describe("drop", () => {
    it("drops from end", async () => {
      const block = makeBlock({
        array_operation: "drop",
        array_input: [1, 2, 3, 4],
        array_drop_position: "end",
        array_drop_count: 2,
        array_bind_value: "$state.result",
      }, "array");
      const result = await arrayExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual([1, 2]);
    });

    it("drops from start", async () => {
      const block = makeBlock({
        array_operation: "drop",
        array_input: [1, 2, 3, 4],
        array_drop_position: "start",
        array_drop_count: 2,
        array_bind_value: "$state.result",
      }, "array");
      const result = await arrayExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual([3, 4]);
    });
  });

  describe("remove", () => {
    it("removes matching items", async () => {
      const block = makeBlock({
        array_operation: "remove",
        array_input: [1, 2, 3, 2, 1],
        array_remove_value: 2,
        array_bind_value: "$state.result",
      }, "array");
      const result = await arrayExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual([1, 3, 1]);
    });

    it("removes by field", async () => {
      const block = makeBlock({
        array_operation: "remove",
        array_input: "$state.users",
        array_remove_field: "name",
        array_remove_value: "Bob",
        array_bind_value: "$state.result",
      }, "array");
      const result = await arrayExecutor(block, ctx);
      expect((result.stateDelta?.result as unknown[]).length).toBe(2);
    });
  });

  describe("merge", () => {
    it("merges two arrays", async () => {
      const block = makeBlock({
        array_operation: "merge",
        array_input: [1, 2],
        array_merge_source: [3, 4],
        array_bind_value: "$state.result",
      }, "array");
      const result = await arrayExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual([1, 2, 3, 4]);
    });
  });

  /* ── convert ─────────────────────────────────────────── */

  describe("convert", () => {
    it("converts objects to CSV", async () => {
      const block = makeBlock({
        array_operation: "convert",
        array_input: [
          { name: "Alice", age: 30 },
          { name: "Bob", age: 25 },
        ],
        array_convert_format: "csv",
        array_convert_delimiter: ",",
        array_convert_has_headers: true,
        array_bind_value: "$state.result",
      }, "array");
      const result = await arrayExecutor(block, ctx);
      const csv = result.stateDelta?.result as string;
      expect(csv).toContain("name,age");
      expect(csv).toContain("Alice,30");
    });

    it("converts CSV to JSON", async () => {
      const block = makeBlock({
        array_operation: "convert",
        array_input: [],
        array_convert_format: "json",
        array_convert_input: "name,age\nAlice,30\nBob,25",
        array_convert_delimiter: ",",
        array_convert_has_headers: true,
        array_bind_value: "$state.result",
      }, "array");
      const result = await arrayExecutor(block, ctx);
      const json = result.stateDelta?.result as Array<Record<string, string>>;
      expect(json.length).toBe(2);
      expect(json[0].name).toBe("Alice");
      expect(json[1].age).toBe("25");
    });

    it("returns empty string for empty array CSV", async () => {
      const block = makeBlock({
        array_operation: "convert",
        array_input: [],
        array_convert_format: "csv",
        array_bind_value: "$state.result",
      }, "array");
      const result = await arrayExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("");
    });
  });

  /* ── dynamic input resolution ───────────────────────── */

  describe("dynamic input", () => {
    it("resolves $state in array input", async () => {
      const block = makeBlock({
        array_operation: "length",
        array_input: "$state.nums",
        array_bind_value: "$state.result",
      }, "array");
      const result = await arrayExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(6);
    });
  });
});

/* ================================================================ */
/*  Math executor                                                    */
/* ================================================================ */

describe("mathExecutor", () => {
  let ctx: WorkflowContext;

  beforeEach(() => {
    ctx = makeContext({ state: { x: 10, y: 3 } });
  });

  /* ── Basic operations ───────────────────────────────── */

  describe("basic operations", () => {
    it("adds two numbers", async () => {
      const block = makeBlock({
        math_operation: "add",
        math_input: 10,
        math_operand: 5,
        math_bind_value: "$state.result",
      }, "math");
      const result = await mathExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(15);
    });

    it("subtracts", async () => {
      const block = makeBlock({
        math_operation: "subtract",
        math_input: 10,
        math_operand: 3,
        math_bind_value: "$state.result",
      }, "math");
      const result = await mathExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(7);
    });

    it("multiplies", async () => {
      const block = makeBlock({
        math_operation: "multiply",
        math_input: 6,
        math_operand: 7,
        math_bind_value: "$state.result",
      }, "math");
      const result = await mathExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(42);
    });

    it("divides", async () => {
      const block = makeBlock({
        math_operation: "divide",
        math_input: 20,
        math_operand: 4,
        math_bind_value: "$state.result",
      }, "math");
      const result = await mathExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(5);
    });

    it("throws on division by zero", async () => {
      const block = makeBlock({
        math_operation: "divide",
        math_input: 10,
        math_operand: 0,
        math_bind_value: "$state.result",
      }, "math");
      await expect(mathExecutor(block, ctx)).rejects.toThrow(/Division by zero/);
    });

    it("modulo", async () => {
      const block = makeBlock({
        math_operation: "modulo",
        math_input: 10,
        math_operand: 3,
        math_bind_value: "$state.result",
      }, "math");
      const result = await mathExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(1);
    });

    it("power", async () => {
      const block = makeBlock({
        math_operation: "power",
        math_input: 2,
        math_operand: 10,
        math_bind_value: "$state.result",
      }, "math");
      const result = await mathExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(1024);
    });
  });

  /* ── Advanced operations ────────────────────────────── */

  describe("advanced operations", () => {
    it("rounds to specified decimals", async () => {
      const block = makeBlock({
        math_operation: "round",
        math_input: 3.14159,
        math_decimals: 2,
        math_bind_value: "$state.result",
      }, "math");
      const result = await mathExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(3.14);
    });

    it("rounds to integer by default", async () => {
      const block = makeBlock({
        math_operation: "round",
        math_input: 3.7,
        math_bind_value: "$state.result",
      }, "math");
      const result = await mathExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(4);
    });

    it("square root", async () => {
      const block = makeBlock({
        math_operation: "square_root",
        math_input: 16,
        math_bind_value: "$state.result",
      }, "math");
      const result = await mathExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(4);
    });

    it("throws on sqrt of negative", async () => {
      const block = makeBlock({
        math_operation: "square_root",
        math_input: -4,
        math_bind_value: "$state.result",
      }, "math");
      await expect(mathExecutor(block, ctx)).rejects.toThrow(/negative/);
    });

    it("absolute value", async () => {
      const block = makeBlock({
        math_operation: "absolute",
        math_input: -42,
        math_bind_value: "$state.result",
      }, "math");
      const result = await mathExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(42);
    });

    it("min", async () => {
      const block = makeBlock({
        math_operation: "min",
        math_input: 10,
        math_values: [20, 5, 30],
        math_bind_value: "$state.result",
      }, "math");
      const result = await mathExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(5);
    });

    it("max", async () => {
      const block = makeBlock({
        math_operation: "max",
        math_input: 10,
        math_values: [20, 5, 30],
        math_bind_value: "$state.result",
      }, "math");
      const result = await mathExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(30);
    });

    it("clamp", async () => {
      const block = makeBlock({
        math_operation: "clamp",
        math_input: 150,
        math_clamp_min: 0,
        math_clamp_max: 100,
        math_bind_value: "$state.result",
      }, "math");
      const result = await mathExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(100);
    });

    it("average", async () => {
      const block = makeBlock({
        math_operation: "average",
        math_input: 10,
        math_values: [20, 30],
        math_bind_value: "$state.result",
      }, "math");
      const result = await mathExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(20);
    });

    it("sum", async () => {
      const block = makeBlock({
        math_operation: "sum",
        math_input: 1,
        math_values: [2, 3, 4],
        math_bind_value: "$state.result",
      }, "math");
      const result = await mathExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(10);
    });

    it("random within range", async () => {
      const block = makeBlock({
        math_operation: "random",
        math_input: 0,
        math_random_min: 10,
        math_random_max: 20,
        math_bind_value: "$state.result",
      }, "math");
      const result = await mathExecutor(block, ctx);
      const val = result.stateDelta?.result as number;
      expect(val).toBeGreaterThanOrEqual(10);
      expect(val).toBeLessThan(20);
    });
  });

  /* ── Expression parser ──────────────────────────────── */

  describe("expression", () => {
    it("evaluates simple arithmetic", async () => {
      const block = makeBlock({
        math_operation: "expression",
        math_input: 0,
        math_expression: "2 + 3 * 4",
        math_bind_value: "$state.result",
      }, "math");
      const result = await mathExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(14);
    });

    it("evaluates parentheses", async () => {
      const block = makeBlock({
        math_operation: "expression",
        math_input: 0,
        math_expression: "(2 + 3) * 4",
        math_bind_value: "$state.result",
      }, "math");
      const result = await mathExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(20);
    });

    it("evaluates Math.floor", async () => {
      const block = makeBlock({
        math_operation: "expression",
        math_input: 0,
        math_expression: "Math.floor(3.7)",
        math_bind_value: "$state.result",
      }, "math");
      const result = await mathExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(3);
    });

    it("evaluates Math.sqrt", async () => {
      const block = makeBlock({
        math_operation: "expression",
        math_input: 0,
        math_expression: "Math.sqrt(144)",
        math_bind_value: "$state.result",
      }, "math");
      const result = await mathExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(12);
    });

    it("evaluates Math.pow", async () => {
      const block = makeBlock({
        math_operation: "expression",
        math_input: 0,
        math_expression: "Math.pow(2, 8)",
        math_bind_value: "$state.result",
      }, "math");
      const result = await mathExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(256);
    });

    it("evaluates PI constant", async () => {
      const block = makeBlock({
        math_operation: "expression",
        math_input: 0,
        math_expression: "PI * 2",
        math_bind_value: "$state.result",
      }, "math");
      const result = await mathExecutor(block, ctx);
      expect(result.stateDelta?.result).toBeCloseTo(6.2832, 3);
    });

    it("evaluates modulo in expression", async () => {
      const block = makeBlock({
        math_operation: "expression",
        math_input: 0,
        math_expression: "10 % 3",
        math_bind_value: "$state.result",
      }, "math");
      const result = await mathExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(1);
    });

    it("evaluates unary negative", async () => {
      const block = makeBlock({
        math_operation: "expression",
        math_input: 0,
        math_expression: "-5 + 3",
        math_bind_value: "$state.result",
      }, "math");
      const result = await mathExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(-2);
    });

    it("throws on invalid expression", async () => {
      const block = makeBlock({
        math_operation: "expression",
        math_input: 0,
        math_expression: "2 + + +",
        math_bind_value: "$state.result",
      }, "math");
      await expect(mathExecutor(block, ctx)).rejects.toThrow();
    });
  });

  /* ── Chained operations ─────────────────────────────── */

  describe("chained", () => {
    it("chains add → multiply", async () => {
      const block = makeBlock({
        math_input: 5,
        math_operations: [
          { operation: "add", math_operand: 3 },
          { operation: "multiply", math_operand: 2 },
        ],
        math_bind_value: "$state.result",
      }, "math");
      const result = await mathExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(16); // (5+3)*2
    });

    it("chains with per-op binding", async () => {
      const block = makeBlock({
        math_input: 10,
        math_operations: [
          { operation: "add", math_operand: 5, bind_to: "$state.added" },
          { operation: "multiply", math_operand: 2, bind_to: "$state.multiplied" },
        ],
        math_bind_value: "$state.final",
      }, "math");
      const result = await mathExecutor(block, ctx);
      expect(result.stateDelta?.added).toBe(15);
      expect(result.stateDelta?.multiplied).toBe(30);
      expect(result.stateDelta?.final).toBe(30);
    });
  });

  /* ── dynamic input resolution ───────────────────────── */

  describe("dynamic input", () => {
    it("resolves $state references", async () => {
      const block = makeBlock({
        math_operation: "add",
        math_input: "$state.x",
        math_operand: "$state.y",
        math_bind_value: "$state.result",
      }, "math");
      const result = await mathExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(13);
    });
  });
});

/* ================================================================ */
/*  Date executor                                                    */
/* ================================================================ */

describe("dateExecutor", () => {
  let ctx: WorkflowContext;

  beforeEach(() => {
    ctx = makeContext();
  });

  /* ── adjust ──────────────────────────────────────────── */

  describe("adjust", () => {
    it("adds days", async () => {
      const block = makeBlock({
        date_input: "2024-01-15T12:00:00Z",
        date_operations: [
          { method: "adjust", date_unit: "day", date_amount: 10, date_bind_to: "$state.result" },
        ],
      }, "date");
      const result = await dateExecutor(block, ctx);
      expect(result.stateDelta?.result).toContain("2024-01-25");
    });

    it("subtracts months", async () => {
      const block = makeBlock({
        date_input: "2024-03-15T12:00:00Z",
        date_operations: [
          { method: "adjust", date_unit: "month", date_amount: -2, date_bind_to: "$state.result" },
        ],
      }, "date");
      const result = await dateExecutor(block, ctx);
      expect(result.stateDelta?.result).toContain("2024-01-15");
    });

    it("adds hours", async () => {
      const block = makeBlock({
        date_input: "2024-01-15T10:00:00Z",
        date_operations: [
          { method: "adjust", date_unit: "hour", date_amount: 5, date_bind_to: "$state.result" },
        ],
      }, "date");
      const result = await dateExecutor(block, ctx);
      expect(result.stateDelta?.result).toContain("15:00:00");
    });
  });

  /* ── boundary ────────────────────────────────────────── */

  describe("boundary", () => {
    it("gets start of month", async () => {
      const block = makeBlock({
        date_input: "2024-03-15T14:30:00Z",
        date_operations: [
          {
            method: "boundary",
            date_period: "month",
            date_edge: "start",
            date_bind_to: "$state.result",
          },
          {
            method: "format",
            date_format: "date",
            date_bind_to: "$state.formatted",
          },
        ],
      }, "date");
      const result = await dateExecutor(block, ctx);
      expect(result.stateDelta?.formatted).toBe("2024-03-01");
    });

    it("gets end of year", async () => {
      const block = makeBlock({
        date_input: "2024-06-15T12:00:00Z",
        date_operations: [
          { method: "boundary", date_period: "year", date_edge: "end", date_bind_to: "$state.result" },
          { method: "format", date_format: "date", date_bind_to: "$state.formatted" },
        ],
      }, "date");
      const result = await dateExecutor(block, ctx);
      expect(result.stateDelta?.formatted).toBe("2024-12-31");
    });

    it("gets start of day", async () => {
      const block = makeBlock({
        date_input: "2024-03-15T14:30:45Z",
        date_operations: [
          { method: "boundary", date_period: "day", date_edge: "start", date_bind_to: "$state.result" },
        ],
      }, "date");
      const result = await dateExecutor(block, ctx);
      const d = new Date(result.stateDelta?.result as string);
      expect(d.getUTCHours()).toBe(0);
      expect(d.getUTCMinutes()).toBe(0);
    });
  });

  /* ── set ─────────────────────────────────────────────── */

  describe("set", () => {
    it("sets year", async () => {
      const block = makeBlock({
        date_input: "2024-06-15T12:00:00Z",
        date_operations: [
          { method: "set", date_component: "year", date_value: 2030, date_bind_to: "$state.result" },
        ],
      }, "date");
      const result = await dateExecutor(block, ctx);
      expect(result.stateDelta?.result).toContain("2030");
    });

    it("sets month (1-indexed)", async () => {
      const block = makeBlock({
        date_input: "2024-06-15T12:00:00Z",
        date_operations: [
          { method: "set", date_component: "month", date_value: 1, date_bind_to: "$state.result" },
          { method: "get", date_component: "month", date_bind_to: "$state.month" },
        ],
      }, "date");
      const result = await dateExecutor(block, ctx);
      expect(result.stateDelta?.month).toBe(1);
    });
  });

  /* ── format ──────────────────────────────────────────── */

  describe("format", () => {
    it("formats as ISO", async () => {
      const block = makeBlock({
        date_input: "2024-03-15T12:00:00.000Z",
        date_operations: [
          { method: "format", date_format: "iso", date_bind_to: "$state.result" },
        ],
      }, "date");
      const result = await dateExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("2024-03-15T12:00:00.000Z");
    });

    it("formats as millis", async () => {
      const block = makeBlock({
        date_input: "2024-03-15T12:00:00.000Z",
        date_operations: [
          { method: "format", date_format: "millis", date_bind_to: "$state.result" },
        ],
      }, "date");
      const result = await dateExecutor(block, ctx);
      expect(typeof result.stateDelta?.result).toBe("number");
    });

    it("formats as date only", async () => {
      const block = makeBlock({
        date_input: "2024-03-15T12:00:00.000Z",
        date_operations: [
          { method: "format", date_format: "date", date_bind_to: "$state.result" },
        ],
      }, "date");
      const result = await dateExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("2024-03-15");
    });

    it("formats as object", async () => {
      const block = makeBlock({
        date_input: "2024-03-15T12:30:45.000Z",
        date_operations: [
          { method: "format", date_format: "object", date_bind_to: "$state.result" },
        ],
      }, "date");
      const result = await dateExecutor(block, ctx);
      const obj = result.stateDelta?.result as Record<string, number>;
      expect(obj.year).toBe(2024);
      expect(obj.month).toBe(3);
      expect(obj.day).toBe(15);
    });

    it("formats with custom pattern", async () => {
      const block = makeBlock({
        date_input: "2024-03-15T12:30:00.000Z",
        date_operations: [
          { method: "format", date_format: "custom", date_pattern: "YYYY/MM/DD", date_bind_to: "$state.result" },
        ],
      }, "date");
      const result = await dateExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("2024/03/15");
    });
  });

  /* ── get ─────────────────────────────────────────────── */

  describe("get", () => {
    it("gets year", async () => {
      const block = makeBlock({
        date_input: "2024-06-15T12:00:00Z",
        date_operations: [
          { method: "get", date_component: "year", date_bind_to: "$state.result" },
        ],
      }, "date");
      const result = await dateExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(2024);
    });

    it("gets daysInMonth", async () => {
      const block = makeBlock({
        date_input: "2024-02-15T12:00:00Z",
        date_operations: [
          { method: "get", date_component: "daysInMonth", date_bind_to: "$state.result" },
        ],
      }, "date");
      const result = await dateExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(29); // 2024 is leap year
    });

    it("gets weekday", async () => {
      const block = makeBlock({
        date_input: "2024-03-15T12:00:00Z", // Friday
        date_operations: [
          { method: "get", date_component: "weekday", date_bind_to: "$state.result" },
        ],
      }, "date");
      const result = await dateExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(5); // Friday
    });
  });

  /* ── check ───────────────────────────────────────────── */

  describe("check", () => {
    it("checks valid date", async () => {
      const block = makeBlock({
        date_input: "2024-03-15T12:00:00Z",
        date_operations: [
          { method: "check", date_check: "valid", date_bind_to: "$state.result" },
        ],
      }, "date");
      const result = await dateExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(true);
    });

    it("checks weekend", async () => {
      const block = makeBlock({
        date_input: "2024-03-16T12:00:00Z", // Saturday
        date_operations: [
          { method: "check", date_check: "weekend", date_bind_to: "$state.result" },
        ],
      }, "date");
      const result = await dateExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(true);
    });

    it("checks weekday", async () => {
      const block = makeBlock({
        date_input: "2024-03-15T12:00:00Z", // Friday
        date_operations: [
          { method: "check", date_check: "weekday", date_bind_to: "$state.result" },
        ],
      }, "date");
      const result = await dateExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(true);
    });
  });

  /* ── Chained operations ─────────────────────────────── */

  describe("chained", () => {
    it("chains adjust → format", async () => {
      const block = makeBlock({
        date_input: "2024-01-01T00:00:00.000Z",
        date_operations: [
          { method: "adjust", date_unit: "month", date_amount: 2 },
          { method: "format", date_format: "date", date_bind_to: "$state.result" },
        ],
      }, "date");
      const result = await dateExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("2024-03-01");
    });

    it("chains set → adjust → get", async () => {
      const block = makeBlock({
        date_input: "2024-06-15T12:00:00Z",
        date_operations: [
          { method: "set", date_component: "day", date_value: 1 },
          { method: "adjust", date_unit: "month", date_amount: -1 },
          { method: "get", date_component: "month", date_bind_to: "$state.result" },
        ],
      }, "date");
      const result = await dateExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(5); // June → set day 1 → sub 1 month → May
    });
  });

  /* ── dynamic input resolution ───────────────────────── */

  describe("dynamic input", () => {
    it("resolves $state date input", async () => {
      ctx.state.myDate = "2024-03-15T12:00:00.000Z";
      const block = makeBlock({
        date_input: "$state.myDate",
        date_operations: [
          { method: "format", date_format: "date", date_bind_to: "$state.result" },
        ],
      }, "date");
      const result = await dateExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("2024-03-15");
    });
  });
});

/* ================================================================ */
/*  Normalize executor                                               */
/* ================================================================ */

describe("normalizeExecutor", () => {
  let ctx: WorkflowContext;

  beforeEach(() => {
    ctx = makeContext();
  });

  /* ── country ─────────────────────────────────────────── */

  describe("normalize_country", () => {
    it("normalizes alpha-3 to alpha-2", async () => {
      const block = makeBlock({
        normalize_operation: "normalize_country",
        normalize_input: "USA",
        normalize_bind_value_to: "$state.result",
      }, "normalize");
      const result = await normalizeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("US");
    });

    it("normalizes numeric code", async () => {
      const block = makeBlock({
        normalize_operation: "normalize_country",
        normalize_input: "826",
        normalize_bind_value_to: "$state.result",
      }, "normalize");
      const result = await normalizeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("GB");
    });

    it("normalizes common name", async () => {
      const block = makeBlock({
        normalize_operation: "normalize_country",
        normalize_input: "United States",
        normalize_bind_value_to: "$state.result",
      }, "normalize");
      const result = await normalizeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("US");
    });

    it("passes through valid alpha-2", async () => {
      const block = makeBlock({
        normalize_operation: "normalize_country",
        normalize_input: "DE",
        normalize_bind_value_to: "$state.result",
      }, "normalize");
      const result = await normalizeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("DE");
    });

    it("returns null for unknown", async () => {
      const block = makeBlock({
        normalize_operation: "normalize_country",
        normalize_input: "Narnia",
        normalize_bind_value_to: "$state.result",
      }, "normalize");
      const result = await normalizeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBeNull();
    });

    it("handles case-insensitive input", async () => {
      const block = makeBlock({
        normalize_operation: "normalize_country",
        normalize_input: "japan",
        normalize_bind_value_to: "$state.result",
      }, "normalize");
      const result = await normalizeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("JP");
    });
  });

  /* ── currency ────────────────────────────────────────── */

  describe("normalize_currency", () => {
    it("normalizes symbol to ISO", async () => {
      ctx.state.currencySymbol = "$";
      const block = makeBlock({
        normalize_operation: "normalize_currency",
        normalize_input: "$state.currencySymbol",
        normalize_bind_value_to: "$state.result",
      }, "normalize");
      const result = await normalizeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("USD");
    });

    it("normalizes EUR", async () => {
      const block = makeBlock({
        normalize_operation: "normalize_currency",
        normalize_input: "€",
        normalize_bind_value_to: "$state.result",
      }, "normalize");
      const result = await normalizeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("EUR");
    });

    it("normalizes name", async () => {
      const block = makeBlock({
        normalize_operation: "normalize_currency",
        normalize_input: "Pound",
        normalize_bind_value_to: "$state.result",
      }, "normalize");
      const result = await normalizeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("GBP");
    });

    it("passes through valid ISO code", async () => {
      const block = makeBlock({
        normalize_operation: "normalize_currency",
        normalize_input: "JPY",
        normalize_bind_value_to: "$state.result",
      }, "normalize");
      const result = await normalizeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("JPY");
    });

    it("returns null for unknown currency", async () => {
      const block = makeBlock({
        normalize_operation: "normalize_currency",
        normalize_input: "bitcoin",
        normalize_bind_value_to: "$state.result",
      }, "normalize");
      const result = await normalizeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBeNull();
    });
  });

  /* ── weight ──────────────────────────────────────────── */

  describe("normalize_weight", () => {
    it("converts grams to kilograms", async () => {
      const block = makeBlock({
        normalize_operation: "normalize_weight",
        normalize_input: "1000g",
        normalize_target_unit: "kg",
        normalize_bind_value_to: "$state.result",
      }, "normalize");
      const result = await normalizeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(1);
    });

    it("converts pounds to grams", async () => {
      const block = makeBlock({
        normalize_operation: "normalize_weight",
        normalize_input: "1lb",
        normalize_target_unit: "g",
        normalize_bind_value_to: "$state.result",
      }, "normalize");
      const result = await normalizeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBeCloseTo(453.592, 1);
    });

    it("converts kg to oz", async () => {
      const block = makeBlock({
        normalize_operation: "normalize_weight",
        normalize_input: "1kg",
        normalize_target_unit: "oz",
        normalize_bind_value_to: "$state.result",
      }, "normalize");
      const result = await normalizeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBeCloseTo(35.274, 0);
    });

    it("returns null for unparseable input", async () => {
      const block = makeBlock({
        normalize_operation: "normalize_weight",
        normalize_input: "heavy",
        normalize_target_unit: "kg",
        normalize_bind_value_to: "$state.result",
      }, "normalize");
      const result = await normalizeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBeNull();
    });
  });

  /* ── length ──────────────────────────────────────────── */

  describe("normalize_length", () => {
    it("converts mm to m", async () => {
      const block = makeBlock({
        normalize_operation: "normalize_length",
        normalize_input: "1000mm",
        normalize_target_unit: "m",
        normalize_bind_value_to: "$state.result",
      }, "normalize");
      const result = await normalizeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(1);
    });

    it("converts feet to cm", async () => {
      const block = makeBlock({
        normalize_operation: "normalize_length",
        normalize_input: "1ft",
        normalize_target_unit: "cm",
        normalize_bind_value_to: "$state.result",
      }, "normalize");
      const result = await normalizeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBeCloseTo(30.48, 1);
    });

    it("converts inches to mm", async () => {
      const block = makeBlock({
        normalize_operation: "normalize_length",
        normalize_input: "2in",
        normalize_target_unit: "mm",
        normalize_bind_value_to: "$state.result",
      }, "normalize");
      const result = await normalizeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBeCloseTo(50.8, 1);
    });

    it("returns null for unknown unit", async () => {
      const block = makeBlock({
        normalize_operation: "normalize_length",
        normalize_input: "10parsecs",
        normalize_target_unit: "mm",
        normalize_bind_value_to: "$state.result",
      }, "normalize");
      const result = await normalizeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBeNull();
    });
  });

  /* ── vertices ────────────────────────────────────────── */

  describe("normalize_vertices", () => {
    it("normalizes coordinates to 0-1 range", async () => {
      const block = makeBlock({
        normalize_operation: "normalize_vertices",
        normalize_input: [[0, 0], [100, 0], [100, 200], [0, 200]],
        normalize_bind_value_to: "$state.result",
      }, "normalize");
      const result = await normalizeExecutor(block, ctx);
      const vertices = result.stateDelta?.result as [number, number][];
      expect(vertices[0]).toEqual([0, 0]);
      expect(vertices[1]).toEqual([1, 0]);
      expect(vertices[2]).toEqual([1, 1]);
      expect(vertices[3]).toEqual([0, 1]);
    });

    it("handles single point", async () => {
      const block = makeBlock({
        normalize_operation: "normalize_vertices",
        normalize_input: [[50, 50]],
        normalize_bind_value_to: "$state.result",
      }, "normalize");
      const result = await normalizeExecutor(block, ctx);
      const vertices = result.stateDelta?.result as [number, number][];
      expect(vertices[0]).toEqual([0.5, 0.5]);
    });

    it("returns null for non-array input", async () => {
      const block = makeBlock({
        normalize_operation: "normalize_vertices",
        normalize_input: "not an array",
        normalize_bind_value_to: "$state.result",
      }, "normalize");
      const result = await normalizeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBeNull();
    });

    it("returns empty array for empty input", async () => {
      const block = makeBlock({
        normalize_operation: "normalize_vertices",
        normalize_input: [],
        normalize_bind_value_to: "$state.result",
      }, "normalize");
      const result = await normalizeExecutor(block, ctx);
      expect(result.stateDelta?.result).toEqual([]);
    });
  });

  /* ── uom (delegating) ───────────────────────────────── */

  describe("normalize_uom", () => {
    it("delegates weight normalization", async () => {
      const block = makeBlock({
        normalize_operation: "normalize_uom",
        normalize_input: "500g",
        normalize_category: "weight",
        normalize_target_unit: "kg",
        normalize_bind_value_to: "$state.result",
      }, "normalize");
      const result = await normalizeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(0.5);
    });

    it("delegates length normalization", async () => {
      const block = makeBlock({
        normalize_operation: "normalize_uom",
        normalize_input: "100cm",
        normalize_category: "length",
        normalize_target_unit: "m",
        normalize_bind_value_to: "$state.result",
      }, "normalize");
      const result = await normalizeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe(1);
    });
  });

  /* ── dynamic input resolution ───────────────────────── */

  describe("dynamic input", () => {
    it("resolves $state input", async () => {
      ctx.state.country = "GBR";
      const block = makeBlock({
        normalize_operation: "normalize_country",
        normalize_input: "$state.country",
        normalize_bind_value_to: "$state.result",
      }, "normalize");
      const result = await normalizeExecutor(block, ctx);
      expect(result.stateDelta?.result).toBe("GB");
    });
  });
});
