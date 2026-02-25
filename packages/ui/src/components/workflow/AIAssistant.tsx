"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  Sparkles,
  X,
  Send,
  Mic,
  Square,
  Loader2,
  CheckCircle2,
  Circle,
  Trash2,
} from "lucide-react";
import { cn } from "../../lib/utils.js";
import { ScrollArea } from "../primitives/ScrollArea.js";
import { AiMarkdown } from "./ai-markdown.js";

/* ── SpeechRecognition type declarations ─────────────────── */

/**
 * Minimal type declarations for the Web Speech API.
 * The UI package compiles with `types: ["node"]` only, so browser
 * WebSpeech types are not available. We define just enough for our use.
 */
interface SpeechRecognitionResultItem {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResult {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEventLike {
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    SpeechRecognition?: SpeechRecognitionConstructor;
  }
}

/* ── Public types ─────────────────────────────────────────── */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface PlanStep {
  text: string;
  status: "pending" | "in_progress" | "done";
}

export interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;

  /** Chat state — managed by the parent hook */
  messages: ChatMessage[];
  isThinking: boolean;
  currentPlan: { planId: string; steps: PlanStep[] } | null;
  changesCount: number;

  /** Actions — delegated to the parent hook */
  onSendMessage: (message: string) => void;
  onCancelGeneration: () => void;
  onClearChat: () => void;

  /** Additional class names */
  className?: string;
}

/* ── Sub-components ──────────────────────────────────────── */

/** Animated thinking dots shown while AI is processing */
function ThinkingIndicator() {
  return (
    <div className="mb-3 flex items-center gap-1.5 px-3 py-2">
      <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "0ms" }} />
      <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "150ms" }} />
      <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  );
}

/** Render a single chat message bubble */
function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("mb-3", isUser && "flex justify-end")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm",
          isUser
            ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
            : "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]",
        )}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : (
          <AiMarkdown content={message.content} />
        )}
      </div>
    </div>
  );
}

/** Sticky plan checklist above the chat */
function PlanChecklist({ steps }: { steps: PlanStep[] }) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        Plan
      </span>
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-2 text-xs text-[hsl(var(--foreground))]">
          {step.status === "done" && (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />
          )}
          {step.status === "in_progress" && (
            <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-blue-500" />
          )}
          {step.status === "pending" && (
            <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
          )}
          <span className={cn(step.status === "done" && "text-[hsl(var(--muted-foreground))] line-through")}>
            {step.text}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Quick action buttons shown when there are no messages */
function QuickActions({ onAction }: { onAction: (msg: string) => void }) {
  const actions = [
    { label: "Explain this workflow", prompt: "Explain what this workflow does step by step." },
    { label: "Suggest improvements", prompt: "Analyze this workflow and suggest improvements for reliability and performance." },
    { label: "Add error handling", prompt: "Add error handling to this workflow. Wrap fetch blocks with retry logic and add fallback paths." },
  ];

  return (
    <div className="flex flex-col gap-2 px-3 pt-4">
      <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
        Quick actions
      </span>
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          onClick={() => onAction(a.prompt)}
          className={cn(
            "w-full rounded-md border border-[hsl(var(--border))] px-3 py-2.5 text-left text-xs",
            "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]",
            "transition-colors",
          )}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

/** Chat input area with send, voice, and cancel controls */
function ChatInput({
  onSend,
  disabled,
  onCancel,
  isThinking,
}: {
  onSend: (msg: string) => void;
  disabled: boolean;
  onCancel: () => void;
  isThinking: boolean;
}) {
  const [value, setValue] = useState("");
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* Detect speech recognition support (client-only) */
  const hasSpeechSupport =
    typeof window !== "undefined" &&
    ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

  const startVoice = useCallback(() => {
    try {
      const Ctor = window.webkitSpeechRecognition ?? window.SpeechRecognition;
      if (!Ctor) return;

      const recognition = new Ctor();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (e: SpeechRecognitionEventLike) => {
        const first = e.results[0];
        const transcript = first?.[0]?.transcript ?? "";
        setValue((prev) => prev + transcript);
        textareaRef.current?.focus();
      };

      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.start();
      setIsListening(true);
    } catch {
      /* Browser doesn't support it — button hidden via hasSpeechSupport */
    }
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      /* Enter sends, Shift+Enter inserts newline */
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  /* Auto-resize textarea */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  return (
    <div className="flex items-end gap-2">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask AI to build or modify your workflow…"
        rows={1}
        disabled={disabled}
        className={cn(
          "flex-1 resize-none rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm",
          "placeholder:text-[hsl(var(--muted-foreground))]",
          "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      />

      {hasSpeechSupport && (
        <button
          type="button"
          onClick={startVoice}
          disabled={disabled || isListening}
          className={cn(
            "rounded-md p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]",
            "disabled:opacity-50",
            isListening && "text-red-500 animate-pulse",
          )}
          title="Voice input"
        >
          <Mic className="h-4 w-4" />
        </button>
      )}

      {isThinking ? (
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md bg-red-100 p-2 text-red-600 hover:bg-red-200"
          title="Stop generation"
        >
          <Square className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!value.trim()}
          className={cn(
            "rounded-md bg-[hsl(var(--primary))] p-2 text-[hsl(var(--primary-foreground))]",
            "hover:bg-[hsl(var(--primary))]/90",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
          title="Send (Enter)"
        >
          <Send className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────── */

/**
 * AI Assistant slide-out panel for the workflow builder.
 * Renders a chat interface with plan display, quick actions,
 * message list, and input area.
 */
export function AIAssistant({
  isOpen,
  onClose,
  messages,
  isThinking,
  currentPlan,
  changesCount,
  onSendMessage,
  onCancelGeneration,
  onClearChat,
  className,
}: AIAssistantProps) {
  const scrollEndRef = useRef<HTMLDivElement>(null);

  /* Auto-scroll to bottom when new messages arrive or while thinking */
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isThinking]);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "flex h-full w-[400px] flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--background))]",
        className,
      )}
    >
      {/* ── Header ─────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-3 py-2.5">
        <Sparkles className="h-4 w-4 text-blue-500" />
        <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
          AI Assistant
        </span>

        {changesCount > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1.5 text-[10px] font-bold text-white">
            {changesCount}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onClearChat}
            className="rounded p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
            title="Clear chat"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
            title="Close (Cmd+K)"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Plan display (sticky) ──────────────── */}
      {currentPlan && (
        <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5">
          <PlanChecklist steps={currentPlan.steps} />
        </div>
      )}

      {/* ── Quick actions (empty state) ────────── */}
      {messages.length === 0 && !isThinking && (
        <QuickActions onAction={onSendMessage} />
      )}

      {/* ── Message list ──────────────────────── */}
      <ScrollArea className="flex-1 px-3 py-3">
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}
        {isThinking && <ThinkingIndicator />}
        <div ref={scrollEndRef} />
      </ScrollArea>

      {/* ── Input area ────────────────────────── */}
      <div className="border-t border-[hsl(var(--border))] px-3 py-3">
        <ChatInput
          onSend={onSendMessage}
          disabled={isThinking}
          onCancel={onCancelGeneration}
          isThinking={isThinking}
        />
      </div>
    </div>
  );
}
