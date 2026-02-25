"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Workflow,
  Play,
  Monitor,
  Blocks,
  Settings,
  ChevronLeft,
  ChevronRight,
  Building2,
  User,
  LogOut,
  ArrowLeftRight,
  ChevronDown,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import type { AuthSession } from "@/lib/auth-client";

/* ── Constants ───────────────────────────────────────────────── */

const SIDEBAR_KEY = "vsync:sidebar-collapsed";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Workflows", href: "/workflows", icon: Workflow },
  { label: "Runs", href: "/runs", icon: Play },
  { label: "Devices", href: "/devices", icon: Monitor },
  { label: "Templates", href: "/templates", icon: Blocks },
  { label: "Settings", href: "/settings", icon: Settings },
] as const;

/* ── Sidebar component ───────────────────────────────────────── */

function AppSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={`flex h-screen flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-[hsl(var(--border))] px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary))] text-xs font-bold text-[hsl(var(--primary-foreground))]">
          VS
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
            V Sync
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-[hsl(var(--primary))]/10 font-medium text-[hsl(var(--primary))]"
                  : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
              } ${collapsed ? "justify-center px-0" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-[hsl(var(--border))] p-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-center rounded-md p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  );
}

/* ── Header component ────────────────────────────────────────── */

function AppHeader({ session }: { session: AuthSession | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  /* Build breadcrumb from pathname */
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs = segments.map((seg, i) => ({
    label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " "),
    href: "/" + segments.slice(0, i + 1).join("/"),
  }));

  const handleSignOut = useCallback(async () => {
    await authClient.signOut();
    router.push("/login");
  }, [router]);

  return (
    <header className="flex h-14 items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1.5">
            {i > 0 && (
              <span className="text-[hsl(var(--muted-foreground))]">/</span>
            )}
            {i === breadcrumbs.length - 1 ? (
              <span className="font-medium text-[hsl(var(--foreground))]">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Right side: user menu */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[hsl(var(--muted))]"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10 text-xs font-medium text-[hsl(var(--primary))]">
            {session?.user.name?.charAt(0)?.toUpperCase() ?? "?"}
          </div>
          <span className="text-sm text-[hsl(var(--foreground))]">
            {session?.user.name ?? "User"}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
        </button>

        {/* Dropdown */}
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-1 shadow-lg">
              <Link
                href="/settings"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
              >
                <User className="h-4 w-4" />
                Profile
              </Link>
              <Link
                href="/select-org"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
              >
                <ArrowLeftRight className="h-4 w-4" />
                Switch Org
              </Link>
              <div className="my-1 border-t border-[hsl(var(--border))]" />
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--destructive))] hover:bg-[hsl(var(--muted))]"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

/* ── Dashboard layout ────────────────────────────────────────── */

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);

  /* Restore sidebar state */
  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_KEY);
    if (saved === "true") setCollapsed(true);
  }, []);

  /* Load session */
  useEffect(() => {
    void authClient.getSession().then(setSession);
  }, []);

  const handleToggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-[hsl(var(--background))]">
      <AppSidebar collapsed={collapsed} onToggle={handleToggle} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader session={session} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
