/**
 * Auth group layout — centred card with V Sync logo.
 * Used for login, signup, forgot-password, reset-password, verify, sso, callback, select-org.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--muted))] px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-lg font-bold text-white">
            VS
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-[hsl(var(--foreground))]">
            V Sync
          </h2>
        </div>

        {/* Page content */}
        {children}
      </div>
    </div>
  );
}
