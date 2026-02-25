import { useCallback } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { cn } from "../../lib/utils.js";
import type { VariableOption } from "./SmartInput.js";

/* ── Types ────────────────────────────────────────────────────── */

export type ConditionOperator =
  | "eq" | "neq" | "gt" | "gte" | "lt" | "lte"
  | "contains" | "not_contains" | "starts_with" | "ends_with"
  | "is_empty" | "is_not_empty"
  | "regex" | "in" | "not_in";

export type ConditionJoin = "and" | "or";

export interface ConditionRow {
  id: string;
  variable: string;
  operator: ConditionOperator;
  value: string;
}

export interface ConditionGroup {
  id: string;
  join: ConditionJoin;
  conditions: ConditionRow[];
}

export interface ConditionBuilderProps {
  /** Current condition groups */
  groups: ConditionGroup[];
  /** Change handler */
  onChange: (groups: ConditionGroup[]) => void;
  /** Available variables for the variable picker */
  variables?: VariableOption[];
  /** Additional class names */
  className?: string;
}

/* ── Operator definitions ────────────────────────────────────── */

interface OperatorDef {
  value: ConditionOperator;
  label: string;
  /** Whether this operator needs a value input */
  needsValue: boolean;
}

const operators: OperatorDef[] = [
  { value: "eq", label: "equals", needsValue: true },
  { value: "neq", label: "not equals", needsValue: true },
  { value: "gt", label: ">", needsValue: true },
  { value: "gte", label: ">=", needsValue: true },
  { value: "lt", label: "<", needsValue: true },
  { value: "lte", label: "<=", needsValue: true },
  { value: "contains", label: "contains", needsValue: true },
  { value: "not_contains", label: "not contains", needsValue: true },
  { value: "starts_with", label: "starts with", needsValue: true },
  { value: "ends_with", label: "ends with", needsValue: true },
  { value: "is_empty", label: "is empty", needsValue: false },
  { value: "is_not_empty", label: "is not empty", needsValue: false },
  { value: "regex", label: "matches regex", needsValue: true },
  { value: "in", label: "in list", needsValue: true },
  { value: "not_in", label: "not in list", needsValue: true },
];

/* ── ID generator ────────────────────────────────────────────── */

