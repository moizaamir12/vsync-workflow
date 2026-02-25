import vm from "node:vm";
import type { WorkflowContext } from "@vsync/shared-types";
import { isPrivateIp } from "./fetch.js";

/* ── Constants ───────────────────────────────────────── */

/** Max console entries captured per execution */
const MAX_CONSOLE_ENTRIES = 100;

/** Max total bytes for console output */
const MAX_CONSOLE_BYTES = 10_240;

/** Max setTimeout delay inside sandbox (ms) */
const MAX_SETTIMEOUT_DELAY = 5_000;

/** Fetch timeout inside sandbox (ms) */
const SANDBOX_FETCH_TIMEOUT = 10_000;

/* ── Console capture ─────────────────────────────────── */

export interface ConsoleEntry {
  level: "log" | "warn" | "error";
  args: unknown[];
  timestamp: string;
}

function createConsoleCapture(): {
  console: { log: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
  getOutput: () => ConsoleEntry[];
} {
  const output: ConsoleEntry[] = [];
  let totalBytes = 0;

  function capture(level: ConsoleEntry["level"], ...args: unknown[]): void {
    if (output.length >= MAX_CONSOLE_ENTRIES) return;

    const serialized = JSON.stringify(args);
    const byteLen = serialized.length;

    if (totalBytes + byteLen > MAX_CONSOLE_BYTES) return;
    totalBytes += byteLen;

    output.push({
      level,
      args: args.map(safeSerialize),
      timestamp: new Date().toISOString(),
    });
  }

  return {
    console: {
      log: (...args: unknown[]) => capture("log", ...args),
      warn: (...args: unknown[]) => capture("warn", ...args),
      error: (...args: unknown[]) => capture("error", ...args),
    },
    getOutput: () => output,
  };
}

/** Serialize values safely — prevent circular references and huge objects */
function safeSerialize(value: unknown): unknown {
  if (value === undefined) return "undefined";
  if (value === null) return null;
  if (typeof value === "function") return "[Function]";
  if (typeof value === "symbol") return value.toString();
  if (typeof value === "bigint") return value.toString();

  try {
    /* Round-trip through JSON to strip non-serializable values */
    const json = JSON.stringify(value);
    if (json.length > 1024) {
      return JSON.parse(json.slice(0, 1024) + "...(truncated)");
    }
    return JSON.parse(json);
  } catch {
    return String(value);
  }
}

/* ── SSRF-protected fetch wrapper ────────────────────── */

function createSandboxFetch(): typeof globalThis.fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;

    /* SSRF check */
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(`Invalid URL: "${url}"`);
    }

    const hostname = parsed.hostname;
    const cleanHost = hostname.startsWith("[") && hostname.endsWith("]")
      ? hostname.slice(1, -1)
      : hostname;

    if (cleanHost === "localhost" || cleanHost.endsWith(".local")) {
      throw new Error(`SSRF blocked: hostname "${cleanHost}" resolves to a local address`);
    }

    if (isPrivateIp(cleanHost)) {
      throw new Error(`SSRF blocked: "${cleanHost}" is a private/internal IP`);
    }

    /* Add timeout via AbortController */
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SANDBOX_FETCH_TIMEOUT);

    try {
      return await globalThis.fetch(input, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };
}

/* ── Secrets proxy (read-only, non-enumerable) ───────── */

function createSecretsProxy(secrets: Record<string, string>): Record<string, string> {
  return new Proxy(secrets, {
    get(target, prop) {
      if (typeof prop === "string") return target[prop];
      return undefined;
    },
    set() {
      throw new Error("Cannot modify secrets — they are read-only");
    },
    deleteProperty() {
      throw new Error("Cannot delete secrets — they are read-only");
    },
    ownKeys() {
      /* Prevent enumeration */
      return [];
    },
    getOwnPropertyDescriptor() {
      return undefined;
    },
    has() {
      return false;
    },
  });
}

