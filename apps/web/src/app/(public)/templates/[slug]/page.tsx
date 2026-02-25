import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Rocket,
  ArrowLeft,
  Blocks,
  Zap,
  Monitor,
  Cloud,
  Smartphone,
} from "lucide-react";

/* ── Template data ──────────────────────────────────────────── */

interface TemplateDetail {
  slug: string;
  name: string;
  description: string;
  longDescription: string;
  category: string;
  blockCount: number;
  triggerType: string;
  /** Block names in execution order */
  blocks: string[];
  environments: string[];
}

const templates: Record<string, TemplateDetail> = {
  "hello-world": {
    slug: "hello-world",
    name: "Hello World",
    description: "A simple workflow that logs a greeting. Perfect for learning the basics.",
    longDescription:
      "This is the simplest possible VSync workflow — perfect for understanding how blocks work. It uses a String block to compose a greeting message and a Code block to log it. Great for testing your first workflow execution.",
    category: "Getting Started",
    blockCount: 2,
    triggerType: "interactive",
    blocks: ["String: Compose greeting", "Code: Log message"],
    environments: ["cloud", "desktop", "mobile"],
  },
  "scheduled-data-fetch": {
    slug: "scheduled-data-fetch",
    name: "Scheduled Data Fetch",
    description: "Fetch data from an API on a schedule and store results.",
    longDescription:
      "Configure a cron schedule to periodically fetch data from a REST API. The workflow validates the response, transforms the payload, and stores it. Includes error handling and retry logic.",
    category: "Getting Started",
    blockCount: 4,
    triggerType: "schedule",
    blocks: ["Fetch: Call API", "Validation: Check response", "Object: Transform data", "Code: Store results"],
    environments: ["cloud"],
  },
  "barcode-inventory": {
    slug: "barcode-inventory",
    name: "Barcode Inventory Scanner",
    description: "Scan barcodes using device camera, look up items in your database, and update stock.",
    longDescription:
      "A complete inventory management workflow. Opens the device camera for barcode scanning, queries your product database, displays item details in a form, and updates stock levels. Supports both 1D barcodes and QR codes.",
    category: "Barcode Scanning",
    blockCount: 7,
    triggerType: "interactive",
    blocks: [
      "UI Camera: Scan barcode",
      "Fetch: Look up product",
      "Normalize: Parse response",
      "UI Form: Confirm quantity",
      "Math: Calculate new stock",
      "Fetch: Update inventory",
      "UI Details: Show confirmation",
    ],
    environments: ["desktop", "mobile"],
  },
  "qr-asset-tracker": {
    slug: "qr-asset-tracker",
    name: "QR Code Asset Tracker",
    description: "Track assets by scanning QR codes. Logs location and timestamp.",
    longDescription:
      "Scan QR codes attached to physical assets to log their location and check-in time. The workflow reads the QR payload, adds GPS coordinates from the device, and stores the tracking event.",
    category: "Barcode Scanning",
    blockCount: 5,
    triggerType: "interactive",
    blocks: [
      "UI Camera: Scan QR code",
      "String: Parse QR payload",
      "Location: Get GPS coordinates",
      "Object: Build tracking event",
      "Fetch: Submit to tracking API",
    ],
    environments: ["mobile"],
  },
  "rest-api-webhook": {
    slug: "rest-api-webhook",
    name: "REST API Webhook Handler",
    description: "Listen for incoming webhooks, validate payload, and trigger actions.",
    longDescription:
      "Set up a webhook endpoint that validates incoming requests using HMAC signatures, processes the payload, and dispatches actions based on event type. Ideal for integrating with third-party services.",
    category: "API Integration",
    blockCount: 5,
    triggerType: "hook",
    blocks: [
      "Validation: Verify HMAC signature",
      "Object: Parse event payload",
      "Goto: Route by event type",
      "Fetch: Execute action",
      "Code: Log result",
    ],
    environments: ["cloud"],
  },
  "api-aggregator": {
    slug: "api-aggregator",
    name: "Multi-API Aggregator",
    description: "Fetch data from multiple APIs in parallel and merge results.",
    longDescription:
      "Run multiple API calls concurrently, merge the responses into a unified data structure, and output the result. Includes timeout handling and partial failure recovery.",
    category: "API Integration",
    blockCount: 8,
    triggerType: "schedule",
    blocks: [
      "Fetch: API call 1",
      "Fetch: API call 2",
      "Fetch: API call 3",
      "Validation: Check responses",
      "Array: Merge results",
      "Normalize: Deduplicate",
      "Object: Build output",
      "Code: Export data",
    ],
    environments: ["cloud"],
  },
  "csv-transform": {
    slug: "csv-transform",
    name: "CSV Transform Pipeline",
    description: "Read a CSV file, transform columns, filter rows, and export results.",
    longDescription:
      "A complete data pipeline for CSV processing. Reads a CSV file, applies column transformations (rename, type cast, compute), filters rows based on conditions, and exports the cleaned data.",
    category: "Data Processing",
    blockCount: 6,
    triggerType: "api",
    blocks: [
      "Filesystem: Read CSV",
      "Code: Parse CSV rows",
      "Array: Filter rows",
      "Object: Transform columns",
      "Code: Format output",
      "Filesystem: Write result",
    ],
    environments: ["cloud", "desktop"],
  },
  "json-validator": {
    slug: "json-validator",
    name: "JSON Schema Validator",
    description: "Validate incoming data against a JSON schema and route valid/invalid records.",
    longDescription:
      "Accepts JSON data, validates it against a configurable schema, and routes records to different processing paths based on validation results. Invalid records get detailed error reports.",
    category: "Data Processing",
    blockCount: 4,
    triggerType: "hook",
    blocks: [
      "Validation: Schema check",
      "Goto: Route valid/invalid",
      "Code: Process valid records",
      "Code: Log validation errors",
    ],
    environments: ["cloud"],
  },
  "image-resize": {
    slug: "image-resize",
    name: "Image Resize & Watermark",
    description: "Batch resize images and apply a watermark overlay.",
    longDescription:
      "Process a batch of images: resize to multiple dimensions (thumbnail, medium, large), apply a watermark overlay, and save the results. Supports JPEG, PNG, and WebP formats.",
    category: "Image Processing",
    blockCount: 5,
    triggerType: "api",
    blocks: [
      "Image: Load source",
      "Image: Resize variants",
      "Image: Apply watermark",
      "Filesystem: Save outputs",
      "Code: Generate manifest",
    ],
    environments: ["cloud", "desktop"],
  },
  "vision-quality-check": {
    slug: "vision-quality-check",
    name: "Vision Quality Inspector",
    description: "Use a camera feed to inspect product quality with AI-powered vision.",
    longDescription:
      "Connect to a device camera feed, capture frames at configurable intervals, run AI inference for defect detection, and flag items that fail quality thresholds. Includes a live dashboard view.",
    category: "Image Processing",
    blockCount: 6,
    triggerType: "vision",
    blocks: [
      "UI Camera: Capture frame",
      "Image: Preprocess",
      "Agent: AI inference",
      "Validation: Check confidence",
      "Goto: Pass/fail routing",
      "UI Details: Show result",
    ],
    environments: ["desktop", "mobile"],
  },
  "custom-script-runner": {
    slug: "custom-script-runner",
    name: "Custom Script Runner",
    description: "Run custom JavaScript/TypeScript code blocks with full access to the VSync context.",
    longDescription:
      "Execute arbitrary JavaScript or TypeScript code within the VSync engine. Access workflow state, secrets, and APIs through the context object. Perfect for one-off automation tasks.",
    category: "Custom Code",
    blockCount: 3,
    triggerType: "interactive",
    blocks: [
      "Code: Setup environment",
      "Code: Run main script",
      "Code: Cleanup",
    ],
    environments: ["cloud", "desktop"],
  },
  "data-migration": {
    slug: "data-migration",
    name: "Data Migration Script",
    description: "Migrate data between services using custom transformation code.",
    longDescription:
      "A structured approach to data migration. Connect to a source service, extract records in batches, transform data to match the target schema, and load into the destination. Includes progress tracking and rollback support.",
    category: "Custom Code",
    blockCount: 7,
    triggerType: "interactive",
    blocks: [
      "Fetch: Connect to source",
      "Code: Extract batch",
      "Array: Transform records",
      "Validation: Verify data",
      "Fetch: Load to destination",
      "Code: Track progress",
      "Code: Generate report",
    ],
    environments: ["cloud"],
  },
};

