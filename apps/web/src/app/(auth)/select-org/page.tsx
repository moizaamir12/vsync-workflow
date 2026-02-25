"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Building2, ChevronRight } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/api";
import type { Organization } from "@vsync/shared-types";

export default function SelectOrgPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  /* ── Load user's organizations ──────────────── */

  useEffect(() => {
    let cancelled = false;

    async function loadOrgs() {
      try {
        const session = await authClient.getSession();
        if (!session) {
          router.push("/login");
          return;
        }

        const res = await api.orgs.list();
        if (!cancelled) {
          setOrgs(res.data ?? []);
        }
      } catch {
        if (!cancelled) toast.error("Failed to load organizations");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadOrgs();
    return () => { cancelled = true; };
  }, [router]);

  /* ── Select an organization ─────────────────── */

  const handleSelect = useCallback(
    async (orgId: string) => {
      setSwitchingId(orgId);
      try {
        await authClient.switchOrg(orgId);
        router.push("/dashboard");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to switch organization");
        setSwitchingId(null);
      }
    },
    [router],
  );

  /* ── Create a new organization ──────────────── */

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const name = newOrgName.trim();
      if (!name) return;

      setCreating(true);
      try {
        const res = await api.orgs.create({ name });
        const org = res.data;
        if (!org) throw new Error("Failed to create organization");

        toast.success("Organization created!");
        setShowCreate(false);
        setNewOrgName("");

        /* Auto-select the newly created org */
        await authClient.switchOrg(org.id);
        router.push("/dashboard");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to create organization");
      } finally {
        setCreating(false);
      }
    },
    [newOrgName, router],
  );

  const inputCn =
    "w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]";

  /* ── Loading state ─────────────────────────── */

  if (loading) {
    return (
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-sm">
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-sm">
      <h3 className="mb-2 text-center text-lg font-semibold text-[hsl(var(--foreground))]">
        Select organization
      </h3>
      <p className="mb-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
        Choose an organization to continue.
      </p>

      {/* Organization list */}
      {orgs.length > 0 && (
        <div className="space-y-2">
          {orgs.map((org) => (
            <button
              key={org.id}
              type="button"
              onClick={() => handleSelect(org.id)}
              disabled={switchingId !== null}
              className="flex w-full items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-left transition-colors hover:bg-[hsl(var(--muted))] disabled:opacity-50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10">
                <Building2 className="h-5 w-5 text-[hsl(var(--primary))]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">
                  {org.name}
                </p>
                {"slug" in org && typeof org.slug === "string" && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                    {org.slug}
                  </p>
                )}
              </div>
              {switchingId === org.id ? (
                <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--muted-foreground))]" />
              ) : (
                <ChevronRight className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* No organizations */}
      {orgs.length === 0 && !showCreate && (
        <div className="rounded-lg border border-dashed border-[hsl(var(--border))] p-6 text-center">
          <Building2 className="mx-auto h-8 w-8 text-[hsl(var(--muted-foreground))]" />
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            You don&apos;t belong to any organizations yet.
          </p>
        </div>
      )}

      {/* Create new org form */}
      {showCreate ? (
        <form onSubmit={handleCreate} className="mt-4 space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
              Organization name
            </label>
            <input
              type="text"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              placeholder="My Organization"
              autoFocus
              className={inputCn}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating || !newOrgName.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary))]/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Create & continue
            </button>
            <button
              type="button"
              onClick={() => { setShowCreate(false); setNewOrgName(""); }}
              className="rounded-md border border-[hsl(var(--border))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-[hsl(var(--border))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]"
        >
          <Plus className="h-4 w-4" />
          Create new organization
        </button>
      )}

      {/* Sign out */}
      <p className="mt-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
        <button
          type="button"
          onClick={async () => {
            await authClient.signOut();
            router.push("/login");
          }}
          className="font-medium text-[hsl(var(--primary))] hover:underline"
        >
          Sign out
        </button>
      </p>
    </div>
  );
}
