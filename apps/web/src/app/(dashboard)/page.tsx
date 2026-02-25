"use client";

import Link from "next/link";
import {
  Workflow,
  Play,
  TrendingUp,
  Activity,
  Plus,
  ArrowRight,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  Ban,
  Hand,
} from "lucide-react";
import { useDashboardStats } from "@/lib/queries/runs";

/* ── Stat card ───────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{label}</p>
        <Icon className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
      </div>
      {loading ? (
        <div className="mt-2 h-8 w-20 animate-pulse rounded bg-[hsl(var(--muted))]" />
      ) : (
        <p className="mt-2 text-2xl font-bold text-[hsl(var(--foreground))]">
          {value}
        </p>
      )}
    </div>
  );
}

/* ── Status icon helper ──────────────────────────────────────── */

const statusConfig: Record<
  string,
  { icon: React.ElementType; color: string; label: string }
> = {
  completed: { icon: CheckCircle, color: "text-green-500", label: "Completed" },
  failed: { icon: XCircle, color: "text-red-500", label: "Failed" },
  running: { icon: Loader2, color: "text-blue-500", label: "Running" },
  pending: { icon: Clock, color: "text-gray-400", label: "Pending" },
  cancelled: { icon: Ban, color: "text-yellow-500", label: "Cancelled" },
  awaiting_action: { icon: Hand, color: "text-orange-500", label: "Awaiting" },
};

/* ── Dashboard page ──────────────────────────────────────────── */

export default function DashboardPage() {
  const { data: stats, isLoading } = useDashboardStats();

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Overview of your workflows and recent activity.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Workflows"
          value={stats?.totalWorkflows ?? 0}
          icon={Workflow}
          loading={isLoading}
        />
        <StatCard
          label="Runs Today"
          value={stats?.runsToday ?? 0}
          icon={Play}
          loading={isLoading}
        />
        <StatCard
          label="Success Rate"
          value={`${stats?.successRate ?? 0}%`}
          icon={TrendingUp}
          loading={isLoading}
        />
        <StatCard
          label="Total Runs"
          value={stats?.totalRuns ?? 0}
          icon={Activity}
          loading={isLoading}
        />
      </div>

      {/* Quick actions */}
      <div className="flex gap-3">
        <Link
          href="/workflows?new=true"
          className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary))]/90"
        >
          <Plus className="h-4 w-4" />
          New Workflow
        </Link>
        <Link
          href="/runs"
          className="inline-flex items-center gap-2 rounded-md border border-[hsl(var(--border))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
        >
          View All Runs
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Recent runs table */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="border-b border-[hsl(var(--border))] px-5 py-3">
          <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">
            Recent Runs
          </h2>
        </div>

        {isLoading ? (
          <div className="space-y-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b border-[hsl(var(--border))] px-5 py-3 last:border-0"
              >
                <div className="h-4 w-4 animate-pulse rounded-full bg-[hsl(var(--muted))]" />
                <div className="h-4 w-32 animate-pulse rounded bg-[hsl(var(--muted))]" />
                <div className="h-4 w-16 animate-pulse rounded bg-[hsl(var(--muted))]" />
                <div className="ml-auto h-4 w-24 animate-pulse rounded bg-[hsl(var(--muted))]" />
              </div>
            ))}
          </div>
        ) : !stats?.recentRuns?.length ? (
          <div className="px-5 py-12 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-[hsl(var(--muted-foreground))]" />
            <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
              No runs yet. Trigger a workflow to see results here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[hsl(var(--border))]">
            {stats.recentRuns.map((run) => {
              const cfg = statusConfig[run.status] ?? statusConfig.pending;
              const StatusIcon = cfg.icon;

              return (
                <Link
                  key={run.id}
                  href={`/runs/${run.id}`}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-[hsl(var(--muted))]/50"
                >
                  <StatusIcon
                    className={`h-4 w-4 shrink-0 ${cfg.color} ${
                      run.status === "running" ? "animate-spin" : ""
                    }`}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-[hsl(var(--foreground))]">
                    {run.workflowId}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color} bg-current/10`}
                  >
                    {cfg.label}
                  </span>
                  <span className="shrink-0 text-xs text-[hsl(var(--muted-foreground))]">
                    {run.durationMs != null ? `${run.durationMs}ms` : "—"}
                  </span>
                  <span className="shrink-0 text-xs text-[hsl(var(--muted-foreground))]">
                    {run.createdAt
                      ? new Date(run.createdAt).toLocaleTimeString()
                      : ""}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
