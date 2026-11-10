import type { Page } from "@playwright/test";

export const SUPABASE_CI_URL = "https://axivestra-ci.supabase.co";
export const SUPABASE_CI_STORAGE_KEY = "sb-axivestra-ci-auth-token";

export const CI_USER = {
  id: "6f85c1e4-6c7d-4b67-a889-4ca824a3fc10",
  aud: "authenticated",
  role: "authenticated",
  email: "axivestra-ci@example.test",
  email_confirmed_at: "2026-01-01T00:00:00.000Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  identities: [],
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z"
};

export function createCiSession() {
  const expiresIn = 60 * 60;
  return {
    access_token: "axivestra-ci-access-token",
    token_type: "bearer",
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    refresh_token: "axivestra-ci-refresh-token",
    user: CI_USER
  };
}

/**
 * The browser suite uses a non-production Supabase URL and deterministic API
 * responses. This exercises the real AuthGate and Supabase client without
 * connecting to a live user database or exposing production credentials.
 */
export async function mockSupabaseApi(page: Page) {
  await page.route(SUPABASE_CI_URL + "/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      "access-control-allow-origin": "http://127.0.0.1:4173",
      "access-control-allow-headers": "apikey, authorization, content-type, x-client-info, prefer",
      "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "content-type": "application/json"
    };

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }

    if (url.pathname === "/auth/v1/token" && request.method() === "POST") {
      await route.fulfill({ status: 200, headers, body: JSON.stringify(createCiSession()) });
      return;
    }

    if (url.pathname === "/auth/v1/user" && request.method() === "GET") {
      await route.fulfill({ status: 200, headers, body: JSON.stringify(CI_USER) });
      return;
    }

    // No companies or records are provisioned in the isolated CI identity.
    // The real app therefore follows its normal private Personal Mode path.
    if (url.pathname.startsWith("/rest/v1/")) {
      await route.fulfill({ status: 200, headers, body: "[]" });
      return;
    }

    await route.fulfill({ status: 404, headers, body: JSON.stringify({ message: "Unmocked AXIVESTRA CI endpoint" }) });
  });
}

export async function seedSignedInSession(page: Page) {
  const session = createCiSession();
  await page.addInitScript(({ storageKey, value }) => {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  }, { storageKey: SUPABASE_CI_STORAGE_KEY, value: session });
}
