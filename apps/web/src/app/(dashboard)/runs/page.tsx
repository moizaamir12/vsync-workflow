"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Ban,
  Hand,
  ChevronRight,
  Filter,
} from "lucide-react";
import { useRuns } from "@/lib/queries/runs";

/* ── Status config ───────────────────────────────────────────── */

const statusConfig: Record<
  string,
  { icon: React.ElementType; color: string; bg: string; label: string }
> = {
  pending: { icon: Clock, color: "text-gray-500", bg: "bg-gray-100", label: "Pending" },
  running: { icon: Loader2, color: "text-blue-600", bg: "bg-blue-50", label: "Running" },
  completed: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50", label: "Completed" },
  failed: { icon: XCircle, color: "text-red-600", bg: "bg-red-50", label: "Failed" },
  cancelled: { icon: Ban, color: "text-yellow-600", bg: "bg-yellow-50", label: "Cancelled" },
  awaiting_action: { icon: Hand, color: "text-orange-600", bg: "bg-orange-50", label: "Awaiting" },
};

const statusOptions = ["all", "pending", "running", "completed", "failed", "cancelled", "awaiting_action"];

/* ── Runs page ───────────────────────────────────────────────── */

export default function RunsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading } = useRuns(
    statusFilter !== "all" ? { status: statusFilter } : undefined,
  );
  const runs = data?.data ?? [];

  const filtered = useMemo(() => {
    if (!search) return runs;
    const q = search.toLowerCase();
    return runs.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.workflowId?.toLowerCase().includes(q),
    );
  }, [runs, search]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
          Run History
        </h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          View and inspect workflow execution history.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by run or workflow ID..."
            className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s === "all"
                  ? "All statuses"
                  : s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        {/* Table header */}
        <div className="hidden border-b border-[hsl(var(--border))] px-5 py-2.5 sm:grid sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_24px] sm:gap-4">
          {["Workflow", "Version", "Status", "Trigger", "Duration", ""].map(
            (h) => (
              <span
                key={h}
                className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]"
              >
                {h}
              </span>
            ),
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="divide-y divide-[hsl(var(--border))]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3">
                <div className="h-4 w-32 animate-pulse rounded bg-[hsl(var(--muted))]" />
                <div className="h-4 w-12 animate-pulse rounded bg-[hsl(var(--muted))]" />
                <div className="h-4 w-20 animate-pulse rounded bg-[hsl(var(--muted))]" />
                <div className="ml-auto h-4 w-16 animate-pulse rounded bg-[hsl(var(--muted))]" />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && filtered.length === 0 && (
          <div className="py-16 text-center">
            <Clock className="mx-auto h-8 w-8 text-[hsl(var(--muted-foreground))]" />
            <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
              No runs found.
            </p>
          </div>
        )}

        {/* Rows */}
        {!isLoading && filtered.length > 0 && (
          <div className="divide-y divide-[hsl(var(--border))]">
            {filtered.map((run) => {
              const cfg = statusConfig[run.status] ?? statusConfig.pending;
              const StatusIcon = cfg.icon;

              return (
                <Link
                  key={run.id}
                  href={`/runs/${run.id}`}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_24px] items-center gap-4 px-5 py-3 hover:bg-[hsl(var(--muted))]/50"
                >
                  <span className="truncate text-sm font-medium text-[hsl(var(--foreground))]">
                    {run.workflowId ?? run.id}
                  </span>
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">
                    v{run.version ?? "—"}
                  </span>
                  <span
                    className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}
                  >
                    <StatusIcon
                      className={`h-3 w-3 ${run.status === "running" ? "animate-spin" : ""}`}
                    />
                    {cfg.label}
                  </span>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    {run.triggerType ?? "manual"}
                  </span>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    {run.durationMs != null ? `${run.durationMs}ms` : "—"}
                  </span>
                  <ChevronRight className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
