import type { Metadata } from "next";
import Link from "next/link";
import {
  Blocks,
  Rocket,
  ScanBarcode,
  Globe,
  Database,
  Image,
  Code2,
} from "lucide-react";

/* ── SEO metadata ───────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "Workflow Templates | VSync",
  description:
    "Browse pre-built workflow templates for barcode scanning, API integration, data processing, image processing, and more. Start automating in seconds.",
  openGraph: {
    title: "Workflow Templates | VSync",
    description:
      "Browse pre-built workflow templates for barcode scanning, API integration, data processing, image processing, and more.",
    type: "website",
  },
};

/* ── Template data (shared with dashboard, could be extracted) ── */

interface Template {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  blockCount: number;
  triggerType: string;
}

const categories = [
  { id: "getting-started", label: "Getting Started", icon: Rocket },
  { id: "barcode-scanning", label: "Barcode Scanning", icon: ScanBarcode },
  { id: "api-integration", label: "API Integration", icon: Globe },
  { id: "data-processing", label: "Data Processing", icon: Database },
  { id: "image-processing", label: "Image Processing", icon: Image },
  { id: "custom-code", label: "Custom Code", icon: Code2 },
] as const;

const templates: Template[] = [
  {
    id: "t1",
    slug: "hello-world",
    name: "Hello World",
    description: "A simple workflow that logs a greeting. Perfect for learning the basics.",
    category: "getting-started",
    blockCount: 2,
    triggerType: "interactive",
  },
  {
    id: "t2",
    slug: "scheduled-data-fetch",
    name: "Scheduled Data Fetch",
    description: "Fetch data from an API on a schedule and store results.",
    category: "getting-started",
    blockCount: 4,
    triggerType: "schedule",
  },
  {
    id: "t3",
    slug: "barcode-inventory",
    name: "Barcode Inventory Scanner",
    description: "Scan barcodes using device camera, look up items in your database, and update stock.",
    category: "barcode-scanning",
    blockCount: 7,
    triggerType: "interactive",
  },
  {
    id: "t4",
    slug: "qr-asset-tracker",
    name: "QR Code Asset Tracker",
    description: "Track assets by scanning QR codes. Logs location and timestamp.",
    category: "barcode-scanning",
    blockCount: 5,
    triggerType: "interactive",
  },
  {
    id: "t5",
    slug: "rest-api-webhook",
    name: "REST API Webhook Handler",
    description: "Listen for incoming webhooks, validate payload, and trigger actions.",
    category: "api-integration",
    blockCount: 5,
    triggerType: "hook",
  },
  {
    id: "t6",
    slug: "api-aggregator",
    name: "Multi-API Aggregator",
    description: "Fetch data from multiple APIs in parallel and merge results.",
    category: "api-integration",
    blockCount: 8,
    triggerType: "schedule",
  },
  {
    id: "t7",
    slug: "csv-transform",
    name: "CSV Transform Pipeline",
    description: "Read a CSV file, transform columns, filter rows, and export results.",
    category: "data-processing",
    blockCount: 6,
    triggerType: "api",
  },
  {
    id: "t8",
    slug: "json-validator",
    name: "JSON Schema Validator",
    description: "Validate incoming data against a JSON schema and route valid/invalid records.",
    category: "data-processing",
    blockCount: 4,
    triggerType: "hook",
  },
  {
    id: "t9",
    slug: "image-resize",
    name: "Image Resize & Watermark",
    description: "Batch resize images and apply a watermark overlay.",
    category: "image-processing",
    blockCount: 5,
    triggerType: "api",
  },
  {
    id: "t10",
    slug: "vision-quality-check",
    name: "Vision Quality Inspector",
    description: "Use a camera feed to inspect product quality with AI-powered vision.",
    category: "image-processing",
    blockCount: 6,
    triggerType: "vision",
  },
  {
    id: "t11",
    slug: "custom-script-runner",
    name: "Custom Script Runner",
    description: "Run custom JavaScript/TypeScript code blocks with full access to the VSync context.",
    category: "custom-code",
    blockCount: 3,
    triggerType: "interactive",
  },
  {
    id: "t12",
    slug: "data-migration",
    name: "Data Migration Script",
    description: "Migrate data between services using custom transformation code.",
    category: "custom-code",
    blockCount: 7,
    triggerType: "interactive",
  },
];

/* ── Page (Server Component for SEO) ────────────────────────── */

export default function PublicTemplatesPage() {
  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-[hsl(var(--foreground))] sm:text-4xl">
          Workflow Templates
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base text-[hsl(var(--muted-foreground))]">
          Jump-start your automation with pre-built templates. Each template is
          fully customizable and ready to run on cloud, desktop, or mobile.
        </p>
      </div>

      {/* Category sections */}
      {categories.map((cat) => {
        const Icon = cat.icon;
        const catTemplates = templates.filter((t) => t.category === cat.id);
        if (catTemplates.length === 0) return null;
        return (
          <section key={cat.id}>
            <div className="mb-4 flex items-center gap-2">
              <Icon className="h-5 w-5 text-[hsl(var(--primary))]" />
              <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
                {cat.label}
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {catTemplates.map((template) => (
                <Link
                  key={template.id}
                  href={`/templates/${template.slug}`}
                  className="flex flex-col rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 transition-shadow hover:shadow-md"
                >
                  <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">
                    {template.name}
                  </h3>
                  <p className="mt-1.5 flex-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
                    {template.description}
                  </p>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                      {template.blockCount} blocks
                    </span>
                    <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                      {template.triggerType}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      {/* CTA */}
      <div className="rounded-xl border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/5 p-8 text-center">
        <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">
          Ready to automate?
        </h2>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          Sign up for free and start using templates in under a minute.
        </p>
        <Link
          href="/signup"
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-6 py-2.5 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90"
        >
          <Rocket className="h-4 w-4" />
          Get Started Free
        </Link>
      </div>
    </div>
  );
}
