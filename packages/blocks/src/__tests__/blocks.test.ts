import { describe, it, expect } from "vitest";
import type { Block } from "@vsync/shared-types";
import {
  /* Schemas */
  SCHEMA_MAP,
  FETCH_SCHEMA,
  CODE_SCHEMA,
  AGENT_SCHEMA,
  GOTO_SCHEMA,
  SLEEP_SCHEMA,
  OBJECT_SCHEMA,
  STRING_SCHEMA,
  ARRAY_SCHEMA,
  MATH_SCHEMA,
  DATE_SCHEMA,
  NORMALIZE_SCHEMA,
  LOCATION_SCHEMA,
  UI_CAMERA_SCHEMA,
  UI_FORM_SCHEMA,
  UI_TABLE_SCHEMA,
  UI_DETAILS_SCHEMA,
  IMAGE_SCHEMA,
  FILESYSTEM_SCHEMA,
  FTP_SCHEMA,
  VIDEO_SCHEMA,
  VALIDATION_SCHEMA,
  /* Validation */
  validateBlock,
  /* Defaults */
  getBlockDefaults,
  getSchemaBlockTypes,
  /* Registry */
  BLOCK_REGISTRY,
  getRegistryEntry,
  getBlocksByCategory,
  getBlocksByPlatform,
  getAllBlockTypes,
} from "../index.js";

/* ── Test helper ───────────────────────────────────────── */

function makeBlock(
  type: string,
  logic: Record<string, unknown> = {},
  conditions?: { left: string; operator: string; right: string }[],
): Block {
  return {
    id: "test-block-1",
    workflowId: "wf-1",
    workflowVersion: 1,
    name: "Test Block",
    type: type as Block["type"],
    logic,
    conditions: conditions as Block["conditions"],
    order: 0,
  };
}

/* ══════════════════════════════════════════════════════════
   SCHEMA_MAP
   ══════════════════════════════════════════════════════════ */

describe("SCHEMA_MAP", () => {
  it("contains all 21 block types", () => {
    const expectedTypes = [
      "object", "string", "array", "math", "date", "normalize",
      "fetch", "agent", "goto", "sleep", "location", "code",
      "ui_camera", "ui_form", "ui_table", "ui_details",
      "image", "filesystem", "ftp", "video", "validation",
    ];
    for (const t of expectedTypes) {
      expect(SCHEMA_MAP[t]).toBeDefined();
    }
    expect(Object.keys(SCHEMA_MAP)).toHaveLength(21);
  });

  it("every schema has required, optional, and commonMistakes", () => {
    for (const [type, schema] of Object.entries(SCHEMA_MAP)) {
      expect(Array.isArray(schema.required)).toBe(true);
      expect(typeof schema.optional).toBe("object");
      expect(typeof schema.commonMistakes).toBe("object");
      /* All required fields should be prefixed with block type */
      for (const field of schema.required) {
        expect(field.startsWith(`${type.replace(/_/g, "_")}_`)).toBe(true);
      }
    }
  });

  it("commonMistakes values point to known fields", () => {
    for (const schema of Object.values(SCHEMA_MAP)) {
      const allFields = new Set([
        ...schema.required,
        ...Object.keys(schema.optional),
      ]);
      for (const correctName of Object.values(schema.commonMistakes)) {
        expect(allFields.has(correctName)).toBe(true);
      }
    }
  });
});

/* ══════════════════════════════════════════════════════════
   Individual schema spot-checks
   ══════════════════════════════════════════════════════════ */

