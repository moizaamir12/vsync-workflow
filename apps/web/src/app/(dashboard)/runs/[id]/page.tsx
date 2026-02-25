"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Ban,
  Hand,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useRun, useCancelRun } from "@/lib/queries/runs";
import { api } from "@/lib/api";
import type { Step } from "@vsync/shared-types";

/* ── Status config ───────────────────────────────────────────── */

const statusConfig: Record<
  string,
  { icon: React.ElementType; color: string; ringColor: string; label: string }
> = {
  completed: { icon: CheckCircle, color: "text-green-500", ringColor: "ring-green-200 bg-green-50", label: "Completed" },
  failed: { icon: XCircle, color: "text-red-500", ringColor: "ring-red-200 bg-red-50", label: "Failed" },
  running: { icon: Loader2, color: "text-blue-500", ringColor: "ring-blue-200 bg-blue-50", label: "Running" },
  pending: { icon: Clock, color: "text-gray-400", ringColor: "ring-gray-200 bg-gray-50", label: "Pending" },
  cancelled: { icon: Ban, color: "text-yellow-500", ringColor: "ring-yellow-200 bg-yellow-50", label: "Cancelled" },
  awaiting_action: { icon: Hand, color: "text-orange-500", ringColor: "ring-orange-200 bg-orange-50", label: "Awaiting" },
  skipped: { icon: ChevronRight, color: "text-gray-300", ringColor: "ring-gray-200 bg-gray-50", label: "Skipped" },
};

/* ── WebSocket reconnection hook ─────────────────────────────── */

