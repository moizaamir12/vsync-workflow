import type { DisclosureLevel, WorkflowBlock } from "../../stores/workflowStore.js";

/* ── Per-block-type form imports ─────────────────────────────── */

import { ObjectBlockForm } from "./forms/ObjectBlockForm.js";
import { StringBlockForm } from "./forms/StringBlockForm.js";
import { ArrayBlockForm } from "./forms/ArrayBlockForm.js";
import { MathBlockForm } from "./forms/MathBlockForm.js";
import { DateBlockForm } from "./forms/DateBlockForm.js";
import { NormalizeBlockForm } from "./forms/NormalizeBlockForm.js";
import { CodeBlockForm } from "./forms/CodeBlockForm.js";
import { FetchBlockForm } from "./forms/FetchBlockForm.js";
import { AgentBlockForm } from "./forms/AgentBlockForm.js";
import { GotoBlockForm } from "./forms/GotoBlockForm.js";
import { SleepBlockForm } from "./forms/SleepBlockForm.js";
import { UIFormBlockForm } from "./forms/UIFormBlockForm.js";
import { UITableBlockForm } from "./forms/UITableBlockForm.js";
import { UICameraBlockForm } from "./forms/UICameraBlockForm.js";
import { UIDetailsBlockForm } from "./forms/UIDetailsBlockForm.js";
import { ImageBlockForm } from "./forms/ImageBlockForm.js";
import { FilesystemBlockForm } from "./forms/FilesystemBlockForm.js";
import { FTPBlockForm } from "./forms/FTPBlockForm.js";
import { VideoBlockForm } from "./forms/VideoBlockForm.js";
import { LocationBlockForm } from "./forms/LocationBlockForm.js";

/* ── Props ────────────────────────────────────────────────────── */

export interface BlockFormProps {
  /** The block being configured */
  block: WorkflowBlock;
  /** Called when logic properties change */
  onChange: (logic: Record<string, unknown>) => void;
  /** Current disclosure level */
  level: DisclosureLevel;
  /** Optional test-run callback for code blocks */
  onCodeTestRun?: (code: string, language: string) => Promise<string>;
}

/* ── Component ────────────────────────────────────────────────── */

/**
 * Switch component that renders the appropriate per-type form
 * based on the block's `type` property.
 */
export function BlockForm({ block, onChange, level, onCodeTestRun }: BlockFormProps) {
  switch (block.type) {
    /* ── Data blocks ─────────────────────────── */
    case "object":
      return <ObjectBlockForm block={block} onChange={onChange} level={level} />;
    case "string":
      return <StringBlockForm block={block} onChange={onChange} level={level} />;
    case "array":
      return <ArrayBlockForm block={block} onChange={onChange} level={level} />;
    case "math":
      return <MathBlockForm block={block} onChange={onChange} level={level} />;
    case "date":
      return <DateBlockForm block={block} onChange={onChange} level={level} />;
    case "normalize":
      return <NormalizeBlockForm block={block} onChange={onChange} level={level} />;
    case "code":
      return (
        <CodeBlockForm
          block={block}
          onChange={onChange}
          level={level}
          onTestRun={onCodeTestRun}
        />
      );

    /* ── Flow blocks ─────────────────────────── */
    case "goto":
      return <GotoBlockForm block={block} onChange={onChange} level={level} />;
    case "sleep":
      return <SleepBlockForm block={block} onChange={onChange} level={level} />;

    /* ── Integration blocks ──────────────────── */
    case "fetch":
      return <FetchBlockForm block={block} onChange={onChange} level={level} />;
    case "agent":
      return <AgentBlockForm block={block} onChange={onChange} level={level} />;

    /* ── UI blocks ───────────────────────────── */
    case "ui_form":
      return <UIFormBlockForm block={block} onChange={onChange} level={level} />;
    case "ui_table":
      return <UITableBlockForm block={block} onChange={onChange} level={level} />;
    case "ui_camera":
      return <UICameraBlockForm block={block} onChange={onChange} level={level} />;
    case "ui_details":
      return <UIDetailsBlockForm block={block} onChange={onChange} level={level} />;

    /* ── Platform blocks ─────────────────────── */
    case "image":
      return <ImageBlockForm block={block} onChange={onChange} level={level} />;
    case "filesystem":
      return <FilesystemBlockForm block={block} onChange={onChange} level={level} />;
    case "ftp":
      return <FTPBlockForm block={block} onChange={onChange} level={level} />;
    case "video":
      return <VideoBlockForm block={block} onChange={onChange} level={level} />;
    case "location":
      return <LocationBlockForm block={block} onChange={onChange} level={level} />;

    default: {
      /* Exhaustive check — future block types surface a compile error */
      const _exhaustive: never = block.type;
      return (
        <div className="py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
          No form available for block type &ldquo;{_exhaustive}&rdquo;
        </div>
      );
    }
  }
}
