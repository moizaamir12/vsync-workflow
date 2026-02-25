import vm from "node:vm";
import type { Block, WorkflowContext } from "@vsync/shared-types";
import type { BlockResult } from "../types.js";
import { ContextManager } from "../core/ContextManager.js";
import {
  createSandboxContext,
  validateCode,
  sanitizeError,
  diffState,
} from "./code-sandbox.js";
import type { ConsoleEntry } from "./code-sandbox.js";
import { transpileTypeScript } from "./code-typescript.js";

/* ── Constants ───────────────────────────────────────── */

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 30_000;

/* ── Code execution result (internal) ────────────────── */

interface CodeExecutionResult {
  returnValue: unknown;
  stateDelta: Record<string, unknown>;
  consoleOutput: ConsoleEntry[];
}

/**
 * Code block executor.
 *
 * Executes user-provided JavaScript/TypeScript code in a sandboxed
 * Node.js vm context with restricted globals, SSRF-protected fetch,
 * read-only secrets, method-based cache API, and console capture.
 *
 * The sandbox prevents access to process, require, import, eval,
 * Function constructor, and other dangerous APIs through both static
 * analysis AND vm context restriction (defense-in-depth).
 *
 * Binding: code_bind_value → $state.key
 */
export async function codeExecutor(
  block: Block,
  context: WorkflowContext,
): Promise<BlockResult> {
  const cm = new ContextManager();
  const logic = block.logic;

  /* Resolve properties */
  let source = String(resolveDynamic(cm, logic.code_source, context) ?? "");
  const language = String(resolveDynamic(cm, logic.code_language, context) ?? "javascript");
  const rawTimeout = Number(resolveDynamic(cm, logic.code_timeout_ms, context) ?? DEFAULT_TIMEOUT_MS);
  /* vm timeout must be reasonable; clamp to valid range (10ms floor avoids flaky races) */
  const timeoutMs = Math.min(Math.max(10, rawTimeout), MAX_TIMEOUT_MS);

  if (!source.trim()) {
    return {};
  }

  /* Static analysis — reject dangerous patterns */
  const validation = validateCode(source);
  if (!validation.valid) {
    throw new Error(
      `Code validation failed:\n${validation.errors.map((e) => `  • ${e}`).join("\n")}`,
    );
  }

  /* Transpile TypeScript if needed */
  if (language === "typescript") {
    source = await transpileTypeScript(source);
  }

  /* Execute in sandbox */
  const result = await executeSandboxed(source, context, timeoutMs);

  /* Build block result */
  const blockResult: BlockResult = {};

  /* Merge state mutations */
  const allChanges = { ...result.stateDelta };
  const bindTo = logic.code_bind_value as string | undefined;
  if (bindTo && result.returnValue !== undefined) {
    allChanges[extractBindKey(bindTo)] = result.returnValue;
  }

  if (Object.keys(allChanges).length > 0) {
    blockResult.stateDelta = allChanges;
  }

  /* Attach console output as event metadata */
  if (result.consoleOutput.length > 0) {
    blockResult.eventDelta = {
      __consoleOutput: result.consoleOutput,
    };
  }

  return blockResult;
}

/* ── Sandboxed execution ─────────────────────────────── */

async function executeSandboxed(
  source: string,
  wfContext: WorkflowContext,
  timeoutMs: number,
): Promise<CodeExecutionResult> {
  const sandbox = createSandboxContext(wfContext);
  const originalState = structuredClone(sandbox.stateClone);

  /* Wrap code in an async IIFE so `await` works at top level.
     The wrapper returns the last expression value. */
  const wrappedSource = `
    (async () => {
      ${source}
    })()
  `;

  /* Compile the script */
  let script: vm.Script;
  try {
    script = new vm.Script(wrappedSource, {
      filename: "user-code.js",
    });
  } catch (err) {
    const sanitized = sanitizeError(err);
    throw new Error(
      `Syntax error${sanitized.line ? ` at line ${sanitized.line - 2}` : ""}: ${sanitized.message}`,
    );
  }

  /* Execute with combined timeout strategy:
     - vm timeout handles sync CPU-bound loops
     - Promise.race handles async operations */
  try {
    const codePromise = script.runInContext(sandbox.context, {
      timeout: timeoutMs,
      /* Prevent breakout via microtask queues */
      breakOnSigint: true,
    }) as Promise<unknown>;

    /* Race against a wall-clock timeout for async code */
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      setTimeout(
        () => reject(new Error(`Code execution timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
    });

    const returnValue = await Promise.race([codePromise, timeoutPromise]);

    /* Diff state changes */
    const sandboxState = sandbox.getSandboxState();
    const stateDelta = diffState(originalState, sandboxState);

    return {
      returnValue,
      stateDelta,
      consoleOutput: sandbox.getConsoleOutput(),
    };
  } catch (err) {
    /* Check for vm timeout error */
    if (err instanceof Error && err.message.includes("Script execution timed out")) {
      throw new Error(`Code execution timed out after ${timeoutMs}ms`);
    }

    const sanitized = sanitizeError(err);
    throw new Error(
      `Runtime error${sanitized.line ? ` at line ${sanitized.line - 2}` : ""}: ${sanitized.message}`,
    );
  }
}

/* ── Helpers ──────────────────────────────────────────── */

function resolveDynamic(
  cm: ContextManager,
  value: unknown,
  context: WorkflowContext,
): unknown {
  return cm.resolveValue(value, context);
}

function extractBindKey(bindTo: string): string {
  if (bindTo.startsWith("$state.")) return bindTo.slice(7);
  return bindTo;
}