describe("individual schemas", () => {
  it("FETCH_SCHEMA requires fetch_url", () => {
    expect(FETCH_SCHEMA.required).toContain("fetch_url");
  });

  it("FETCH_SCHEMA fetch_method has correct enum", () => {
    expect(FETCH_SCHEMA.optional.fetch_method.enum).toEqual(
      ["GET", "POST", "PUT", "DELETE", "PATCH"],
    );
    expect(FETCH_SCHEMA.optional.fetch_method.default).toBe("GET");
  });

  it("CODE_SCHEMA requires code_source", () => {
    expect(CODE_SCHEMA.required).toContain("code_source");
  });

  it("CODE_SCHEMA code_language has correct enum", () => {
    expect(CODE_SCHEMA.optional.code_language.enum).toEqual(
      ["javascript", "typescript"],
    );
    expect(CODE_SCHEMA.optional.code_language.default).toBe("javascript");
  });

  it("AGENT_SCHEMA requires agent_model and agent_prompt", () => {
    expect(AGENT_SCHEMA.required).toContain("agent_model");
    expect(AGENT_SCHEMA.required).toContain("agent_prompt");
  });

  it("GOTO_SCHEMA requires goto_target_block_id", () => {
    expect(GOTO_SCHEMA.required).toContain("goto_target_block_id");
  });

  it("SLEEP_SCHEMA requires sleep_duration_ms", () => {
    expect(SLEEP_SCHEMA.required).toContain("sleep_duration_ms");
  });

  it("OBJECT_SCHEMA requires object_operation", () => {
    expect(OBJECT_SCHEMA.required).toContain("object_operation");
  });

  it("STRING_SCHEMA requires string_input", () => {
    expect(STRING_SCHEMA.required).toContain("string_input");
  });

  it("ARRAY_SCHEMA requires array_operation and array_input", () => {
    expect(ARRAY_SCHEMA.required).toContain("array_operation");
    expect(ARRAY_SCHEMA.required).toContain("array_input");
  });

  it("MATH_SCHEMA requires math_input", () => {
    expect(MATH_SCHEMA.required).toContain("math_input");
  });

  it("DATE_SCHEMA requires date_input and date_operations", () => {
    expect(DATE_SCHEMA.required).toContain("date_input");
    expect(DATE_SCHEMA.required).toContain("date_operations");
  });

  it("NORMALIZE_SCHEMA requires normalize_operation and normalize_input", () => {
    expect(NORMALIZE_SCHEMA.required).toContain("normalize_operation");
    expect(NORMALIZE_SCHEMA.required).toContain("normalize_input");
  });

  it("LOCATION_SCHEMA requires location_operation", () => {
    expect(LOCATION_SCHEMA.required).toContain("location_operation");
  });

  it("UI_CAMERA_SCHEMA requires ui_camera_title", () => {
    expect(UI_CAMERA_SCHEMA.required).toContain("ui_camera_title");
    expect(UI_CAMERA_SCHEMA.optional.ui_camera_mode.enum).toContain("barcode");
  });

  it("UI_FORM_SCHEMA requires ui_form_fields", () => {
    expect(UI_FORM_SCHEMA.required).toContain("ui_form_fields");
  });

  it("UI_TABLE_SCHEMA requires ui_table_data", () => {
    expect(UI_TABLE_SCHEMA.required).toContain("ui_table_data");
  });

  it("UI_DETAILS_SCHEMA requires ui_details_data", () => {
    expect(UI_DETAILS_SCHEMA.required).toContain("ui_details_data");
  });

  it("IMAGE_SCHEMA requires image_operation", () => {
    expect(IMAGE_SCHEMA.required).toContain("image_operation");
  });

  it("FILESYSTEM_SCHEMA requires filesystem_operation", () => {
    expect(FILESYSTEM_SCHEMA.required).toContain("filesystem_operation");
  });

  it("FTP_SCHEMA requires ftp_operation and ftp_host", () => {
    expect(FTP_SCHEMA.required).toContain("ftp_operation");
    expect(FTP_SCHEMA.required).toContain("ftp_host");
  });

  it("VIDEO_SCHEMA requires video_operation", () => {
    expect(VIDEO_SCHEMA.required).toContain("video_operation");
  });

  it("VALIDATION_SCHEMA requires validation_rules", () => {
    expect(VALIDATION_SCHEMA.required).toContain("validation_rules");
  });
});

