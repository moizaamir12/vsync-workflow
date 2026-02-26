"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import { WorkflowDesigner } from "@vsync/designer";
import type { DesignerEvent, EditEvent } from "@vsync/designer";
import { useWorkflowStore, type BlockType } from "@vsync/ui";
import type { ChatMessage, PlanStep } from "@vsync/ui";

/* ── Options ──────────────────────────────────────────────── */

export interface UseAIDesignerOptions {
  workflowId: string;
  apiKey: string;
  model?: string;
}

export interface UseAIDesignerReturn {
  /** Chat messages (user + assistant) */
  messages: ChatMessage[];
  /** Whether the AI is currently generating */
  isThinking: boolean;
  /** Current multi-step plan, if AI created one */
  currentPlan: { planId: string; steps: PlanStep[] } | null;
  /** Number of AI edits applied in this session */
  changesCount: number;
  /** Send a message to the AI */
  sendMessage: (prompt: string) => void;
  /** Cancel the current generation */
  cancelGeneration: () => void;
  /** Clear all chat history and reset state */
  clearChat: () => void;
}

/* ── Helpers ──────────────────────────────────────────────── */

function makeMessageId(): string {
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Build a compact context object from the Zustand store
 * to send alongside each user prompt. Keeps token usage low.
 */
function buildContext(): {
  workflowName: string;
  triggerType: string;
  blocks: Array<{ id: string; name: string; type: string; logicKeys: string[] }>;
  selectedBlockId: string | null;
  recentErrors: string[];
} {
  const store = useWorkflowStore.getState();
  return {
    workflowName: store.workflow?.name ?? "Untitled",
    triggerType: store.workflow?.triggerType ?? "interactive",
    blocks: store.blocks.map((b) => ({
      id: b.id,
      name: b.name,
      type: b.type,
      logicKeys: Object.keys(b.logic),
    })),
    selectedBlockId: store.selectedBlockId,
    recentErrors: [],
  };
}

/**
 * Apply an AI edit event to the Zustand store.
 * Best-effort mapping: edits on existing blocks (matching IDs) are applied;
 * add_block creates a new store block; unresolvable IDs are skipped.
 */
function applyEdit(data: EditEvent["data"]): string | null {
  const store = useWorkflowStore.getState();

  switch (data.operation) {
    case "add_block": {
      if (!data.blockType) return null;
      /* addBlock internally calls pushUndo() */
      const newId = store.addBlock(data.blockType as BlockType);
      store.addAiModifiedBlockId(newId);
      return newId;
    }

    case "update_block": {
      if (!data.blockId) return null;
      const block = store.getBlock(data.blockId);
      if (!block) return null;
      /* updateBlockLogic does NOT pushUndo — we do it here */
      store.pushUndo();
      if (data.changes) {
        store.updateBlockLogic(data.blockId, data.changes);
      }
      store.addAiModifiedBlockId(data.blockId);
      return data.blockId;
    }

    case "remove_block": {
      if (!data.blockId) return null;
      const block = store.getBlock(data.blockId);
      if (!block) return null;
      /* deleteBlock internally calls pushUndo() */
      store.deleteBlock(data.blockId);
      return null;
    }

    case "reorder_blocks": {
      /* EditEvent doesn't carry the ordered ID list — skip for now */
      return null;
    }

    case "set_trigger": {
      /* Trigger updates affect workflow meta, not the block store.
         The workflow meta is managed by the server / React Query. */
      return null;
    }

    default:
      return null;
  }
}

/* ── Hook ─────────────────────────────────────────────────── */

export function useAIDesigner(options: UseAIDesignerOptions): UseAIDesignerReturn {
  const { workflowId, apiKey, model } = options;

  /* ── Local state ──────────────────────────────── */

  // TODO(perf): Memoize messages loaded from localStorage to prevent unnecessary re-renders.
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(`vsync:ai-chat:${workflowId}`);
      return stored ? (JSON.parse(stored) as ChatMessage[]) : [];
    } catch {
      return [];
    }
  });

  const [isThinking, setIsThinking] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<{
    planId: string;
    steps: PlanStep[];
  } | null>(null);
  const [changesCount, setChangesCount] = useState(0);

  /* ── Refs ──────────────────────────────────────── */

  const abortRef = useRef<AbortController | null>(null);
  const assistantBufferRef = useRef("");

  /* ── Designer instance (memoized) ─────────────── */

  // TODO: Show a user-visible warning when NEXT_PUBLIC_AI_API_KEY is missing instead of silently creating a non-functional designer instance.
  const designer = useMemo(() => {
    if (!apiKey) return null;
    return new WorkflowDesigner({ apiKey, model });
  }, [apiKey, model]);

  /* ── Persist messages to localStorage ─────────── */

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(`vsync:ai-chat:${workflowId}`, JSON.stringify(messages));
  }, [messages, workflowId]);

  /* ── sendMessage ──────────────────────────────── */

  const sendMessage = useCallback(
    async (prompt: string) => {
      if (!designer) {
        toast.error("AI API key is not configured");
        return;
      }
      if (isThinking) return;

      /* 1. Add user message */
      const userMsg: ChatMessage = {
        id: makeMessageId(),
        role: "user",
        content: prompt,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);

      /* 2. Set thinking state */
      setIsThinking(true);
      assistantBufferRef.current = "";

      /* 3. Build context and full prompt */
      const context = buildContext();
      const fullPrompt = `Context: ${JSON.stringify(context)}\n\nUser request: ${prompt}`;

      /* 4. Build existing workflow from store */
      const store = useWorkflowStore.getState();
      const existingWorkflow =
        store.blocks.length > 0
          ? {
              blocks: store.blocks.map((b) => ({
                id: b.id,
                workflowId: b.workflowId,
                workflowVersion: b.workflowVersion,
                name: b.name,
                type: b.type as import("@vsync/shared-types").BlockType,
                logic: b.logic,
                conditions: b.conditions as import("@vsync/shared-types").Condition[] | undefined,
                order: b.order,
                notes: b.notes,
              })),
              triggerType: (store.workflow?.triggerType ?? "interactive") as import("@vsync/shared-types").TriggerType,
              triggerConfig: (store.workflow?.triggerConfig ?? {}) as import("@vsync/shared-types").TriggerConfig,
            }
          : undefined;

      /* 5. Abort controller */
      const abortController = new AbortController();
      abortRef.current = abortController;

      const assistantMsgId = makeMessageId();

      try {
        /* 6. Consume the async generator */
        const generator = designer.generateWorkflow(fullPrompt, existingWorkflow);

        for await (const event of generator) {
          if (abortController.signal.aborted) break;

          switch (event.type) {
            case "thinking": {
              assistantBufferRef.current += event.data.text;
              const currentText = assistantBufferRef.current;
              setMessages((prev) => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg?.id === assistantMsgId) {
                  /* Update existing assistant message */
                  return [
                    ...prev.slice(0, -1),
                    { ...lastMsg, content: currentText },
                  ];
                }
                /* Create new assistant message */
                return [
                  ...prev,
                  {
                    id: assistantMsgId,
                    role: "assistant" as const,
                    content: currentText,
                    timestamp: Date.now(),
                  },
                ];
              });
              break;
            }

            case "plan": {
              setCurrentPlan({
                planId: event.data.planId,
                steps: event.data.steps.map((s) => ({
                  text: s,
                  status: "pending" as const,
                })),
              });
              break;
            }

            case "edit": {
              applyEdit(event.data);
              setChangesCount((prev) => prev + 1);
              break;
            }

            case "complete": {
              /* Ensure there's a final assistant message */
              if (!assistantBufferRef.current) {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: assistantMsgId,
                    role: "assistant" as const,
                    content: event.data.summary,
                    timestamp: Date.now(),
                  },
                ]);
              }
              break;
            }

            case "error": {
              setMessages((prev) => [
                ...prev,
                {
                  id: makeMessageId(),
                  role: "assistant" as const,
                  content: `⚠ ${event.data.message}`,
                  timestamp: Date.now(),
                },
              ]);
              toast.error(event.data.message);
              break;
            }
          }
        }
      } catch (err: unknown) {
        if (!abortController.signal.aborted) {
          const message =
            err instanceof Error ? err.message : "AI generation failed";
          toast.error(message);
          setMessages((prev) => [
            ...prev,
            {
              id: makeMessageId(),
              role: "assistant" as const,
              content: `Error: ${message}`,
              timestamp: Date.now(),
            },
          ]);
        }
      } finally {
        setIsThinking(false);
        abortRef.current = null;
      }
    },
    [designer, isThinking],
  );

  /* ── cancelGeneration ─────────────────────────── */

  const cancelGeneration = useCallback(() => {
    abortRef.current?.abort();
    setIsThinking(false);
  }, []);

  /* ── clearChat ────────────────────────────────── */

  const clearChat = useCallback(() => {
    setMessages([]);
    setCurrentPlan(null);
    setChangesCount(0);
    useWorkflowStore.getState().clearAiModifiedBlockIds();
    if (typeof window !== "undefined") {
      localStorage.removeItem(`vsync:ai-chat:${workflowId}`);
    }
  }, [workflowId]);

  return {
    messages,
    isThinking,
    currentPlan,
    changesCount,
    sendMessage,
    cancelGeneration,
    clearChat,
  };
}
