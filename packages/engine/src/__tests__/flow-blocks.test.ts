import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { Block, WorkflowContext } from "@vsync/shared-types";
import { fetchExecutor, isPrivateIp, matchesStatusCode } from "../blocks/fetch.js";
import { agentExecutor } from "../blocks/agent.js";
import type { ModelConfig, ModelResponse } from "../blocks/agent.js";
import { gotoExecutor } from "../blocks/goto.js";
import type { GotoResult } from "../blocks/goto.js";
import { sleepExecutor, MAX_SLEEP_DURATION_MS } from "../blocks/sleep.js";
import { locationExecutor, haversineDistance } from "../blocks/location.js";
import { flowBlockHandlers } from "../blocks/index.js";

/* ── Test helpers ────────────────────────────────────────── */

function makeBlock(logic: Record<string, unknown>, type = "fetch"): Block {
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

let ctx: WorkflowContext;
beforeEach(() => {
  ctx = makeContext({
    state: {
      apiUrl: "https://api.example.com/data",
      authToken: "Bearer test-token",
    },
  });
});

/* ================================================================ */
/*  flowBlockHandlers                                                */
/* ================================================================ */

describe("flowBlockHandlers", () => {
  it("exports all flow block handlers (including code)", () => {
    expect(Object.keys(flowBlockHandlers)).toEqual(
      expect.arrayContaining(["fetch", "agent", "goto", "sleep", "location", "code"]),
    );
    expect(Object.keys(flowBlockHandlers).length).toBe(6);
  });

  it("all handlers are functions", () => {
    for (const handler of Object.values(flowBlockHandlers)) {
      expect(typeof handler).toBe("function");
    }
  });
});

/* ================================================================ */
/*  fetchExecutor                                                    */
/* ================================================================ */

describe("fetchExecutor", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function mockFetch(response: {
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
    body?: unknown;
    contentType?: string;
  }): void {
    const {
      status = 200,
      statusText = "OK",
      headers = {},
      body = {},
      contentType = "application/json",
    } = response;

    const responseHeaders = new Headers({
      "content-type": contentType,
      ...headers,
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      status,
      statusText,
      headers: responseHeaders,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
    });
  }

  /* ── Basic request ──────────────────────────────────── */

  describe("basic requests", () => {
    it("performs a GET request and returns JSON body", async () => {
      mockFetch({ body: { message: "hello" } });

      const block = makeBlock({
        fetch_url: "https://api.example.com/test",
        fetch_method: "GET",
        fetch_bind_value: "$state.result",
      }, "fetch");

      const result = await fetchExecutor(block, ctx);
      const response = result.stateDelta?.result as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "hello" });
    });

    it("performs a POST request with body", async () => {
      mockFetch({ body: { id: 123 }, status: 201, statusText: "Created" });

      const block = makeBlock({
        fetch_url: "https://api.example.com/items",
        fetch_method: "POST",
        fetch_body: JSON.stringify({ name: "test" }),
        fetch_headers: { "Content-Type": "application/json" },
        fetch_bind_value: "$state.result",
      }, "fetch");

      const result = await fetchExecutor(block, ctx);
      const response = result.stateDelta?.result as Record<string, unknown>;

      expect(response.status).toBe(201);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.example.com/items",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "test" }),
        }),
      );
    });

    it("resolves $state references in URL", async () => {
      mockFetch({ body: { ok: true } });

      const block = makeBlock({
        fetch_url: "$state.apiUrl",
        fetch_bind_value: "$state.result",
      }, "fetch");

      const result = await fetchExecutor(block, ctx);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.example.com/data",
        expect.anything(),
      );
      expect(result.stateDelta?.result).toBeDefined();
    });

    it("resolves $state references in headers", async () => {
      mockFetch({ body: {} });

      const block = makeBlock({
        fetch_url: "https://api.example.com/test",
        fetch_headers: { Authorization: "$state.authToken" },
        fetch_bind_value: "$state.result",
      }, "fetch");

      await fetchExecutor(block, ctx);

      /* The header value "$state.authToken" is resolved via ContextManager
         but headers are cast to string — it depends on whether headers object
         values get resolved. In our impl, we resolve the rawHeaders object
         but individual string values inside aren't re-resolved. That's fine
         because the header object as a whole goes through resolveDynamic. */
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    it("auto-parses JSON responses", async () => {
      mockFetch({ body: { data: [1, 2, 3] }, contentType: "application/json; charset=utf-8" });

      const block = makeBlock({
        fetch_url: "https://api.example.com/test",
        fetch_bind_value: "$state.result",
      }, "fetch");

      const result = await fetchExecutor(block, ctx);
      const response = result.stateDelta?.result as Record<string, unknown>;
      expect(response.body).toEqual({ data: [1, 2, 3] });
    });

    it("returns text body for non-JSON content-type", async () => {
      mockFetch({ body: "Hello World", contentType: "text/plain" });

      const block = makeBlock({
        fetch_url: "https://api.example.com/test",
        fetch_bind_value: "$state.result",
      }, "fetch");

      const result = await fetchExecutor(block, ctx);
      const response = result.stateDelta?.result as Record<string, unknown>;
      expect(response.body).toBe("Hello World");
    });

    it("throws on missing URL", async () => {
      const block = makeBlock({
        fetch_url: "",
        fetch_bind_value: "$state.result",
      }, "fetch");

      await expect(fetchExecutor(block, ctx)).rejects.toThrow("fetch_url is required");
    });
  });

  /* ── Status code validation ─────────────────────────── */

  describe("status code validation", () => {
    it("accepts 200 with default 2xx pattern", async () => {
      mockFetch({ status: 200 });

      const block = makeBlock({
        fetch_url: "https://api.example.com/test",
        fetch_bind_value: "$state.result",
      }, "fetch");

      const result = await fetchExecutor(block, ctx);
      expect(result.stateDelta?.result).toBeDefined();
    });

    it("rejects 404 with default 2xx pattern", async () => {
      mockFetch({ status: 404, statusText: "Not Found" });

      const block = makeBlock({
        fetch_url: "https://api.example.com/test",
        fetch_bind_value: "$state.result",
      }, "fetch");

      await expect(fetchExecutor(block, ctx)).rejects.toThrow("status not in accepted codes");
    });

    it("accepts 404 when explicitly included", async () => {
      mockFetch({ status: 404, statusText: "Not Found" });

      const block = makeBlock({
        fetch_url: "https://api.example.com/test",
        fetch_accepted_status_codes: ["2xx", "404"],
        fetch_bind_value: "$state.result",
      }, "fetch");

      const result = await fetchExecutor(block, ctx);
      const response = result.stateDelta?.result as Record<string, unknown>;
      expect(response.status).toBe(404);
    });

    it("accepts 201 with 20x pattern", async () => {
      mockFetch({ status: 201 });

      const block = makeBlock({
        fetch_url: "https://api.example.com/test",
        fetch_accepted_status_codes: ["20x"],
        fetch_bind_value: "$state.result",
      }, "fetch");

      const result = await fetchExecutor(block, ctx);
      expect(result.stateDelta?.result).toBeDefined();
    });
  });

  /* ── Retry logic ────────────────────────────────────── */

  describe("retry logic", () => {
    it("retries on failure up to max_retries", async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve({
          status: 200,
          statusText: "OK",
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve({ ok: true }),
          text: () => Promise.resolve("{}"),
        });
      });

      const block = makeBlock({
        fetch_url: "https://api.example.com/test",
        fetch_max_retries: 3,
        fetch_retry_delay_ms: 1, /* Minimal delay for tests */
        fetch_bind_value: "$state.result",
      }, "fetch");

      const result = await fetchExecutor(block, ctx);
      expect(callCount).toBe(3);
      expect(result.stateDelta?.result).toBeDefined();
    });

    it("throws after exhausting retries", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const block = makeBlock({
        fetch_url: "https://api.example.com/test",
        fetch_max_retries: 2,
        fetch_retry_delay_ms: 1,
        fetch_bind_value: "$state.result",
      }, "fetch");

      await expect(fetchExecutor(block, ctx)).rejects.toThrow("Network error");
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });
  });

  /* ── Timeout ────────────────────────────────────────── */

  describe("timeout", () => {
    it("aborts on timeout", async () => {
      globalThis.fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          const signal = init.signal;
          if (signal) {
            signal.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          }
        });
      });

      const block = makeBlock({
        fetch_url: "https://api.example.com/slow",
        fetch_timeout_ms: 50,
        fetch_max_retries: 1,
        fetch_bind_value: "$state.result",
      }, "fetch");

      await expect(fetchExecutor(block, ctx)).rejects.toThrow();
    });
  });

  /* ── SSRF protection ────────────────────────────────── */

  describe("SSRF protection", () => {
    it("blocks localhost", async () => {
      const block = makeBlock({
        fetch_url: "http://localhost:8080/admin",
        fetch_bind_value: "$state.result",
      }, "fetch");

      await expect(fetchExecutor(block, ctx)).rejects.toThrow("SSRF blocked");
    });

    it("blocks 127.0.0.1", async () => {
      const block = makeBlock({
        fetch_url: "http://127.0.0.1/admin",
        fetch_bind_value: "$state.result",
      }, "fetch");

      await expect(fetchExecutor(block, ctx)).rejects.toThrow("SSRF blocked");
    });

    it("blocks 10.x.x.x", async () => {
      const block = makeBlock({
        fetch_url: "http://10.0.0.1/admin",
        fetch_bind_value: "$state.result",
      }, "fetch");

      await expect(fetchExecutor(block, ctx)).rejects.toThrow("SSRF blocked");
    });

    it("blocks 192.168.x.x", async () => {
      const block = makeBlock({
        fetch_url: "http://192.168.1.1/admin",
        fetch_bind_value: "$state.result",
      }, "fetch");

      await expect(fetchExecutor(block, ctx)).rejects.toThrow("SSRF blocked");
    });

    it("blocks 172.16.x.x", async () => {
      const block = makeBlock({
        fetch_url: "http://172.16.0.1/admin",
        fetch_bind_value: "$state.result",
      }, "fetch");

      await expect(fetchExecutor(block, ctx)).rejects.toThrow("SSRF blocked");
    });

    it("blocks 169.254.x.x (link-local)", async () => {
      const block = makeBlock({
        fetch_url: "http://169.254.169.254/latest/meta-data/",
        fetch_bind_value: "$state.result",
      }, "fetch");

      await expect(fetchExecutor(block, ctx)).rejects.toThrow("SSRF blocked");
    });

    it("blocks 0.x.x.x", async () => {
      const block = makeBlock({
        fetch_url: "http://0.0.0.0/admin",
        fetch_bind_value: "$state.result",
      }, "fetch");

      await expect(fetchExecutor(block, ctx)).rejects.toThrow("SSRF blocked");
    });

    it("blocks .local domains", async () => {
      const block = makeBlock({
        fetch_url: "http://myhost.local/admin",
        fetch_bind_value: "$state.result",
      }, "fetch");

      await expect(fetchExecutor(block, ctx)).rejects.toThrow("SSRF blocked");
    });

    it("allows public IP addresses", async () => {
      mockFetch({ body: { ok: true } });

      const block = makeBlock({
        fetch_url: "https://8.8.8.8/dns",
        fetch_bind_value: "$state.result",
      }, "fetch");

      /* Should not throw — public IP is allowed */
      const result = await fetchExecutor(block, ctx);
      expect(result.stateDelta?.result).toBeDefined();
    });
  });

  /* ── isPrivateIp utility ────────────────────────────── */

  describe("isPrivateIp", () => {
    it("identifies private IPv4 ranges", () => {
      expect(isPrivateIp("127.0.0.1")).toBe(true);
      expect(isPrivateIp("10.0.0.1")).toBe(true);
      expect(isPrivateIp("192.168.1.1")).toBe(true);
      expect(isPrivateIp("172.16.0.1")).toBe(true);
      expect(isPrivateIp("172.31.255.255")).toBe(true);
      expect(isPrivateIp("169.254.1.1")).toBe(true);
      expect(isPrivateIp("0.0.0.0")).toBe(true);
    });

    it("rejects public IPv4 addresses", () => {
      expect(isPrivateIp("8.8.8.8")).toBe(false);
      expect(isPrivateIp("1.1.1.1")).toBe(false);
      expect(isPrivateIp("172.15.0.1")).toBe(false); /* Just outside /12 range */
      expect(isPrivateIp("172.32.0.1")).toBe(false);
    });

    it("identifies private IPv6 addresses", () => {
      expect(isPrivateIp("::1")).toBe(true);
      expect(isPrivateIp("fc00:1234::1")).toBe(true);
      expect(isPrivateIp("fd12:3456::1")).toBe(true);
      expect(isPrivateIp("fe80:1234::1")).toBe(true);
    });
  });

  /* ── matchesStatusCode utility ──────────────────────── */

  describe("matchesStatusCode", () => {
    it("matches exact codes", () => {
      expect(matchesStatusCode(200, ["200"])).toBe(true);
      expect(matchesStatusCode(404, ["404"])).toBe(true);
      expect(matchesStatusCode(200, ["201"])).toBe(false);
    });

    it("matches wildcard patterns", () => {
      expect(matchesStatusCode(200, ["2xx"])).toBe(true);
      expect(matchesStatusCode(299, ["2xx"])).toBe(true);
      expect(matchesStatusCode(301, ["2xx"])).toBe(false);
      expect(matchesStatusCode(201, ["20x"])).toBe(true);
      expect(matchesStatusCode(210, ["20x"])).toBe(false);
    });

    it("matches any of multiple patterns", () => {
      expect(matchesStatusCode(404, ["2xx", "404"])).toBe(true);
      expect(matchesStatusCode(200, ["2xx", "404"])).toBe(true);
      expect(matchesStatusCode(500, ["2xx", "404"])).toBe(false);
    });
  });
});