/* ══════════════════════════════════════════════════════════
   validateBlock
   ══════════════════════════════════════════════════════════ */

describe("validateBlock", () => {
  /* ── Passing validation ──────────────────────────────── */

  describe("valid blocks", () => {
    it("fetch block with all required fields → no errors", () => {
      const block = makeBlock("fetch", {
        fetch_url: "https://api.example.com/data",
        fetch_method: "GET",
      });

      const result = validateBlock(block);
      expect(result.errors).toHaveLength(0);
      expect(result.suggestions).toHaveLength(0);
    });

    it("code block with all required fields → no errors", () => {
      const block = makeBlock("code", {
        code_source: "return 42;",
      });

      const result = validateBlock(block);
      expect(result.errors).toHaveLength(0);
    });

    it("agent block with required fields → no errors", () => {
      const block = makeBlock("agent", {
        agent_model: "gpt-4",
        agent_prompt: "Summarize this text",
      });

      const result = validateBlock(block);
      expect(result.errors).toHaveLength(0);
    });

    it("goto block with required fields → no errors", () => {
      const block = makeBlock("goto", {
        goto_target_block_id: "block-xyz",
      });

      const result = validateBlock(block);
      expect(result.errors).toHaveLength(0);
    });

    it("sleep block with required fields → no errors", () => {
      const block = makeBlock("sleep", {
        sleep_duration_ms: 5000,
      });

      const result = validateBlock(block);
      expect(result.errors).toHaveLength(0);
    });

    it("object block with required fields → no errors", () => {
      const block = makeBlock("object", {
        object_operation: "set",
        object_value: { key: "value" },
      });

      const result = validateBlock(block);
      expect(result.errors).toHaveLength(0);
    });

    it("string block with required fields → no errors", () => {
      const block = makeBlock("string", {
        string_input: "hello world",
        string_operation: "trim",
      });

      const result = validateBlock(block);
      expect(result.errors).toHaveLength(0);
    });

    it("array block with required fields → no errors", () => {
      const block = makeBlock("array", {
        array_operation: "sort",
        array_input: [3, 1, 2],
      });

      const result = validateBlock(block);
      expect(result.errors).toHaveLength(0);
    });

    it("date block with required fields → no errors", () => {
      const block = makeBlock("date", {
        date_input: "2026-01-01",
        date_operations: [{ method: "format", date_format: "iso" }],
      });

      const result = validateBlock(block);
      expect(result.errors).toHaveLength(0);
    });

    it("ui_camera block with required fields → no errors", () => {
      const block = makeBlock("ui_camera", {
        ui_camera_title: "Scan barcode",
        ui_camera_mode: "barcode",
      });

      const result = validateBlock(block);
      expect(result.errors).toHaveLength(0);
    });

    it("ui_form block with required fields → no errors", () => {
      const block = makeBlock("ui_form", {
        ui_form_fields: [{ name: "email", type: "text" }],
      });

      const result = validateBlock(block);
      expect(result.errors).toHaveLength(0);
    });

    it("fetch block with all optional fields → no errors", () => {
      const block = makeBlock("fetch", {
        fetch_url: "https://api.example.com/data",
        fetch_method: "POST",
        fetch_headers: { "Content-Type": "application/json" },
        fetch_body: { name: "test" },
        fetch_timeout_ms: 5000,
        fetch_max_retries: 3,
        fetch_retry_delay_ms: 500,
        fetch_backoff_multiplier: 1.5,
        fetch_accepted_status_codes: ["2xx"],
        fetch_bind_value: "$state.response",
      });

      const result = validateBlock(block);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.suggestions).toHaveLength(0);
    });
  });

  /* ── Missing required fields ─────────────────────────── */

  describe("missing required fields", () => {
    it("fetch block missing fetch_url → error", () => {
      const block = makeBlock("fetch", {
        fetch_method: "GET",
      });

      const result = validateBlock(block);
      expect(result.errors).toContainEqual(
        expect.stringContaining("fetch_url"),
      );
    });

    it("code block missing code_source → error", () => {
      const block = makeBlock("code", {});

      const result = validateBlock(block);
      expect(result.errors).toContainEqual(
        expect.stringContaining("code_source"),
      );
    });

    it("agent block missing both agent_model and agent_prompt → two errors", () => {
      const block = makeBlock("agent", {});

      const result = validateBlock(block);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContainEqual(
        expect.stringContaining("agent_model"),
      );
      expect(result.errors).toContainEqual(
        expect.stringContaining("agent_prompt"),
      );
    });

    it("goto block missing goto_target_block_id → error", () => {
      const block = makeBlock("goto", {});

      const result = validateBlock(block);
      expect(result.errors).toContainEqual(
        expect.stringContaining("goto_target_block_id"),
      );
    });

    it("sleep block missing sleep_duration_ms → error", () => {
      const block = makeBlock("sleep", {});

      const result = validateBlock(block);
      expect(result.errors).toContainEqual(
        expect.stringContaining("sleep_duration_ms"),
      );
    });

    it("empty string counts as missing required field", () => {
      const block = makeBlock("fetch", {
        fetch_url: "",
      });

      const result = validateBlock(block);
      expect(result.errors).toContainEqual(
        expect.stringContaining("fetch_url"),
      );
    });

    it("null counts as missing required field", () => {
      const block = makeBlock("fetch", {
        fetch_url: null,
      });

      const result = validateBlock(block);
      expect(result.errors).toContainEqual(
        expect.stringContaining("fetch_url"),
      );
    });
  });

  /* ── Enum validation ─────────────────────────────────── */

  describe("enum validation", () => {
    it("fetch block with invalid method → error", () => {
      const block = makeBlock("fetch", {
        fetch_url: "https://example.com",
        fetch_method: "INVALID",
      });

      const result = validateBlock(block);
      expect(result.errors).toContainEqual(
        expect.stringContaining("INVALID"),
      );
      expect(result.errors).toContainEqual(
        expect.stringContaining("fetch_method"),
      );
    });

    it("code block with invalid language → error", () => {
      const block = makeBlock("code", {
        code_source: "return 1;",
        code_language: "python",
      });

      const result = validateBlock(block);
      expect(result.errors).toContainEqual(
        expect.stringContaining("python"),
      );
    });

    it("ui_camera block with invalid mode → error", () => {
      const block = makeBlock("ui_camera", {
        ui_camera_title: "Test",
        ui_camera_mode: "video",
      });

      const result = validateBlock(block);
      expect(result.errors).toContainEqual(
        expect.stringContaining("video"),
      );
    });

    it("valid enum value → no error", () => {
      const block = makeBlock("fetch", {
        fetch_url: "https://example.com",
        fetch_method: "POST",
      });

      const result = validateBlock(block);
      expect(result.errors).toHaveLength(0);
    });

    it("null enum value skips validation (uses default)", () => {
      const block = makeBlock("code", {
        code_source: "return 1;",
        code_language: null,
      });

      const result = validateBlock(block);
      expect(result.errors).toHaveLength(0);
    });
  });

  /* ── Common mistakes → suggestions ───────────────────── */

  describe("common mistakes", () => {
    it("'url' instead of 'fetch_url' → suggestion", () => {
      const block = makeBlock("fetch", {
        url: "https://example.com",
      });

      const result = validateBlock(block);
      expect(result.suggestions).toContainEqual(
        expect.stringContaining('Did you mean "fetch_url" instead of "url"'),
      );
    });

    it("'source' instead of 'code_source' → suggestion", () => {
      const block = makeBlock("code", {
        source: "return 1;",
      });

      const result = validateBlock(block);
      expect(result.suggestions).toContainEqual(
        expect.stringContaining('Did you mean "code_source" instead of "source"'),
      );
    });

    it("'model' instead of 'agent_model' → suggestion", () => {
      const block = makeBlock("agent", {
        model: "gpt-4",
        prompt: "Hello",
      });

      const result = validateBlock(block);
      expect(result.suggestions).toContainEqual(
        expect.stringContaining('Did you mean "agent_model" instead of "model"'),
      );
    });

    it("no suggestion when both wrong and correct are present", () => {
      const block = makeBlock("fetch", {
        url: "https://old.com",
        fetch_url: "https://correct.com",
      });

      const result = validateBlock(block);
      /* The suggestion should NOT fire because the correct field is present */
      const urlSuggestion = result.suggestions.find(
        (s) => s.includes('"fetch_url"') && s.includes('"url"'),
      );
      expect(urlSuggestion).toBeUndefined();
    });

    it("'duration' instead of 'sleep_duration_ms' → suggestion", () => {
      const block = makeBlock("sleep", {
        duration: 5000,
      });

      const result = validateBlock(block);
      expect(result.suggestions).toContainEqual(
        expect.stringContaining('Did you mean "sleep_duration_ms" instead of "duration"'),
      );
    });
  });

  /* ── Unknown fields → warnings ───────────────────────── */

  describe("unknown fields", () => {
    it("unrecognized field on fetch block → warning", () => {
      const block = makeBlock("fetch", {
        fetch_url: "https://example.com",
        fetch_unknown_option: true,
      });

      const result = validateBlock(block);
      expect(result.warnings).toContainEqual(
        expect.stringContaining("fetch_unknown_option"),
      );
    });

    it("no warning for known optional fields", () => {
      const block = makeBlock("fetch", {
        fetch_url: "https://example.com",
        fetch_method: "POST",
        fetch_body: { data: 1 },
      });

      const result = validateBlock(block);
      expect(result.warnings).toHaveLength(0);
    });

    it("common mistake keys do not trigger unknown field warnings", () => {
      const block = makeBlock("fetch", {
        url: "https://example.com",
      });

      const result = validateBlock(block);
      /* 'url' is in commonMistakes, so no unknown-field warning */
      const unknownWarning = result.warnings.find(
        (w) => w.includes("url"),
      );
      expect(unknownWarning).toBeUndefined();
    });
  });

  /* ── Conditions validation ───────────────────────────── */

  describe("conditions validation", () => {
    it("valid conditions → no errors", () => {
      const block = makeBlock(
        "fetch",
        { fetch_url: "https://example.com" },
        [{ left: "$state.active", operator: "==", right: "true" }],
      );

      const result = validateBlock(block);
      expect(result.errors).toHaveLength(0);
    });

    it("invalid operator → error", () => {
      const block = makeBlock(
        "fetch",
        { fetch_url: "https://example.com" },
        [{ left: "$state.x", operator: "LIKE", right: "foo" }],
      );

      const result = validateBlock(block);
      expect(result.errors).toContainEqual(
        expect.stringContaining("LIKE"),
      );
    });

    it("all valid operators are accepted", () => {
      const operators = [
        "==", "!=", "<", ">", "<=", ">=",
        "contains", "startsWith", "endsWith",
        "in", "isEmpty", "isFalsy", "isNull", "regex",
      ];

      for (const op of operators) {
        const block = makeBlock(
          "fetch",
          { fetch_url: "https://example.com" },
          [{ left: "$state.x", operator: op, right: "val" }],
        );
        const result = validateBlock(block);
        const opError = result.errors.find((e) => e.includes("operator"));
        expect(opError).toBeUndefined();
      }
    });
  });

  /* ── Unknown block type ──────────────────────────────── */

  describe("unknown block type", () => {
    it("returns error for unknown type", () => {
      const block = makeBlock("nonexistent", {});

      const result = validateBlock(block);
      expect(result.errors).toContainEqual(
        expect.stringContaining("nonexistent"),
      );
    });
  });
});

