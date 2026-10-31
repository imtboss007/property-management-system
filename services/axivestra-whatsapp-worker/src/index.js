const DEFAULT_GRAPH_VERSION = "v26.0";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const encoder = new TextEncoder();

function digits(value) {
  return String(value ?? "").replace(/\D/g, "");
}
function jsonResponse(request, env, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request, env), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}
function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.CORS_ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean);
  const allowOrigin = !allowed.length ? "*" : (allowed.includes(origin) ? origin : "");
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Apikey, Content-Type, X-Axivestra-Scheduler-Secret, X-Hub-Signature-256",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
  if (allowOrigin) headers["Access-Control-Allow-Origin"] = allowOrigin;
  return headers;
}
function graphVersion(env) {
  const version = String(env.META_GRAPH_API_VERSION || DEFAULT_GRAPH_VERSION);
  return /^v\d+\.0$/.test(version) ? version : DEFAULT_GRAPH_VERSION;
}
function equalConstantTime(left, right) {
  const a = encoder.encode(String(left || ""));
  const b = encoder.encode(String(right || ""));
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index++) diff |= a[index] ^ b[index];
  return diff === 0;
}
async function hmacHex(secret, content) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(content)));
  return Array.from(signature, byte => byte.toString(16).padStart(2, "0")).join("");
}
function supabaseBase(env) {
  const base = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
  if (!/^https:\/\//i.test(base)) throw new Error("Supabase URL is not configured.");
  return base;
}
function serviceHeaders(env) {
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!key) throw new Error("Supabase service credentials are not configured.");
  return { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" };
}
async function adminRpc(env, name, body) {
  const response = await fetch(supabaseBase(env) + "/rest/v1/rpc/" + encodeURIComponent(name), {
    method: "POST", headers: serviceHeaders(env), body: JSON.stringify(body), signal: AbortSignal.timeout(15000)
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { /* keep provider text out of returned errors */ }
  if (!response.ok) return { error: "Supabase RPC " + name + " failed with HTTP " + response.status, data: null };
  return { error: null, data };
}
async function verifiedUser(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  if (!/^Bearer\s+\S+/i.test(authorization)) return { error: "Sign in to AXIVESTRA before using cloud messaging.", status: 401 };
  const base = supabaseBase(env);
  const publicKey = String(env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || "");
  if (!publicKey) return { error: "AXIVESTRA cloud authentication is not configured.", status: 503 };
  const response = await fetch(base + "/auth/v1/user", {
    headers: { apikey: publicKey, Authorization: authorization },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) return { error: "Your AXIVESTRA session is invalid or expired. Sign in again.", status: 401 };
  const user = await response.json().catch(() => null);
  return user?.id ? { user, authorization, publicKey, base } : { error: "Your AXIVESTRA session is invalid or expired.", status: 401 };
}
async function getCloudStatus(request, env, companyId) {
  const auth = await verifiedUser(request, env);
  if (auth.error) return jsonResponse(request, env, auth.status, { ok: false, ready: false, error: auth.error });
  if (!UUID_RE.test(String(companyId || ""))) return jsonResponse(request, env, 400, { ok: false, ready: false, error: "Select a valid AXIVESTRA company." });
  const membershipUrl = new URL(auth.base + "/rest/v1/company_memberships");
  membershipUrl.searchParams.set("select", "role");
  membershipUrl.searchParams.set("company_id", "eq." + companyId);
  membershipUrl.searchParams.set("user_id", "eq." + auth.user.id);
  membershipUrl.searchParams.set("limit", "1");
  const memberResponse = await fetch(membershipUrl.toString(), {
    headers: { apikey: auth.publicKey, Authorization: auth.authorization },
    signal: AbortSignal.timeout(10000)
  });
  const memberships = memberResponse.ok ? await memberResponse.json().catch(() => []) : [];
  if (!Array.isArray(memberships) || !memberships.length) {
    return jsonResponse(request, env, 403, { ok: false, ready: false, error: "Your account does not have access to this AXIVESTRA company." });
  }
  const accessToken = String(env.META_ACCESS_TOKEN || "");
  const phoneNumberId = String(env.META_PHONE_NUMBER_ID || "");
  const schedulerSecret = String(env.AXIVESTRA_SCHEDULER_SECRET || "");
  const senderCompanyId = String(env.AXIVESTRA_WA_COMPANY_ID || "");
  const webhookConfigured = Boolean(env.META_APP_SECRET && env.META_WEBHOOK_VERIFY_TOKEN);
  if (!accessToken || !phoneNumberId || schedulerSecret.length < 32) {
    return jsonResponse(request, env, 200, { ok: true, ready: false, configured: false, webhookConfigured, companyId, error: "Cloud sender credentials are not fully configured yet." });
  }
  if (!UUID_RE.test(senderCompanyId) || senderCompanyId !== companyId) {
    return jsonResponse(request, env, 200, { ok: true, ready: false, configured: false, webhookConfigured, companyId, error: "The hosted WhatsApp sender is restricted to its configured AXIVESTRA company." });
  }
  try {
    const response = await fetch("https://graph.facebook.com/" + graphVersion(env) + "/" + encodeURIComponent(phoneNumberId) + "?fields=id,display_phone_number,verified_name", {
      headers: { Authorization: "Bearer " + accessToken },
      signal: AbortSignal.timeout(10000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("WhatsApp cloud status check failed", response.status, data?.error?.code || "provider-error");
      return jsonResponse(request, env, 200, { ok: true, ready: false, configured: true, webhookConfigured, companyId, error: "The cloud WhatsApp connection could not be verified. Check the business sender connection." });
    }
    return jsonResponse(request, env, 200, {
      ok: true, ready: true, configured: true, companyId,
      senderNumber: digits(data.display_phone_number),
      displayName: String(data.verified_name || ""),
      platform: "cloud-whatsapp-business",
      webhookConfigured
    });
  } catch {
    return jsonResponse(request, env, 200, { ok: true, ready: false, configured: true, webhookConfigured, companyId, error: "Could not reach the WhatsApp cloud service. The queue remains saved." });
  }
}
async function finishMessage(env, id, companyId, status, providerId, reason) {
  const result = await adminRpc(env, "finish_whatsapp_cloud_message", {
    target_message_id: id, target_company_id: companyId, final_status: status,
    provider_id: providerId || "", failure_reason: reason || ""
  });
  return !result.error && result.data === true;
}
async function sendDueMessages(env) {
  const schedulerSecret = String(env.AXIVESTRA_SCHEDULER_SECRET || "");
  const accessToken = String(env.META_ACCESS_TOKEN || "");
  const phoneNumberId = String(env.META_PHONE_NUMBER_ID || "");
  const companyId = String(env.AXIVESTRA_WA_COMPANY_ID || "");
  if (schedulerSecret.length < 32 || !accessToken || !phoneNumberId || !UUID_RE.test(companyId)) {
    console.error("WhatsApp cloud worker is not configured; no messages claimed.");
    return { ok: false, processed: 0, error: "Cloud worker configuration is incomplete." };
  }
  const claimed = await adminRpc(env, "claim_due_whatsapp_messages", { batch_size: 10, target_company_id: companyId });
  if (claimed.error || !Array.isArray(claimed.data)) {
    console.error("WhatsApp queue claim failed.");
    return { ok: false, processed: 0, error: "Could not claim scheduled messages." };
  }
  let sent = 0, failed = 0;
  for (const row of claimed.data) {
    const id = String(row.id || "");
    try {
      const to = digits(row.to_phone);
      if (to.length < 8 || to.length > 15) throw new Error("Recipient phone number is invalid.");
      const payload = { messaging_product: "whatsapp", recipient_type: "individual", to };
      if (String(row.message_type || "text") === "template") {
        const name = String(row.template_name || "");
        const language = String(row.template_language || "en_US");
        if (!/^[A-Za-z0-9_]{1,128}$/.test(name) || !/^[A-Za-z0-9_]{2,20}$/.test(language)) {
          throw new Error("The approved WhatsApp template name or language is invalid.");
        }
        const params = Array.isArray(row.template_params) ? row.template_params.slice(0, 20) : [];
        payload.type = "template";
        payload.template = {
          name,
          language: { code: language },
          ...(params.length ? { components: [{ type: "body", parameters: params.map(value => ({ type: "text", text: String(value).slice(0, 1024) })) }] } : {})
        };
      } else {
        const body = String(row.message || "").trim();
        if (!body || body.length > 4000) throw new Error("Message text must contain 1 to 4000 characters.");
        payload.type = "text";
        payload.text = { preview_url: false, body };
      }
      const response = await fetch("https://graph.facebook.com/" + graphVersion(env) + "/" + encodeURIComponent(phoneNumberId) + "/messages", {
        method: "POST",
        headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const reason = String(result?.error?.message || ("WhatsApp returned HTTP " + response.status)).slice(0, 1400);
        if (!await finishMessage(env, id, companyId, "failed", "", reason)) {
          console.error("WhatsApp provider rejection could not be recorded for a queue row.");
        }
        failed++;
        continue;
      }
      const providerId = String(result?.messages?.[0]?.id || "");
      if (!providerId) {
        await finishMessage(env, id, companyId, "failed", "", "WhatsApp accepted the request without returning a message ID; delivery is uncertain. Check the recipient chat before retrying.");
        failed++;
        continue;
      }
      if (!await finishMessage(env, id, companyId, "sent", providerId, "")) {
        // The provider may already have accepted this message: never enqueue an automatic resend.
        console.error("WhatsApp accepted a message but queue completion failed.");
        failed++;
      } else {
        sent++;
      }
    } catch (error) {
      const reason = (error instanceof Error ? error.message : "Send request failed") +
        ". Delivery may be uncertain. Check the WhatsApp chat before retrying.";
      if (!await finishMessage(env, id, companyId, "failed", "", reason.slice(0, 1450))) {
        console.error("WhatsApp uncertain-send status could not be saved.");
      }
      failed++;
    }
  }
  return { ok: true, processed: claimed.data.length, sent, failed };
}
async function handleWebhook(request, env) {
  const secret = String(env.META_APP_SECRET || "");
  const supplied = request.headers.get("x-hub-signature-256") || "";
  if (!secret || !/^sha256=[a-f0-9]{64}$/i.test(supplied)) {
    return jsonResponse(request, env, 401, { ok: false, error: "Webhook signature is missing or invalid." });
  }
  const rawBody = await request.text();
  const expected = "sha256=" + await hmacHex(secret, rawBody);
  if (!equalConstantTime(supplied.toLowerCase(), expected.toLowerCase())) {
    return jsonResponse(request, env, 401, { ok: false, error: "Webhook signature is invalid." });
  }
  let body;
  try { body = JSON.parse(rawBody); } catch {
    return jsonResponse(request, env, 400, { ok: false, error: "Webhook body is not valid JSON." });
  }
  const companyId = String(env.AXIVESTRA_WA_COMPANY_ID || "");
  if (!UUID_RE.test(companyId)) return jsonResponse(request, env, 503, { ok: false, error: "Sender company is not configured." });
  const entry = Array.isArray(body.entry) ? body.entry : [];
  let inboundProcessed = 0, statusProcessed = 0;
  for (const item of entry) {
    const changes = Array.isArray(item?.changes) ? item.changes : [];
    for (const change of changes) {
      const value = change?.value && typeof change.value === "object" ? change.value : {};
      const messages = Array.isArray(value.messages) ? value.messages : [];
      for (const message of messages) {
        const from = digits(message?.from);
        if (from.length < 8 || from.length > 15) continue;
        const result = await adminRpc(env, "cancel_whatsapp_cloud_followups_for_reply", {
          target_phone: from, target_company_id: companyId
        });
        if (!result.error) inboundProcessed++;
        else console.error("Reply-stop queue update failed.");
      }
      const statuses = Array.isArray(value.statuses) ? value.statuses : [];
      for (const status of statuses) {
        const providerId = String(status?.id || "");
        const providerStatus = String(status?.status || "").toLowerCase();
        if (!providerId || !["delivered", "read", "failed"].includes(providerStatus)) continue;
        const timestamp = Number(status.timestamp);
        const occurredAt = Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp * 1000).toISOString() : new Date().toISOString();
        const errors = Array.isArray(status.errors) ? status.errors : [];
        const reason = errors.map(error => String(error?.error_data?.details || error?.title || error?.message || "Meta reported a delivery failure")).join("; ").slice(0, 1400);
        const result = await adminRpc(env, "apply_whatsapp_cloud_delivery_status", {
          target_provider_id: providerId,
          target_company_id: companyId,
          target_status: providerStatus,
          target_occurred_at: occurredAt,
          failure_reason: reason
        });
        if (!result.error) statusProcessed++;
        else console.error("WhatsApp delivery status update failed.");
      }
    }
  }
  return jsonResponse(request, env, 200, { ok: true, inboundSendersProcessed: inboundProcessed, deliveryStatusesProcessed: statusProcessed });
}
async function handleFetch(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  const url = new URL(request.url);
  if (url.pathname === "/health" && request.method === "GET") {
    return jsonResponse(request, env, 200, { ok: true, service: "AXIVESTRA WhatsApp Worker", scheduler: "cloudflare-cron" });
  }
  if (url.pathname === "/webhook" && request.method === "GET") {
    const verify = String(env.META_WEBHOOK_VERIFY_TOKEN || "");
    const mode = url.searchParams.get("hub.mode") || "";
    const token = url.searchParams.get("hub.verify_token") || "";
    const challenge = url.searchParams.get("hub.challenge") || "";
    if (verify.length >= 32 && mode === "subscribe" && equalConstantTime(token, verify)) {
      return new Response(challenge, { status: 200, headers: { ...corsHeaders(request, env), "Content-Type": "text/plain", "Cache-Control": "no-store" } });
    }
    return new Response("Forbidden", { status: 403, headers: corsHeaders(request, env) });
  }
  if (url.pathname === "/webhook" && request.method === "POST") return await handleWebhook(request, env);
  if (url.pathname === "/status" && request.method === "POST") {
    let body;
    try { body = await request.json(); } catch { return jsonResponse(request, env, 400, { ok: false, ready: false, error: "Request must contain valid JSON." }); }
    return await getCloudStatus(request, env, String(body?.companyId || ""));
  }
  if (url.pathname === "/dispatch" && request.method === "POST") {
    const expected = String(env.AXIVESTRA_SCHEDULER_SECRET || "");
    const supplied = request.headers.get("x-axivestra-scheduler-secret") || "";
    if (expected.length < 32 || !equalConstantTime(supplied, expected)) return jsonResponse(request, env, 401, { ok: false, error: "Scheduler authentication failed." });
    const result = await sendDueMessages(env);
    return jsonResponse(request, env, result.ok ? 200 : 503, result);
  }
  return jsonResponse(request, env, 404, { ok: false, error: "Not found." });
}
export const workerInternals = { digits, equalConstantTime, graphVersion };
export const dispatchDueMessages = sendDueMessages;
export default {
  async fetch(request, env) {
    try { return await handleFetch(request, env); }
    catch (error) {
      console.error("AXIVESTRA Worker request failed.", error instanceof Error ? error.message : "unknown error");
      return jsonResponse(request, env, 500, { ok: false, error: "AXIVESTRA cloud messaging is temporarily unavailable." });
    }
  },
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(sendDueMessages(env).catch(error => {
      console.error("AXIVESTRA scheduled dispatcher failed.", error instanceof Error ? error.message : "unknown error");
    }));
  }
};