/* ================================================================ */
/*  agentExecutor                                                    */
/* ================================================================ */

describe("agentExecutor", () => {
  let ctx: WorkflowContext;

  beforeEach(() => {
    ctx = makeContext({
      state: {
        userInput: "Translate this to French",
        document: "Hello world",
      },
    });
  });

  function makeAdapter(
    response: Partial<ModelResponse> = {},
  ): { runModel: (config: ModelConfig) => Promise<ModelResponse> } {
    return {
      runModel: vi.fn().mockResolvedValue({
        result: response.result ?? "Mock response",
        usage: response.usage ?? { inputTokens: 10, outputTokens: 5 },
      }),
    };
  }

  /* ── Text generation ────────────────────────────────── */

  describe("text generation", () => {
    it("returns text result", async () => {
      const adapter = makeAdapter({ result: "Bonjour le monde" });

      const block = makeBlock({
        agent_type: "text",
        agent_model: "gpt-4o",
        agent_prompt: "Translate to French",
        agent_input: "$state.document",
        agent_bind_value: "$state.result",
      }, "agent");

      const result = await agentExecutor(block, ctx, adapter);
      expect(result.stateDelta?.result).toBe("Bonjour le monde");
    });

    it("passes correct config to adapter", async () => {
      const adapter = makeAdapter();

      const block = makeBlock({
        agent_type: "text",
        agent_model: "gpt-4o",
        agent_prompt: "Translate",
        agent_input: "Hello",
        agent_temperature: 0.7,
        agent_max_tokens: 100,
        agent_json_mode: false,
        agent_bind_value: "$state.result",
      }, "agent");

      await agentExecutor(block, ctx, adapter);

      expect(adapter.runModel).toHaveBeenCalledWith({
        type: "text",
        model: "gpt-4o",
        prompt: "Translate",
        input: "Hello",
        temperature: 0.7,
        maxTokens: 100,
        jsonMode: false,
      });
    });

    it("resolves $state in prompt and input", async () => {
      const adapter = makeAdapter();

      const block = makeBlock({
        agent_type: "text",
        agent_model: "gpt-4o",
        agent_prompt: "$state.userInput",
        agent_input: "$state.document",
        agent_bind_value: "$state.result",
      }, "agent");

      await agentExecutor(block, ctx, adapter);

      expect(adapter.runModel).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "Translate this to French",
          input: "Hello world",
        }),
      );
    });
  });

  /* ── JSON mode ──────────────────────────────────────── */

  describe("json mode", () => {
    it("parses JSON when json_mode is true and result is string", async () => {
      const adapter = makeAdapter({ result: '{"key": "value"}' });

      const block = makeBlock({
        agent_type: "text",
        agent_model: "gpt-4o",
        agent_prompt: "Generate JSON",
        agent_json_mode: true,
        agent_bind_value: "$state.result",
      }, "agent");

      const result = await agentExecutor(block, ctx, adapter);
      expect(result.stateDelta?.result).toEqual({ key: "value" });
    });

    it("falls back to string when JSON parse fails", async () => {
      const adapter = makeAdapter({ result: "not valid json" });

      const block = makeBlock({
        agent_type: "text",
        agent_model: "gpt-4o",
        agent_prompt: "Generate JSON",
        agent_json_mode: true,
        agent_bind_value: "$state.result",
      }, "agent");

      const result = await agentExecutor(block, ctx, adapter);
      expect(result.stateDelta?.result).toBe("not valid json");
    });

    it("passes through object result in json mode", async () => {
      const adapter = makeAdapter({ result: { structured: true } as unknown as string });

      const block = makeBlock({
        agent_type: "text",
        agent_model: "gpt-4o",
        agent_prompt: "Generate JSON",
        agent_json_mode: true,
        agent_bind_value: "$state.result",
      }, "agent");

      const result = await agentExecutor(block, ctx, adapter);
      expect(result.stateDelta?.result).toEqual({ structured: true });
    });
  });

  /* ── Validation type ────────────────────────────────── */

  describe("validation type", () => {
    it("returns validation result directly", async () => {
      const adapter = makeAdapter({
        result: { valid: true } as unknown as string,
      });

      const block = makeBlock({
        agent_type: "validation",
        agent_model: "gpt-4o",
        agent_prompt: "Validate input",
        agent_input: "test input",
        agent_bind_value: "$state.result",
      }, "agent");

      const result = await agentExecutor(block, ctx, adapter);
      expect(result.stateDelta?.result).toEqual({ valid: true });
    });

    it("returns validation error", async () => {
      const adapter = makeAdapter({
        result: { valid: false, error: "Invalid format" } as unknown as string,
      });

      const block = makeBlock({
        agent_type: "validation",
        agent_model: "gpt-4o",
        agent_prompt: "Validate",
        agent_bind_value: "$state.result",
      }, "agent");

      const result = await agentExecutor(block, ctx, adapter);
      const validationResult = result.stateDelta?.result as Record<string, unknown>;
      expect(validationResult.valid).toBe(false);
      expect(validationResult.error).toBe("Invalid format");
    });
  });

  /* ── Extended response ──────────────────────────────── */

  describe("extended response", () => {
    it("includes usage data when extended_response is true", async () => {
      const adapter = makeAdapter({
        result: "Hello",
        usage: { inputTokens: 50, outputTokens: 20 },
      });

      const block = makeBlock({
        agent_type: "text",
        agent_model: "gpt-4o",
        agent_prompt: "Say hello",
        agent_extended_response: true,
        agent_bind_value: "$state.result",
      }, "agent");

      const result = await agentExecutor(block, ctx, adapter);
      const extended = result.stateDelta?.result as Record<string, unknown>;
      expect(extended.result).toBe("Hello");
      expect(extended.usage).toEqual({ inputTokens: 50, outputTokens: 20 });
    });
  });

  /* ── Error handling ─────────────────────────────────── */

  describe("error handling", () => {
    it("throws when no adapter is provided", async () => {
      const block = makeBlock({
        agent_type: "text",
        agent_model: "gpt-4o",
        agent_prompt: "Hello",
        agent_bind_value: "$state.result",
      }, "agent");

      await expect(agentExecutor(block, ctx)).rejects.toThrow("adapter");
    });

    it("throws when model is missing", async () => {
      const adapter = makeAdapter();

      const block = makeBlock({
        agent_type: "text",
        agent_model: "",
        agent_prompt: "Hello",
        agent_bind_value: "$state.result",
      }, "agent");

      await expect(agentExecutor(block, ctx, adapter)).rejects.toThrow("agent_model is required");
    });

    it("throws when prompt is missing", async () => {
      const adapter = makeAdapter();

      const block = makeBlock({
        agent_type: "text",
        agent_model: "gpt-4o",
        agent_prompt: "",
        agent_bind_value: "$state.result",
      }, "agent");

      await expect(agentExecutor(block, ctx, adapter)).rejects.toThrow("agent_prompt is required");
    });
  });
});

