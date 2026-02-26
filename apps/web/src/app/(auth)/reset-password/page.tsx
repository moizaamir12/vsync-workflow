"use client";

import { useState, useCallback, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, CheckCircle } from "lucide-react";
import { resetPasswordSchema, getPasswordStrength, type PasswordStrength } from "@/lib/validators";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const strengthColors: Record<PasswordStrength, string> = {
  weak: "bg-red-500",
  fair: "bg-orange-500",
  good: "bg-yellow-500",
  strong: "bg-green-500",
};

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const passwordInfo = useMemo(
    () => getPasswordStrength(form.password),
    [form.password],
  );

  const validateField = useCallback(
    (field: string) => {
      const result = resetPasswordSchema.safeParse(form);
      if (!result.success) {
        const fieldError = result.error.errors.find((e) => e.path[0] === field);
        setErrors((prev) => ({ ...prev, [field]: fieldError?.message ?? "" }));
      } else {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    },
    [form],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const result = resetPasswordSchema.safeParse(form);
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        for (const err of result.error.errors) {
          const key = String(err.path[0]);
          if (!fieldErrors[key]) fieldErrors[key] = err.message;
        }
        setErrors(fieldErrors);
        return;
      }

      if (!token) {
        toast.error("Invalid or missing reset token");
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/v1/auth/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, newPassword: form.password }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(
            (body as { message?: string } | null)?.message ?? "Failed to reset password",
          );
        }

        setSuccess(true);
        /* Redirect to login after brief delay */
        setTimeout(() => router.push("/login"), 3000);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setIsLoading(false);
      }
    },
    [form, token, router],
  );

  const isValid = resetPasswordSchema.safeParse(form).success && token.length > 0;

  const inputCn =
    "w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]";

  /* ── Success state ─────────────────────────── */

  if (success) {
    return (
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--success))]/10">
            <CheckCircle className="h-6 w-6 text-[hsl(var(--success))]" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-[hsl(var(--foreground))]">
            Password reset successfully
          </h3>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            Redirecting you to sign in…
          </p>
        </div>
      </div>
    );
  }

  /* ── No token state ────────────────────────── */

  if (!token) {
    return (
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">
            Invalid reset link
          </h3>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            This link is invalid or has expired. Please request a new password reset.
          </p>
          <Link
            href="/forgot-password"
            className="mt-4 text-sm font-medium text-[hsl(var(--primary))] hover:underline"
          >
            Request new reset link
          </Link>
        </div>
      </div>
    );
  }

  /* ── Form state ────────────────────────────── */

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-sm">
      <h3 className="mb-2 text-center text-lg font-semibold text-[hsl(var(--foreground))]">
        Set a new password
      </h3>
      <p className="mb-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
        Choose a strong password for your account.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* New password */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
            New password
          </label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            onBlur={() => validateField("password")}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            className={inputCn}
          />
          {form.password.length > 0 && (
            <div className="mt-2">
              <div className="flex gap-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full ${
                      i < passwordInfo.score
                        ? strengthColors[passwordInfo.strength]
                        : "bg-[hsl(var(--border))]"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                Password strength: <span className="font-medium capitalize">{passwordInfo.strength}</span>
              </p>
            </div>
          )}
          {errors.password && (
            <p className="mt-1 text-xs text-[hsl(var(--destructive))]">{errors.password}</p>
          )}
        </div>

        {/* Confirm password */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
            Confirm new password
          </label>
          <input
            type="password"
            value={form.confirmPassword}
            onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
            onBlur={() => validateField("confirmPassword")}
            placeholder="Re-enter your password"
            autoComplete="new-password"
            className={inputCn}
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-[hsl(var(--destructive))]">{errors.confirmPassword}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading || !isValid}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary))]/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          Reset password
        </button>
      </form>
    </div>
  );
}

/** Wrapping in Suspense because useSearchParams requires it in Next.js 15 */
export default function ResetPasswordPage() {
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
      <ResetPasswordForm />
    </Suspense>
  );
}
