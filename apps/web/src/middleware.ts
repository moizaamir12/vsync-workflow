import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Route-protection middleware.
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │ Public routes (no session required):                        │
 * │   /login, /signup, /forgot-password, /reset-password,       │
 * │   /verify, /sso, /callback/*                                │
 * │                                                             │
 * │ Session required (redirects → /login):                      │
 * │   /dashboard, /workflows, /runs, /settings, /select-org     │
 * │                                                             │
 * │ Org required (redirects → /select-org):                     │
 * │   /dashboard, /workflows, /runs, /settings                  │
 * └──────────────────────────────────────────────────────────────┘
 *
 * Session detection is based on the presence of a "session_token"
 * cookie (set by Better Auth). The actual session validity is
 * confirmed server-side on API calls.
 *
 * Org selection is tracked via an "active_org" cookie that is set
 * when the user picks an organization on /select-org.
 */

const PUBLIC_PATHS = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify",
  "/sso",
]);

/** Paths that start with these prefixes are public */
const PUBLIC_PREFIXES = ["/callback/", "/api/", "/templates/", "/w/"];

/** Paths that require a session but NOT an active org */
const SESSION_ONLY_PATHS = new Set(["/select-org"]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /* ── Skip static assets and Next.js internals ── */
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const sessionToken =
    request.cookies.get("session_token")?.value ??
    request.cookies.get("better-auth.session_token")?.value;
  const activeOrg = request.cookies.get("active_org")?.value;

  const hasSession = !!sessionToken;
  const hasOrg = !!activeOrg;

  /* ── Public routes ─────────────────────────── */

  if (isPublicPath(pathname)) {
    /* If already authenticated, redirect away from auth pages */
    if (hasSession && PUBLIC_PATHS.has(pathname)) {
      const target = hasOrg ? "/dashboard" : "/select-org";
      return NextResponse.redirect(new URL(target, request.url));
    }
    return NextResponse.next();
  }

  /* ── Protected routes: require session ──────── */

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  /* ── Session-only paths (e.g. /select-org) ──── */

  if (SESSION_ONLY_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  /* ── Remaining routes: require active org ───── */

  if (!hasOrg) {
    return NextResponse.redirect(new URL("/select-org", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
