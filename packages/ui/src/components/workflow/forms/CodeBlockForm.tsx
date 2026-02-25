import { useCallback, useState } from "react";
import { Play, Loader2 } from "lucide-react";
import { cn } from "../../../lib/utils.js";
import { FormField, FormSection } from "./FormField.js";
import type { DisclosureLevel, WorkflowBlock } from "../../../stores/workflowStore.js";

/* ── Props ────────────────────────────────────────────────────── */

export interface CodeBlockFormProps {
  block: WorkflowBlock;
  onChange: (logic: Record<string, unknown>) => void;
  level: DisclosureLevel;
  /** Optional callback to run a test execution */
  onTestRun?: (code: string, language: string) => Promise<string>;
}

/* ── Component ────────────────────────────────────────────────── */

export function CodeBlockForm({ block, onChange, level, onTestRun }: CodeBlockFormProps) {
  const logic = block.logic;
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const update = useCallback(
    (key: string, value: unknown) => onChange({ [key]: value }),
    [onChange],
  );

  const language = (logic["code_language"] as string) ?? "javascript";
  const code = (logic["code_source"] as string) ?? "";

  const handleTestRun = useCallback(async () => {
    if (!onTestRun || isRunning) return;
    setIsRunning(true);
    setTestOutput(null);
    try {
      const result = await onTestRun(code, language);
      setTestOutput(result);
    } catch (err) {
      setTestOutput(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRunning(false);
    }
  }, [onTestRun, code, language, isRunning]);

  const inputCn = cn(
    "w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]",
    "px-3 py-1.5 text-sm font-mono text-[hsl(var(--foreground))]",
    "placeholder:text-[hsl(var(--muted-foreground))]",
    "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]",
  );

  return (
    <div className="space-y-4">
      <FormSection title="Code">
        <FormField label="Language" level={level}>
          <select
            value={language}
            onChange={(e) => update("code_language", e.target.value)}
            className={inputCn}
          >
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
          </select>
        </FormField>

        <FormField label="Source Code" level={level}>
          <textarea
            value={code}
            onChange={(e) => update("code_source", e.target.value)}
            placeholder={`// Your ${language} code here\nreturn { result: 42 };`}
            rows={12}
            className={cn(inputCn, "resize-y leading-relaxed")}
            spellCheck={false}
          />
        </FormField>
      </FormSection>

      <FormSection title="Settings">
        <FormField
          label="Timeout (ms)"
          hint="Maximum execution time before the block is terminated"
          showAt={["standard", "advanced"]}
          level={level}
        >
          <input
            type="range"
            min={100}
            max={30000}
            step={100}
            value={(logic["code_timeout"] as number) ?? 5000}
            onChange={(e) => update("code_timeout", Number(e.target.value))}
            className="w-full"
          />
          <span className="text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
            {((logic["code_timeout"] as number) ?? 5000).toLocaleString()} ms
          </span>
        </FormField>

        <FormField
          label="Allow Network"
          hint="Enable fetch/HTTP from within the sandbox"
          showAt={["advanced"]}
          level={level}
        >
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(logic["code_allow_network"] as boolean) ?? false}
              onChange={(e) => update("code_allow_network", e.target.checked)}
              className="rounded border-[hsl(var(--border))]"
            />
            <span className="text-sm text-[hsl(var(--foreground))]">Enable network access</span>
          </label>
        </FormField>

        <FormField
          label="Max Memory (MB)"
          showAt={["advanced"]}
          level={level}
        >
          <input
            type="number"
            value={(logic["code_max_memory"] as number) ?? 128}
            onChange={(e) => update("code_max_memory", Number(e.target.value))}
            min={16}
            max={1024}
            className={inputCn}
          />
        </FormField>

        <FormField label="Output Variable" level={level}>
          <input
            type="text"
            value={(logic["code_output"] as string) ?? ""}
            onChange={(e) => update("code_output", e.target.value)}
            placeholder="result"
            className={inputCn}
          />
        </FormField>
      </FormSection>

      {/* Test run section */}
      {onTestRun && (
        <FormSection title="Test Run">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestRun}
              disabled={isRunning || !code.trim()}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
                "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
                "hover:bg-[hsl(var(--primary))]/90 transition-colors",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {isRunning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              {isRunning ? "Running…" : "Run Test"}
            </button>
          </div>

          {testOutput !== null && (
            <div
              className={cn(
                "max-h-48 overflow-auto rounded-md border p-3",
                "bg-[hsl(var(--muted))] font-mono text-xs leading-relaxed",
                "text-[hsl(var(--foreground))]",
                testOutput.startsWith("Error:")
                  ? "border-[hsl(var(--destructive))]/30"
                  : "border-[hsl(var(--border))]",
              )}
            >
              <pre className="whitespace-pre-wrap">{testOutput}</pre>
            </div>
          )}
        </FormSection>
      )}
    </div>
  );
}
