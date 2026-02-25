"use client";

import { useState, useCallback, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Monitor,
  Plus,
  Search,
  Trash2,
  Wifi,
  WifiOff,
  Cpu,
  HardDrive,
  MemoryStick,
  X,
  Loader2,
  ChevronDown,
  Tag,
} from "lucide-react";
import {
  useDevices,
  useRegisterDevice,
  useUpdateDevice,
  useDeleteDevice,
} from "@/lib/queries/devices";

/* ── Heartbeat helper ───────────────────────────────────────── */

type HeartbeatStatus = "online" | "idle" | "offline";

function getHeartbeat(lastSeenAt: string): HeartbeatStatus {
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  const minutes = diff / 60_000;
  if (minutes < 5) return "online";
  if (minutes < 30) return "idle";
  return "offline";
}

const heartbeatConfig: Record<
  HeartbeatStatus,
  { color: string; bg: string; label: string }
> = {
  online: { color: "text-green-600", bg: "bg-green-500", label: "Online" },
  idle: { color: "text-yellow-600", bg: "bg-yellow-500", label: "Idle" },
  offline: { color: "text-gray-400", bg: "bg-gray-400", label: "Offline" },
};

/* ── Sheet ──────────────────────────────────────────────────── */

function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4">
          <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 hover:bg-[hsl(var(--muted))]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </div>
    </>
  );
}

/* ── Device detail panel ────────────────────────────────────── */

