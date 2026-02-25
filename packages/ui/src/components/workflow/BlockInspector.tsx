import { useCallback, useState } from "react";
import { X, Settings2, GitFork, StickyNote, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils.js";
import { useWorkflowStore, type DisclosureLevel } from "../../stores/workflowStore.js";
import { BlockForm } from "./BlockForm.js";
import { ConditionBuilder, type ConditionGroup } from "./ConditionBuilder.js";
import type { VariableOption } from "./SmartInput.js";

/* ── Props ────────────────────────────────────────────────────── */

export interface BlockInspectorProps {
  /** Available variables for autocomplete in forms and conditions */
  variables?: VariableOption[];
  /** Optional test-run callback for code blocks */
  onCodeTestRun?: (code: string, language: string) => Promise<string>;
  /** Additional class names */
  className?: string;
}

/* ── Tab type ────────────────────────────────────────────────── */

type InspectorTab = "configure" | "conditions" | "notes";

interface TabDef {
  id: InspectorTab;
  label: string;
  icon: typeof Settings2;
}

const tabs: TabDef[] = [
  { id: "configure", label: "Configure", icon: Settings2 },
  { id: "conditions", label: "Conditions", icon: GitFork },
  { id: "notes", label: "Notes", icon: StickyNote },
];

/* ── Component ────────────────────────────────────────────────── */

/**
 * Right sidebar inspector panel for the selected block.
 * Contains three tabs: Configure (block-type-specific form),
 * Conditions (visual condition builder), and Notes (free text).
 */
export function BlockInspector({
  variables = [],
  onCodeTestRun,
  className,
}: BlockInspectorProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>("configure");

  /* ── Store selectors ──────────────────────── */

  const selectedBlockId = useWorkflowStore((s) => s.selectedBlockId);
  const block = useWorkflowStore((s) =>
    s.selectedBlockId ? s.blocks.find((b) => b.id === s.selectedBlockId) : undefined,
  );
  const disclosureLevel = useWorkflowStore((s) => s.disclosureLevel);
  const setDisclosureLevel = useWorkflowStore((s) => s.setDisclosureLevel);
  const updateBlockLogic = useWorkflowStore((s) => s.updateBlockLogic);
  const updateBlockName = useWorkflowStore((s) => s.updateBlockName);
  const updateBlockNotes = useWorkflowStore((s) => s.updateBlockNotes);
  const updateBlockConditions = useWorkflowStore((s) => s.updateBlockConditions);
  const deselectAll = useWorkflowStore((s) => s.deselectAll);

  /* ── Handlers ─────────────────────────────── */

  const handleLogicChange = useCallback(
    (logic: Record<string, unknown>) => {
      if (!selectedBlockId) return;
      updateBlockLogic(selectedBlockId, logic);
    },
    [selectedBlockId, updateBlockLogic],
  );

  const handleNameChange = useCallback(
    (name: string) => {
      if (!selectedBlockId) return;
      updateBlockName(selectedBlockId, name);
    },
    [selectedBlockId, updateBlockName],
  );

  const handleNotesChange = useCallback(
    (notes: string) => {
      if (!selectedBlockId) return;
      updateBlockNotes(selectedBlockId, notes);
    },
    [selectedBlockId, updateBlockNotes],
  );

  const handleConditionsChange = useCallback(
    (groups: ConditionGroup[]) => {
      if (!selectedBlockId) return;
      updateBlockConditions(selectedBlockId, { groups });
    },
    [selectedBlockId, updateBlockConditions],
  );

  /* ── Empty state ──────────────────────────── */

  if (!block) {
    return (
      <div
        className={cn(
          "flex h-full w-80 flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))]",
          className,
        )}
      >
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
            Select a block to configure
          </p>
        </div>
      </div>
    );
  }

  const conditionGroups: ConditionGroup[] =
    (block.conditions?.["groups"] as ConditionGroup[]) ?? [];

  const inputCn = cn(
    "w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]",
    "px-3 py-1.5 text-sm text-[hsl(var(--foreground))]",
    "placeholder:text-[hsl(var(--muted-foreground))]",
    "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]",
  );

  return (
    <div
      className={cn(
        "flex h-full w-80 flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))]",
        className,
      )}
      /* Prevent canvas keyboard shortcuts while editing in the inspector */
      onFocus={() => useWorkflowStore.getState().setCanvasHasFocus(false)}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] p-3">
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={block.name}
            onChange={(e) => handleNameChange(e.target.value)}
            className={cn(
              "w-full bg-transparent text-sm font-semibold text-[hsl(var(--foreground))]",
              "border-none p-0 focus:outline-none focus:ring-0",
            )}
          />
          <span className="text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            {block.type}
          </span>
        </div>

        {/* Disclosure level picker */}
        <div className="relative">
          <select
            value={disclosureLevel}
            onChange={(e) => setDisclosureLevel(e.target.value as DisclosureLevel)}
            className={cn(
              "appearance-none rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]",
              "py-1 pl-2 pr-6 text-[10px] font-medium text-[hsl(var(--muted-foreground))]",
              "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]",
            )}
          >
            <option value="simple">Simple</option>
            <option value="standard">Standard</option>
            <option value="advanced">Advanced</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={deselectAll}
          className="rounded-md p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-[hsl(var(--border))]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-medium",
                "border-b-2 transition-colors",
                isActive
                  ? "border-[hsl(var(--primary))] text-[hsl(var(--foreground))]"
                  : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.id === "conditions" && conditionGroups.length > 0 && (
                <span className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-orange-400 text-[9px] font-bold text-white">
                  {conditionGroups.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Configure tab */}
        {activeTab === "configure" && (
          <BlockForm
            block={block}
            onChange={handleLogicChange}
            level={disclosureLevel}
            onCodeTestRun={onCodeTestRun}
          />
        )}

        {/* Conditions tab */}
        {activeTab === "conditions" && (
          <div className="space-y-3">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Define conditions that must be met for this block to execute.
              If no conditions are set, the block always runs.
            </p>
            <ConditionBuilder
              groups={conditionGroups}
              onChange={handleConditionsChange}
              variables={variables}
            />
          </div>
        )}

        {/* Notes tab */}
        {activeTab === "notes" && (
          <div className="space-y-2">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Add notes or documentation for this block.
            </p>
            <textarea
              value={block.notes ?? ""}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Add notes about this block…"
              rows={8}
              className={cn(inputCn, "resize-y")}
            />
          </div>
        )}
      </div>
    </div>
  );
}
