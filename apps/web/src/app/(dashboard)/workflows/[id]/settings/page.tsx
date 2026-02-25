"use client";

import { useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Settings,
  Zap,
  Key,
  Cloud,
  Monitor,
  Smartphone,
  Tablet,
  History,
  Trash2,
  Copy,
  Loader2,
  Plus,
  AlertTriangle,
  Clock,
  Globe,
  Eye,
  Camera,
  Hand,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  useWorkflow,
  useWorkflowVersions,
  useUpdateWorkflow,
} from "@/lib/queries/workflows";
import {
  useKeys,
  useCreateKey,
  useRevokeKey,
} from "@/lib/queries/keys";

/* ── Types ──────────────────────────────────────────────────── */

type TriggerType = "interactive" | "api" | "schedule" | "hook" | "vision";

/* ── Section wrapper ────────────────────────────────────────── */

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-[hsl(var(--border))] p-5">
      <div>
        <h3 className="text-base font-semibold text-[hsl(var(--foreground))]">
          {title}
        </h3>
        {description && (
          <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

/* ================================================================
   TRIGGER: Interactive
   ================================================================ */

function TriggerInteractive() {
  return (
    <div className="flex items-center gap-3 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-4">
      <Hand className="h-5 w-5 shrink-0 text-[hsl(var(--muted-foreground))]" />
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        Triggered manually by a user. No additional configuration needed.
      </p>
    </div>
  );
}

/* ================================================================
   TRIGGER: API (webhook URL)
   ================================================================ */

function TriggerApi({ workflowId }: { workflowId: string }) {
  const webhookUrl = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/v1/workflows/${workflowId}/trigger`;

  const copyUrl = useCallback(() => {
    void navigator.clipboard.writeText(webhookUrl);
    toast.success("Webhook URL copied");
  }, [webhookUrl]);

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
          Webhook URL
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={webhookUrl}
            readOnly
            className="flex-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 font-mono text-xs text-[hsl(var(--foreground))] focus:outline-none"
          />
          <button
            type="button"
            onClick={copyUrl}
            className="rounded-md border border-[hsl(var(--border))] px-3 py-2 hover:bg-[hsl(var(--muted))]"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-xs text-[hsl(var(--muted-foreground))]">
          Send a POST request to this URL to trigger the workflow. Include an
          API key in the Authorization header.
        </p>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
          API Key
        </label>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 font-mono text-xs text-[hsl(var(--muted-foreground))]">
            ••••••••••••••••
          </code>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] px-3 py-2 text-xs hover:bg-[hsl(var(--muted))]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Regenerate
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   TRIGGER: Schedule (cron)
   ================================================================ */

const cronPresets = [
  { label: "Every hour", value: "0 * * * *" },
  { label: "Daily (9 AM)", value: "0 9 * * *" },
  { label: "Weekly (Mon 9 AM)", value: "0 9 * * 1" },
  { label: "Monthly (1st 9 AM)", value: "0 9 1 * *" },
];

function describeCron(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return "Invalid cron expression";
  const [min, hour, dom, mon, dow] = parts;

  if (min === "0" && hour === "*") return "Every hour, at the start of the hour";
  if (min === "0" && hour !== "*" && dom === "*" && mon === "*" && dow === "*")
    return `Every day at ${hour}:00`;
  if (min === "0" && hour !== "*" && dom === "*" && mon === "*" && dow !== "*") {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayName = days[Number(dow)] ?? dow;
    return `Every ${dayName} at ${hour}:00`;
  }
  if (min === "0" && hour !== "*" && dom !== "*" && mon === "*" && dow === "*")
    return `Monthly on the ${dom}${dom === "1" ? "st" : dom === "2" ? "nd" : dom === "3" ? "rd" : "th"} at ${hour}:00`;
  return `${expr} (custom schedule)`;
}

function TriggerSchedule({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const description = useMemo(() => describeCron(value), [value]);

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
          Cron Expression
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0 9 * * *"
          className="w-full max-w-md rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
        />
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          <Clock className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
          <span className="text-[hsl(var(--muted-foreground))]">{description}</span>
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium text-[hsl(var(--muted-foreground))]">
          Presets
        </p>
        <div className="flex flex-wrap gap-2">
          {cronPresets.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => onChange(preset.value)}
              className={`rounded-md px-3 py-1.5 text-xs ${
                value === preset.value
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   TRIGGER: Hook (event source)
   ================================================================ */

function TriggerHook({
  source,
  eventType,
  onSourceChange,
  onEventTypeChange,
}: {
  source: string;
  eventType: string;
  onSourceChange: (v: string) => void;
  onEventTypeChange: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
          Event Source
        </label>
        <select
          value={source}
          onChange={(e) => onSourceChange(e.target.value)}
          className="w-full max-w-md rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
        >
          <option value="">Select a connected service...</option>
          <option value="github">GitHub</option>
          <option value="stripe">Stripe</option>
          <option value="twilio">Twilio</option>
          <option value="custom">Custom Webhook</option>
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
          Event Type Filter
        </label>
        <input
          type="text"
          value={eventType}
          onChange={(e) => onEventTypeChange(e.target.value)}
          placeholder="e.g. push, payment_intent.succeeded"
          className="w-full max-w-md rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
        />
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          Leave empty to receive all events from this source.
        </p>
      </div>
    </div>
  );
}

/* ================================================================
   TRIGGER: Vision (camera + inference)
   ================================================================ */

function TriggerVision({
  cameraId,
  fps,
  confidence,
  onCameraChange,
  onFpsChange,
  onConfidenceChange,
}: {
  cameraId: string;
  fps: number;
  confidence: number;
  onCameraChange: (v: string) => void;
  onFpsChange: (v: number) => void;
  onConfidenceChange: (v: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
          <Camera className="mr-1.5 inline h-3.5 w-3.5" />
          Camera
        </label>
        <select
          value={cameraId}
          onChange={(e) => onCameraChange(e.target.value)}
          className="w-full max-w-md rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
        >
          <option value="">Select a registered device camera...</option>
          <option value="default">Default Camera</option>
          <option value="cam-1">Warehouse Cam 1</option>
          <option value="cam-2">Production Line Cam</option>
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
          Frame Rate: {fps} fps
        </label>
        <input
          type="range"
          min={1}
          max={30}
          value={fps}
          onChange={(e) => onFpsChange(Number(e.target.value))}
          className="w-full max-w-md accent-[hsl(var(--primary))]"
        />
        <div className="flex justify-between text-xs text-[hsl(var(--muted-foreground))]">
          <span>1 fps</span>
          <span>30 fps</span>
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
          Confidence Threshold: {(confidence * 100).toFixed(0)}%
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={confidence * 100}
          onChange={(e) => onConfidenceChange(Number(e.target.value) / 100)}
          className="w-full max-w-md accent-[hsl(var(--primary))]"
        />
        <div className="flex justify-between text-xs text-[hsl(var(--muted-foreground))]">
          <span>0%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   MAIN: Workflow Settings
   ================================================================ */

export default function WorkflowSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: workflowData, isLoading } = useWorkflow(id);
  const { data: versionsData } = useWorkflowVersions(id);
  const { data: keysData } = useKeys(id);
  const updateMutation = useUpdateWorkflow();
  const createKeyMutation = useCreateKey();
  const revokeKeyMutation = useRevokeKey();

  const workflow = workflowData?.data;
  const versions = versionsData?.data ?? [];
  const keys = keysData?.data ?? [];

  /* Trigger state */
  const [triggerType, setTriggerType] = useState<TriggerType>("interactive");
  const [cronExpr, setCronExpr] = useState("0 9 * * *");
  const [hookSource, setHookSource] = useState("");
  const [hookEventType, setHookEventType] = useState("");
  const [visionCamera, setVisionCamera] = useState("");
  const [visionFps, setVisionFps] = useState(5);
  const [visionConfidence, setVisionConfidence] = useState(0.7);
  const [saving, setSaving] = useState(false);

  /* Secrets / keys state */
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [createdKeyValue, setCreatedKeyValue] = useState<string | null>(null);

  /* Execution environments */
  const [envs, setEnvs] = useState<string[]>(["cloud"]);

  /* Init from version data */
  useEffect(() => {
    if (workflow?.version?.triggerType) {
      setTriggerType(workflow.version.triggerType as TriggerType);
    }
    if (workflow?.version?.triggerConfig) {
      const cfg = workflow.version.triggerConfig as Record<string, unknown>;
      if (cfg.schedule_cron) setCronExpr(String(cfg.schedule_cron));
      if (cfg.hook_source) setHookSource(String(cfg.hook_source));
      if (cfg.hook_event_type) setHookEventType(String(cfg.hook_event_type));
      if (cfg.vision_camera) setVisionCamera(String(cfg.vision_camera));
      if (cfg.vision_fps) setVisionFps(Number(cfg.vision_fps));
      if (cfg.vision_confidence) setVisionConfidence(Number(cfg.vision_confidence));
    }
    if (workflow?.version?.executionEnvironments) {
      setEnvs(workflow.version.executionEnvironments as string[]);
    }
  }, [workflow]);

  const handleSaveTrigger = useCallback(async () => {
    if (!workflow?.activeVersion) return;
    setSaving(true);
    try {
      const triggerConfig: Record<string, unknown> = {};
      if (triggerType === "schedule") triggerConfig.schedule_cron = cronExpr;
      if (triggerType === "hook") {
        triggerConfig.hook_source = hookSource;
        triggerConfig.hook_event_type = hookEventType;
      }
      if (triggerType === "vision") {
        triggerConfig.vision_camera = visionCamera;
        triggerConfig.vision_fps = visionFps;
        triggerConfig.vision_confidence = visionConfidence;
      }

      await api.versions.update(id, workflow.activeVersion, {
        triggerType,
        triggerConfig,
      });
      toast.success("Trigger configuration saved");
    } catch {
      toast.error("Failed to save trigger configuration");
    } finally {
      setSaving(false);
    }
  }, [id, workflow, triggerType, cronExpr, hookSource, hookEventType, visionCamera, visionFps, visionConfidence]);

  const handleCreateKey = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newKeyName.trim() || !newKeyValue.trim()) return;
      try {
        const result = await createKeyMutation.mutateAsync({
          name: newKeyName.trim(),
          value: newKeyValue.trim(),
          keyType: "custom",
          provider: "custom",
          storageMode: "cloud",
          workflowId: id,
        });
        setCreatedKeyValue(result.data?.value ?? newKeyValue);
        setNewKeyName("");
        setNewKeyValue("");
        toast.success("Secret created");
      } catch {
        toast.error("Failed to create secret");
      }
    },
    [id, newKeyName, newKeyValue, createKeyMutation],
  );

  const handleDeleteWorkflow = useCallback(async () => {
    try {
      await api.workflows.delete(id);
      toast.success("Workflow deleted");
      router.push("/workflows");
    } catch {
      toast.error("Failed to delete workflow");
    }
  }, [id, router]);

  const toggleEnv = useCallback((env: string) => {
    setEnvs((prev) =>
      prev.includes(env) ? prev.filter((e) => e !== env) : [...prev, env],
    );
  }, []);

  const triggerIcons: Record<TriggerType, React.ElementType> = {
    interactive: Hand,
    api: Globe,
    schedule: Clock,
    hook: Zap,
    vision: Eye,
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-[hsl(var(--muted))]" />
        <div className="h-64 animate-pulse rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div>
        <Link
          href={`/workflows/${id}`}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Builder
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[hsl(var(--foreground))]">
          <Settings className="h-6 w-6" />
          Workflow Settings
        </h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          {workflow?.name ?? "Untitled Workflow"}
        </p>
      </div>

      {/* ── Trigger Configuration ─────────────── */}
      <Section
        title="Trigger Configuration"
        description="Define how this workflow is triggered."
      >
        {/* Trigger type selector */}
        <div className="flex flex-wrap gap-2">
          {(["interactive", "api", "schedule", "hook", "vision"] as const).map(
            (t) => {
              const Icon = triggerIcons[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTriggerType(t)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm ${
                    triggerType === t
                      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                      : "border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              );
            },
          )}
        </div>

        {/* Trigger-specific config */}
        <div className="mt-4">
          {triggerType === "interactive" && <TriggerInteractive />}
          {triggerType === "api" && <TriggerApi workflowId={id} />}
          {triggerType === "schedule" && (
            <TriggerSchedule value={cronExpr} onChange={setCronExpr} />
          )}
          {triggerType === "hook" && (
            <TriggerHook
              source={hookSource}
              eventType={hookEventType}
              onSourceChange={setHookSource}
              onEventTypeChange={setHookEventType}
            />
          )}
          {triggerType === "vision" && (
            <TriggerVision
              cameraId={visionCamera}
              fps={visionFps}
              confidence={visionConfidence}
              onCameraChange={setVisionCamera}
              onFpsChange={setVisionFps}
              onConfidenceChange={setVisionConfidence}
            />
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSaveTrigger}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Trigger
          </button>
        </div>
      </Section>

      {/* ── Secrets & Keys ────────────────────── */}
      <Section
        title="Secrets & Keys"
        description="Manage secrets scoped to this workflow."
      >
        {createdKeyValue && (
          <div className="rounded-md border border-green-200 bg-green-50 p-3">
            <p className="text-xs font-medium text-green-800">
              Copy the value now — it won't be shown again.
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <code className="flex-1 rounded bg-white px-2 py-1 font-mono text-xs text-green-900 border border-green-200">
                {createdKeyValue}
              </code>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(createdKeyValue);
                  toast.success("Copied");
                }}
                className="rounded p-1 hover:bg-green-100"
              >
                <Copy className="h-3.5 w-3.5 text-green-700" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setCreatedKeyValue(null)}
              className="mt-1.5 text-xs text-green-600 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Existing keys */}
        {keys.length > 0 && (
          <div className="rounded-md border border-[hsl(var(--border))] divide-y divide-[hsl(var(--border))]">
            {keys.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                    {k.name}
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {k.provider} · {k.keyType}
                    {k.isRevoked && (
                      <span className="ml-2 text-[hsl(var(--destructive))]">Revoked</span>
                    )}
                  </p>
                </div>
                {!k.isRevoked && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await revokeKeyMutation.mutateAsync(k.id);
                        toast.success("Key revoked");
                      } catch {
                        toast.error("Failed to revoke key");
                      }
                    }}
                    className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add new */}
        <form
          onSubmit={handleCreateKey}
          className="flex items-end gap-2"
        >
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium">Name</label>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="OPENAI_API_KEY"
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium">Value</label>
            <input
              type="password"
              value={newKeyValue}
              onChange={(e) => setNewKeyValue(e.target.value)}
              placeholder="sk-..."
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>
          <button
            type="submit"
            disabled={!newKeyName.trim() || !newKeyValue.trim() || createKeyMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(var(--primary))] px-3 py-1.5 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90 disabled:opacity-50"
          >
            {createKeyMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Add
          </button>
        </form>
      </Section>

      {/* ── Execution Environments ────────────── */}
      <Section
        title="Execution Environments"
        description="Where this workflow can run."
      >
        <div className="flex flex-wrap gap-3">
          {[
            { id: "cloud", label: "Cloud", icon: Cloud },
            { id: "desktop", label: "Desktop", icon: Monitor },
            { id: "mobile", label: "Mobile", icon: Smartphone },
            { id: "kiosk", label: "Kiosk", icon: Tablet },
          ].map((env) => {
            const Icon = env.icon;
            const active = envs.includes(env.id);
            return (
              <button
                key={env.id}
                type="button"
                onClick={() => toggleEnv(env.id)}
                className={`inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm ${
                  active
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                }`}
              >
                <Icon className="h-4 w-4" />
                {env.label}
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── Version History ───────────────────── */}
      <Section title="Version History" description="Published versions of this workflow.">
        {versions.length === 0 && (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            No published versions yet.
          </p>
        )}
        {versions.length > 0 && (
          <div className="rounded-md border border-[hsl(var(--border))] divide-y divide-[hsl(var(--border))]">
            {versions.map((v) => (
              <div
                key={v.version}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs font-medium text-[hsl(var(--foreground))]">
                    v{v.version}
                  </span>
                  <span
                    className={`text-xs ${
                      v.status === "published"
                        ? "text-green-600"
                        : "text-[hsl(var(--muted-foreground))]"
                    }`}
                  >
                    {v.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
                  {v.changelog && <span>{v.changelog}</span>}
                  <History className="h-3.5 w-3.5" />
                  {v.createdAt
                    ? new Date(v.createdAt).toLocaleDateString()
                    : "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Danger Zone ───────────────────────── */}
      <div className="rounded-lg border border-[hsl(var(--destructive))]/30 p-5">
        <h3 className="flex items-center gap-2 text-base font-semibold text-[hsl(var(--destructive))]">
          <AlertTriangle className="h-5 w-5" />
          Danger Zone
        </h3>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Permanently delete this workflow and all its versions, runs, and data.
          This action cannot be undone.
        </p>
        <button
          type="button"
          onClick={handleDeleteWorkflow}
          className="mt-4 inline-flex items-center gap-2 rounded-md border border-[hsl(var(--destructive))] px-4 py-2 text-sm font-medium text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10"
        >
          <Trash2 className="h-4 w-4" />
          Delete Workflow
        </button>
      </div>
    </div>
  );
}
