"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Globe,
  Copy,
  Check,
  ExternalLink,
  Code2,
  Loader2,
  ArrowLeft,
  Eye,
  Play,
  Palette,
  Shield,
} from "lucide-react";
import { api } from "@/lib/api";
import { useWorkflow } from "@/lib/queries/workflows";

/* ── Page Component ──────────────────────────────────────── */

export default function WorkflowSharePage() {
  const params = useParams();
  const workflowId = params.id as string;

  const { data: workflowRes, refetch } = useWorkflow(workflowId);
  const workflow = workflowRes?.data;

  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  /* Form state */
  const [accessMode, setAccessMode] = useState<"view" | "run">("view");
  const [customSlug, setCustomSlug] = useState("");
  const [brandingTitle, setBrandingTitle] = useState("");
  const [brandingDesc, setBrandingDesc] = useState("");
  const [accentColor, setAccentColor] = useState("#6366f1");
  const [maxPerMinute, setMaxPerMinute] = useState(10);

  /* Sync form state from loaded workflow */
  useEffect(() => {
    if (!workflow) return;
    if (workflow.publicSlug) setCustomSlug(workflow.publicSlug);
    if (workflow.publicAccessMode === "run") setAccessMode("run");
    const branding = workflow.publicBranding as Record<string, string> | null;
    if (branding?.title) setBrandingTitle(branding.title);
    if (branding?.description) setBrandingDesc(branding.description);
    if (branding?.accentColor) setAccentColor(branding.accentColor);
    const rl = workflow.publicRateLimit as { maxPerMinute?: number } | null;
    if (rl?.maxPerMinute) setMaxPerMinute(rl.maxPerMinute);
  }, [workflow]);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = workflow?.publicSlug ? `${baseUrl}/w/${workflow.publicSlug}` : null;
  const embedUrl = workflow?.publicSlug ? `${baseUrl}/w/${workflow.publicSlug}/embed` : null;

  const embedCode = embedUrl
    ? `<iframe src="${embedUrl}" width="100%" height="500" frameborder="0" allow="clipboard-write" style="border-radius:12px;border:1px solid #e5e7eb;"></iframe>`
    : "";

  /* Handlers */

  const handlePublish = useCallback(async () => {
    setIsPublishing(true);
    setError(null);
    try {
      await api.sharing.publish(workflowId, {
        accessMode,
        slug: customSlug || undefined,
        branding: {
          title: brandingTitle || undefined,
          description: brandingDesc || undefined,
          accentColor: accentColor || undefined,
        },
        rateLimit: { maxPerMinute },
      });
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to publish");
    } finally {
      setIsPublishing(false);
    }
  }, [workflowId, accessMode, customSlug, brandingTitle, brandingDesc, accentColor, maxPerMinute, refetch]);

  const handleUnpublish = useCallback(async () => {
    setIsPublishing(true);
    setError(null);
    try {
      await api.sharing.unpublish(workflowId);
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to unpublish");
    } finally {
      setIsPublishing(false);
    }
  }, [workflowId, refetch]);

  const copyToClipboard = useCallback(async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  if (!workflow) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    );
  }

  const isPublic = workflow.isPublic && workflow.publicSlug;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link
          href={`/workflows/${workflowId}`}
          className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Workflow
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-[hsl(var(--foreground))]">
          Share &amp; Publish
        </h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Make this workflow accessible via a public URL. Anyone with the link can view or run it.
        </p>
      </div>

      {/* Status banner */}
      {isPublic && publicUrl && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              This workflow is public
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded-md border border-green-200 bg-white px-3 py-1.5 text-xs text-green-800 dark:border-green-800 dark:bg-green-900/40 dark:text-green-200">
              {publicUrl}
            </code>
            <button
              onClick={() => copyToClipboard(publicUrl, "url")}
              className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700"
            >
              {copied === "url" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied === "url" ? "Copied" : "Copy"}
            </button>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-green-200 px-3 py-1.5 text-xs text-green-700 hover:bg-green-100 dark:border-green-800 dark:text-green-300"
            >
              <ExternalLink className="h-3 w-3" />
              Open
            </a>
          </div>
        </div>
      )}

      {/* Configuration form */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Access Mode */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--foreground))]">
            <Eye className="h-4 w-4" />
            Access Mode
          </h2>
          <div className="mt-3 space-y-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[hsl(var(--border))] p-3 transition-colors hover:bg-[hsl(var(--muted))]/50">
              <input
                type="radio"
                name="accessMode"
                value="view"
                checked={accessMode === "view"}
                onChange={() => setAccessMode("view")}
                className="mt-0.5"
              />
              <div>
                <div className="flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--foreground))]">
                  <Eye className="h-3.5 w-3.5" />
                  View Only
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Visitors can see the workflow structure but cannot run it.
                </p>
              </div>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[hsl(var(--border))] p-3 transition-colors hover:bg-[hsl(var(--muted))]/50">
              <input
                type="radio"
                name="accessMode"
                value="run"
                checked={accessMode === "run"}
                onChange={() => setAccessMode("run")}
                className="mt-0.5"
              />
              <div>
                <div className="flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--foreground))]">
                  <Play className="h-3.5 w-3.5" />
                  Run
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Anyone with the link can trigger and interact with this workflow.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Custom Slug */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--foreground))]">
            <Globe className="h-4 w-4" />
            Custom URL
          </h2>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            Choose a custom slug for your public URL. Leave blank to auto-generate.
          </p>
          <div className="mt-3 flex items-center gap-1">
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{baseUrl}/w/</span>
            <input
              type="text"
              value={customSlug}
              onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              placeholder="my-workflow"
              className="flex-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
            />
          </div>
        </div>

        {/* Branding */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--foreground))]">
            <Palette className="h-4 w-4" />
            Branding
          </h2>
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-xs font-medium text-[hsl(var(--foreground))]">Title Override</label>
              <input
                type="text"
                value={brandingTitle}
                onChange={(e) => setBrandingTitle(e.target.value)}
                placeholder={workflow.name}
                className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[hsl(var(--foreground))]">Description Override</label>
              <textarea
                value={brandingDesc}
                onChange={(e) => setBrandingDesc(e.target.value)}
                placeholder={workflow.description ?? ""}
                rows={2}
                className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[hsl(var(--foreground))]">Accent Color</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded border border-[hsl(var(--border))]"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-24 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-xs font-mono text-[hsl(var(--foreground))]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Rate Limiting */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--foreground))]">
            <Shield className="h-4 w-4" />
            Rate Limiting
          </h2>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            Limit how many times a single IP can trigger this workflow per minute.
          </p>
          <div className="mt-3">
            <label className="text-xs font-medium text-[hsl(var(--foreground))]">Max runs/minute per IP</label>
            <input
              type="number"
              value={maxPerMinute}
              onChange={(e) => setMaxPerMinute(Math.max(1, Math.min(100, parseInt(e.target.value) || 10)))}
              min={1}
              max={100}
              className="mt-1 w-24 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-sm text-[hsl(var(--foreground))]"
            />
          </div>
        </div>
      </div>

      {/* Embed code */}
      {isPublic && embedCode && (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--foreground))]">
            <Code2 className="h-4 w-4" />
            Embed Code
          </h2>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            Paste this HTML snippet to embed the workflow on any webpage.
          </p>
          <div className="mt-3 flex items-start gap-2">
            <code className="flex-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3 text-xs leading-relaxed text-[hsl(var(--foreground))]">
              {embedCode}
            </code>
            <button
              onClick={() => copyToClipboard(embedCode, "embed")}
              className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-xs text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
            >
              {copied === "embed" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied === "embed" ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handlePublish}
          disabled={isPublishing}
          className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-6 py-2.5 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90 disabled:opacity-50"
        >
          {isPublishing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Globe className="h-4 w-4" />
          )}
          {isPublic ? "Update Public Settings" : "Publish as Public"}
        </button>

        {isPublic && (
          <button
            onClick={handleUnpublish}
            disabled={isPublishing}
            className="inline-flex items-center gap-2 rounded-md border border-red-200 px-5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            Unpublish
          </button>
        )}
      </div>
    </div>
  );
}
