"use client";

import { useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Grid3X3,
  List,
  MoreVertical,
  Copy,
  Trash2,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Workflow as WorkflowIcon,
} from "lucide-react";
import {
  useWorkflows,
  useCreateWorkflow,
  useDuplicateWorkflow,
  useDeleteWorkflow,
  useUpdateWorkflow,
} from "@/lib/queries/workflows";

/* ── New Workflow Dialog ─────────────────────────────────────── */

function NewWorkflowDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const createMutation = useCreateWorkflow();

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) return;

      try {
        const result = await createMutation.mutateAsync({ name: name.trim() });
        toast.success("Workflow created");
        onClose();
        if (result.data) {
          router.push(`/workflows/${result.data.id}`);
        }
      } catch {
        toast.error("Failed to create workflow");
      }
    },
    [name, createMutation, onClose, router],
  );

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">
          New Workflow
        </h3>
        <form onSubmit={handleCreate} className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Workflow"
              autoFocus
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[hsl(var(--border))] px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || createMutation.isPending}
              className="flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90 disabled:opacity-50"
            >
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Create
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

/* ── Workflow card actions ────────────────────────────────────── */

function WorkflowActions({
  workflowId,
  isDisabled,
}: {
  workflowId: string;
  isDisabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const duplicateMutation = useDuplicateWorkflow();
  const deleteMutation = useDeleteWorkflow();
  const updateMutation = useUpdateWorkflow();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(!open);
        }}
        className="rounded p-1 hover:bg-[hsl(var(--muted))]"
      >
        <MoreVertical className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-1 shadow-lg">
            <Link
              href={`/workflows/${workflowId}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-[hsl(var(--muted))]"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Link>
            <button
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                setOpen(false);
                try {
                  await duplicateMutation.mutateAsync(workflowId);
                  toast.success("Workflow duplicated");
                } catch {
                  toast.error("Failed to duplicate");
                }
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-[hsl(var(--muted))]"
            >
              <Copy className="h-3.5 w-3.5" /> Duplicate
            </button>
            <button
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                setOpen(false);
                try {
                  await updateMutation.mutateAsync({
                    id: workflowId,
                    isDisabled: !isDisabled,
                  });
                  toast.success(isDisabled ? "Workflow enabled" : "Workflow disabled");
                } catch {
                  toast.error("Failed to update");
                }
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-[hsl(var(--muted))]"
            >
              {isDisabled ? (
                <><ToggleRight className="h-3.5 w-3.5" /> Enable</>
              ) : (
                <><ToggleLeft className="h-3.5 w-3.5" /> Disable</>
              )}
            </button>
            <div className="my-1 border-t border-[hsl(var(--border))]" />
            <button
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                setOpen(false);
                try {
                  await deleteMutation.mutateAsync(workflowId);
                  toast.success("Workflow deleted");
                } catch {
                  toast.error("Failed to delete");
                }
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-[hsl(var(--destructive))] hover:bg-[hsl(var(--muted))]"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Workflows content (needs Suspense for useSearchParams) ── */

function WorkflowsContent() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("vsync:workflows-view") as "grid" | "list") ?? "grid";
    }
    return "grid";
  });
  const [dialogOpen, setDialogOpen] = useState(
    searchParams.get("new") === "true",
  );

  const { data, isLoading } = useWorkflows();
  const workflows = data?.data ?? [];

  const filtered = search
    ? workflows.filter(
        (w) =>
          w.name.toLowerCase().includes(search.toLowerCase()) ||
          w.description?.toLowerCase().includes(search.toLowerCase()),
      )
    : workflows;

  const toggleView = useCallback(
    (mode: "grid" | "list") => {
      setViewMode(mode);
      localStorage.setItem("vsync:workflows-view", mode);
    },
    [],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
            Workflows
          </h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Build and manage your automation workflows.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90"
        >
          <Plus className="h-4 w-4" />
          New Workflow
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workflows..."
            className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          />
        </div>
        <div className="flex rounded-md border border-[hsl(var(--border))]">
          <button
            type="button"
            onClick={() => toggleView("grid")}
            className={`p-2 ${viewMode === "grid" ? "bg-[hsl(var(--muted))]" : ""}`}
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => toggleView("list")}
            className={`p-2 ${viewMode === "list" ? "bg-[hsl(var(--muted))]" : ""}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div
          className={
            viewMode === "grid"
              ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
              : "space-y-2"
          }
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-[hsl(var(--border))] py-16 text-center">
          <WorkflowIcon className="mx-auto h-10 w-10 text-[hsl(var(--muted-foreground))]" />
          <h3 className="mt-4 text-lg font-semibold text-[hsl(var(--foreground))]">
            {search ? "No workflows match your search" : "Create your first workflow"}
          </h3>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            {search
              ? "Try a different search term."
              : "Build automations that run on cloud, desktop, or mobile."}
          </p>
          {!search && (
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90"
            >
              <Plus className="h-4 w-4" />
              New Workflow
            </button>
          )}
        </div>
      )}

      {/* Grid view */}
      {!isLoading && filtered.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((wf) => (
            <Link
              key={wf.id}
              href={`/workflows/${wf.id}`}
              className="group rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-[hsl(var(--foreground))]">
                    {wf.name}
                  </h3>
                  {wf.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-[hsl(var(--muted-foreground))]">
                      {wf.description}
                    </p>
                  )}
                </div>
                <WorkflowActions workflowId={wf.id} isDisabled={wf.isDisabled} />
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                  v{wf.activeVersion}
                </span>
                {wf.isDisabled && (
                  <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                    Disabled
                  </span>
                )}
              </div>
              <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">
                {wf.createdAt
                  ? `Created ${new Date(wf.createdAt).toLocaleDateString()}`
                  : ""}
              </p>
            </Link>
          ))}
        </div>
      )}

      {/* List view */}
      {!isLoading && filtered.length > 0 && viewMode === "list" && (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] divide-y divide-[hsl(var(--border))]">
          {filtered.map((wf) => (
            <Link
              key={wf.id}
              href={`/workflows/${wf.id}`}
              className="flex items-center gap-4 px-5 py-3 hover:bg-[hsl(var(--muted))]/50"
            >
              <WorkflowIcon className="h-5 w-5 shrink-0 text-[hsl(var(--muted-foreground))]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">
                  {wf.name}
                </p>
                {wf.description && (
                  <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                    {wf.description}
                  </p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                v{wf.activeVersion}
              </span>
              {wf.isDisabled && (
                <span className="shrink-0 rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                  Disabled
                </span>
              )}
              <WorkflowActions workflowId={wf.id} isDisabled={wf.isDisabled} />
            </Link>
          ))}
        </div>
      )}

      {/* New workflow dialog */}
      <NewWorkflowDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}

/* ── Workflows page (Suspense boundary for useSearchParams) ── */

export default function WorkflowsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="h-8 w-48 animate-pulse rounded bg-[hsl(var(--muted))]" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50"
              />
            ))}
          </div>
        </div>
      }
    >
      <WorkflowsContent />
    </Suspense>
  );
}
