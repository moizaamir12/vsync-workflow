"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function CallbackContent() {
  const router = useRouter();
  const params = useParams<{ provider: string }>();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  const provider = params.provider;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  useEffect(() => {
    /* Handle OAuth error from the IdP */
    if (oauthError) {
      setError(errorDescription ?? `Authentication with ${provider} failed`);
      return;
    }

    if (!code) {
      setError("Missing authorization code");
      return;
    }

    let cancelled = false;

    async function exchangeCode() {
      try {
        const res = await fetch(`${API_URL}/api/v1/auth/callback/${provider}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ code, state }),
        });

        if (cancelled) return;

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(
            (body as { message?: string } | null)?.message ??
              `Failed to complete ${provider} sign-in`,
          );
        }

        /* The API sets session cookies — redirect to org selection or dashboard */
        router.push("/select-org");
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Authentication failed";
          setError(message);
          toast.error(message);
        }
      }
    }

    void exchangeCode();
    return () => { cancelled = true; };
  }, [code, state, provider, oauthError, errorDescription, router]);

  if (error) {
    return (
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--destructive))]/10">
            <AlertCircle className="h-6 w-6 text-[hsl(var(--destructive))]" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-[hsl(var(--foreground))]">
            Authentication failed
          </h3>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{error}</p>
          <Link
            href="/login"
            className="mt-4 text-sm font-medium text-[hsl(var(--primary))] hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-sm">
      <div className="flex flex-col items-center text-center">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
        <h3 className="mt-4 text-lg font-semibold text-[hsl(var(--foreground))]">
          Completing sign-in…
        </h3>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          Connecting with {provider.charAt(0).toUpperCase() + provider.slice(1)}.
        </p>
      </div>
    </div>
  );
}

/** useSearchParams requires a Suspense boundary in Next.js 15 */
export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-sm">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