/* ── Cache API (method-based) ────────────────────────── */

function createCacheApi(cache: Map<string, unknown>): {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
  delete: (key: string) => void;
  has: (key: string) => boolean;
} {
  return {
    get: (key: string) => cache.get(key),
    set: (key: string, value: unknown) => { cache.set(key, value); },
    delete: (key: string) => { cache.delete(key); },
    has: (key: string) => cache.has(key),
  };
}

/* ── Sandbox context creation ────────────────────────── */

export interface SandboxResult {
  context: vm.Context;
  stateClone: Record<string, unknown>;
  getConsoleOutput: () => ConsoleEntry[];
  getSandboxState: () => Record<string, unknown>;
}

/**
 * Create a sandboxed vm.Context with restricted globals.
 *
 * Allowed: state (deep clone), cache (method API), artifacts (read-only),
 * secrets (read-only proxy), console (captured), fetch (SSRF-protected),
 * and safe builtins (JSON, Math, Date, etc.)
 *
 * Blocked: process, require, import, eval, Function, fs, child_process,
 * __dirname, __filename, global, globalThis
 */
export function createSandboxContext(wfContext: WorkflowContext): SandboxResult {
  const stateClone = structuredClone(wfContext.state);
  const artifactsClone = Object.freeze(structuredClone(wfContext.artifacts));
  const secretsProxy = createSecretsProxy(wfContext.secrets);
  const cacheApi = createCacheApi(wfContext.cache);
  const { console: sandboxConsole, getOutput } = createConsoleCapture();
  const sandboxFetch = createSandboxFetch();

  /* Sandbox state is held in an object so we can detect reassignment */
  const stateHolder = { current: stateClone };

  /* Capped setTimeout — max 5s delay */
  const cappedSetTimeout = (fn: (...args: unknown[]) => void, delay?: number): ReturnType<typeof setTimeout> => {
    const safeDelay = Math.min(Math.max(0, Number(delay) || 0), MAX_SETTIMEOUT_DELAY);
    return setTimeout(fn, safeDelay);
  };

  const globals: Record<string, unknown> = {
    /* Workflow data */
    state: stateClone,
    cache: cacheApi,
    artifacts: artifactsClone,
    secrets: secretsProxy,

    /* Console */
    console: sandboxConsole,

    /* Network */
    fetch: sandboxFetch,

    /* Safe builtins */
    JSON,
    Math,
    Date,
    Array,
    Object,
    String,
    Number,
    RegExp,
    Map,
    Set,
    Promise,
    setTimeout: cappedSetTimeout,
    clearTimeout,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    undefined,
    NaN,
    Infinity,
    Error,
    TypeError,
    RangeError,
    SyntaxError,
    URIError,
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,
  };

  const context = vm.createContext(globals, {
    name: "vsync-code-sandbox",
    /* Prevent breakout via prototype chain */
    codeGeneration: {
      strings: false,   /* Blocks eval() and new Function() at VM level */
      wasm: false,       /* Blocks WebAssembly compilation */
    },
  });

  return {
    context,
    stateClone,
    getConsoleOutput: getOutput,
    getSandboxState: () => {
      /* Check if state was reassigned inside the sandbox */
      const currentState = vm.runInContext("state", context) as Record<string, unknown>;
      return currentState;
    },
  };
}

/* ── Code validation (static analysis) ───────────────── */

/**
 * Blocked patterns — defense-in-depth.
 * Even if these pass, the vm context doesn't expose the corresponding globals.
 */