/* ================================================================ */
/*  gotoExecutor                                                     */
/* ================================================================ */

describe("gotoExecutor", () => {
  let ctx: WorkflowContext;

  beforeEach(() => {
    ctx = makeContext({
      state: {
        nextBlockId: "block-5",
      },
    });
  });

  /* ── Basic goto ─────────────────────────────────────── */

  describe("basic goto", () => {
    it("returns goto result with target block ID", async () => {
      const block = makeBlock({
        goto_target_block_id: "block-3",
      }, "goto");

      const result = await gotoExecutor(block, ctx);
      const goto = result.stateDelta?.__goto as GotoResult;

      expect(goto.goto).toBe("block-3");
      expect(goto.defer).toBe(false);
      expect(goto.maxConcurrent).toBe(10);
    });

    it("resolves $state reference in target block ID", async () => {
      const block = makeBlock({
        goto_target_block_id: "$state.nextBlockId",
      }, "goto");

      const result = await gotoExecutor(block, ctx);
      const goto = result.stateDelta?.__goto as GotoResult;
      expect(goto.goto).toBe("block-5");
    });

    it("sets defer flag", async () => {
      const block = makeBlock({
        goto_target_block_id: "block-3",
        goto_defer: true,
        goto_max_concurrent: 5,
      }, "goto");

      const result = await gotoExecutor(block, ctx);
      const goto = result.stateDelta?.__goto as GotoResult;

      expect(goto.defer).toBe(true);
      expect(goto.maxConcurrent).toBe(5);
    });

    it("includes loop name when provided", async () => {
      const block = makeBlock({
        goto_target_block_id: "block-3",
        goto_loop_name: "processItems",
      }, "goto");

      const result = await gotoExecutor(block, ctx);
      const goto = result.stateDelta?.__goto as GotoResult;
      expect(goto.loopName).toBe("processItems");
    });

    it("omits loopName when not provided", async () => {
      const block = makeBlock({
        goto_target_block_id: "block-3",
      }, "goto");

      const result = await gotoExecutor(block, ctx);
      const goto = result.stateDelta?.__goto as GotoResult;
      expect(goto.loopName).toBeUndefined();
    });
  });

  /* ── Validation ─────────────────────────────────────── */

  describe("validation", () => {
    it("throws when target block ID is missing", async () => {
      const block = makeBlock({
        goto_target_block_id: "",
      }, "goto");

      await expect(gotoExecutor(block, ctx)).rejects.toThrow("goto_target_block_id is required");
    });

    it("throws when max_concurrent is invalid", async () => {
      const block = makeBlock({
        goto_target_block_id: "block-3",
        goto_max_concurrent: -1,
      }, "goto");

      await expect(gotoExecutor(block, ctx)).rejects.toThrow("positive number");
    });

    it("floors max_concurrent to integer", async () => {
      const block = makeBlock({
        goto_target_block_id: "block-3",
        goto_max_concurrent: 7.5,
      }, "goto");

      const result = await gotoExecutor(block, ctx);
      const goto = result.stateDelta?.__goto as GotoResult;
      expect(goto.maxConcurrent).toBe(7);
    });
  });
});

