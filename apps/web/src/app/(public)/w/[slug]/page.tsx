"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Blocks,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Globe,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import { api } from "@/lib/api";

/* ── Types ───────────────────────────────────────────────── */

interface PublicWorkflowConfig {
  slug: string;
  name: string;
  description: string | null;
  branding: {
    title?: string;
    description?: string;
    accentColor?: string;
    logoUrl?: string;
    hideVsyncBranding?: boolean;
  };
  accessMode: string;
  triggerType: string;
  blockCount: number;
  blocks: Array<{ id: string; name: string; type: string; order: number }>;
  environments: unknown;
}

interface PublicRunStatus {
  id: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  stepsJson: unknown;
}

/* ── Status helpers ──────────────────────────────────────── */

const statusConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-yellow-500", label: "Pending" },
  running: { icon: Loader2, color: "text-blue-500", label: "Running" },
  completed: { icon: CheckCircle2, color: "text-green-500", label: "Completed" },
  failed: { icon: XCircle, color: "text-red-500", label: "Failed" },
  cancelled: { icon: XCircle, color: "text-gray-500", label: "Cancelled" },
  awaiting_action: { icon: Clock, color: "text-orange-500", label: "Awaiting Input" },
};

/* ── Page Component ──────────────────────────────────────── */

export default function PublicWorkflowPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [config, setConfig] = useState<PublicWorkflowConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Run state */
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<PublicRunStatus | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [polling, setPolling] = useState(false);

  /* Action state (for interactive workflows) */
  const [actionPayload, setActionPayload] = useState<string>("{}");

  /* Load public config */
  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    api.publicWorkflows
      .getConfig(slug)
      .then((res) => setConfig(res.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load workflow"))
      .finally(() => setLoading(false));
  }, [slug]);

  /* Poll for run status */
  useEffect(() => {
    if (!runId || !slug || !polling) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.publicWorkflows.getRunStatus(slug, runId);
        setRunStatus(res.data);

        /* Stop polling on terminal states */
        if (
          res.data.status === "completed" ||
          res.data.status === "failed" ||
          res.data.status === "cancelled"
        ) {
          setPolling(false);
        }
      } catch {
        /* Ignore polling errors silently */
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [runId, slug, polling]);

  /* Trigger a public run */
  const handleTrigger = useCallback(async () => {
    if (!slug) return;
    setTriggering(true);
    setError(null);
    try {
      const res = await api.publicWorkflows.triggerRun(slug);
      setRunId(res.data.runId);
      setRunStatus({ id: res.data.runId, status: "pending", startedAt: null, completedAt: null, durationMs: null, errorMessage: null, stepsJson: null });
      setPolling(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to trigger workflow");
    } finally {
      setTriggering(false);
    }
  }, [slug]);

  /* Submit user action */
  const handleSubmitAction = useCallback(async () => {
    if (!slug || !runId) return;
    try {
      const payload = JSON.parse(actionPayload) as Record<string, unknown>;
      await api.publicWorkflows.submitAction(slug, runId, payload);
      setPolling(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit action");
    }
  }, [slug, runId, actionPayload]);

  /* ── Loading state ──────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <XCircle className="h-12 w-12 text-red-500" />
        <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">Workflow Not Found</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{error}</p>
        <Link href="/" className="text-sm text-[hsl(var(--primary))] hover:underline">
          Go Home
        </Link>
      </div>
    );
  }

  if (!config) return null;

  const accentColor = config.branding.accentColor ?? "hsl(var(--primary))";
  const StatusCfg = runStatus ? statusConfig[runStatus.status] ?? statusConfig["pending"] : null;

  /* ── Render ─────────────────────────────────────────── */

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
          <Globe className="h-3.5 w-3.5" />
          <span>Public Workflow</span>
          <span>·</span>
          <span>{config.blockCount} blocks</span>
          <span>·</span>
          <span>{config.triggerType}</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-[hsl(var(--foreground))] sm:text-3xl">
          {config.name}
        </h1>
        {config.description && (
          <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
            {config.description}
          </p>
        )}
      </div>

      {/* Block overview */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--foreground))]">
          <Blocks className="h-4 w-4" />
          Workflow Steps
        </h2>
        <div className="mt-4 space-y-0">
          {config.blocks.map((block, i) => (
            <div key={block.id} className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <div className={`h-2.5 w-px ${i === 0 ? "bg-transparent" : "bg-[hsl(var(--border))]"}`} />
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold"
                  style={{ borderColor: accentColor, color: accentColor }}
                >
                  {i + 1}
                </div>
                <div className={`h-2.5 w-px ${i === config.blocks.length - 1 ? "bg-transparent" : "bg-[hsl(var(--border))]"}`} />
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-xs font-mono text-[hsl(var(--muted-foreground))]">
                  {block.type}
                </span>
                <span className="text-sm text-[hsl(var(--foreground))]">{block.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Run section */}
      {config.accessMode === "run" && (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Run this Workflow</h2>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            Click below to execute this workflow. No account required.
          </p>

          {!runId && (
            <button
              onClick={handleTrigger}
              disabled={triggering}
              className="mt-4 inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
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

          {/* Run status */}
          {runStatus && StatusCfg && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2">
                <StatusCfg.icon
                  className={`h-5 w-5 ${StatusCfg.color} ${runStatus.status === "running" ? "animate-spin" : ""}`}
                />
                <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                  {StatusCfg.label}
                </span>
                {runStatus.durationMs !== null && (
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    ({Math.round(runStatus.durationMs)}ms)
                  </span>
                )}
              </div>

              {runStatus.errorMessage && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                  {runStatus.errorMessage}
                </div>
              )}

              {/* Action input for interactive workflows */}
              {runStatus.status === "awaiting_action" && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[hsl(var(--foreground))]">
                    Workflow is waiting for your input:
                  </label>
                  <textarea
                    value={actionPayload}
                    onChange={(e) => setActionPayload(e.target.value)}
                    className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-2 text-xs font-mono text-[hsl(var(--foreground))]"
                    rows={4}
                    placeholder='{"field": "value"}'
                  />
                  <button
                    onClick={handleSubmitAction}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-xs font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90"
                  >
                    Submit Response
                  </button>
                </div>
              )}

              {/* Run again button after completion */}
              {(runStatus.status === "completed" || runStatus.status === "failed" || runStatus.status === "cancelled") && (
                <button
                  onClick={() => {
                    setRunId(null);
                    setRunStatus(null);
                  }}
                  className="text-xs text-[hsl(var(--primary))] hover:underline"
                >
                  Run Again
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Footer */}
      {!config.branding.hideVsyncBranding && (
        <div className="text-center text-xs text-[hsl(var(--muted-foreground))]">
          Powered by{" "}
          <Link href="/" className="font-medium text-[hsl(var(--primary))] hover:underline">
            VSync
          </Link>
        </div>
      )}
    </div>
  );
}
