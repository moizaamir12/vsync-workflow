"use client";

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  Building2,
  Users,
  Shield,
  Key,
  Code2,
  CreditCard,
  Search,
  Plus,
  Trash2,
  RotateCw,
  Copy,
  Eye,
  EyeOff,
  X,
  Loader2,
  ChevronRight,
  Clock,
  AlertTriangle,
  CheckCircle,
  Mail,
} from "lucide-react";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import type { AuthSession } from "@/lib/auth-client";
import {
  useKeys,
  useCreateKey,
  useRotateKey,
  useRevokeKey,
  useKeyAudit,
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
} from "@/lib/queries/keys";

/* ── Tab definition ─────────────────────────────────────────── */

const tabs = [
  { id: "general", label: "General", icon: Building2 },
  { id: "members", label: "Members", icon: Users },
  { id: "auth", label: "Auth", icon: Shield },
  { id: "keys", label: "Keys", icon: Key },
  { id: "api-keys", label: "API Keys", icon: Code2 },
  { id: "billing", label: "Billing", icon: CreditCard },
] as const;

type TabId = (typeof tabs)[number]["id"];

/* ── Sheet (slide-out) ──────────────────────────────────────── */

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
    <div className="space-y-4">
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
   TAB: General
   ================================================================ */

interface OrgData {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

function useOrg(): { org: OrgData | null; loading: boolean } {
  const [org, setOrg] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void api.orgs
      .list()
      .then((res) => {
        /* Use the first org (active org is tracked via cookie) */
        const first = res.data?.[0];
        // TODO: Replace unsafe type cast with proper type narrowing or a typed API response.
        if (first) setOrg({ id: first.id, name: first.name, slug: first.slug, plan: (first as unknown as { plan?: string }).plan ?? "free" });
      })
      .finally(() => setLoading(false));
  }, []);
  return { org, loading };
}

