"use client";

import { useState, useCallback, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Layers,
  Play,
  Zap,
  Globe,
  ScanBarcode,
  Database,
  Code2,
  ClipboardList,
  Clock,
  Check,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Rocket,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { TriggerType, BlockType } from "@vsync/shared-types";

/* ── Constants ──────────────────────────────────────────────────── */

const ONBOARDING_KEY = "vsync:onboarding-complete";
const TOTAL_STEPS = 5;

/* ── Template definitions ───────────────────────────────────────── */

interface TemplateBlock {
  name: string;
  type: BlockType;
  logic: Record<string, unknown>;
  order: number;
  notes?: string;
}

interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  category: string;
  blockCount: number;
  triggerType: TriggerType;
  triggerConfig: Record<string, unknown>;
  blocks: TemplateBlock[];
  customizable?: {
    label: string;
    key: string;
    type: "text" | "textarea" | "select";
    defaultValue: string;
    placeholder?: string;
    options?: string[];
    description?: string;
  }[];
}

const TEMPLATES: TemplateDefinition[] = [
  {
    id: "hello-api",
    name: "Hello API",
    description: "Simple GET request that displays data",
    icon: Globe,
    category: "Getting Started",
    blockCount: 3,
    triggerType: "interactive",
    triggerConfig: {},
    blocks: [
      {
        name: "Fetch API Data",
        type: "fetch",
        logic: {
          fetch_url: "https://jsonplaceholder.typicode.com/posts/1",
          fetch_method: "GET",
          fetch_bind_value: "apiResponse",
        },
        order: 0,
      },
      {
        name: "Extract Fields",
        type: "object",
        logic: {
          object_operation: "create",
          object_value: {
            title: "$state.apiResponse.title",
            body: "$state.apiResponse.body",
          },
          object_bind_value: "display",
        },
        order: 1,
      },
      {
        name: "Show Result",
        type: "ui_details",
        logic: {
          ui_details_title: "API Response",
          ui_details_data: "$state.display",
          ui_details_layout: "card",
          ui_details_fields: [
            { key: "title", label: "Title" },
            { key: "body", label: "Body" },
          ],
        },
        order: 2,
      },
    ],
    customizable: [
      {
        label: "API URL",
        key: "fetch_url",
        type: "text",
        defaultValue: "https://jsonplaceholder.typicode.com/posts/1",
        placeholder: "https://api.example.com/data",
        description: "The URL to fetch data from",
      },
    ],
  },
  {
    id: "barcode-scanner",
    name: "Barcode Scanner",
    description: "Camera scan, extract, and display results",
    icon: ScanBarcode,
    category: "Logistics",
    blockCount: 4,
    triggerType: "interactive",
    triggerConfig: {},
    blocks: [
      {
        name: "Scan Barcode",
        type: "ui_camera",
        logic: {
          ui_camera_title: "Scan Barcode",
          ui_camera_instructions: "Point the camera at a barcode to scan it",
          ui_camera_mode: "barcode",
          ui_camera_bind_value: "scan",
        },
        order: 0,
      },
      {
        name: "Extract Tracking Number",
        type: "string",
        logic: {
          string_input: "$state.scan.barcodes[0].value",
          string_operation: "extract",
          string_extract_mode: "number",
          string_bind_value: "trackingNumber",
        },
        order: 1,
      },
      {
        name: "Look Up Package",
        type: "fetch",
        logic: {
          fetch_url:
            "https://jsonplaceholder.typicode.com/posts/$state.trackingNumber",
          fetch_method: "GET",
          fetch_bind_value: "packageInfo",
        },
        order: 2,
      },
      {
        name: "Show Package Info",
        type: "ui_details",
        logic: {
          ui_details_title: "Package Info",
          ui_details_data: "$state.packageInfo",
          ui_details_layout: "card",
          ui_details_fields: [
            { key: "id", label: "Tracking #" },
            { key: "title", label: "Description" },
            { key: "body", label: "Details" },
          ],
        },
        order: 3,
      },
    ],
    customizable: [],
  },
  {
    id: "data-transform",
    name: "Data Transform",
    description: "Fetch JSON, transform, and display in a table",
    icon: Database,
    category: "Data Processing",
    blockCount: 4,
    triggerType: "interactive",
    triggerConfig: {},
    blocks: [
      {
        name: "Fetch Posts",
        type: "fetch",
        logic: {
          fetch_url: "https://jsonplaceholder.typicode.com/posts",
          fetch_method: "GET",
          fetch_bind_value: "posts",
        },
        order: 0,
      },
      {
        name: "Filter by User",
        type: "array",
        logic: {
          array_operation: "filter",
          array_input: "$state.posts",
          array_filter_mode: "match",
          array_filter_field: "userId",
          array_filter_operator: "==",
          array_filter_value: 1,
          array_bind_value: "filtered",
        },
        order: 1,
      },
      {
        name: "Extract Titles",
        type: "array",
        logic: {
          array_operation: "pluck",
          array_input: "$state.filtered",
          array_pluck_field: "title",
          array_bind_value: "titles",
        },
        order: 2,
      },
      {
        name: "Show Results Table",
        type: "ui_table",
        logic: {
          ui_table_title: "User Posts",
          ui_table_data: "$state.filtered",
          ui_table_columns: [
            { key: "id", label: "ID" },
            { key: "title", label: "Title" },
          ],
          ui_table_searchable: true,
        },
        order: 3,
      },
    ],
    customizable: [
      {
        label: "API URL",
        key: "fetch_url",
        type: "text",
        defaultValue: "https://jsonplaceholder.typicode.com/posts",
        placeholder: "https://api.example.com/items",
        description: "The API endpoint to fetch the list from",
      },
    ],
  },
  {
    id: "custom-code",
    name: "Custom Code",
    description: "Write JS code to process data",
    icon: Code2,
    category: "Custom Code",
    blockCount: 3,
    triggerType: "interactive",
    triggerConfig: {},
    blocks: [
      {
        name: "Setup Data",
        type: "object",
        logic: {
          object_operation: "create",
          object_value: {
            items: [10, 25, 30, 15, 42],
            label: "Sales Data",
          },
          object_bind_value: "data",
        },
        order: 0,
      },
      {
        name: "Process Data",
        type: "code",
        logic: {
          code_source:
            'const items = state.data.items;\nconst sum = items.reduce((a, b) => a + b, 0);\nconst avg = sum / items.length;\nconst max = Math.max(...items);\nstate.result = { sum, average: avg.toFixed(2), max, count: items.length };\nreturn state.result;',
          code_language: "javascript",
          code_timeout_ms: 5000,
          code_bind_value: "result",
        },
        order: 1,
      },
      {
        name: "Show Analysis",
        type: "ui_details",
        logic: {
          ui_details_title: "Analysis Result",
          ui_details_data: "$state.result",
          ui_details_layout: "grid",
          ui_details_fields: [
            { key: "sum", label: "Total", format: "number" },
            { key: "average", label: "Average", format: "number" },
            { key: "max", label: "Maximum", format: "number" },
            { key: "count", label: "Item Count", format: "number" },
          ],
        },
        order: 2,
      },
    ],
    customizable: [
      {
        label: "Code",
        key: "code_source",
        type: "textarea",
        defaultValue:
          'const items = state.data.items;\nconst sum = items.reduce((a, b) => a + b, 0);\nconst avg = sum / items.length;\nconst max = Math.max(...items);\nstate.result = { sum, average: avg.toFixed(2), max, count: items.length };\nreturn state.result;',
        description: "JavaScript code to process the data",
      },
    ],
  },
  {
    id: "form-collector",
    name: "Form Collector",
    description: "Show form, collect data, and display summary",
    icon: ClipboardList,
    category: "Logistics",
    blockCount: 3,
    triggerType: "interactive",
    triggerConfig: {},
    blocks: [
      {
        name: "Package Intake Form",
        type: "ui_form",
        logic: {
          ui_form_title: "Package Intake Form",
          ui_form_fields: [
            { key: "sender", label: "Sender Name", type: "text", required: true },
            {
              key: "recipient",
              label: "Recipient Name",
              type: "text",
              required: true,
            },
            {
              key: "weight",
              label: "Weight (kg)",
              type: "number",
              required: true,
            },
            {
              key: "priority",
              label: "Priority",
              type: "select",
              required: true,
              options: ["Standard", "Express", "Overnight"],
            },
          ],
          ui_form_submit_label: "Submit Package",
          ui_form_bind_value: "formData",
        },
        order: 0,
      },
      {
        name: "Prepare Record",
        type: "object",
        logic: {
          object_operation: "merge",
          object_sources: [
            "$state.formData",
            { status: "received", timestamp: "$now" },
          ],
          object_bind_value: "package",
        },
        order: 1,
      },
      {
        name: "Show Confirmation",
        type: "ui_details",
        logic: {
          ui_details_title: "Package Submitted",
          ui_details_data: "$state.package",
          ui_details_layout: "card",
          ui_details_fields: [
            { key: "sender", label: "From" },
            { key: "recipient", label: "To" },
            { key: "weight", label: "Weight", suffix: " kg" },
            { key: "priority", label: "Priority" },
            { key: "status", label: "Status" },
          ],
        },
        order: 2,
      },
    ],
    customizable: [],
  },
  {
    id: "scheduled-report",
    name: "Scheduled Report",
    description: "Fetch data on schedule, summarize, and notify",
    icon: Clock,
    category: "Automation",
    blockCount: 3,
    triggerType: "schedule",
    triggerConfig: { schedule_cron: "0 9 * * *" },
    blocks: [
      {
        name: "Fetch Source Data",
        type: "fetch",
        logic: {
          fetch_url: "https://jsonplaceholder.typicode.com/posts",
          fetch_method: "GET",
          fetch_bind_value: "data",
        },
        order: 0,
      },
      {
        name: "Generate Summary",
        type: "code",
        logic: {
          code_source:
            "const posts = state.data;\nstate.summary = {\n  total: posts.length,\n  latest: posts[posts.length - 1].title,\n  reportDate: new Date().toISOString().split('T')[0]\n};\nreturn state.summary;",
          code_language: "javascript",
          code_timeout_ms: 5000,
          code_bind_value: "summary",
        },
        order: 1,
      },
      {
        name: "Send Notification",
        type: "fetch",
        logic: {
          fetch_url: "https://httpbin.org/post",
          fetch_method: "POST",
          fetch_body: "$state.summary",
          fetch_headers: { "Content-Type": "application/json" },
          fetch_bind_value: "notificationResult",
        },
        order: 2,
      },
    ],
    customizable: [
      {
        label: "Schedule",
        key: "schedule_cron",
        type: "select",
        defaultValue: "0 9 * * *",
        options: [
          "0 9 * * *",
          "0 */6 * * *",
          "0 0 * * 1",
        ],
        description: "How often to run the report",
      },
    ],
  },
];

