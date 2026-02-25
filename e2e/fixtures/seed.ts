/**
 * API-based seeding functions for E2E tests.
 *
 * Seeds data via HTTP calls to the running API server — we cannot
 * access PGlite directly because it lives in the API process.
 */

const API_URL = "http://localhost:3001";

interface SeedResult {
  userId: string | null;
  orgId: string | null;
  workflowIds: string[];
  sessionCookie: string | null;
}

/**
 * Create a user, org, and workflows via API calls.
 * Idempotent — 409 on signup means user already exists.
 */
export async function seedViaApi(
  user: { email: string; password: string; name: string },
  orgName: string,
  workflowNames: string[],
): Promise<SeedResult> {
  const result: SeedResult = {
    userId: null,
    orgId: null,
    workflowIds: [],
    sessionCookie: null,
  };

  /* 1. Sign up */
  const signupRes = await fetch(`${API_URL}/api/v1/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });

  if (!signupRes.ok && signupRes.status !== 409) {
    const body = await signupRes.text();
    console.warn(`[e2e:seed] Signup ${signupRes.status}: ${body}`);
  }

  /* 2. Sign in to get a session cookie */
  const signinRes = await fetch(`${API_URL}/api/v1/auth/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });

  const cookies = signinRes.headers.getSetCookie?.() ?? [];
  result.sessionCookie =
    cookies
      .find(
        (c: string) =>
          c.startsWith("session_token=") ||
          c.startsWith("better-auth.session_token="),
      )
      ?.split(";")[0] ?? null;

  if (!signinRes.ok) {
    const body = await signinRes.text();
    console.warn(`[e2e:seed] Signin ${signinRes.status}: ${body}`);
  }

  const signinBody = (await signinRes.json().catch(() => null)) as {
    data?: { user?: { id?: string } };
  } | null;
  result.userId = signinBody?.data?.user?.id ?? null;

  if (!result.sessionCookie) {
    console.warn("[e2e:seed] No session cookie — seeding may be incomplete");
    return result;
  }

  const authHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Cookie: result.sessionCookie,
  };

  /* 3. Create organization */
  const orgRes = await fetch(`${API_URL}/api/v1/orgs`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ name: orgName }),
  });

  const orgBody = (await orgRes.json().catch(() => null)) as {
    data?: { id?: string };
  } | null;
  result.orgId = orgBody?.data?.id ?? null;

  /* 4. Create seed workflows */
  if (result.orgId) {
    for (const wfName of workflowNames) {
      const wfRes = await fetch(`${API_URL}/api/v1/workflows`, {
        method: "POST",
        headers: { ...authHeaders, "X-Org-Id": result.orgId },
        body: JSON.stringify({ name: wfName }),
      });

      const wfBody = (await wfRes.json().catch(() => null)) as {
        data?: { id?: string };
      } | null;

      if (wfBody?.data?.id) {
        result.workflowIds.push(wfBody.data.id);
      }
    }
  }

  return result;
}
