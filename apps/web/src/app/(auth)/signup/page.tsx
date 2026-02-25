"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { signupSchema, getPasswordStrength, type SignupFormData } from "@/lib/validators";
import { authClient } from "@/lib/auth-client";

const strengthColors = {
  weak: "bg-red-500",
  fair: "bg-orange-500",
  good: "bg-yellow-500",
  strong: "bg-green-500",
};

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false as boolean,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  const passwordInfo = useMemo(
    () => getPasswordStrength(form.password),
    [form.password],
  );

  /* ── Field-level validation on blur ────────── */

  const validateField = useCallback(
    (field: string) => {
      const result = signupSchema.safeParse(form);
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

  /* ── Submit ────────────────────────────────── */

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const result = signupSchema.safeParse(form);
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
        await authClient.signUp(form.email, form.password, form.name);
        router.push("/verify");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Sign up failed");
      } finally {
        setIsLoading(false);
      }
    },
    [form, router],
  );

  const isValid = signupSchema.safeParse(form).success;

  const inputCn =
    "w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]";

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-sm">
      <h3 className="mb-6 text-center text-lg font-semibold text-[hsl(var(--foreground))]">
        Create your account
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
            Full name
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            onBlur={() => validateField("name")}
            placeholder="Jane Doe"
            autoComplete="name"
            className={inputCn}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-[hsl(var(--destructive))]">{errors.name}</p>
          )}
        </div>

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
            className={inputCn}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-[hsl(var(--destructive))]">{errors.email}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
            Password
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

        {/* Confirm Password */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
            Confirm password
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

        {/* Terms */}
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={form.acceptTerms}
            onChange={(e) => setForm((f) => ({ ...f, acceptTerms: e.target.checked }))}
            onBlur={() => validateField("acceptTerms")}
            className="mt-1 rounded border-[hsl(var(--border))]"
          />
          <label className="text-sm text-[hsl(var(--muted-foreground))]">
            I agree to the{" "}
            <Link href="/terms" className="text-[hsl(var(--primary))] hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-[hsl(var(--primary))] hover:underline">
              Privacy Policy
            </Link>
          </label>
        </div>
        {errors.acceptTerms && (
          <p className="text-xs text-[hsl(var(--destructive))]">{errors.acceptTerms}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading || !isValid}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary))]/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          Create account
        </button>
      </form>

      {/* Divider */}
      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-[hsl(var(--border))]" />
        <span className="text-xs text-[hsl(var(--muted-foreground))]">or continue with</span>
        <div className="h-px flex-1 bg-[hsl(var(--border))]" />
      </div>

      {/* OAuth */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={async () => {
            setOauthLoading("google");
            try { await authClient.signInWithGoogle(); } catch { toast.error("Google sign-up failed"); setOauthLoading(null); }
          }}
          disabled={oauthLoading !== null}
          className="flex items-center justify-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))] disabled:opacity-50"
        >
          {oauthLoading === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Google
        </button>
        <button
          type="button"
          onClick={async () => {
            setOauthLoading("microsoft");
            try { await authClient.signInWithMicrosoft(); } catch { toast.error("Microsoft sign-up failed"); setOauthLoading(null); }
          }}
          disabled={oauthLoading !== null}
          className="flex items-center justify-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))] disabled:opacity-50"
        >
          {oauthLoading === "microsoft" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Microsoft
        </button>
      </div>

      {/* Sign in link */}
      <p className="mt-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[hsl(var(--primary))] hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
