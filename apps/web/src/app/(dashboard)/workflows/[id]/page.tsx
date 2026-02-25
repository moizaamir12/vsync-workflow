"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Upload,
  Play,
  Loader2,
  Undo2,
  Redo2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { AIAssistant } from "@vsync/ui";
import { useWorkflow, useWorkflowBlocks, usePublishVersion } from "@/lib/queries/workflows";
import { useTriggerRun } from "@/lib/queries/runs";
import { useAIDesigner } from "@/hooks/useAIDesigner";

const AUTOSAVE_DELAY = 2000;

export default function WorkflowBuilderPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const workflowId = params.id;

  const { data: workflowRes, isLoading: loadingWorkflow } = useWorkflow(workflowId);
  const workflow = workflowRes?.data;
  const activeVersion = workflow?.activeVersion ?? 1;

  const { data: blocksRes, isLoading: loadingBlocks } = useWorkflowBlocks(
    workflowId,
    activeVersion,
  );

  const publishMutation = usePublishVersion();
  const triggerMutation = useTriggerRun();

  /* ── AI Assistant ──────────────────────────────────── */
  const [isAIOpen, setIsAIOpen] = useState(false);

  const aiDesigner = useAIDesigner({
    workflowId,
    apiKey: process.env.NEXT_PUBLIC_AI_API_KEY ?? "",
  });

  /* ── Auto-save timer ─────────────────────────────────── */
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false);

  const scheduleSave = useCallback(() => {
    isDirtyRef.current = true;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      if (!isDirtyRef.current) return;
      try {
        /* In a real implementation this would persist canvas state */
        isDirtyRef.current = false;
        toast.success("Saved", { duration: 1500 });
      } catch {
        toast.error("Auto-save failed");
      }
    }, AUTOSAVE_DELAY);
  }, []);

  /* ── Keyboard shortcuts ──────────────────────────────── */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;

      /* Cmd+K: Toggle AI Assistant */
      if (meta && e.key === "k") {
        e.preventDefault();
        setIsAIOpen((prev) => !prev);
        return;
      }

      /* Cmd+S: Save */
      if (meta && e.key === "s") {
        e.preventDefault();
        scheduleSave();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [scheduleSave]);

  /* ── Actions ─────────────────────────────────────────── */

  const handlePublish = useCallback(async () => {
    try {
      await publishMutation.mutateAsync({
        workflowId,
        version: activeVersion,
      });
      toast.success("Version published!");
    } catch {
      toast.error("Failed to publish");
    }
  }, [publishMutation, workflowId, activeVersion]);

  const handleTestRun = useCallback(async () => {
    try {
      const result = await triggerMutation.mutateAsync({ workflowId });
      toast.success("Test run started");
      if (result.data) {
        router.push(`/runs/${result.data.id}`);
      }
    } catch {
      toast.error("Failed to start test run");
    }
  }, [triggerMutation, workflowId, router]);

  const isLoading = loadingWorkflow || loadingBlocks;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col -m-6">
      {/* Toolbar */}
      <div className="flex h-12 items-center gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4">
        <Link
          href="/workflows"
          className="rounded p-1.5 hover:bg-[hsl(var(--muted))]"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        {isLoading ? (
          <div className="h-5 w-40 animate-pulse rounded bg-[hsl(var(--muted))]" />
        ) : (
          <>
            <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
              {workflow?.name ?? "Untitled"}
            </span>
            <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs text-[hsl(var(--muted-foreground))]">
              v{activeVersion}
            </span>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* AI Assistant toggle */}
          <button
            type="button"
            onClick={() => setIsAIOpen((prev) => !prev)}
            className={
              isAIOpen
                ? "inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700"
                : "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
            }
            title="AI Assistant (Cmd+K)"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI
            {aiDesigner.changesCount > 0 && (
              <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[9px] font-bold text-white">
                {aiDesigner.changesCount}
              </span>
            )}
          </button>

          <div className="mx-1 h-5 w-px bg-[hsl(var(--border))]" />

          {/* Undo / Redo placeholders */}
          <button
            type="button"
            disabled
            className="rounded p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-30"
            title="Undo (Cmd+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled
            className="rounded p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-30"
            title="Redo (Cmd+Shift+Z)"
          >
            <Redo2 className="h-4 w-4" />
          </button>

          <div className="mx-1 h-5 w-px bg-[hsl(var(--border))]" />

          <button
            type="button"
            onClick={scheduleSave}
            className="inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
          >
            <Save className="h-3.5 w-3.5" />
            Save
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-50"
          >
            {publishMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Publish
          </button>
          <button
            type="button"
            onClick={handleTestRun}
            disabled={triggerMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90 disabled:opacity-50"
          >
            {triggerMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Test Run
          </button>
        </div>
      </div>

      {/* Canvas area + AI panel */}
      <div className="relative flex-1 bg-[hsl(var(--background))]">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        ) : (
          <div className="flex h-full">
            {/* Main canvas placeholder — @vsync/ui WorkflowCanvas goes here */}
            <div className="flex flex-1 items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
              <div className="text-center">
                <p className="text-lg font-medium text-[hsl(var(--foreground))]">
                  Workflow Canvas
                </p>
                <p className="mt-1">
                  {(blocksRes?.data ?? []).length} blocks loaded
                </p>
                <p className="mt-0.5 text-xs">
                  Drag blocks from the palette to get started
                </p>
              </div>
            </div>

            {/* AI Assistant panel — persistent side panel with CSS transition */}
            <div
              className={
                isAIOpen
                  ? "w-[400px] opacity-100 transition-[width,opacity] duration-200 ease-in-out"
                  : "w-0 overflow-hidden opacity-0 transition-[width,opacity] duration-200 ease-in-out"
              }
            >
              <AIAssistant
                isOpen={isAIOpen}
                onClose={() => setIsAIOpen(false)}
                messages={aiDesigner.messages}
                isThinking={aiDesigner.isThinking}
                currentPlan={aiDesigner.currentPlan}
                changesCount={aiDesigner.changesCount}
                onSendMessage={aiDesigner.sendMessage}
                onCancelGeneration={aiDesigner.cancelGeneration}
                onClearChat={aiDesigner.clearChat}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
