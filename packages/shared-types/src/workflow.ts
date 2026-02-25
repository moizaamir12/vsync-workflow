import type { Block } from "./block.js";

/**
 * Supported trigger mechanisms that can initiate a workflow run.
 * Each trigger type determines how and when a workflow begins execution.
 */
export type TriggerType =
  | "interactive"
  | "api"
  | "schedule"
  | "hook"
  | "vision";

/**
 * Trigger-specific configuration.
 * Only the fields relevant to the chosen TriggerType need to be populated —
 * prefixed by trigger type so consumers can discriminate at the field level.
 */
export interface TriggerConfig {
  /** Cron expression for schedule-triggered workflows (e.g. "0 9 * * MON") */
  schedule_cron?: string;

  /** Inbound URL that external systems POST to for hook-triggered workflows */
  hook_url?: string;

  /** HMAC secret used to verify authenticity of incoming hook payloads */
  hook_secret?: string;

  /** Model identifier for vision-triggered workflows (e.g. "gpt-4o-vision") */
  vision_model?: string;

  /** Arbitrary vision pipeline parameters (resolution, confidence thresholds, etc.) */
  vision_config?: Record<string, unknown>;
}

/**
 * A named group of contiguous blocks inside a workflow version.
 * Groups let authors collapse/expand sections in the designer
 * and provide logical boundaries for error handling.
 */
export interface BlockGroup {
  /** Unique identifier for this group */
  id: string;

  /** Human-readable label shown in the designer */
  name: string;

  /** ID of the first block in this group — inclusive */
  startBlockId: string;

  /** ID of the last block in this group — inclusive */
  endBlockId: string;
}

/**
 * Custom branding configuration for public workflow pages.
 */
export interface PublicBranding {
  title?: string;
  description?: string;
  accentColor?: string;
  logoUrl?: string;
  hideVsyncBranding?: boolean;
}

/**
 * Rate limit configuration for public workflow runs.
 */
export interface PublicRateLimit {
  maxPerMinute: number;
}

/**
 * Top-level workflow entity.
 * A workflow is a reusable automation owned by an organization.
 * It contains one or more versions, only one of which is "active" at a time.
 */
export interface Workflow {
  /** Unique identifier */
  id: string;

  /** Human-readable workflow name */
  name: string;

  /** Optional long-form description of what the workflow does */
  description: string;

  /** Owning organization — used for access control and billing */
  orgId: string;

  /** User ID of the original author */
  createdBy: string;

  /**
   * Version number currently used when new runs are created.
   * Null when no version has been published yet.
   */
  activeVersion: number | null;

  /** Whether the workflow is locked for editing */
  isLocked: boolean;

  /** User ID that holds the edit lock, if any */
  lockedBy: string | null;

  /** Disabled workflows cannot be triggered */
  isDisabled: boolean;

  /** Public workflows are visible to anyone in the organization */
  isPublic: boolean;

  /** URL-safe slug for public access (e.g. "my-cool-workflow-a3xk") */
  publicSlug: string | null;

  /** Access mode: "view" = read-only, "run" = anyone can trigger */
  publicAccessMode: "view" | "run";

  /** Custom branding for the public page */
  publicBranding: PublicBranding | null;

  /** Per-slug rate limit configuration */
  publicRateLimit: PublicRateLimit | null;

  /** ISO-8601 timestamp of creation */
  createdAt: string;

  /** ISO-8601 timestamp of last modification */
  updatedAt: string;
}

/**
 * An immutable snapshot of a workflow's configuration at a point in time.
 * Draft versions can be edited; published versions are frozen.
 */
export interface WorkflowVersion {
  /** Parent workflow this version belongs to */
  workflowId: string;

  /** Monotonically increasing version number (1, 2, 3 …) */
  version: number;

  /** Draft versions are editable; published versions are immutable */
  status: "draft" | "published";

  /** How this workflow version is initiated */
  triggerType: TriggerType;

  /** Trigger-specific settings (cron, hook URL, vision model, etc.) */
  triggerConfig: TriggerConfig;

  /**
   * Target platforms this version is designed to run on.
   * Enables the engine to skip unsupported blocks at plan time.
   */
  executionEnvironments: string[];

  /** Ordered list of blocks that make up this version's logic */
  blocks: Block[];

  /** Logical groupings of blocks for designer UX and error scoping */
  groups: BlockGroup[];

  /** Human-readable summary of changes from the previous version */
  changelog: string;

  /** ISO-8601 timestamp of creation */
  createdAt: string;

  /** ISO-8601 timestamp of last modification */
  updatedAt: string;
}
