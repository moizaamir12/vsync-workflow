import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Ban,
  PauseCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../lib/utils.js";
import { Badge, type BadgeProps } from "../primitives/Badge.js";

/* ── Status definitions ───────────────────────────────────────── */

interface StatusConfig {
  label: string;
  variant: NonNullable<BadgeProps["variant"]>;
  icon: LucideIcon;
  iconClassName?: string;
}

const runStatusMap: Record<string, StatusConfig> = {
  pending: {
    label: "Pending",
    variant: "secondary",
    icon: Clock,
  },
  running: {
    label: "Running",
    variant: "info",
    icon: Loader2,
    iconClassName: "animate-spin",
  },
  completed: {
    label: "Completed",
    variant: "success",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    variant: "destructive",
    icon: XCircle,
  },
  cancelled: {
    label: "Cancelled",
    variant: "secondary",
    icon: Ban,
  },
  awaiting_action: {
    label: "Awaiting Action",
    variant: "warning",
    icon: PauseCircle,
  },
};

const workflowStatusMap: Record<string, StatusConfig> = {
  draft: {
    label: "Draft",
    variant: "secondary",
    icon: Clock,
  },
  published: {
    label: "Published",
    variant: "success",
    icon: CheckCircle2,
  },
  disabled: {
    label: "Disabled",
    variant: "destructive",
    icon: Ban,
  },
};

/* ── Component ────────────────────────────────────────────────── */

export interface StatusBadgeProps {
  /** The status value */
  status: string;
  /** Which status map to use */
  type?: "run" | "workflow";
  /** Override the default label */
  label?: string;
  /** Additional class names */
  className?: string;
}

/**
 * Renders a colour-coded badge with an icon for a run or workflow status.
 *
 * ```tsx
 * <StatusBadge status="running" type="run" />
 * <StatusBadge status="published" type="workflow" />
 * ```
 */
function StatusBadge({
  status,
  type = "run",
  label: overrideLabel,
  className,
}: StatusBadgeProps) {
  const map = type === "workflow" ? workflowStatusMap : runStatusMap;
  const config = map[status];

  if (!config) {
    return (
      <Badge variant="outline" className={className}>
        {overrideLabel ?? status}
      </Badge>
    );
  }

  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={cn("gap-1", className)}>
      <Icon className={cn("h-3 w-3", config.iconClassName)} />
      {overrideLabel ?? config.label}
    </Badge>
  );
}

export { StatusBadge };