function makeConditionId(): string {
  return `cond_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/* ── Component ────────────────────────────────────────────────── */

/**
 * Visual condition builder with groups (AND/OR), operators, and variable pickers.
 */
export function ConditionBuilder({
  groups,
  onChange,
  variables = [],
  className,
}: ConditionBuilderProps) {
  /* ── Group CRUD ────────────────────────────── */

  const addGroup = useCallback(() => {
    onChange([
      ...groups,
      {
        id: makeConditionId(),
        join: "and",
        conditions: [
          { id: makeConditionId(), variable: "", operator: "eq", value: "" },
        ],
      },
    ]);
  }, [groups, onChange]);

  const removeGroup = useCallback(
    (groupId: string) => {
      onChange(groups.filter((g) => g.id !== groupId));
    },
    [groups, onChange],
  );

  const updateGroupJoin = useCallback(
    (groupId: string, join: ConditionJoin) => {
      onChange(
        groups.map((g) => (g.id === groupId ? { ...g, join } : g)),
      );
    },
    [groups, onChange],
  );

  /* ── Row CRUD ──────────────────────────────── */

  const addRow = useCallback(
    (groupId: string) => {
      onChange(
        groups.map((g) => {
          if (g.id !== groupId) return g;
          return {
            ...g,
            conditions: [
              ...g.conditions,
              { id: makeConditionId(), variable: "", operator: "eq" as ConditionOperator, value: "" },
            ],
          };
        }),
      );
    },
    [groups, onChange],
  );

  const removeRow = useCallback(
    (groupId: string, rowId: string) => {
      onChange(
        groups.map((g) => {
          if (g.id !== groupId) return g;
          return {
            ...g,
            conditions: g.conditions.filter((c) => c.id !== rowId),
          };
        }),
      );
    },
    [groups, onChange],
  );

  const updateRow = useCallback(
    (groupId: string, rowId: string, patch: Partial<ConditionRow>) => {
      onChange(
        groups.map((g) => {
          if (g.id !== groupId) return g;
          return {
            ...g,
            conditions: g.conditions.map((c) =>
              c.id === rowId ? { ...c, ...patch } : c,
            ),
          };
        }),
      );
    },
    [groups, onChange],
  );

  /* ── Get operator definition ───────────────── */

  const getOperatorDef = useCallback((op: ConditionOperator): OperatorDef => {
    return operators.find((o) => o.value === op) ?? operators[0]!;
  }, []);

  /* ── Render ────────────────────────────────── */

  return (
    <div className={cn("space-y-3", className)}>
      {groups.map((group, gi) => (
        <div
          key={group.id}
          className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3"
        >
          {/* Group header */}
          <div className="mb-2 flex items-center gap-2">
            {gi > 0 && (
              <span className="text-xs font-semibold uppercase text-[hsl(var(--muted-foreground))]">
                OR
              </span>
            )}
            <div className="flex items-center gap-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-0.5">
              <button
                type="button"
                onClick={() => updateGroupJoin(group.id, "and")}
                className={cn(
                  "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                  group.join === "and"
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
                )}
              >
                AND
              </button>
              <button
                type="button"
                onClick={() => updateGroupJoin(group.id, "or")}
                className={cn(
                  "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                  group.join === "or"
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
                )}
              >
                OR
              </button>
            </div>

            <div className="flex-1" />

            <button
              type="button"
              onClick={() => removeGroup(group.id)}
              className="rounded-md p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--destructive))]"
              title="Remove group"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Condition rows */}
          <div className="space-y-1.5">
            {group.conditions.map((row, ri) => {
              const opDef = getOperatorDef(row.operator);
              return (
                <div key={row.id} className="flex items-center gap-1.5">
                  <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-[hsl(var(--muted-foreground))]" />

                  {/* Join label */}
                  {ri > 0 && (
                    <span className="w-8 shrink-0 text-center text-[10px] font-semibold uppercase text-[hsl(var(--muted-foreground))]">
                      {group.join}
                    </span>
                  )}
                  {ri === 0 && <span className="w-8 shrink-0" />}

                  {/* Variable picker */}
                  <select
                    value={row.variable}
                    onChange={(e) =>
                      updateRow(group.id, row.id, { variable: e.target.value })
                    }
                    className={cn(
                      "min-w-[120px] flex-1 rounded-md border border-[hsl(var(--border))]",
                      "bg-[hsl(var(--card))] px-2 py-1.5 text-xs text-[hsl(var(--foreground))]",
                      "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]",
                    )}
                  >
                    <option value="">Select variable…</option>
                    {variables.map((v) => (
                      <option key={v.path} value={v.path}>
                        {v.label || v.path}
                      </option>
                    ))}
                  </select>

                  {/* Operator */}
                  <select
                    value={row.operator}
                    onChange={(e) =>
                      updateRow(group.id, row.id, {
                        operator: e.target.value as ConditionOperator,
                      })
                    }
                    className={cn(
                      "w-[130px] shrink-0 rounded-md border border-[hsl(var(--border))]",
                      "bg-[hsl(var(--card))] px-2 py-1.5 text-xs text-[hsl(var(--foreground))]",
                      "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]",
                    )}
                  >
                    {operators.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>

                  {/* Value input (hidden for is_empty / is_not_empty) */}
                  {opDef.needsValue && (
                    <input
                      type="text"
                      value={row.value}
                      onChange={(e) =>
                        updateRow(group.id, row.id, { value: e.target.value })
                      }
                      placeholder="Value…"
                      className={cn(
                        "min-w-[100px] flex-1 rounded-md border border-[hsl(var(--border))]",
                        "bg-[hsl(var(--card))] px-2 py-1.5 text-xs font-mono text-[hsl(var(--foreground))]",
                        "placeholder:text-[hsl(var(--muted-foreground))]",
                        "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]",
                      )}
                    />
                  )}

                  {/* Remove row */}
                  <button
                    type="button"
                    onClick={() => removeRow(group.id, row.id)}
                    className="shrink-0 rounded-md p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--destructive))]"
                    title="Remove condition"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Add row button */}
          <button
            type="button"
            onClick={() => addRow(group.id)}
            className={cn(
              "mt-2 flex items-center gap-1 rounded-md px-2 py-1 text-xs",
              "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]",
              "transition-colors",
            )}
          >
            <Plus className="h-3 w-3" />
            Add condition
          </button>
        </div>
      ))}

      {/* Add group button */}
      <button
        type="button"
        onClick={addGroup}
        className={cn(
          "flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed",
          "border-[hsl(var(--border))] py-2.5 text-xs font-medium",
          "text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--ring))] hover:text-[hsl(var(--foreground))]",
          "transition-colors",
        )}
      >
        <Plus className="h-3.5 w-3.5" />
        Add condition group
      </button>
    </div>
  );
}