/* ══════════════════════════════════════════════════════════
   getBlockDefaults
   ══════════════════════════════════════════════════════════ */

describe("getBlockDefaults", () => {
  it("returns defaults for all 21 block types without throwing", () => {
    const types = getSchemaBlockTypes();
    expect(types).toHaveLength(21);

    for (const t of types) {
      const defaults = getBlockDefaults(t as Block["type"]);
      expect(typeof defaults).toBe("object");
      expect(defaults).not.toBeNull();
    }
  });

  it("fetch defaults include all required and optional fields", () => {
    const defaults = getBlockDefaults("fetch");

    /* Required fields get empty string placeholder */
    expect(defaults.fetch_url).toBe("");

    /* Optional fields get their defaults */
    expect(defaults.fetch_method).toBe("GET");
    expect(defaults.fetch_timeout_ms).toBe(30000);
    expect(defaults.fetch_max_retries).toBe(1);
    expect(defaults.fetch_bind_value).toBeNull();
  });

  it("code defaults include code_language javascript", () => {
    const defaults = getBlockDefaults("code");

    expect(defaults.code_source).toBe("");
    expect(defaults.code_language).toBe("javascript");
    expect(defaults.code_timeout_ms).toBe(10000);
  });

  it("agent defaults include empty placeholders for required fields", () => {
    const defaults = getBlockDefaults("agent");

    expect(defaults.agent_model).toBe("");
    expect(defaults.agent_prompt).toBe("");
    expect(defaults.agent_type).toBe("text");
    expect(defaults.agent_json_mode).toBe(false);
  });

  it("sleep defaults include empty duration placeholder", () => {
    const defaults = getBlockDefaults("sleep");
    expect(defaults.sleep_duration_ms).toBe("");
  });

  it("ui_camera defaults include correct mode and flash", () => {
    const defaults = getBlockDefaults("ui_camera");

    expect(defaults.ui_camera_title).toBe("");
    expect(defaults.ui_camera_mode).toBe("photo");
    expect(defaults.ui_camera_flash).toBe("auto");
  });

  it("object defaults returned as deep clones", () => {
    const defaults1 = getBlockDefaults("fetch");
    const defaults2 = getBlockDefaults("fetch");

    /* Modifying one should not affect the other */
    (defaults1.fetch_headers as Record<string, unknown>).test = "value";
    expect(defaults2.fetch_headers).toEqual({});
  });

  it("throws for unknown block type", () => {
    expect(() =>
      getBlockDefaults("unknown_type" as Block["type"]),
    ).toThrow("No schema found");
  });

  it("getSchemaBlockTypes returns correct list", () => {
    const types = getSchemaBlockTypes();
    expect(types).toContain("fetch");
    expect(types).toContain("code");
    expect(types).toContain("agent");
    expect(types).toContain("ui_camera");
    expect(types).toContain("video");
  });
});

