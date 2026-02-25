import { useCallback, useEffect, useRef, useState } from "react";
import {
  Save,
  Upload,
  Play,
  Undo2,
  Redo2,
  LayoutGrid,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Globe,
  Share2,
} from "lucide-react";
import { cn } from "../../lib/utils.js";
import { useWorkflowStore } from "../../stores/workflowStore.js";

/* ── Props ────────────────────────────────────────────────────── */

export interface WorkflowToolbarProps {
  /** Called to save the workflow. Should throw on error. */
  onSave?: () => Promise<void>;
  /** Called to publish the workflow. */
  onPublish?: () => Promise<void>;
  /** Called to trigger a test run. */
  onTestRun?: () => void;
  /** Called to auto-layout nodes (dagre). */
  onAutoLayout?: () => void;
  /** Called when the Share button is clicked. */
  onShare?: () => void;
  /** Whether the workflow is currently public. */
  isPublic?: boolean;
  /** Auto-save debounce interval in ms (0 = off). Default 3000. */
  autoSaveMs?: number;
  /** Additional class names */
  className?: string;
}

/* ── Component ────────────────────────────────────────────────── */

/**
 * Top toolbar for the workflow builder.
 * Displays workflow name, trigger type, version badge,
 * save/publish/test/undo/redo buttons, and auto-save status.
 */
export function WorkflowToolbar({
  onSave,
  onPublish,
  onTestRun,
  onAutoLayout,
  onShare,
  isPublic = false,
  autoSaveMs = 3000,
  className,
}: WorkflowToolbarProps) {
  const workflow = useWorkflowStore((s) => s.workflow);
  const isDirty = useWorkflowStore((s) => s.isDirty);
  const saveStatus = useWorkflowStore((s) => s.saveStatus);
  const saveError = useWorkflowStore((s) => s.saveError);
  const undoStack = useWorkflowStore((s) => s.undoStack);
  const redoStack = useWorkflowStore((s) => s.redoStack);
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const setSaveStatus = useWorkflowStore((s) => s.setSaveStatus);
  const markClean = useWorkflowStore((s) => s.markClean);

  const [isPublishing, setIsPublishing] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  /* ── Save handler with error handling ──────── */

  const handleSave = useCallback(async () => {
    if (!onSave || saveStatus === "saving") return;

    setSaveStatus("saving");

    try {
      await onSave();
      markClean();
      setSaveStatus("saved");
      retryCountRef.current = 0;

      /* Reset saved status after 2s */
      setTimeout(() => {
        setSaveStatus("idle");
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      const isConflict = message.includes("409") || message.toLowerCase().includes("conflict");

      if (isConflict) {
        /* 409 conflict — do not retry, surface to user */
        setSaveStatus("error", "Version conflict — reload to get latest changes");
        retryCountRef.current = 0;
      } else if (retryCountRef.current < 3) {
        /* Exponential backoff retry */
        retryCountRef.current += 1;
        const backoff = Math.pow(2, retryCountRef.current) * 1000;
        setSaveStatus("error", `Retrying in ${backoff / 1000}s…`);
        setTimeout(() => {
          void handleSave();
        }, backoff);
      } else {
        setSaveStatus("error", message);
        retryCountRef.current = 0;
      }
    }
  }, [onSave, saveStatus, setSaveStatus, markClean]);

  /* ── Auto-save via debounce ────────────────── */

  useEffect(() => {
    if (!autoSaveMs || autoSaveMs <= 0 || !isDirty || !onSave) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      void handleSave();
    }, autoSaveMs);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [isDirty, autoSaveMs, handleSave, onSave]);

  /* ── Publish handler ───────────────────────── */

  const handlePublish = useCallback(async () => {
    if (!onPublish || isPublishing) return;
    setIsPublishing(true);
    try {
      await onPublish();
    } finally {
      setIsPublishing(false);
    }
  }, [onPublish, isPublishing]);

  /* ── Save status indicator ─────────────────── */

  const statusIcon = (() => {
    switch (saveStatus) {
      case "saving":
        return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />;
      case "saved":
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
      case "error":
        return <XCircle className="h-3.5 w-3.5 text-[hsl(var(--destructive))]" />;
      default:
        return isDirty ? (
          <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
        ) : null;
    }
  })();

  const statusLabel = (() => {
    switch (saveStatus) {
      case "saving": return "Saving…";
      case "saved": return "Saved";
      case "error": return saveError ?? "Error";
      default: return isDirty ? "Unsaved changes" : "";
    }
  })();

  const buttonCn = cn(
    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
    "transition-colors disabled:cursor-not-allowed disabled:opacity-50",
  );

  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2",
        className,
      )}
    >
      {/* Workflow name & meta */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-[hsl(var(--foreground))]">
            {workflow?.name ?? "Untitled Workflow"}
          </span>
          {workflow && (
            <span className="shrink-0 rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[10px] font-medium text-[hsl(var(--muted-foreground))]">
              v{workflow.activeVersion}
            </span>
          )}
          {workflow?.triggerType && (
            <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
              {workflow.triggerType}
            </span>
          )}
        </div>
      </div>

      {/* Save status */}
      {(statusIcon || statusLabel) && (
        <div className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
          {statusIcon}
          <span className="max-w-[200px] truncate">{statusLabel}</span>
        </div>
      )}

      {/* Divider */}
      <div className="h-5 w-px bg-[hsl(var(--border))]" />

      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={undo}
          disabled={undoStack.length === 0}
          className={cn(buttonCn, "px-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]")}
          title="Undo (Cmd+Z)"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={redoStack.length === 0}
          className={cn(buttonCn, "px-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]")}
          title="Redo (Cmd+Shift+Z)"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Auto-layout */}
      {onAutoLayout && (
        <button
          type="button"
          onClick={onAutoLayout}
          className={cn(buttonCn, "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]")}
          title="Auto-layout"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Layout
        </button>
      )}

      <div className="h-5 w-px bg-[hsl(var(--border))]" />

      {/* Save */}
      {onSave && (
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saveStatus === "saving" || !isDirty}
          className={cn(
            buttonCn,
            "border border-[hsl(var(--border))] bg-[hsl(var(--background))]",
            "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]",
          )}
        >
          {saveStatus === "saving" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Save
        </button>
      )}

      {/* Publish */}
      {onPublish && (
        <button
          type="button"
          onClick={() => void handlePublish()}
          disabled={isPublishing || isDirty}
          className={cn(
            buttonCn,
            "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
            "hover:bg-[hsl(var(--primary))]/90",
          )}
        >
          {isPublishing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Publish
        </button>
      )}

      {/* Test Run */}
      {onTestRun && (
        <button
          type="button"
          onClick={onTestRun}
          className={cn(
            buttonCn,
            "border border-green-300 bg-green-50 text-green-700",
            "hover:bg-green-100",
          )}
        >
          <Play className="h-3.5 w-3.5" />
          Test Run
        </button>
      )}

      {/* Share */}
      {onShare && (
        <button
          type="button"
          onClick={onShare}
          className={cn(
            buttonCn,
            isPublic
              ? "border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
              : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]",
          )}
          title={isPublic ? "Workflow is public — manage sharing" : "Share this workflow"}
        >
          {isPublic ? (
            <Globe className="h-3.5 w-3.5" />
          ) : (
            <Share2 className="h-3.5 w-3.5" />
          )}
          Share
        </button>
      )}
    </div>
  );
}
