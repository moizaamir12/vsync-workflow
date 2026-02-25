import { useState, useMemo, useCallback, type DragEvent } from "react";
import {
  Database,
  GitBranch,
  Globe,
  MonitorSmartphone,
  Cpu,
  Search,
  Braces,
  Type,
  List,
  Calculator,
  Calendar,
  Filter,
  Code,
  ArrowRight,
  Clock,
  Radio,
  Camera,
  Table2,
  FileText,
  Image,
  HardDrive,
  Upload,
  Video,
  MapPin,
  Bot,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../lib/utils.js";
import type { BlockType } from "../../stores/workflowStore.js";

/* ── Block definition ────────────────────────────────────────── */

export interface PaletteBlockDef {
  type: BlockType;
  label: string;
  description: string;
  icon: LucideIcon;
  category: BlockCategory;
  /** Platforms where this block is supported */
  platforms?: string[];
}

export type BlockCategory = "data" | "flow" | "integration" | "ui" | "platform";

interface CategoryDef {
  id: BlockCategory;
  label: string;
  icon: LucideIcon;
  accentColor: string;
}

/* ── Category definitions ────────────────────────────────────── */

const categories: CategoryDef[] = [
  { id: "data", label: "Data", icon: Database, accentColor: "#6366f1" },
  { id: "flow", label: "Flow", icon: GitBranch, accentColor: "#f59e0b" },
  { id: "integration", label: "Integration", icon: Globe, accentColor: "#10b981" },
  { id: "ui", label: "UI", icon: MonitorSmartphone, accentColor: "#ec4899" },
  { id: "platform", label: "Platform", icon: Cpu, accentColor: "#8b5cf6" },
];

/* ── Block registry ──────────────────────────────────────────── */

const allBlocks: PaletteBlockDef[] = [
  /* Data blocks */
  { type: "object", label: "Set Object", description: "Create or transform an object", icon: Braces, category: "data" },
  { type: "string", label: "Format String", description: "String interpolation and formatting", icon: Type, category: "data" },
  { type: "array", label: "Array", description: "Map, filter, sort, reduce arrays", icon: List, category: "data" },
  { type: "math", label: "Math", description: "Arithmetic and math operations", icon: Calculator, category: "data" },
  { type: "date", label: "Date", description: "Parse, format, and calculate dates", icon: Calendar, category: "data" },
  { type: "normalize", label: "Normalize", description: "Clean and normalize data", icon: Filter, category: "data" },
  { type: "code", label: "Code", description: "Run custom JavaScript / TypeScript", icon: Code, category: "data" },

  /* Flow blocks */
  { type: "goto", label: "Go To", description: "Jump to another block", icon: ArrowRight, category: "flow" },
  { type: "sleep", label: "Wait", description: "Pause execution for a duration", icon: Clock, category: "flow" },

  /* Integration blocks */
  { type: "fetch", label: "HTTP Request", description: "Make HTTP/REST API calls", icon: Radio, category: "integration" },
  { type: "agent", label: "AI Agent", description: "Call an AI model or agent", icon: Bot, category: "integration" },

  /* UI blocks */
  { type: "ui_form", label: "Form", description: "Capture user input via forms", icon: FileText, category: "ui", platforms: ["mobile", "web"] },
  { type: "ui_camera", label: "Camera", description: "Capture photos or video", icon: Camera, category: "ui", platforms: ["mobile"] },
  { type: "ui_table", label: "Table", description: "Display data in a table", icon: Table2, category: "ui", platforms: ["mobile", "web"] },
  { type: "ui_details", label: "Details", description: "Display detail view", icon: FileText, category: "ui", platforms: ["mobile", "web"] },

  /* Platform blocks */
  { type: "image", label: "Image", description: "Process and transform images", icon: Image, category: "platform" },
  { type: "filesystem", label: "File System", description: "Read and write files", icon: HardDrive, category: "platform", platforms: ["node", "mobile"] },
  { type: "ftp", label: "FTP", description: "Upload/download via FTP/SFTP", icon: Upload, category: "platform", platforms: ["node", "cloud"] },
  { type: "video", label: "Video", description: "Video capture and processing", icon: Video, category: "platform", platforms: ["mobile"] },
  { type: "location", label: "Location", description: "GPS and geolocation", icon: MapPin, category: "platform", platforms: ["mobile"] },
];

/* ── Props ────────────────────────────────────────────────────── */

export interface BlockPaletteProps {
  /** Optional platform filter to show compatible blocks */
  platform?: string;
  /** Additional class names */
  className?: string;
}

/* ── Component ────────────────────────────────────────────────── */

/**
 * Sidebar panel listing all available block types grouped by category.
 * Blocks can be dragged onto the WorkflowCanvas to add them.
 */
export function BlockPalette({ platform, className }: BlockPaletteProps) {
  const [search, setSearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<BlockCategory>>(
    () => new Set(categories.map((c) => c.id)),
  );

  /* ── Filter blocks by search and platform ──── */

  const filteredBlocks = useMemo(() => {
    const query = search.toLowerCase().trim();

    return allBlocks.filter((b) => {
      /* Platform filter */
      if (platform && b.platforms && !b.platforms.includes(platform)) {
        return false;
      }
      /* Search filter */
      if (query) {
        return (
          b.label.toLowerCase().includes(query) ||
          b.description.toLowerCase().includes(query) ||
          b.type.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [search, platform]);

  /* ── Group blocks by category ──────────────── */

  const grouped = useMemo(() => {
    const map = new Map<BlockCategory, PaletteBlockDef[]>();
    for (const cat of categories) {
      const blocks = filteredBlocks.filter((b) => b.category === cat.id);
      if (blocks.length > 0) {
        map.set(cat.id, blocks);
      }
    }
    return map;
  }, [filteredBlocks]);

  /* ── Toggle category expansion ─────────────── */

  const toggleCategory = useCallback((id: BlockCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  /* ── Drag start handler ────────────────────── */

  const onDragStart = useCallback(
    (event: DragEvent<HTMLDivElement>, type: BlockType) => {
      event.dataTransfer.setData("application/vsync-block-type", type);
      event.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  return (
    <div
      className={cn(
        "flex h-full w-64 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))]",
        className,
      )}
    >
      {/* Search bar */}
      <div className="border-b border-[hsl(var(--border))] p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search blocks…"
            className={cn(
              "w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]",
              "py-1.5 pl-8 pr-3 text-sm text-[hsl(var(--foreground))]",
              "placeholder:text-[hsl(var(--muted-foreground))]",
              "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]",
            )}
          />
        </div>
      </div>

      {/* Category list */}
      <div className="flex-1 overflow-y-auto p-2">
        {categories.map((cat) => {
          const blocks = grouped.get(cat.id);
          if (!blocks) return null;

          const isExpanded = expandedCategories.has(cat.id);
          const CatIcon = cat.icon;

          return (
            <div key={cat.id} className="mb-1">
              {/* Category header */}
              <button
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold uppercase tracking-wider",
                  "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]",
                  "transition-colors",
                )}
              >
                <CatIcon className="h-3.5 w-3.5" style={{ color: cat.accentColor }} />
                <span className="flex-1 text-left">{cat.label}</span>
                <span className="text-[10px] font-normal tabular-nums">{blocks.length}</span>
                <svg
                  className={cn(
                    "h-3 w-3 transition-transform",
                    isExpanded ? "rotate-0" : "-rotate-90",
                  )}
                  viewBox="0 0 12 12"
                  fill="currentColor"
                >
                  <path d="M2 4l4 4 4-4z" />
                </svg>
              </button>

              {/* Block list */}
              {isExpanded && (
                <div className="mt-0.5 space-y-0.5 pb-1">
                  {blocks.map((block) => {
                    const Icon = block.icon;
                    return (
                      <div
                        key={block.type}
                        draggable
                        onDragStart={(e) => onDragStart(e, block.type)}
                        className={cn(
                          "group flex cursor-grab items-center gap-2.5 rounded-md px-2 py-2",
                          "border border-transparent",
                          "hover:border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]",
                          "active:cursor-grabbing active:opacity-70",
                          "transition-all",
                        )}
                      >
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white"
                          style={{ backgroundColor: cat.accentColor }}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-[hsl(var(--foreground))]">
                            {block.label}
                          </div>
                          <div className="truncate text-[10px] text-[hsl(var(--muted-foreground))]">
                            {block.description}
                          </div>
                        </div>
                        {block.platforms && (
                          <div className="flex gap-0.5">
                            {block.platforms.map((p) => (
                              <span
                                key={p}
                                className={cn(
                                  "rounded-sm px-1 py-0.5 text-[8px] font-medium uppercase",
                                  "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
                                )}
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filteredBlocks.length === 0 && (
          <div className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
            No blocks match &ldquo;{search}&rdquo;
          </div>
        )}
      </div>
    </div>
  );
}

export { allBlocks, categories };