/* ── Generate static params ─────────────────────────────────── */

export function generateStaticParams() {
  return Object.keys(templates).map((slug) => ({ slug }));
}

/* ── Dynamic metadata ───────────────────────────────────────── */

export function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  // Need to await params in Next.js 15
  return params.then(({ slug }) => {
    const template = templates[slug];
    if (!template) {
      return { title: "Template Not Found | VSync" };
    }
    return {
      title: `${template.name} — Workflow Template | VSync`,
      description: template.description,
      openGraph: {
        title: `${template.name} — Workflow Template | VSync`,
        description: template.description,
        type: "website",
      },
    };
  });
}

/* ── Page ───────────────────────────────────────────────────── */

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const template = templates[slug];

  if (!template) {
    notFound();
  }

  const envIcons: Record<string, React.ElementType> = {
    cloud: Cloud,
    desktop: Monitor,
    mobile: Smartphone,
  };

  return (
    <div className="space-y-8">
      {/* Back link */}
      <Link
        href="/templates"
        className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        <ArrowLeft className="h-4 w-4" />
        All Templates
      </Link>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
          <span>{template.category}</span>
          <span>·</span>
          <span>{template.blockCount} blocks</span>
          <span>·</span>
          <span>Trigger: {template.triggerType}</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold text-[hsl(var(--foreground))]">
          {template.name}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
          {template.longDescription}
        </p>
      </div>

      {/* CTA */}
      <div className="flex items-center gap-3">
        <Link
          href={`/signup?template=${template.slug}`}
          className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-6 py-2.5 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90"
        >
          <Rocket className="h-4 w-4" />
          Use this Template
        </Link>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          Free to use — no credit card required
        </span>
      </div>

      {/* Block diagram preview */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--foreground))]">
          <Blocks className="h-4 w-4" />
          Block Diagram
        </h2>
        <div className="mt-4 space-y-0">
          {template.blocks.map((block, i) => (
            <div key={i} className="flex items-center gap-3">
              {/* Vertical connector */}
              <div className="flex flex-col items-center">
                <div
                  className={`h-3 w-px ${i === 0 ? "bg-transparent" : "bg-[hsl(var(--border))]"}`}
                />
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-xs font-bold text-[hsl(var(--primary))]">
                  {i + 1}
                </div>
                <div
                  className={`h-3 w-px ${i === template.blocks.length - 1 ? "bg-transparent" : "bg-[hsl(var(--border))]"}`}
                />
              </div>
              {/* Block label */}
              <span className="text-sm text-[hsl(var(--foreground))]">
                {block}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Supported environments */}
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--foreground))]">
          <Zap className="h-4 w-4" />
          Supported Environments
        </h2>
        <div className="mt-3 flex gap-3">
          {template.environments.map((env) => {
            const Icon = envIcons[env] ?? Monitor;
            return (
              <div
                key={env}
                className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-4 py-2.5"
              >
                <Icon className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                  {env.charAt(0).toUpperCase() + env.slice(1)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
