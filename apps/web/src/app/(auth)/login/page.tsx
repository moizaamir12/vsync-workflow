"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { loginSchema, type LoginFormData } from "@/lib/validators";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState<LoginFormData>({ email: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginFormData, string>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  /* ── Validation on blur ────────────────────── */

  const validateField = useCallback(
    (field: keyof LoginFormData) => {
      const result = loginSchema.safeParse(form);
      if (!result.success) {
        const fieldError = result.error.errors.find((e) => e.path[0] === field);
        setErrors((prev) => ({ ...prev, [field]: fieldError?.message }));
      } else {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [form],
  );

  /* ── Email/password submit ─────────────────── */

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const result = loginSchema.safeParse(form);
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        for (const err of result.error.errors) {
          const key = String(err.path[0]);
          if (!fieldErrors[key]) fieldErrors[key] = err.message;
        }
        setErrors(fieldErrors);
        return;
      }

      setIsLoading(true);
      try {
        await authClient.signIn(form.email, form.password);
        router.push("/dashboard");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Sign in failed");
      } finally {
        setIsLoading(false);
      }
    },
    [form, router],
  );

  /* ── OAuth handlers ────────────────────────── */

  const handleGoogleLogin = useCallback(async () => {
    setOauthLoading("google");
    try {
      await authClient.signInWithGoogle();
    } catch {
      toast.error("Google sign-in failed");
      setOauthLoading(null);
    }
  }, []);

  const handleMicrosoftLogin = useCallback(async () => {
    setOauthLoading("microsoft");
    try {
      await authClient.signInWithMicrosoft();
    } catch {
      toast.error("Microsoft sign-in failed");
      setOauthLoading(null);
    }
  }, []);

  const isValid = loginSchema.safeParse(form).success;

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-sm">
      <h3 className="mb-6 text-center text-lg font-semibold text-[hsl(var(--foreground))]">
        Sign in to your account
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
            Email
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            onBlur={() => validateField("email")}
            placeholder="you@example.com"
            autoComplete="email"
            className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-[hsl(var(--destructive))]">{errors.email}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium text-[hsl(var(--foreground))]">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-[hsl(var(--primary))] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            onBlur={() => validateField("password")}
            placeholder="Enter your password"
            autoComplete="current-password"
            className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          />
          {errors.password && (
            <p className="mt-1 text-xs text-[hsl(var(--destructive))]">{errors.password}</p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading || !isValid}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary))]/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          Sign in
        </button>
      </form>

      {/* Divider */}
      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-[hsl(var(--border))]" />
        <span className="text-xs text-[hsl(var(--muted-foreground))]">or continue with</span>
        <div className="h-px flex-1 bg-[hsl(var(--border))]" />
      </div>

      {/* OAuth buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={oauthLoading !== null}
          className="flex items-center justify-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))] disabled:opacity-50"
        >
          {oauthLoading === "google" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
          )}
          Google
        </button>

        <button
          type="button"
          onClick={handleMicrosoftLogin}
          disabled={oauthLoading !== null}
          className="flex items-center justify-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))] disabled:opacity-50"
        >
          {oauthLoading === "microsoft" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path d="M11.4 11.4H0V0h11.4v11.4z" fill="#F25022" />
              <path d="M24 11.4H12.6V0H24v11.4z" fill="#7FBA00" />
              <path d="M11.4 24H0V12.6h11.4V24z" fill="#00A4EF" />
              <path d="M24 24H12.6V12.6H24V24z" fill="#FFB900" />
            </svg>
          )}
          Microsoft
        </button>
      </div>

      {/* SSO link */}
      <div className="mt-4 text-center">
        <Link
          href="/sso"
          className="text-sm text-[hsl(var(--primary))] hover:underline"
        >
          Use SSO
        </Link>
      </div>

      {/* Sign up link */}
      <p className="mt-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-[hsl(var(--primary))] hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
