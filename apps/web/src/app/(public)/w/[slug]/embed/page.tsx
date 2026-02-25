"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { api } from "@/lib/api";

/* ── Types (shared with parent page) ─────────────────────── */

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

/* ── PostMessage bridge for parent frame ─────────────────── */

function postToParent(type: string, payload: Record<string, unknown>) {
  if (typeof window !== "undefined" && window.parent !== window) {
    window.parent.postMessage({ source: "vsync-embed", type, ...payload }, "*");
  }
}

/* ── Status helpers ──────────────────────────────────────── */

const statusConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-yellow-500", label: "Pending" },
  running: { icon: Loader2, color: "text-blue-500", label: "Running" },
  completed: { icon: CheckCircle2, color: "text-green-500", label: "Completed" },
  failed: { icon: XCircle, color: "text-red-500", label: "Failed" },
  awaiting_action: { icon: Clock, color: "text-orange-500", label: "Awaiting Input" },
};

/**
 * Embeddable version of the public workflow viewer.
 * Designed to be loaded in an iframe. Communicates with the
 * parent frame via postMessage for run lifecycle events.
 */
export default function PublicWorkflowEmbedPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [config, setConfig] = useState<PublicWorkflowConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<PublicRunStatus | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [polling, setPolling] = useState(false);

  /* Load config */
  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    api.publicWorkflows
      .getConfig(slug)
      .then((res) => {
        setConfig(res.data);
        postToParent("ready", { slug });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [slug]);

  /* Poll for run status */
  useEffect(() => {
    if (!runId || !slug || !polling) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.publicWorkflows.getRunStatus(slug, runId);
        setRunStatus(res.data);
        postToParent("status", { runId, status: res.data.status });

        if (
          res.data.status === "completed" ||
          res.data.status === "failed" ||
          res.data.status === "cancelled"
        ) {
          setPolling(false);
          postToParent("done", {
            runId,
            status: res.data.status,
            durationMs: res.data.durationMs,
          });
        }
      } catch {
        /* Ignore polling errors */
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [runId, slug, polling]);

  /* Listen for parent messages */
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      const data = e.data as Record<string, unknown>;
      if (data?.source !== "vsync-host") return;

      if (data.type === "trigger" && slug) {
        void handleTrigger();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [slug]);

  const handleTrigger = useCallback(async () => {
    if (!slug) return;
    setTriggering(true);
    setError(null);
    try {
      const res = await api.publicWorkflows.triggerRun(slug);
      setRunId(res.data.runId);
      setRunStatus({
        id: res.data.runId,
        status: "pending",
        startedAt: null,
        completedAt: null,
        durationMs: null,
        errorMessage: null,
        stepsJson: null,
      });
      setPolling(true);
      postToParent("triggered", { runId: res.data.runId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to trigger";
      setError(msg);
      postToParent("error", { message: msg });
    } finally {
      setTriggering(false);
    }
  }, [slug]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[hsl(var(--background))]">
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    );
  }

  if (!config || error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 bg-[hsl(var(--background))]">
        <XCircle className="h-8 w-8 text-red-500" />
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{error ?? "Not found"}</p>
      </div>
    );
  }

  const accent = config.branding.accentColor ?? "hsl(var(--primary))";
  const Stat = runStatus ? statusConfig[runStatus.status] ?? statusConfig["pending"] : null;

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[hsl(var(--background))] p-4">
      <h1 className="text-center text-lg font-bold text-[hsl(var(--foreground))]">
        {config.name}
      </h1>

      {config.description && (
        <p className="max-w-md text-center text-xs text-[hsl(var(--muted-foreground))]">
          {config.description}
        </p>
      )}

      {config.accessMode === "run" && !runId && (
        <button
          onClick={handleTrigger}
          disabled={triggering}
          className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: accent }}
        >
          {triggering ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {triggering ? "Starting…" : "Run"}
        </button>
      )}

      {runStatus && Stat && (
        <div className="flex items-center gap-2">
          <Stat.icon
            className={`h-5 w-5 ${Stat.color} ${runStatus.status === "running" ? "animate-spin" : ""}`}
          />
          <span className="text-sm font-medium text-[hsl(var(--foreground))]">
            {Stat.label}
          </span>
          {runStatus.durationMs !== null && (
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              ({Math.round(runStatus.durationMs)}ms)
            </span>
          )}
        </div>
      )}

      {runStatus?.errorMessage && (
        <p className="max-w-md text-center text-xs text-red-500">{runStatus.errorMessage}</p>
      )}

      {(runStatus?.status === "completed" || runStatus?.status === "failed") && (
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
  );
}