function GeneralTab() {
  const { org } = useOrg();
  const [orgName, setOrgName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (org?.name) setOrgName(org.name);
  }, [org]);

  const handleSave = useCallback(async () => {
    if (!org?.id) return;
    setSaving(true);
    try {
      await api.orgs.update(org.id, { name: orgName });
      toast.success("Organization updated");
    } catch {
      toast.error("Failed to update organization");
    } finally {
      setSaving(false);
    }
  }, [org, orgName]);

  const planColors: Record<string, string> = {
    free: "bg-gray-100 text-gray-700",
    pro: "bg-blue-100 text-blue-700",
    enterprise: "bg-purple-100 text-purple-700",
  };

  const plan = org?.plan ?? "free";

  return (
    <div className="space-y-8">
      <Section title="Organization" description="Manage your organization details.">
        <div className="space-y-4 rounded-lg border border-[hsl(var(--border))] p-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
              Organization Name
            </label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full max-w-md rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
              Slug
            </label>
            <div className="flex max-w-md items-center rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
              <span className="px-3 text-sm text-[hsl(var(--muted-foreground))]">
                vsync.app/
              </span>
              <input
                type="text"
                value={org?.slug ?? ""}
                disabled
                className="w-full rounded-r-md border-l border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]"
              />
            </div>
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              Slug cannot be changed after creation.
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
              Plan
            </label>
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                planColors[plan] ?? planColors.free
              }`}
            >
              {plan.charAt(0).toUpperCase() + plan.slice(1)}
            </span>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !orgName.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>
      </Section>
    </div>
  );
}

/* ================================================================
   TAB: Members
   ================================================================ */

function MembersTab() {
  const { org } = useOrg();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [members, setMembers] = useState<
    Array<{ id: string; name: string; email: string; role: string; avatarUrl?: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    void authClient.getSession().then(setSession);
  }, []);

  const loadMembers = useCallback(async () => {
    if (!org?.id) return;
    setLoading(true);
    try {
      const res = await api.orgs.members.list(org.id);
      setMembers(
        (res.data ?? []).map((m) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          role: m.role,
          avatarUrl: m.avatarUrl ?? undefined,
        })),
      );
    } catch {
      // TODO: Add retry button when member list fails to load, and distinguish between network errors and permission errors.
      toast.error("Failed to load members");
    } finally {
      setLoading(false);
    }
  }, [org]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const handleInvite = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!org?.id || !inviteEmail.trim()) return;
      setInviting(true);
      try {
        await api.orgs.members.invite(org.id, {
          email: inviteEmail.trim(),
          role: inviteRole,
        });
        toast.success(`Invitation sent to ${inviteEmail}`);
        setInviteEmail("");
        setSheetOpen(false);
        void loadMembers();
      } catch {
        toast.error("Failed to send invitation");
      } finally {
        setInviting(false);
      }
    },
    [org, inviteEmail, inviteRole, loadMembers],
  );

  const handleRoleChange = useCallback(
    async (userId: string, role: string) => {
      if (!org?.id) return;
      try {
        await api.orgs.members.updateRole(org.id, userId, role);
        toast.success("Role updated");
        void loadMembers();
      } catch {
        toast.error("Failed to update role");
      }
    },
    [org, loadMembers],
  );

  const handleRemove = useCallback(
    async (userId: string) => {
      if (!org?.id) return;
      try {
        await api.orgs.members.remove(org.id, userId);
        toast.success("Member removed");
        void loadMembers();
      } catch {
        toast.error("Failed to remove member");
      }
    },
    [org, loadMembers],
  );

  return (
    <div className="space-y-8">
      <Section
        title="Team Members"
        description="Manage who has access to this organization."
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90"
          >
            <Plus className="h-4 w-4" />
            Invite Member
          </button>
        </div>

        <div className="rounded-lg border border-[hsl(var(--border))] divide-y divide-[hsl(var(--border))]">
          {loading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3">
                <div className="h-8 w-8 animate-pulse rounded-full bg-[hsl(var(--muted))]" />
                <div className="h-4 w-40 animate-pulse rounded bg-[hsl(var(--muted))]" />
              </div>
            ))}
          {!loading && members.length === 0 && (
            <div className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
              No members yet. Invite someone to get started.
            </div>
          )}
          {!loading &&
            members.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-4 px-5 py-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10 text-xs font-medium text-[hsl(var(--primary))]">
                  {m.name?.charAt(0)?.toUpperCase() ?? m.email.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">
                    {m.name || m.email}
                  </p>
                  <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                    {m.email}
                  </p>
                </div>
                <select
                  value={m.role}
                  onChange={(e) => handleRoleChange(m.id, e.target.value)}
                  disabled={m.id === session?.user?.id}
                  className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] disabled:opacity-50"
                >
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
                {m.id !== session?.user?.id && (
                  <button
                    type="button"
                    onClick={() => handleRemove(m.id)}
                    className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--destructive))]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
        </div>
      </Section>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Invite Member"
      >
        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
              Role
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            >
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={!inviteEmail.trim() || inviting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90 disabled:opacity-50"
          >
            {inviting && <Loader2 className="h-4 w-4 animate-spin" />}
            Send Invitation
          </button>
        </form>
      </Sheet>
    </div>
  );
}

/* ================================================================
   TAB: Auth (SSO Configuration)
   ================================================================ */

function AuthTab() {
  const { org } = useOrg();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [ssoType, setSsoType] = useState<"saml" | "oidc">("saml");
  const [samlEntityId, setSamlEntityId] = useState("");
  const [samlSsoUrl, setSamlSsoUrl] = useState("");
  const [samlCert, setSamlCert] = useState("");
  const [oidcClientId, setOidcClientId] = useState("");
  const [oidcIssuer, setOidcIssuer] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSaveSso = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!org?.id) return;
      setSaving(true);
      try {
        const data =
          ssoType === "saml"
            ? { type: "saml", entityId: samlEntityId, ssoUrl: samlSsoUrl, certificate: samlCert }
            : { type: "oidc", clientId: oidcClientId, issuer: oidcIssuer };
        await api.orgs.configureSso(org.id, data);
        toast.success("SSO configuration saved");
        setSheetOpen(false);
      } catch {
        toast.error("Failed to save SSO configuration");
      } finally {
        setSaving(false);
      }
    },
    [org, ssoType, samlEntityId, samlSsoUrl, samlCert, oidcClientId, oidcIssuer],
  );

  const isEnterprise = org?.plan === "enterprise";

  return (
    <div className="space-y-8">
      <Section
        title="Single Sign-On"
        description="Configure SSO for your organization."
      >
        {!isEnterprise && (
          <div className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-600" />
            <p className="text-sm text-yellow-700">
              SSO is available on the Enterprise plan. Upgrade to configure SAML or OIDC.
            </p>
          </div>
        )}
        {isEnterprise && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90"
            >
              <Shield className="h-4 w-4" />
              Configure SSO
            </button>
          </div>
        )}
      </Section>

      <Section
        title="OAuth Connections"
        description="Connected identity providers for team members."
      >
        <div className="space-y-2">
          {["Google", "Microsoft"].map((provider) => (
            <div
              key={provider}
              className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] px-5 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--muted))] text-xs font-bold">
                  {provider.charAt(0)}
                </div>
                <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                  {provider}
                </span>
              </div>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                Available
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Configure SSO"
      >
        <form onSubmit={handleSaveSso} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
              Protocol
            </label>
            <div className="flex gap-2">
              {(["saml", "oidc"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSsoType(t)}
                  className={`rounded-md px-4 py-2 text-sm font-medium ${
                    ssoType === t
                      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                      : "border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                  }`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {ssoType === "saml" ? (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Entity ID</label>
                <input
                  type="url"
                  value={samlEntityId}
                  onChange={(e) => setSamlEntityId(e.target.value)}
                  placeholder="https://idp.example.com/entity"
                  className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">SSO URL</label>
                <input
                  type="url"
                  value={samlSsoUrl}
                  onChange={(e) => setSamlSsoUrl(e.target.value)}
                  placeholder="https://idp.example.com/sso"
                  className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Certificate (Base64 X.509)
                </label>
                <textarea
                  value={samlCert}
                  onChange={(e) => setSamlCert(e.target.value)}
                  rows={4}
                  placeholder="MIIC..."
                  className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Client ID</label>
                <input
                  type="text"
                  value={oidcClientId}
                  onChange={(e) => setOidcClientId(e.target.value)}
                  placeholder="your-client-id"
                  className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Issuer URL</label>
                <input
                  type="url"
                  value={oidcIssuer}
                  onChange={(e) => setOidcIssuer(e.target.value)}
                  placeholder="https://accounts.example.com"
                  className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Configuration
          </button>
        </form>
      </Sheet>
    </div>
  );
}

