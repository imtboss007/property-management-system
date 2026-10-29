import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store"
};

type Action =
  | "status" | "queue" | "address-book" | "sync-address-book"
  | "connect" | "pairing-code" | "disconnect" | "schedule"
  | "send-now" | "cancel" | "retry";

const routes: Record<Action, { method: "GET" | "POST"; path: string; write: boolean }> = {
  status: { method: "GET", path: "/api/status", write: false },
  queue: { method: "GET", path: "/api/queue", write: false },
  "address-book": { method: "GET", path: "/api/address-book", write: false },
  "sync-address-book": { method: "POST", path: "/api/sync-address-book", write: true },
  connect: { method: "POST", path: "/api/connect", write: true },
  "pairing-code": { method: "POST", path: "/api/pairing-code", write: true },
  disconnect: { method: "POST", path: "/api/disconnect", write: true },
  schedule: { method: "POST", path: "/api/schedule", write: true },
  "send-now": { method: "POST", path: "/api/send-now", write: true },
  cancel: { method: "POST", path: "/api/cancel", write: true },
  retry: { method: "POST", path: "/api/retry", write: true }
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
  });
}

function defaultKeyFromJson(name: string): string {
  try {
    const value = JSON.parse(Deno.env.get(name) || "{}");
    return value && typeof value.default === "string" ? value.default : "";
  } catch {
    return "";
  }
}

function safeHubUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); }
  catch { throw new Error("The hosted WhatsApp sender URL is not configured correctly."); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("The hosted WhatsApp sender must use a clean HTTPS URL.");
  }
  return url.toString().replace(/\/+$/, "");
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(405, { error: "Use POST to access the hosted sender." });

  const authorization = request.headers.get("Authorization") || "";
  if (!/^Bearer\s+\S+/i.test(authorization)) return jsonResponse(401, { error: "Sign in to AXIVESTRA first." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") || defaultKeyFromJson("SUPABASE_PUBLISHABLE_KEYS");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || defaultKeyFromJson("SUPABASE_SECRET_KEYS");
  const hubToken = Deno.env.get("AXIVESTRA_WHATSAPP_HUB_TOKEN") || "";
  const configuredCompanyId = Deno.env.get("AXIVESTRA_WHATSAPP_COMPANY_ID") || "";
  let hubUrl = "";
  try {
    hubUrl = safeHubUrl(Deno.env.get("AXIVESTRA_WHATSAPP_HUB_URL") || "");
  } catch {
    return jsonResponse(503, { error: "The always-on WhatsApp sender has not been configured for this AXIVESTRA workspace." });
  }
  if (!supabaseUrl || !publicKey || !serviceKey || hubToken.length < 32 || !configuredCompanyId) {
    console.error("whatsapp-cloud-proxy: required server-side settings are missing");
    return jsonResponse(503, { error: "The always-on WhatsApp sender is not fully configured yet." });
  }

  let body: { companyId?: unknown; action?: unknown; payload?: unknown };
  try { body = await request.json(); }
  catch { return jsonResponse(400, { error: "Request body must be valid JSON." }); }

  const companyId = String(body.companyId || "");
  if (companyId !== configuredCompanyId) {
    return jsonResponse(403, { error: "This hosted WhatsApp sender is not assigned to the selected AXIVESTRA company." });
  }
  const action = String(body.action || "") as Action;
  const route = routes[action];
  if (!route) return jsonResponse(400, { error: "Choose a supported WhatsApp action." });
  const payload = body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
    ? body.payload as Record<string, unknown>
    : {};
  if (JSON.stringify(payload).length > 100_000) return jsonResponse(413, { error: "The WhatsApp request is too large." });

  const token = authorization.replace(/^Bearer\s+/i, "");
  const userClient = createClient(supabaseUrl, publicKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return jsonResponse(401, { error: "Your AXIVESTRA session is invalid or expired. Sign in again." });

  const { data: membership, error: membershipError } = await admin
    .from("company_memberships")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (membershipError) {
    console.error("whatsapp-cloud-proxy: membership check failed", membershipError.message);
    return jsonResponse(500, { error: "Could not verify your access to this company." });
  }
  if (!membership) return jsonResponse(403, { error: "You do not have access to this AXIVESTRA company." });
  if (route.write && membership.role === "read_only") {
    return jsonResponse(403, { error: "Read-only members cannot change WhatsApp settings or send/schedule messages." });
  }

  try {
    const upstream = await fetch(hubUrl + route.path, {
      method: route.method,
      headers: {
        "X-EstateFlow-Token": hubToken,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      ...(route.method === "POST" ? { body: JSON.stringify(payload) } : {}),
      signal: AbortSignal.timeout(15_000)
    });
    const raw = await upstream.text();
    let data: Record<string, unknown>;
    try { data = raw ? JSON.parse(raw) as Record<string, unknown> : {}; }
    catch { data = { ok: false, error: "The hosted sender returned an unreadable response." }; }
    if (!upstream.ok) {
      const message = typeof data.error === "string" ? data.error : "The hosted sender request failed.";
      return jsonResponse(upstream.status, { ok: false, error: message });
    }
    return jsonResponse(200, data);
  } catch (error) {
    console.error("whatsapp-cloud-proxy: upstream request failed", String(error instanceof Error ? error.message : error));
    return jsonResponse(502, { ok: false, error: "Could not reach the hosted WhatsApp sender. Check its online status and try again." });
  }
});