function useRunLive(runId: string, isLive: boolean) {
  const [wsConnected, setWsConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);

  useEffect(() => {
    if (!isLive) return;

    let cancelled = false;

    function connect() {
      const url = api.runs.liveUrl(runId).replace(/^http/, "ws");
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        setWsConnected(true);
        setReconnecting(false);
        retriesRef.current = 0;
      };

      ws.onclose = () => {
        if (cancelled) return;
        setWsConnected(false);

        /* Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s */
        const delay = Math.min(1000 * Math.pow(2, retriesRef.current), 30000);
        retriesRef.current += 1;
        setReconnecting(true);
        setTimeout(() => {
          if (!cancelled) connect();
        }, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  }, [runId, isLive]);

  return { wsConnected, reconnecting };
}

/* ── Step detail panel ───────────────────────────────────────── */

function stepDuration(step: Step): string {
  if (!step.startedAt || !step.endedAt) return "—";
  const ms = new Date(step.endedAt).getTime() - new Date(step.startedAt).getTime();
  return `${ms}ms`;
}

function StepDetail({ step }: { step: Step }) {
  return (
    <div className="space-y-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs font-medium uppercase text-[hsl(var(--muted-foreground))]">
            Block
          </p>
          <p className="mt-0.5 text-[hsl(var(--foreground))]">
            {step.blockName} ({step.blockType})
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-[hsl(var(--muted-foreground))]">
            Duration
          </p>
          <p className="mt-0.5 text-[hsl(var(--foreground))]">
            {stepDuration(step)}
          </p>
        </div>
      </div>

      {/* State delta */}
      {step.stateDelta && Object.keys(step.stateDelta).length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase text-[hsl(var(--muted-foreground))]">
            State Changes
          </p>
          <pre className="max-h-48 overflow-auto rounded-md bg-[hsl(var(--muted))] p-3 text-xs text-[hsl(var(--foreground))]">
            {JSON.stringify(step.stateDelta, null, 2)}
          </pre>
        </div>
      )}

      {/* Error details */}
      {step.error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-red-700">
            <AlertTriangle className="h-4 w-4" />
            {step.error.message}
          </div>
          {step.error.stack && (
            <pre className="mt-1 whitespace-pre-wrap text-xs text-red-600">
              {step.error.stack}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Run detail page ─────────────────────────────────────────── */

export default function RunDetailPage() {
  const params = useParams<{ id: string }>();
  const runId = params.id;
  const { data: runRes, isLoading } = useRun(runId);
  const cancelMutation = useCancelRun();
  const run = runRes?.data;

  const isLive = run?.status === "running" || run?.status === "pending";
  const { wsConnected, reconnecting } = useRunLive(runId, isLive);

  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const steps: Step[] = (run as { steps?: Step[] } | undefined)?.steps ?? [];

  const runCfg = statusConfig[run?.status ?? "pending"] ?? statusConfig.pending;
  const RunStatusIcon = runCfg.icon;

  const handleCancel = useCallback(async () => {
    try {
      await cancelMutation.mutateAsync(runId);
      toast.success("Run cancelled");
    } catch {
      toast.error("Failed to cancel run");
    }
  }, [cancelMutation, runId]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-pulse rounded bg-[hsl(var(--muted))]" />
          <div className="h-6 w-48 animate-pulse rounded bg-[hsl(var(--muted))]" />
        </div>
        <div className="mt-8 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Reconnecting banner */}
      {reconnecting && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
          <WifiOff className="h-4 w-4" />
          Reconnecting to live updates…
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/runs"
            className="rounded p-1.5 hover:bg-[hsl(var(--muted))]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[hsl(var(--foreground))]">
                Run {runId.slice(0, 8)}…
              </h1>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${runCfg.ringColor} ${runCfg.color}`}
              >
                <RunStatusIcon
                  className={`h-3 w-3 ${run?.status === "running" ? "animate-spin" : ""}`}
                />
                {runCfg.label}
              </span>
              {isLive && wsConnected && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <Wifi className="h-3 w-3" /> Live
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">
              Workflow: {run?.workflowId ?? "—"} • Version: v{run?.version ?? "—"}
              {run?.durationMs != null && ` • ${run.durationMs}ms`}
            </p>
          </div>
        </div>

        {isLive && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--destructive))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10 disabled:opacity-50"
          >
            {cancelMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Ban className="h-3.5 w-3.5" />
            )}
            Cancel Run
          </button>
        )}
      </div>

      {/* Error message */}
      {run?.errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-red-700">
            <AlertTriangle className="h-4 w-4" />
            Run Error
          </div>
          <p className="mt-1 text-sm text-red-600">{run.errorMessage}</p>
        </div>
      )}

      {/* Step timeline */}
      <div className="space-y-0">
        <h2 className="mb-4 text-sm font-semibold text-[hsl(var(--foreground))]">
          Steps ({steps.length})
        </h2>

        {steps.length === 0 && (
          <div className="rounded-lg border border-dashed border-[hsl(var(--border))] py-10 text-center">
            <Clock className="mx-auto h-6 w-6 text-[hsl(var(--muted-foreground))]" />
            <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
              {isLive ? "Waiting for steps…" : "No steps recorded."}
            </p>
          </div>
        )}

        {steps.map((step, i) => {
          const cfg =
            statusConfig[step.status] ?? statusConfig.pending;
          const StepIcon = cfg.icon;
          const isExpanded = expandedStep === step.stepId;
          const isLast = i === steps.length - 1;

          return (
            <div key={step.stepId} className="relative flex gap-4">
              {/* Timeline line */}
              {!isLast && (
                <div className="absolute left-[15px] top-10 bottom-0 w-px bg-[hsl(var(--border))]" />
              )}

              {/* Circle */}
              <div
                className={`z-10 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-2 ${cfg.ringColor}`}
              >
                <StepIcon
                  className={`h-4 w-4 ${cfg.color} ${
                    step.status === "running" ? "animate-spin" : ""
                  }`}
                />
              </div>

              {/* Content */}
              <div className="flex-1 pb-6">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedStep(isExpanded ? null : step.stepId)
                  }
                  className="flex w-full items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 text-left hover:bg-[hsl(var(--muted))]/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                      {step.blockId}
                    </p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {stepDuration(step) !== "—" ? stepDuration(step) : "Pending"}
                      {" • "}
                      {cfg.label}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                  )}
                </button>

                {isExpanded && (
                  <div className="mt-2">
                    <StepDetail step={step} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