const SCHEDULE_LABELS: Record<string, string> = {
  "0 9 * * *": "Daily at 9:00 AM",
  "0 */6 * * *": "Every 6 hours",
  "0 0 * * 1": "Weekly on Monday",
};

/* ── Step indicator ─────────────────────────────────────────────── */

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all duration-300 ${
            i === current
              ? "w-8 bg-[hsl(var(--primary))]"
              : i < current
                ? "w-2 bg-[hsl(var(--primary))]/50"
                : "w-2 bg-[hsl(var(--muted))]"
          }`}
        />
      ))}
    </div>
  );
}

/* ── Animated card wrapper ──────────────────────────────────────── */

function FadeInCard({
  delay,
  children,
}: {
  delay: number;
  children: ReactNode;
}) {
  return (
    <div
      className="animate-[fadeSlideUp_0.5s_ease-out_both] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6"
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ── Step 1: Welcome ────────────────────────────────────────────── */

function WelcomeStep({ onNext }: { onNext: () => void }) {
  const features = [
    {
      icon: Layers,
      title: "Build",
      description: "Design workflows visually with 21+ block types",
    },
    {
      icon: Play,
      title: "Run",
      description: "Execute on cloud, desktop, or mobile devices",
    },
    {
      icon: Zap,
      title: "Automate",
      description: "Schedule, trigger via API, or run on-demand",
    },
  ];

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="animate-[fadeSlideUp_0.4s_ease-out_both] text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--primary))]/10">
          <Rocket className="h-8 w-8 text-[hsl(var(--primary))]" />
        </div>
        <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">
          Welcome to V Sync
        </h1>
        <p className="mt-2 text-[hsl(var(--muted-foreground))]">
          Build, run, and automate workflows across any platform
        </p>
      </div>

      <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-3">
        {features.map((feature, i) => (
          <FadeInCard key={feature.title} delay={200 + i * 150}>
            <feature.icon className="mb-3 h-8 w-8 text-[hsl(var(--primary))]" />
            <h3 className="text-base font-semibold text-[hsl(var(--foreground))]">
              {feature.title}
            </h3>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              {feature.description}
            </p>
          </FadeInCard>
        ))}
      </div>

      <button
        type="button"
        onClick={onNext}
        className="animate-[fadeSlideUp_0.5s_ease-out_both] flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-6 py-2.5 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
        style={{ animationDelay: "650ms" }}
      >
        Get Started
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ── Step 2: Choose a template ──────────────────────────────────── */

function ChooseTemplateStep({
  selected,
  onSelect,
  onNext,
  onSkip,
}: {
  selected: TemplateDefinition | null;
  onSelect: (t: TemplateDefinition) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-[hsl(var(--foreground))]">
          Choose a template
        </h2>
        <p className="mt-1 text-[hsl(var(--muted-foreground))]">
          Pick a starter workflow to see V Sync in action
        </p>
      </div>

      <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((template) => {
          const isSelected = selected?.id === template.id;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelect(template)}
              className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all ${
                isSelected
                  ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5 ring-1 ring-[hsl(var(--primary))]"
                  : "border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary))]/50"
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <template.icon
                  className={`h-5 w-5 ${
                    isSelected
                      ? "text-[hsl(var(--primary))]"
                      : "text-[hsl(var(--muted-foreground))]"
                  }`}
                />
                <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                  {template.blockCount} blocks
                </span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">
                  {template.name}
                </h3>
                <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                  {template.description}
                </p>
              </div>
              {isSelected && (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(var(--primary))]">
                  <Check className="h-3 w-3 text-[hsl(var(--primary-foreground))]" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={onNext}
          disabled={!selected}
          className="flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-6 py-2.5 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          Skip — start from scratch
        </button>
      </div>
    </div>
  );
}

/* ── Step 3: Personalize ────────────────────────────────────────── */

function PersonalizeStep({
  template,
  customValues,
  onChange,
  onNext,
  onBack,
  creating,
}: {
  template: TemplateDefinition;
  customValues: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onNext: () => void;
  onBack: () => void;
  creating: boolean;
}) {
  const fields = template.customizable ?? [];
  const hasFields = fields.length > 0;

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-[hsl(var(--foreground))]">
          Personalize your workflow
        </h2>
        <p className="mt-1 text-[hsl(var(--muted-foreground))]">
          {hasFields
            ? `Customize "${template.name}" to fit your needs`
            : `"${template.name}" is ready to go — no customization needed`}
        </p>
      </div>

      {hasFields && (
        <div className="w-full max-w-md space-y-4">
          {fields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <label className="text-sm font-medium text-[hsl(var(--foreground))]">
                {field.label}
              </label>
              {field.description && (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {field.description}
                </p>
              )}
              {field.type === "text" && (
                <input
                  type="text"
                  value={customValues[field.key] ?? field.defaultValue}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                />
              )}
              {field.type === "textarea" && (
                <textarea
                  value={customValues[field.key] ?? field.defaultValue}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  rows={6}
                  className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 font-mono text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                />
              )}
              {field.type === "select" && (
                <select
                  value={customValues[field.key] ?? field.defaultValue}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                >
                  {field.options?.map((opt) => (
                    <option key={opt} value={opt}>
                      {SCHEDULE_LABELS[opt] ?? opt}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Preview card */}
      <div className="w-full max-w-md rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
        <div className="flex items-center gap-3">
          <template.icon className="h-5 w-5 text-[hsl(var(--primary))]" />
          <div>
            <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">
              {template.name}
            </h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {template.blockCount} blocks &middot; {template.category}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {template.blocks.map((block) => (
            <span
              key={block.order}
              className="rounded-md bg-[hsl(var(--muted))] px-2 py-0.5 text-xs text-[hsl(var(--muted-foreground))]"
            >
              {block.name}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={creating}
          className="flex items-center gap-2 rounded-md border border-[hsl(var(--border))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={creating}
          className="flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-6 py-2.5 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {creating ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Creating...
            </>
          ) : (
            <>
              Create Workflow
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/* ── Step 4: Run it ─────────────────────────────────────────────── */

function RunStep({
  workflowId,
  workflowName,
  onNext,
}: {
  workflowId: string;
  workflowName: string;
  onNext: () => void;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/10">
          <Check className="h-8 w-8 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-[hsl(var(--foreground))]">
          Workflow created!
        </h2>
        <p className="mt-1 text-[hsl(var(--muted-foreground))]">
          &ldquo;{workflowName}&rdquo; is ready to use
        </p>
      </div>

      <div className="w-full max-w-md rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <h3 className="text-sm font-medium text-[hsl(var(--foreground))]">
          What&apos;s next?
        </h3>
        <ul className="mt-3 space-y-2 text-sm text-[hsl(var(--muted-foreground))]">
          <li className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--primary))]" />
            Open the builder to customize blocks and logic
          </li>
          <li className="flex items-start gap-2">
            <Play className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--primary))]" />
            Run a test execution to see it in action
          </li>
          <li className="flex items-start gap-2">
            <Zap className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--primary))]" />
            Set up triggers or schedules for automation
          </li>
        </ul>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push(`/workflows/${workflowId}`)}
          className="flex items-center gap-2 rounded-md border border-[hsl(var(--border))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
        >
          Open in Builder
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-6 py-2.5 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ── Step 5: Success ────────────────────────────────────────────── */

function SuccessStep({ workflowId }: { workflowId: string | null }) {
  const router = useRouter();

  // Mark onboarding as complete
  useEffect(() => {
    localStorage.setItem(ONBOARDING_KEY, "true");
  }, []);

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Animated celebration */}
      <div className="relative">
        <div className="animate-[bounceIn_0.6s_ease-out_both] mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10">
          <Sparkles className="h-10 w-10 text-[hsl(var(--primary))]" />
        </div>
        {/* Decorative dots */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="absolute h-2 w-2 rounded-full bg-[hsl(var(--primary))]/30 animate-[ping_1.5s_ease-out_infinite]"
            style={{
              top: `${50 + 45 * Math.sin((i * Math.PI * 2) / 6)}%`,
              left: `${50 + 45 * Math.cos((i * Math.PI * 2) / 6)}%`,
              animationDelay: `${i * 200}ms`,
            }}
          />
        ))}
      </div>

      <div className="animate-[fadeSlideUp_0.5s_ease-out_0.3s_both] text-center">
        <h2 className="text-3xl font-bold text-[hsl(var(--foreground))]">
          You&apos;re all set!
        </h2>
        <p className="mt-2 text-[hsl(var(--muted-foreground))]">
          You&apos;re ready to build powerful workflows with V Sync
        </p>
      </div>

      <div className="animate-[fadeSlideUp_0.5s_ease-out_0.5s_both] flex flex-col items-center gap-3 sm:flex-row">
        {workflowId && (
          <button
            type="button"
            onClick={() => router.push(`/workflows/${workflowId}`)}
            className="flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-6 py-2.5 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
          >
            Customize this workflow
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => router.push("/workflows")}
          className="flex items-center gap-2 rounded-md border border-[hsl(var(--border))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
        >
          {workflowId ? "Create from scratch" : "Go to Workflows"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/templates")}
          className="flex items-center gap-2 rounded-md border border-[hsl(var(--border))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
        >
          Explore more templates
        </button>
      </div>
    </div>
  );
}

/* ── Main onboarding page ───────────────────────────────────────── */

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] =
    useState<TemplateDefinition | null>(null);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [createdWorkflowId, setCreatedWorkflowId] = useState<string | null>(
    null,
  );
  const [createdWorkflowName, setCreatedWorkflowName] = useState("");
  const [creating, setCreating] = useState(false);

  // Redirect if onboarding is already complete
  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (done === "true") {
      router.replace("/dashboard");
    }
  }, [router]);

  const handleCustomValueChange = useCallback(
    (key: string, value: string) => {
      setCustomValues((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  /** Creates a workflow from the selected template via the API. */
  const createWorkflowFromTemplate = useCallback(async () => {
    if (!selectedTemplate) return;

    setCreating(true);
    try {
      // 1. Create workflow
      const { data: workflow } = await api.workflows.create({
        name: selectedTemplate.name,
        description: selectedTemplate.description,
      });

      if (!workflow) throw new Error("Failed to create workflow");

      // 2. Create version
      const { data: version } = await api.versions.create(workflow.id);
      if (!version) throw new Error("Failed to create version");

      // 3. Optionally update trigger type if not interactive
      if (selectedTemplate.triggerType !== "interactive") {
        await api.versions.update(workflow.id, version.version, {
          triggerType: selectedTemplate.triggerType,
          triggerConfig: selectedTemplate.triggerConfig,
        });
      }

      // 4. Create blocks, applying any custom values
      for (const block of selectedTemplate.blocks) {
        const logic = { ...block.logic };

        // Apply custom values from personalization step
        for (const [key, value] of Object.entries(customValues)) {
          if (key in logic) {
            logic[key] = value;
          }
        }

        await api.blocks.create(workflow.id, version.version, {
          workflowId: workflow.id,
          workflowVersion: version.version,
          name: block.name,
          type: block.type,
          logic,
          order: block.order,
          notes: block.notes,
        });
      }

      // 5. Publish the version
      await api.versions.publish(workflow.id, version.version);

      setCreatedWorkflowId(workflow.id);
      setCreatedWorkflowName(workflow.name);
      setStep(3);
      toast.success("Workflow created successfully!");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create workflow";
      toast.error(message);
    } finally {
      setCreating(false);
    }
  }, [selectedTemplate, customValues]);

  const handleSkip = useCallback(() => {
    // Skip to success without creating a workflow
    setStep(4);
  }, []);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-4xl flex-col items-center justify-center py-8">
      {/* Step indicator */}
      <div className="mb-10">
        <StepIndicator current={step} total={TOTAL_STEPS} />
      </div>

      {/* Step content */}
      <div className="w-full">
        {step === 0 && <WelcomeStep onNext={() => setStep(1)} />}

        {step === 1 && (
          <ChooseTemplateStep
            selected={selectedTemplate}
            onSelect={setSelectedTemplate}
            onNext={() => setStep(2)}
            onSkip={handleSkip}
          />
        )}

        {step === 2 && selectedTemplate && (
          <PersonalizeStep
            template={selectedTemplate}
            customValues={customValues}
            onChange={handleCustomValueChange}
            onNext={createWorkflowFromTemplate}
            onBack={() => setStep(1)}
            creating={creating}
          />
        )}

        {step === 3 && createdWorkflowId && (
          <RunStep
            workflowId={createdWorkflowId}
            workflowName={createdWorkflowName}
            onNext={() => setStep(4)}
          />
        )}

        {step === 4 && <SuccessStep workflowId={createdWorkflowId} />}
      </div>

      {/* Custom animation keyframes */}
      <style jsx global>{`
        @keyframes fadeSlideUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes bounceIn {
          0% {
            opacity: 0;
            transform: scale(0.3);
          }
          50% {
            transform: scale(1.05);
          }
          70% {
            transform: scale(0.95);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
