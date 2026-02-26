"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Mail, CheckCircle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const RESEND_COOLDOWN_SECONDS = 60;

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [verifying, setVerifying] = useState(!!token);
  const [verified, setVerified] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Auto-verify when a token is present in the URL ──── */

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function verifyToken() {
      try {
        const res = await fetch(`${API_URL}/api/v1/auth/verify-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (cancelled) return;

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(
            (body as { message?: string } | null)?.message ?? "Verification failed",
          );
        }

        setVerified(true);
        /* Redirect to login after short delay */
        setTimeout(() => router.push("/login"), 3000);
      } catch (err) {
        if (!cancelled) {
          setVerifyError(err instanceof Error ? err.message : "Verification failed");
        }
      } finally {
        if (!cancelled) setVerifying(false);
      }
    }

    void verifyToken();
    return () => { cancelled = true; };
  }, [token, router]);

  /* ── Cooldown timer ──────────────────────────── */

  useEffect(() => {
    if (cooldown <= 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) return 0;
        return c - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [cooldown]);

  /* ── Resend verification email ───────────────── */

  const handleResend = useCallback(async () => {
    setResending(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/send-verification-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          (body as { message?: string } | null)?.message ?? "Failed to resend email",
        );
      }

      toast.success("Verification email sent!");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setResending(false);
    }
  }, []);

  /* ── Verifying spinner ─────────────────────── */

  if (verifying) {
    return (
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
          <h3 className="mt-4 text-lg font-semibold text-[hsl(var(--foreground))]">
            Verifying your email…
          </h3>
        </div>
      </div>
    );
  }

  /* ── Verified success ──────────────────────── */

  if (verified) {
    return (
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--success))]/10">
            <CheckCircle className="h-6 w-6 text-[hsl(var(--success))]" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-[hsl(var(--foreground))]">
            Email verified!
          </h3>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            Redirecting you to sign in…
          </p>
        </div>
      </div>
    );
  }

  /* ── Verification error (bad/expired token) ── */

  if (verifyError) {
    return (
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">
            Verification failed
          </h3>
          <p className="mt-2 text-sm text-[hsl(var(--destructive))]">{verifyError}</p>
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            className="mt-4 text-sm font-medium text-[hsl(var(--primary))] hover:underline disabled:opacity-50"
          >
            {resending ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend verification email"}
          </button>
        </div>
      </div>
    );
  }

  /* ── Default: check-your-email screen ──────── */

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-sm">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10">
          <Mail className="h-6 w-6 text-[hsl(var(--primary))]" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-[hsl(var(--foreground))]">
          Check your email
        </h3>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          We&apos;ve sent a verification link to your email address. Click the link to activate your account.
        </p>

        <div className="mt-6 w-full space-y-3">
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resending && <Loader2 className="h-4 w-4 animate-spin" />}
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend verification email"}
          </button>
        </div>

        <p className="mt-6 text-sm text-[hsl(var(--muted-foreground))]">
          Already verified?{" "}
          <Link href="/login" className="font-medium text-[hsl(var(--primary))] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

/** useSearchParams requires a Suspense boundary in Next.js 15 */
export default function VerifyPage() {
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
      <VerifyContent />
    </Suspense>
  );
}