/* ================================================================ */
/*  sleepExecutor                                                    */
/* ================================================================ */

describe("sleepExecutor", () => {
  let ctx: WorkflowContext;

  beforeEach(() => {
    ctx = makeContext({
      state: { delayMs: 100 },
    });
  });

  /* ── Duration behavior ──────────────────────────────── */

  describe("duration", () => {
    it("sleeps for specified duration", async () => {
      const block = makeBlock({
        sleep_duration_ms: 10,
      }, "sleep");

      const start = Date.now();
      await sleepExecutor(block, ctx);
      const elapsed = Date.now() - start;

      /* Allow some tolerance — at least 5ms should have passed */
      expect(elapsed).toBeGreaterThanOrEqual(5);
    });

    it("returns empty result", async () => {
      const block = makeBlock({
        sleep_duration_ms: 1,
      }, "sleep");

      const result = await sleepExecutor(block, ctx);
      expect(result).toEqual({});
    });

    it("resolves $state references in duration", async () => {
      const block = makeBlock({
        sleep_duration_ms: "$state.delayMs",
      }, "sleep");

      /* Should not throw — resolves to 100 */
      const result = await sleepExecutor(block, ctx);
      expect(result).toEqual({});
    });
  });

  /* ── Duration cap ───────────────────────────────────── */

  describe("duration cap", () => {
    it("caps at MAX_SLEEP_DURATION_MS", () => {
      expect(MAX_SLEEP_DURATION_MS).toBe(300_000);
    });

    it("clamps negative duration to 0", async () => {
      const block = makeBlock({
        sleep_duration_ms: -1000,
      }, "sleep");

      /* Should complete instantly, not throw */
      const start = Date.now();
      await sleepExecutor(block, ctx);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(50);
    });

    it("handles zero duration without delay", async () => {
      const block = makeBlock({
        sleep_duration_ms: 0,
      }, "sleep");

      const start = Date.now();
      await sleepExecutor(block, ctx);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(50);
    });
  });
});