const BLOCKED_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /\brequire\s*\(/, message: "require() is not allowed" },
  { pattern: /\bimport\s+/, message: "import statements are not allowed" },
  { pattern: /\bimport\s*\(/, message: "dynamic import() is not allowed" },
  { pattern: /\bprocess\./, message: "process access is not allowed" },
  { pattern: /\bchild_process\b/, message: "child_process access is not allowed" },
  { pattern: /\b__proto__\b/, message: "__proto__ access is not allowed" },
  { pattern: /\bconstructor\s*\[/, message: "constructor bracket access is not allowed" },
  { pattern: /\beval\s*\(/, message: "eval() is not allowed" },
  { pattern: /\bnew\s+Function\s*\(/, message: "new Function() is not allowed" },
  { pattern: /\bglobalThis\b/, message: "globalThis access is not allowed" },
  { pattern: /\bglobal\b(?!\.fetch)/, message: "global access is not allowed" },
  { pattern: /\bBuffer\b/, message: "Buffer access is not allowed" },
  { pattern: /\bfs\./, message: "fs access is not allowed" },
  { pattern: /\bfromCharCode\b/, message: "String.fromCharCode is not allowed (potential bypass)" },
  { pattern: /\batob\s*\(/, message: "atob() is not allowed (potential bypass)" },
  { pattern: /\bbtoa\s*\(/, message: "btoa() is not allowed (potential bypass)" },
];

/**
 * Validate user code against blocked patterns.
 * Returns validation result with list of specific violations.
 */
export function validateCode(source: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const { pattern, message } of BLOCKED_PATTERNS) {
    if (pattern.test(source)) {
      errors.push(message);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/* ── Error sanitization ──────────────────────────────── */

export interface SanitizedError {
  message: string;
  line?: number;
  column?: number;
}

/**
 * Sanitize a VM execution error.
 * Extracts line/column from stack trace, strips internal paths.
 */
export function sanitizeError(error: unknown): SanitizedError {
  if (!(error instanceof Error)) {
    return { message: String(error) };
  }

  const message = error.message;
  let line: number | undefined;
  let column: number | undefined;

  /* Try to extract line/column from stack trace */
  const stack = error.stack ?? "";

  /* vm stack traces use format: "evalmachine.<anonymous>:LINE:COLUMN" */
  const vmMatch = stack.match(/evalmachine\.<anonymous>:(\d+):(\d+)/);
  if (vmMatch) {
    line = Number(vmMatch[1]);
    column = Number(vmMatch[2]);
  }

  /* SyntaxError often includes line info in message */
  if (!line && error instanceof SyntaxError) {
    const syntaxMatch = message.match(/line (\d+)/i);
    if (syntaxMatch) {
      line = Number(syntaxMatch[1]);
    }
  }

  return {
    message: sanitizeMessage(message),
    ...(line !== undefined ? { line } : {}),
    ...(column !== undefined ? { column } : {}),
  };
}

/** Strip internal Node.js paths from error messages */
function sanitizeMessage(msg: string): string {
  return msg
    .replace(/at .+node_modules.+/g, "")
    .replace(/at .+internal\/.+/g, "")
    .replace(/\n\s*\n/g, "\n")
    .trim();
}

/* ── State diffing ───────────────────────────────────── */

/**
 * Deep diff the sandbox state against the original clone.
 * Returns only the changed top-level keys with their new values.
 *
 * If the entire state was reassigned (state = newObj), returns the new object.
 * If individual keys changed (state.count++), returns only changed keys.
 */
export function diffState(
  original: Record<string, unknown>,
  modified: Record<string, unknown>,
): Record<string, unknown> {
  const delta: Record<string, unknown> = {};

  /* Check for new or modified keys */
  for (const key of Object.keys(modified)) {
    if (!deepEqual(original[key], modified[key])) {
      delta[key] = modified[key];
    }
  }

  /* Check for deleted keys — mark as undefined */
  for (const key of Object.keys(original)) {
    if (!(key in modified)) {
      delta[key] = undefined;
    }
  }

  return delta;
}

/** Deep equality check for state diffing */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a === "object") {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((val, i) => deepEqual(val, b[i]));
    }

    if (Array.isArray(a) || Array.isArray(b)) return false;

    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);

    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => deepEqual(aObj[key], bObj[key]));
  }

  return false;
}