/* ══════════════════════════════════════════════════════════
   BLOCK_REGISTRY
   ══════════════════════════════════════════════════════════ */

describe("BLOCK_REGISTRY", () => {
  it("has entries for all 21 block types", () => {
    expect(BLOCK_REGISTRY.size).toBe(21);
  });

  it("every entry has required metadata fields", () => {
    for (const entry of BLOCK_REGISTRY.values()) {
      expect(entry.type).toBeTruthy();
      expect(entry.name).toBeTruthy();
      expect(entry.description).toBeTruthy();
      expect(entry.icon).toBeTruthy();
      expect(entry.category).toBeTruthy();
      expect(entry.platforms.length).toBeGreaterThan(0);
      expect(entry.schema).toBeDefined();
    }
  });

  it("getRegistryEntry returns correct entry for fetch", () => {
    const entry = getRegistryEntry("fetch");
    expect(entry).toBeDefined();
    expect(entry?.name).toBe("HTTP Fetch");
    expect(entry?.category).toBe("integration");
    expect(entry?.schema).toBe(FETCH_SCHEMA);
  });

  it("getRegistryEntry returns undefined for unknown type", () => {
    expect(getRegistryEntry("nonexistent")).toBeUndefined();
  });

  it("getBlocksByCategory returns data blocks", () => {
    const dataBlocks = getBlocksByCategory("data");
    const dataTypes = dataBlocks.map((b) => b.type);
    expect(dataTypes).toContain("object");
    expect(dataTypes).toContain("string");
    expect(dataTypes).toContain("array");
    expect(dataTypes).toContain("math");
    expect(dataTypes).toContain("date");
    expect(dataTypes).toContain("normalize");
    expect(dataBlocks).toHaveLength(6);
  });

  it("getBlocksByCategory returns UI blocks", () => {
    const uiBlocks = getBlocksByCategory("ui");
    const uiTypes = uiBlocks.map((b) => b.type);
    expect(uiTypes).toContain("ui_camera");
    expect(uiTypes).toContain("ui_form");
    expect(uiTypes).toContain("ui_table");
    expect(uiTypes).toContain("ui_details");
    expect(uiBlocks).toHaveLength(4);
  });

  it("getBlocksByPlatform('mobile') includes mobile-only blocks", () => {
    const mobileBlocks = getBlocksByPlatform("mobile");
    const types = mobileBlocks.map((b) => b.type);
    expect(types).toContain("ui_camera");
  });

  it("getBlocksByPlatform('mobile') excludes server-only blocks", () => {
    const mobileBlocks = getBlocksByPlatform("mobile");
    const types = mobileBlocks.map((b) => b.type);
    expect(types).not.toContain("ftp");
    expect(types).not.toContain("filesystem");
  });

  it("getBlocksByPlatform('server') includes server-only blocks", () => {
    const serverBlocks = getBlocksByPlatform("server");
    const types = serverBlocks.map((b) => b.type);
    expect(types).toContain("ftp");
    expect(types).toContain("filesystem");
  });

  it("getAllBlockTypes returns all entries", () => {
    const all = getAllBlockTypes();
    expect(all).toHaveLength(21);
  });

  it("registry schema matches SCHEMA_MAP", () => {
    for (const entry of BLOCK_REGISTRY.values()) {
      expect(entry.schema).toBe(SCHEMA_MAP[entry.type]);
    }
  });
});