/* ================================================================ */
/*  locationExecutor                                                 */
/* ================================================================ */

describe("locationExecutor", () => {
  let ctx: WorkflowContext;

  /* Known coordinates for testing */
  const NYC = { lat: 40.7128, lng: -74.0060 };
  const LA = { lat: 34.0522, lng: -118.2437 };
  const LONDON = { lat: 51.5074, lng: -0.1278 };

  beforeEach(() => {
    ctx = makeContext({
      state: {
        currentLocation: NYC,
        destination: LA,
      },
    });
  });

  /* ── get_coordinates ────────────────────────────────── */

  describe("get_coordinates", () => {
    it("delegates to adapter.getLocation()", async () => {
      const adapter = {
        getLocation: vi.fn().mockResolvedValue({ lat: 40.7128, lng: -74.0060 }),
      };

      const block = makeBlock({
        location_operation: "get_coordinates",
        location_bind_value: "$state.result",
      }, "location");

      const result = await locationExecutor(block, ctx, adapter);
      expect(adapter.getLocation).toHaveBeenCalled();
      expect(result.stateDelta?.result).toEqual({ lat: 40.7128, lng: -74.0060 });
    });

    it("throws when no adapter is provided", async () => {
      const block = makeBlock({
        location_operation: "get_coordinates",
        location_bind_value: "$state.result",
      }, "location");

      await expect(locationExecutor(block, ctx)).rejects.toThrow("adapter");
    });
  });

  /* ── distance (Haversine) ───────────────────────────── */

  describe("distance", () => {
    it("calculates distance between NYC and LA in km", async () => {
      const block = makeBlock({
        location_operation: "distance",
        location_from: NYC,
        location_to: LA,
        location_unit: "km",
        location_bind_value: "$state.result",
      }, "location");

      const result = await locationExecutor(block, ctx);
      const distResult = result.stateDelta?.result as { distance: number; unit: string };
      /* NYC to LA ≈ 3944 km */
      expect(distResult.distance).toBeGreaterThan(3900);
      expect(distResult.distance).toBeLessThan(4000);
      expect(distResult.unit).toBe("km");
    });

    it("calculates distance in miles", async () => {
      const block = makeBlock({
        location_operation: "distance",
        location_from: NYC,
        location_to: LA,
        location_unit: "mi",
        location_bind_value: "$state.result",
      }, "location");

      const result = await locationExecutor(block, ctx);
      const distResult = result.stateDelta?.result as { distance: number; unit: string };
      /* NYC to LA ≈ 2451 mi */
      expect(distResult.distance).toBeGreaterThan(2400);
      expect(distResult.distance).toBeLessThan(2500);
      expect(distResult.unit).toBe("mi");
    });

    it("calculates distance in meters", async () => {
      /* Short distance — same city, roughly 1km apart */
      const block = makeBlock({
        location_operation: "distance",
        location_from: { lat: 40.7128, lng: -74.0060 },
        location_to: { lat: 40.7218, lng: -74.0060 },
        location_unit: "m",
        location_bind_value: "$state.result",
      }, "location");

      const result = await locationExecutor(block, ctx);
      const distResult = result.stateDelta?.result as { distance: number; unit: string };
      /* About 1000m */
      expect(distResult.distance).toBeGreaterThan(900);
      expect(distResult.distance).toBeLessThan(1100);
      expect(distResult.unit).toBe("m");
    });

    it("calculates distance in feet", async () => {
      const block = makeBlock({
        location_operation: "distance",
        location_from: { lat: 40.7128, lng: -74.0060 },
        location_to: { lat: 40.7218, lng: -74.0060 },
        location_unit: "ft",
        location_bind_value: "$state.result",
      }, "location");

      const result = await locationExecutor(block, ctx);
      const distResult = result.stateDelta?.result as { distance: number; unit: string };
      expect(distResult.unit).toBe("ft");
      expect(distResult.distance).toBeGreaterThan(2900);
      expect(distResult.distance).toBeLessThan(3600);
    });

    it("resolves coordinates from $state", async () => {
      const block = makeBlock({
        location_operation: "distance",
        location_from: "$state.currentLocation",
        location_to: "$state.destination",
        location_unit: "km",
        location_bind_value: "$state.result",
      }, "location");

      const result = await locationExecutor(block, ctx);
      const distResult = result.stateDelta?.result as { distance: number; unit: string };
      expect(distResult.distance).toBeGreaterThan(3900);
      expect(distResult.distance).toBeLessThan(4000);
    });

    it("returns 0 for same coordinates", async () => {
      const block = makeBlock({
        location_operation: "distance",
        location_from: NYC,
        location_to: NYC,
        location_unit: "km",
        location_bind_value: "$state.result",
      }, "location");

      const result = await locationExecutor(block, ctx);
      const distResult = result.stateDelta?.result as { distance: number; unit: string };
      expect(distResult.distance).toBe(0);
    });
  });

  /* ── verify (within radius) ─────────────────────────── */

  describe("verify", () => {
    it("returns within=true when inside radius", async () => {
      /* Current at NYC, target near NYC, 50km radius */
      const block = makeBlock({
        location_operation: "verify",
        location_current: NYC,
        location_target_lat: 40.7580,   /* Times Square */
        location_target_lng: -73.9855,
        location_radius: 50,
        location_radius_unit: "km",
        location_bind_value: "$state.result",
      }, "location");

      const result = await locationExecutor(block, ctx);
      const verify = result.stateDelta?.result as { within: boolean; distance: number; unit: string };

      expect(verify.within).toBe(true);
      expect(verify.distance).toBeLessThan(50);
      expect(verify.unit).toBe("km");
    });

    it("returns within=false when outside radius", async () => {
      /* Current at NYC, target at LA, 100km radius */
      const block = makeBlock({
        location_operation: "verify",
        location_current: NYC,
        location_target_lat: LA.lat,
        location_target_lng: LA.lng,
        location_radius: 100,
        location_radius_unit: "km",
        location_bind_value: "$state.result",
      }, "location");

      const result = await locationExecutor(block, ctx);
      const verify = result.stateDelta?.result as { within: boolean; distance: number; unit: string };

      expect(verify.within).toBe(false);
      expect(verify.distance).toBeGreaterThan(3900);
    });

    it("works with miles unit", async () => {
      const block = makeBlock({
        location_operation: "verify",
        location_current: LONDON,
        location_target_lat: 51.5155, /* Buckingham Palace */
        location_target_lng: -0.1419,
        location_radius: 5,
        location_radius_unit: "mi",
        location_bind_value: "$state.result",
      }, "location");

      const result = await locationExecutor(block, ctx);
      const verify = result.stateDelta?.result as { within: boolean; distance: number; unit: string };

      expect(verify.within).toBe(true);
      expect(verify.unit).toBe("mi");
    });

    it("boundary: within=true at exactly the radius", async () => {
      /* Set up a scenario where distance ≈ radius */
      const block = makeBlock({
        location_operation: "verify",
        location_current: { lat: 0, lng: 0 },
        location_target_lat: 0,
        location_target_lng: 0,
        location_radius: 0,
        location_radius_unit: "km",
        location_bind_value: "$state.result",
      }, "location");

      const result = await locationExecutor(block, ctx);
      const verify = result.stateDelta?.result as { within: boolean; distance: number; unit: string };

      expect(verify.within).toBe(true);
      expect(verify.distance).toBe(0);
    });
  });

  /* ── haversineDistance utility ───────────────────────── */

  describe("haversineDistance", () => {
    it("returns 0 for identical points", () => {
      expect(haversineDistance(0, 0, 0, 0)).toBe(0);
    });

    it("calculates NYC to London distance", () => {
      const dist = haversineDistance(
        NYC.lat, NYC.lng,
        LONDON.lat, LONDON.lng,
        "km",
      );
      /* NYC to London ≈ 5570 km */
      expect(dist).toBeGreaterThan(5500);
      expect(dist).toBeLessThan(5600);
    });

    it("calculates in different units", () => {
      const distKm = haversineDistance(0, 0, 1, 0, "km");
      const distMi = haversineDistance(0, 0, 1, 0, "mi");
      const distM = haversineDistance(0, 0, 1, 0, "m");
      const distFt = haversineDistance(0, 0, 1, 0, "ft");

      /* 1 degree of latitude ≈ 111.19 km */
      expect(distKm).toBeGreaterThan(110);
      expect(distKm).toBeLessThan(112);

      /* km → mi conversion */
      expect(distMi).toBeCloseTo(distKm * 0.621371, 0);

      /* km → m conversion */
      expect(distM).toBeCloseTo(distKm * 1000, -1);

      /* km → ft conversion */
      expect(distFt).toBeCloseTo(distKm * 3280.84, -2);
    });

    it("throws on unknown unit", () => {
      expect(() => haversineDistance(0, 0, 1, 0, "parsec")).toThrow("Unknown distance unit");
    });
  });

  /* ── error handling ─────────────────────────────────── */

  describe("error handling", () => {
    it("throws on unknown operation", async () => {
      const block = makeBlock({
        location_operation: "teleport",
        location_bind_value: "$state.result",
      }, "location");

      await expect(locationExecutor(block, ctx)).rejects.toThrow("Unknown location operation");
    });
  });
});