interface DeviceData {
  id: string;
  name: string;
  slug: string;
  hardwareId: string;
  platform?: string;
  arch?: string;
  executionEnvironment: string;
  tags?: Record<string, unknown>;
  cpuCores?: number;
  memoryGb?: number;
  diskGb?: number;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

function DeviceDetail({
  device,
  onClose,
}: {
  device: DeviceData;
  onClose: () => void;
}) {
  const updateMutation = useUpdateDevice();
  const deleteMutation = useDeleteDevice();
  const [editName, setEditName] = useState(device.name);
  const [editTags, setEditTags] = useState(
    device.tags ? Object.entries(device.tags).map(([k, v]) => `${k}:${v}`).join(", ") : "",
  );

  const hb = getHeartbeat(device.lastSeenAt);
  const hbCfg = heartbeatConfig[hb];

  const handleSave = useCallback(async () => {
    const tagsObj: Record<string, string> = {};
    if (editTags.trim()) {
      editTags.split(",").forEach((t) => {
        const [key, val] = t.split(":").map((s) => s.trim());
        if (key) tagsObj[key] = val ?? "";
      });
    }
    try {
      await updateMutation.mutateAsync({ id: device.id, name: editName, tags: tagsObj });
      toast.success("Device updated");
    } catch {
      toast.error("Failed to update device");
    }
  }, [device.id, editName, editTags, updateMutation]);

  const handleDelete = useCallback(async () => {
    try {
      await deleteMutation.mutateAsync(device.id);
      toast.success("Device deleted");
      onClose();
    } catch {
      toast.error("Failed to delete device");
    }
  }, [device.id, deleteMutation, onClose]);

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className="flex items-center gap-2">
        <div className={`h-2.5 w-2.5 rounded-full ${hbCfg.bg}`} />
        <span className={`text-sm font-medium ${hbCfg.color}`}>{hbCfg.label}</span>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          · Last seen {new Date(device.lastSeenAt).toLocaleString()}
        </span>
      </div>

      {/* Name */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">Name</label>
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
        />
      </div>

      {/* Specs */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-[hsl(var(--border))] p-3">
          <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
            <Monitor className="h-3.5 w-3.5" /> Platform
          </div>
          <p className="mt-1 text-sm font-medium text-[hsl(var(--foreground))]">
            {device.platform ?? "Unknown"} {device.arch ? `(${device.arch})` : ""}
          </p>
        </div>
        <div className="rounded-lg border border-[hsl(var(--border))] p-3">
          <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
            <ChevronDown className="h-3.5 w-3.5" /> Environment
          </div>
          <p className="mt-1 text-sm font-medium text-[hsl(var(--foreground))]">
            {device.executionEnvironment}
          </p>
        </div>
        {device.cpuCores != null && (
          <div className="rounded-lg border border-[hsl(var(--border))] p-3">
            <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
              <Cpu className="h-3.5 w-3.5" /> CPU
            </div>
            <p className="mt-1 text-sm font-medium text-[hsl(var(--foreground))]">
              {device.cpuCores} cores
            </p>
          </div>
        )}
        {device.memoryGb != null && (
          <div className="rounded-lg border border-[hsl(var(--border))] p-3">
            <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
              <MemoryStick className="h-3.5 w-3.5" /> Memory
            </div>
            <p className="mt-1 text-sm font-medium text-[hsl(var(--foreground))]">
              {device.memoryGb} GB
            </p>
          </div>
        )}
        {device.diskGb != null && (
          <div className="rounded-lg border border-[hsl(var(--border))] p-3">
            <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
              <HardDrive className="h-3.5 w-3.5" /> Disk
            </div>
            <p className="mt-1 text-sm font-medium text-[hsl(var(--foreground))]">
              {device.diskGb} GB
            </p>
          </div>
        )}
      </div>

      {/* Tags */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          <Tag className="mr-1.5 inline h-3.5 w-3.5" />
          Tags
          <span className="ml-1 font-normal text-[hsl(var(--muted-foreground))]">
            (key:value, comma-separated)
          </span>
        </label>
        <input
          type="text"
          value={editTags}
          onChange={(e) => setEditTags(e.target.value)}
          placeholder="env:production, floor:3"
          className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
        />
      </div>

      {/* IDs */}
      <div className="space-y-1 text-xs text-[hsl(var(--muted-foreground))]">
        <p>ID: {device.id}</p>
        <p>Hardware ID: {device.hardwareId}</p>
        <p>Slug: {device.slug}</p>
        <p>Registered: {new Date(device.createdAt).toLocaleString()}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90 disabled:opacity-50"
        >
          {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="inline-flex items-center gap-2 rounded-md border border-[hsl(var(--destructive))]/30 px-4 py-2 text-sm font-medium text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10 disabled:opacity-50"
        >
          {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Delete Device
        </button>
      </div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────── */

export default function DevicesPage() {
  const { data, isLoading } = useDevices();
  const registerMutation = useRegisterDevice();

  const [search, setSearch] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceData | null>(null);

  /* Register form */
  const [regName, setRegName] = useState("");
  const [regHardwareId, setRegHardwareId] = useState("");
  const [regPlatform, setRegPlatform] = useState("");
  const [regArch, setRegArch] = useState("");
  const [regEnv, setRegEnv] = useState("desktop");

  const devices = data?.data ?? [];
  const filtered = search
    ? devices.filter(
        (d) =>
          d.name.toLowerCase().includes(search.toLowerCase()) ||
          d.platform?.toLowerCase().includes(search.toLowerCase()) ||
          d.slug.toLowerCase().includes(search.toLowerCase()),
      )
    : devices;

  const handleRegister = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!regName.trim() || !regHardwareId.trim()) return;
      try {
        await registerMutation.mutateAsync({
          name: regName.trim(),
          hardwareId: regHardwareId.trim(),
          platform: regPlatform || undefined,
          arch: regArch || undefined,
          executionEnvironment: regEnv,
        });
        toast.success("Device registered");
        setRegisterOpen(false);
        setRegName("");
        setRegHardwareId("");
        setRegPlatform("");
        setRegArch("");
      } catch {
        toast.error("Failed to register device");
      }
    },
    [regName, regHardwareId, regPlatform, regArch, regEnv, registerMutation],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
            Devices
          </h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Manage registered devices for workflow execution.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRegisterOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90"
        >
          <Plus className="h-4 w-4" />
          Register Device
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search devices..."
          className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
        />
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-[hsl(var(--border))] py-16 text-center">
          <Monitor className="mx-auto h-10 w-10 text-[hsl(var(--muted-foreground))]" />
          <h3 className="mt-4 text-lg font-semibold text-[hsl(var(--foreground))]">
            {search ? "No devices match your search" : "No devices registered"}
          </h3>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            {search
              ? "Try a different search term."
              : "Register a device to start running workflows on it."}
          </p>
          {!search && (
            <button
              type="button"
              onClick={() => setRegisterOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90"
            >
              <Plus className="h-4 w-4" />
              Register Device
            </button>
          )}
        </div>
      )}

      {/* Device grid */}
      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((device) => {
            const hb = getHeartbeat(device.lastSeenAt);
            const hbCfg = heartbeatConfig[hb];
            const HeartbeatIcon = hb === "offline" ? WifiOff : Wifi;

            return (
              <button
                key={device.id}
                type="button"
                onClick={() => setSelectedDevice(device)}
                className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 text-left transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-[hsl(var(--foreground))]">
                      {device.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                      {device.platform ?? "Unknown platform"}
                      {device.arch ? ` (${device.arch})` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={`h-2 w-2 rounded-full ${hbCfg.bg}`} />
                    <HeartbeatIcon className={`h-4 w-4 ${hbCfg.color}`} />
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                    {device.executionEnvironment}
                  </span>
                  {device.cpuCores != null && (
                    <span className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                      <Cpu className="h-3 w-3" /> {device.cpuCores}c
                    </span>
                  )}
                  {device.memoryGb != null && (
                    <span className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                      <MemoryStick className="h-3 w-3" /> {device.memoryGb}GB
                    </span>
                  )}
                </div>

                <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">
                  Last seen {new Date(device.lastSeenAt).toLocaleString()}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Register device sheet */}
      <Sheet
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        title="Register Device"
      >
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Device Name <span className="text-[hsl(var(--destructive))]">*</span>
            </label>
            <input
              type="text"
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              placeholder="Warehouse Scanner #1"
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Hardware ID <span className="text-[hsl(var(--destructive))]">*</span>
            </label>
            <input
              type="text"
              value={regHardwareId}
              onChange={(e) => setRegHardwareId(e.target.value)}
              placeholder="Unique identifier (e.g. MAC address)"
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Platform</label>
              <input
                type="text"
                value={regPlatform}
                onChange={(e) => setRegPlatform(e.target.value)}
                placeholder="linux, darwin, win32"
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Architecture</label>
              <input
                type="text"
                value={regArch}
                onChange={(e) => setRegArch(e.target.value)}
                placeholder="x64, arm64"
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Execution Environment
            </label>
            <select
              value={regEnv}
              onChange={(e) => setRegEnv(e.target.value)}
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            >
              <option value="desktop">Desktop</option>
              <option value="mobile">Mobile</option>
              <option value="kiosk">Kiosk</option>
              <option value="cloud">Cloud</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={!regName.trim() || !regHardwareId.trim() || registerMutation.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90 disabled:opacity-50"
          >
            {registerMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Register Device
          </button>
        </form>
      </Sheet>

      {/* Device detail sheet */}
      <Sheet
        open={!!selectedDevice}
        onClose={() => setSelectedDevice(null)}
        title={selectedDevice?.name ?? "Device Detail"}
      >
        {selectedDevice && (
          <DeviceDetail
            device={selectedDevice}
            onClose={() => setSelectedDevice(null)}
          />
        )}
      </Sheet>
    </div>
  );
}