/* ══════════════════════════════════════════════════════════
   Integration: validation + defaults round-trip
   ══════════════════════════════════════════════════════════ */

describe("integration: defaults → validate round-trip", () => {
  it("defaults for every type pass validation (only expected required errors)", () => {
    const types = getSchemaBlockTypes();

    for (const t of types) {
      const defaults = getBlockDefaults(t as Block["type"]);
      const block = makeBlock(t, defaults);
      const result = validateBlock(block);

      /* Required fields in defaults are "" (placeholder), so they will produce
         'Missing required field' errors. We assert there are NO enum errors,
         NO unknown field warnings, and NO suggestions. */
      expect(result.warnings).toHaveLength(0);
      expect(result.suggestions).toHaveLength(0);

      /* Only required-field errors should exist */
      for (const err of result.errors) {
        expect(err).toContain("Missing required field");
      }
    }
  });

  it("filling in required fields on defaults produces zero errors", () => {
    const defaults = getBlockDefaults("fetch");
    defaults.fetch_url = "https://example.com";

    const block = makeBlock("fetch", defaults);
    const result = validateBlock(block);

    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.suggestions).toHaveLength(0);
  });

  it("filling in required fields for code block produces zero errors", () => {
    const defaults = getBlockDefaults("code");
    defaults.code_source = "return 42;";

    const block = makeBlock("code", defaults);
    const result = validateBlock(block);

    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.suggestions).toHaveLength(0);
  });
});
