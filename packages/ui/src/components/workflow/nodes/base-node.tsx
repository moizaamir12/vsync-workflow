import { memo, type ReactNode } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "../../../lib/utils.js";
import type { WorkflowBlock } from "../../../stores/workflowStore.js";

export interface BlockNodeData {
  block: WorkflowBlock;
  /** Set to true when the AI assistant has modified this block */
  aiModified?: boolean;
  [key: string]: unknown;
}

export interface BaseNodeProps {
  nodeProps: NodeProps;
  accentColor: string;
  icon: ReactNode;
  categoryLabel: string;
}

/**
 * Shared layout for all block node types.
 * Renders source/target handles, icon, name, type label,
 * and a coloured left border accent.
 */
export const BaseNode = memo(function BaseNode({
  nodeProps,
  accentColor,
  icon,
  categoryLabel,
}: BaseNodeProps) {
  const { selected } = nodeProps;
  const data = nodeProps.data as BlockNodeData;
  const block = data.block;

  const hasConditions = block.conditions && Object.keys(block.conditions).length > 0;
  const aiModified = data.aiModified === true;

  return (
    <div
      className={cn(
        "relative min-w-[180px] max-w-[240px] rounded-lg border bg-[hsl(var(--card))] shadow-sm transition-shadow",
        selected
          ? "border-[hsl(var(--ring))] shadow-md ring-2 ring-[hsl(var(--ring))]/20"
          : "border-[hsl(var(--border))]",
      )}
    >
      {/* Coloured accent bar */}
      <div
        className="absolute left-0 top-0 h-full w-1 rounded-l-lg"
        style={{ backgroundColor: accentColor }}
      />

      {/* Target handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-[hsl(var(--background))] !bg-[hsl(var(--border))]"
      />

      {/* Content */}
      <div className="flex items-start gap-2.5 px-3 py-2.5 pl-4">
        <div
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white"
          style={{ backgroundColor: accentColor }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-[hsl(var(--foreground))]">
            {block.name}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              {categoryLabel}
            </span>
            {hasConditions && (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-orange-400" title="Has conditions" />
            )}
            {aiModified && (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" title="Modified by AI" />
            )}
          </div>
        </div>
      </div>

      {/* Source handle (bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-[hsl(var(--background))] !bg-[hsl(var(--border))]"
      />
    </div>
  );
});
