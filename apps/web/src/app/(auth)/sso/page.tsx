"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Building2 } from "lucide-react";
import { ssoSchema, type SSOFormData } from "@/lib/validators";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function SSOPage() {
  const [orgSlug, setOrgSlug] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const validate = useCallback(() => {
    const result = ssoSchema.safeParse({ orgSlug });
    if (!result.success) {
      const msg = result.error.errors[0]?.message ?? "";
      setError(msg);
      return false;
    }
    setError("");
    return true;
  }, [orgSlug]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      setIsLoading(true);
      try {
        /* Look up the org's SSO configuration */
        const res = await fetch(`${API_URL}/api/v1/orgs/by-slug/${orgSlug}/sso`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(
            (body as { error?: { message?: string } } | null)?.error?.message ??
              "Organization not found or SSO not configured",
          );
        }

        const data = await res.json() as { data?: { redirectUrl?: string } };
        const redirectUrl = data.data?.redirectUrl;

        if (!redirectUrl) {
          throw new Error("SSO is not configured for this organization");
        }

        /* Redirect to the Identity Provider */
        window.location.href = redirectUrl;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "SSO login failed");
        setIsLoading(false);
      }
    },
    [orgSlug, validate],
  );

  const isValid = ssoSchema.safeParse({ orgSlug }).success;

  const inputCn =
    "w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]";

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-sm">
      <div className="mb-6 flex flex-col items-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10">
          <Building2 className="h-6 w-6 text-[hsl(var(--primary))]" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-[hsl(var(--foreground))]">
          Single Sign-On
        </h3>
        <p className="mt-1 text-center text-sm text-[hsl(var(--muted-foreground))]">
          Enter your organization&apos;s slug to sign in with SSO.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
            Organization slug
          </label>
          <div className="flex items-center gap-0">
            <span className="inline-flex h-[38px] items-center rounded-l-md border border-r-0 border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 text-sm text-[hsl(var(--muted-foreground))]">
              vsync.app/
            </span>
            <input
              type="text"
              value={orgSlug}
              onChange={(e) => setOrgSlug(e.target.value.toLowerCase())}
              onBlur={validate}
              placeholder="your-org"
              autoComplete="organization"
              className={`${inputCn} rounded-l-none`}
            />
          </div>
          {error && (
            <p className="mt-1 text-xs text-[hsl(var(--destructive))]">{error}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading || !isValid}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary))]/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          Continue with SSO
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 font-medium text-[hsl(var(--primary))] hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
