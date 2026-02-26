"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Mail } from "lucide-react";
import { forgotPasswordSchema, type ForgotPasswordFormData } from "@/lib/validators";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const validate = useCallback(() => {
    const result = forgotPasswordSchema.safeParse({ email });
    if (!result.success) {
      const msg = result.error.errors[0]?.message ?? "";
      setError(msg);
      return false;
    }
    setError("");
    return true;
  }, [email]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      setIsLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/v1/auth/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(
            (body as { message?: string } | null)?.message ?? "Failed to send reset link",
          );
        }

        setSent(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setIsLoading(false);
      }
    },
    [email, validate],
  );

  const inputCn =
    "w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]";

  /* ── Success state ─────────────────────────── */

  if (sent) {
    return (
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--success))]/10">
            <Mail className="h-6 w-6 text-[hsl(var(--success))]" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-[hsl(var(--foreground))]">
            Check your email
          </h3>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            We sent a password reset link to{" "}
            <span className="font-medium text-[hsl(var(--foreground))]">{email}</span>.
            It may take a minute to arrive.
          </p>
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setEmail("");
            }}
            className="mt-4 text-sm text-[hsl(var(--primary))] hover:underline"
          >
            Try a different email
          </button>
        </div>
        <p className="mt-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
          <Link href="/login" className="font-medium text-[hsl(var(--primary))] hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  /* ── Form state ────────────────────────────── */

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-sm">
      <h3 className="mb-2 text-center text-lg font-semibold text-[hsl(var(--foreground))]">
        Forgot your password?
      </h3>
      <p className="mb-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={validate}
            placeholder="you@example.com"
            autoComplete="email"
            className={inputCn}
          />
          {error && (
            <p className="mt-1 text-xs text-[hsl(var(--destructive))]">{error}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading || !forgotPasswordSchema.safeParse({ email }).success}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary))]/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          Send reset link
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
        <Link href="/login" className="inline-flex items-center gap-1 font-medium text-[hsl(var(--primary))] hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