/* ================================================================
   TAB: Keys (Encryption / Cloud / Local)
   ================================================================ */

function KeysTab() {
  const { data, isLoading } = useKeys();
  const createMutation = useCreateKey();
  const rotateMutation = useRotateKey();
  const revokeMutation = useRevokeKey();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [auditKeyId, setAuditKeyId] = useState<string | null>(null);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);

  /* Create form state */
  const [formName, setFormName] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formType, setFormType] = useState("api_key");
  const [formProvider, setFormProvider] = useState("custom");
  const [formStorage, setFormStorage] = useState("cloud");
  const [formWorkflow, setFormWorkflow] = useState("");
  const [formExpiry, setFormExpiry] = useState("");
  const [showValue, setShowValue] = useState(false);

  const keys = data?.data ?? [];

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formName.trim() || !formValue.trim()) return;
      try {
        const result = await createMutation.mutateAsync({
          name: formName.trim(),
          value: formValue.trim(),
          keyType: formType,
          provider: formProvider,
          storageMode: formStorage,
          workflowId: formWorkflow || undefined,
          expiresAt: formExpiry || undefined,
        });
        /* Show the value once */
        setNewKeyValue(result.data?.value ?? formValue);
        setSheetOpen(false);
        setFormName("");
        setFormValue("");
        toast.success("Key created — copy the value now, it won't be shown again.");
      } catch {
        toast.error("Failed to create key");
      }
    },
    [formName, formValue, formType, formProvider, formStorage, formWorkflow, formExpiry, createMutation],
  );

  const handleRotate = useCallback(
    async (id: string) => {
      try {
        const result = await rotateMutation.mutateAsync(id);
        setNewKeyValue(result.data?.value ?? null);
        toast.success("Key rotated — copy the new value now.");
      } catch {
        toast.error("Failed to rotate key");
      }
    },
    [rotateMutation],
  );

  const handleRevoke = useCallback(
    async (id: string) => {
      try {
        await revokeMutation.mutateAsync(id);
        toast.success("Key revoked");
      } catch {
        toast.error("Failed to revoke key");
      }
    },
    [revokeMutation],
  );

  const copyToClipboard = useCallback((val: string) => {
    void navigator.clipboard.writeText(val);
    toast.success("Copied to clipboard");
  }, []);

  return (
    <div className="space-y-8">
      {/* Newly created/rotated key value banner */}
      {newKeyValue && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-green-800">
            <CheckCircle className="h-4 w-4" />
            Copy your key value now — it will not be shown again.
          </div>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded bg-white px-3 py-2 font-mono text-xs text-green-900 border border-green-200">
              {newKeyValue}
            </code>
            <button
              type="button"
              onClick={() => copyToClipboard(newKeyValue)}
              className="rounded-md p-2 hover:bg-green-100"
            >
              <Copy className="h-4 w-4 text-green-700" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setNewKeyValue(null)}
            className="mt-2 text-xs text-green-600 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <Section title="Organization Keys" description="Manage encryption, API, and service keys.">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90"
          >
            <Plus className="h-4 w-4" />
            Create Key
          </button>
        </div>

        <div className="rounded-lg border border-[hsl(var(--border))]">
          {/* Header */}
          <div className="hidden border-b border-[hsl(var(--border))] px-5 py-2.5 sm:grid sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_80px] sm:gap-4">
            {["Name", "Type", "Provider", "Last Used", "Expiry", ""].map((h) => (
              <span
                key={h}
                className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]"
              >
                {h}
              </span>
            ))}
          </div>

          {isLoading && (
            <div className="divide-y divide-[hsl(var(--border))]">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3">
                  <div className="h-4 w-32 animate-pulse rounded bg-[hsl(var(--muted))]" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && keys.length === 0 && (
            <div className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
              No keys yet. Create one to get started.
            </div>
          )}

          {!isLoading &&
            keys.length > 0 && (
              <div className="divide-y divide-[hsl(var(--border))]">
                {keys.map((k) => (
                  <div
                    key={k.id}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_80px] items-center gap-4 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">
                        {k.name}
                      </p>
                      {k.isRevoked && (
                        <span className="text-xs text-[hsl(var(--destructive))]">Revoked</span>
                      )}
                    </div>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      {k.keyType}
                    </span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      {k.provider}
                    </span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      {k.lastUsedAt
                        ? new Date(k.lastUsedAt).toLocaleDateString()
                        : "Never"}
                    </span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      {k.expiresAt
                        ? new Date(k.expiresAt).toLocaleDateString()
                        : "—"}
                    </span>
                    <div className="flex items-center gap-1">
                      {!k.isRevoked && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleRotate(k.id)}
                            title="Rotate"
                            className="rounded p-1 hover:bg-[hsl(var(--muted))]"
                          >
                            <RotateCw className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevoke(k.id)}
                            title="Revoke"
                            className="rounded p-1 hover:bg-[hsl(var(--muted))]"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-[hsl(var(--destructive))]" />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setAuditKeyId(auditKeyId === k.id ? null : k.id)}
                        title="Audit log"
                        className="rounded p-1 hover:bg-[hsl(var(--muted))]"
                      >
                        <Clock className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                      </button>
                    </div>
                    {/* Inline audit log */}
                    {auditKeyId === k.id && (
                      <div className="col-span-full mt-2">
                        <KeyAuditLog keyId={k.id} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
        </div>
      </Section>

      {/* Create key sheet */}
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Create Key"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Name</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="My API Key"
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Value</label>
            <div className="relative">
              <input
                type={showValue ? "text" : "password"}
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                placeholder="sk-..."
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 pr-10 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              />
              <button
                type="button"
                onClick={() => setShowValue(!showValue)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-[hsl(var(--muted))]"
              >
                {showValue ? (
                  <EyeOff className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                ) : (
                  <Eye className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                )}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Type</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              >
                <option value="api_key">API Key</option>
                <option value="oauth_token">OAuth Token</option>
                <option value="encryption_key">Encryption Key</option>
                <option value="certificate">Certificate</option>
                <option value="webhook_secret">Webhook Secret</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Provider</label>
              <select
                value={formProvider}
                onChange={(e) => setFormProvider(e.target.value)}
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              >
                <option value="custom">Custom</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="google">Google</option>
                <option value="aws">AWS</option>
                <option value="azure">Azure</option>
                <option value="stripe">Stripe</option>
                <option value="twilio">Twilio</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Storage Mode</label>
            <div className="flex gap-2">
              {(["cloud", "local", "both"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFormStorage(mode)}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    formStorage === mode
                      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                      : "border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]"
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Workflow Scope{" "}
              <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span>
            </label>
            <input
              type="text"
              value={formWorkflow}
              onChange={(e) => setFormWorkflow(e.target.value)}
              placeholder="Workflow ID (leave empty for org-wide)"
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Expiry{" "}
              <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span>
            </label>
            <input
              type="date"
              value={formExpiry}
              onChange={(e) => setFormExpiry(e.target.value)}
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>
          <button
            type="submit"
            disabled={!formName.trim() || !formValue.trim() || createMutation.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90 disabled:opacity-50"
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Key
          </button>
        </form>
      </Sheet>
    </div>
  );
}

/* Audit log sub-component */
function KeyAuditLog({ keyId }: { keyId: string }) {
  const { data, isLoading } = useKeyAudit(keyId);
  const entries = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-3">
        <div className="h-4 w-48 animate-pulse rounded bg-[hsl(var(--muted))]" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-3 text-xs text-[hsl(var(--muted-foreground))]">
        No audit entries.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 divide-y divide-[hsl(var(--border))]">
      {entries.map((entry) => (
        <div key={entry.id} className="flex items-center gap-3 px-3 py-2 text-xs">
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${
              entry.action === "created"
                ? "bg-green-100 text-green-700"
                : entry.action === "rotated"
                  ? "bg-blue-100 text-blue-700"
                  : entry.action === "revoked"
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-700"
            }`}
          >
            {entry.action}
          </span>
          <span className="text-[hsl(var(--muted-foreground))]">
            {entry.performedBy ?? "System"}
          </span>
          <span className="ml-auto text-[hsl(var(--muted-foreground))]">
            {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ================================================================
   TAB: API Keys (programmatic access)
   ================================================================ */

function ApiKeysTab() {
  const { data, isLoading } = useApiKeys();
  const createMutation = useCreateApiKey();
  const revokeMutation = useRevokeApiKey();

  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const apiKeysList = data?.data ?? [];

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newKeyName.trim()) return;
      setCreating(true);
      try {
        const result = await createMutation.mutateAsync({ name: newKeyName.trim() });
        setCreatedKey(result.data?.key ?? null);
        setNewKeyName("");
        toast.success("API key created — copy it now.");
      } catch {
        toast.error("Failed to create API key");
      } finally {
        setCreating(false);
      }
    },
    [newKeyName, createMutation],
  );

  const handleRevoke = useCallback(
    async (id: string) => {
      try {
        await revokeMutation.mutateAsync(id);
        toast.success("API key revoked");
      } catch {
        toast.error("Failed to revoke API key");
      }
    },
    [revokeMutation],
  );

  const copyToClipboard = useCallback((val: string) => {
    void navigator.clipboard.writeText(val);
    toast.success("Copied to clipboard");
  }, []);

  return (
    <div className="space-y-8">
      {createdKey && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-green-800">
            <CheckCircle className="h-4 w-4" />
            Copy your API key now — it will not be shown again.
          </div>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded bg-white px-3 py-2 font-mono text-xs text-green-900 border border-green-200">
              {createdKey}
            </code>
            <button
              type="button"
              onClick={() => copyToClipboard(createdKey)}
              className="rounded-md p-2 hover:bg-green-100"
            >
              <Copy className="h-4 w-4 text-green-700" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setCreatedKey(null)}
            className="mt-2 text-xs text-green-600 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <Section title="API Keys" description="Generate keys for programmatic access to the VSync API.">
        <form onSubmit={handleCreate} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
              Key Name
            </label>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="e.g. CI/CD Pipeline"
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>
          <button
            type="submit"
            disabled={!newKeyName.trim() || creating}
            className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90 disabled:opacity-50"
          >
            {creating && <Loader2 className="h-4 w-4 animate-spin" />}
            Generate
          </button>
        </form>

        <div className="rounded-lg border border-[hsl(var(--border))] divide-y divide-[hsl(var(--border))]">
          {isLoading &&
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3">
                <div className="h-4 w-48 animate-pulse rounded bg-[hsl(var(--muted))]" />
              </div>
            ))}
          {!isLoading && apiKeysList.length === 0 && (
            <div className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
              No API keys yet.
            </div>
          )}
          {!isLoading &&
            apiKeysList.map((k) => (
              <div
                key={k.id}
                className="flex items-center gap-4 px-5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                    {k.name}
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {k.prefix}••••••••
                    {k.lastUsedAt
                      ? ` · Last used ${new Date(k.lastUsedAt).toLocaleDateString()}`
                      : " · Never used"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRevoke(k.id)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--destructive))]/30 px-3 py-1.5 text-xs font-medium text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10"
                >
                  <Trash2 className="h-3 w-3" />
                  Revoke
                </button>
              </div>
            ))}
        </div>
      </Section>
    </div>
  );
}

/* ================================================================
   TAB: Billing
   ================================================================ */

function BillingTab() {
  const { org } = useOrg();

  const plan = org?.plan ?? "free";

  const planFeatures: Record<string, string[]> = {
    free: ["5 workflows", "100 runs/mo", "1 device", "Community support"],
    pro: ["Unlimited workflows", "10,000 runs/mo", "10 devices", "Email support", "SSO (OIDC)"],
    enterprise: [
      "Unlimited everything",
      "Custom limits",
      "Unlimited devices",
      "Priority support",
      "SAML + OIDC SSO",
      "Audit logs",
    ],
  };

  return (
    <div className="space-y-8">
      <Section title="Current Plan" description="Your organization's billing details.">
        <div className="rounded-lg border border-[hsl(var(--border))] p-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-[hsl(var(--foreground))]">
              {plan.charAt(0).toUpperCase() + plan.slice(1)}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                plan === "enterprise"
                  ? "bg-purple-100 text-purple-700"
                  : plan === "pro"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-700"
              }`}
            >
              {plan === "free" ? "Free tier" : "Active"}
            </span>
          </div>
          <ul className="mt-4 space-y-1.5">
            {(planFeatures[plan] ?? planFeatures.free).map((f) => (
              <li
                key={f}
                className="flex items-center gap-2 text-sm text-[hsl(var(--foreground))]"
              >
                <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section title="Usage" description="Current billing period usage.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: "Workflows", value: "—", limit: plan === "free" ? "5" : "∞" },
            { label: "Runs this month", value: "—", limit: plan === "free" ? "100" : plan === "pro" ? "10,000" : "∞" },
            { label: "Devices", value: "—", limit: plan === "free" ? "1" : plan === "pro" ? "10" : "∞" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-[hsl(var(--border))] p-4"
            >
              <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                {stat.label}
              </p>
              <p className="mt-1 text-xl font-bold text-[hsl(var(--foreground))]">
                {stat.value}
                <span className="text-sm font-normal text-[hsl(var(--muted-foreground))]">
                  {" "}
                  / {stat.limit}
                </span>
              </p>
            </div>
          ))}
        </div>
      </Section>

      {plan !== "enterprise" && (
        <Section title="Upgrade">
          <div className="rounded-lg border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/5 p-5">
            <h4 className="text-base font-semibold text-[hsl(var(--foreground))]">
              {plan === "free" ? "Upgrade to Pro" : "Upgrade to Enterprise"}
            </h4>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              {plan === "free"
                ? "Unlock unlimited workflows, more runs, and team features."
                : "Get SAML SSO, audit logs, unlimited everything, and priority support."}
            </p>
            <button
              type="button"
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90"
            >
              <ChevronRight className="h-4 w-4" />
              {plan === "free" ? "Upgrade to Pro" : "Contact Sales"}
            </button>
          </div>
        </Section>
      )}
    </div>
  );
}

/* ================================================================
   MAIN: Settings Page
   ================================================================ */

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTabs = useMemo(() => {
    if (!searchQuery) return tabs;
    const q = searchQuery.toLowerCase();
    return tabs.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  const TabComponent: Record<TabId, React.ComponentType> = {
    general: GeneralTab,
    members: MembersTab,
    auth: AuthTab,
    keys: KeysTab,
    "api-keys": ApiKeysTab,
    billing: BillingTab,
  };

  const ActiveComponent = TabComponent[activeTab];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
          Settings
        </h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Manage your organization, team, and integrations.
        </p>
      </div>

      <div className="flex gap-8">
        {/* Sidebar tabs */}
        <div className="w-52 shrink-0 space-y-1">
          {/* Search settings */}
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search settings..."
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>

          {filteredTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                  activeTab === tab.id
                    ? "bg-[hsl(var(--primary))]/10 font-medium text-[hsl(var(--primary))]"
                    : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="min-w-0 flex-1">
          <ActiveComponent />
        </div>
      </div>
    </div>
  );
}
