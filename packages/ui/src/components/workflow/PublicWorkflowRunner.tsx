import { useState, useEffect, useCallback } from "react";
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCw,
} from "lucide-react";
import { cn } from "../../lib/utils.js";

/* ── Types ───────────────────────────────────────────────── */

export interface PublicRunState {
  id: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  stepsJson: unknown;
}

export interface PublicWorkflowRunnerProps {
  /** Trigger a new run. Should return the run ID. */
  onTrigger: () => Promise<string>;
  /** Poll for the latest run status. */
  onPoll: (runId: string) => Promise<PublicRunState>;
  /** Submit a user action (for interactive workflows). */
  onSubmitAction?: (runId: string, payload: Record<string, unknown>) => Promise<void>;
  /** Polling interval in ms (default 2000). */
  pollIntervalMs?: number;
  /** Accent colour for the run button. */
  accentColor?: string;
  /** Additional class names. */
  className?: string;
}

/* ── Status config ───────────────────────────────────────── */

const statusConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-yellow-500", label: "Pending" },
  running: { icon: Loader2, color: "text-blue-500", label: "Running" },
  completed: { icon: CheckCircle2, color: "text-green-500", label: "Completed" },
  failed: { icon: XCircle, color: "text-red-500", label: "Failed" },
  cancelled: { icon: XCircle, color: "text-gray-500", label: "Cancelled" },
  awaiting_action: { icon: Clock, color: "text-orange-500", label: "Awaiting Input" },
};

/**
 * Reusable component for running public workflows.
 *
 * Renders a trigger button, polls for status updates, and displays
 * the current run state. Can be embedded in any page that needs
 * to run public workflows without authentication.
 */
export function PublicWorkflowRunner({
  onTrigger,
  onPoll,
  onSubmitAction,
  pollIntervalMs = 2000,
  accentColor = "hsl(var(--primary))",
  className,
}: PublicWorkflowRunnerProps) {
  const [runId, setRunId] = useState<string | null>(null);
  const [runState, setRunState] = useState<PublicRunState | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Trigger ──────────────────────────────── */

  const handleTrigger = useCallback(async () => {
    setTriggering(true);
    setError(null);
    try {
      const id = await onTrigger();
      setRunId(id);
      setRunState({
        id,
        status: "pending",
        startedAt: null,
        completedAt: null,
        durationMs: null,
        errorMessage: null,
        stepsJson: null,
      });
      setPolling(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start workflow");
    } finally {
      setTriggering(false);
    }
  }, [onTrigger]);

  /* ── Polling ──────────────────────────────── */

  useEffect(() => {
    if (!runId || !polling) return;

    const interval = setInterval(async () => {
      try {
        const state = await onPoll(runId);
        setRunState(state);

        /* Stop polling on terminal states */
        if (
          state.status === "completed" ||
          state.status === "failed" ||
          state.status === "cancelled"
        ) {
          setPolling(false);
        }
      } catch {
        /* Silently ignore polling errors */
      }
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [runId, polling, pollIntervalMs, onPoll]);

  /* ── Reset ────────────────────────────────── */

  const handleReset = useCallback(() => {
    setRunId(null);
    setRunState(null);
    setPolling(false);
    setError(null);
  }, []);

  /* ── Render ───────────────────────────────── */

  const Stat = runState ? statusConfig[runState.status] ?? statusConfig["pending"] : null;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Trigger button */}
      {!runId && (
        <button
          onClick={handleTrigger}
          disabled={triggering}
          className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: accentColor }}
        >
          {triggering ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {triggering ? "Starting…" : "Run Workflow"}
        </button>
      )}

      {/* Status display */}
      {runState && Stat && (
        <div className="flex items-center gap-2">
          <Stat.icon
            className={cn(
              "h-5 w-5",
              Stat.color,
              runState.status === "running" && "animate-spin",
            )}
          />
          <span className="text-sm font-medium text-[hsl(var(--foreground))]">
            {Stat.label}
          </span>
          {runState.durationMs !== null && (
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              ({Math.round(runState.durationMs)}ms)
            </span>
          )}
        </div>
      )}

      {/* Error message */}
      {(runState?.errorMessage || error) && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {runState?.errorMessage ?? error}
        </div>
      )}

      {/* Reset / run again */}
      {runState && (runState.status === "completed" || runState.status === "failed" || runState.status === "cancelled") && (
        <button
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--primary))] hover:underline"
        >
          <RotateCw className="h-3 w-3" />
          Run Again
        </button>
      )}
    </div>
  );
}
