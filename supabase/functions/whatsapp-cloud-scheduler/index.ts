import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Cache-Control": "no-store"
};
const encoder = new TextEncoder();

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
  } catch { return ""; }
}
function graphVersion() {
  const version = Deno.env.get("META_GRAPH_API_VERSION") || "v26.0";
  return /^v\d+\.0$/.test(version) ? version : "v26.0";
}
function digits(value: unknown) { return String(value || "").replace(/\D/g, ""); }
function equalConstantTime(left: string, right: string) {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index++) result |= a[index] ^ b[index];
  return result === 0;
}
async function hmacHex(secret: string, content: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(content)));
  return Array.from(signature, byte => byte.toString(16).padStart(2, "0")).join("");
}
function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || defaultKeyFromJson("SUPABASE_SECRET_KEYS");
  if (!url || !serviceKey) throw new Error("Cloud database service credentials are not configured.");
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}
async function verifiedUser(request: Request) {
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!/^Bearer\s+\S+/i.test(authorization)) return { error: "Sign in to AXIVESTRA before using cloud messaging." };
  const url = Deno.env.get("SUPABASE_URL") || "";
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") || defaultKeyFromJson("SUPABASE_PUBLISHABLE_KEYS");
  if (!url || !publicKey) return { error: "Cloud authentication is not configured on this project." };
  const client = createClient(url, publicKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return { error: "Your session is invalid or expired. Sign in again." };
  return { user: data.user, client };
}
async function getCloudStatus(request: Request, companyId: string) {
  const auth = await verifiedUser(request);
  if ("error" in auth) return jsonResponse(401, { ok: false, ready: false, error: auth.error });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(companyId)) {
    return jsonResponse(400, { ok: false, ready: false, error: "Select a valid AXIVESTRA company." });
  }
  const { data: membership, error: memberError } = await auth.client
    .from("company_memberships").select("role").eq("company_id", companyId).eq("user_id", auth.user.id).maybeSingle();
  if (memberError || !membership) return jsonResponse(403, { ok: false, ready: false, error: "Your account does not have access to this company." });

  const accessToken = Deno.env.get("META_ACCESS_TOKEN") || "";
  const phoneNumberId = Deno.env.get("META_PHONE_NUMBER_ID") || "";
  if (!accessToken || !phoneNumberId) {
    return jsonResponse(200, { ok: true, ready: false, configured: false, companyId, error: "Cloud sending is not activated for this AXIVESTRA workspace yet." });
  }
  try {
    const response = await fetch("https://graph.facebook.com/" + graphVersion() + "/" + encodeURIComponent(phoneNumberId) + "?fields=id,display_phone_number,verified_name", {
      headers: { Authorization: "Bearer " + accessToken },
      signal: AbortSignal.timeout(10000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("WhatsApp cloud status check failed", response.status, data?.error?.code || "provider-error");
      return jsonResponse(200, { ok: true, ready: false, configured: true, companyId, error: "The cloud WhatsApp connection could not be verified. Check the server-side WhatsApp account connection." });
    }
    return jsonResponse(200, {
      ok: true, ready: true, configured: true, companyId,
      senderNumber: digits(data.display_phone_number),
      displayName: String(data.verified_name || ""),
      platform: "cloud-whatsapp-business"
    });
  } catch {
    return jsonResponse(200, { ok: true, ready: false, configured: true, companyId, error: "Could not reach the WhatsApp cloud service. The queue remains saved." });
  }
}
async function sendDueMessages() {
  const schedulerSecret = Deno.env.get("AXIVESTRA_SCHEDULER_SECRET") || "";
  const accessToken = Deno.env.get("META_ACCESS_TOKEN") || "";
  const phoneNumberId = Deno.env.get("META_PHONE_NUMBER_ID") || "";
  if (schedulerSecret.length < 32 || !accessToken || !phoneNumberId) {
    console.error("WhatsApp cloud worker is not configured; no messages claimed.");
    return jsonResponse(503, { ok: false, error: "Cloud worker configuration is incomplete.", processed: 0 });
  }
  const admin = getAdminClient();
  const { data: rows, error } = await admin.rpc("claim_due_whatsapp_messages", { batch_size: 10 });
  if (error) {
    console.error("WhatsApp cloud claim failed", error.message);
    return jsonResponse(500, { ok: false, error: "Could not claim scheduled messages.", processed: 0 });
  }
  let sent = 0;
  let failed = 0;
  for (const row of (rows || []) as Array<Record<string, unknown>>) {
    const id = String(row.id || "");
    try {
      const to = digits(row.to_phone);
      const messageType = String(row.message_type || "text");
      const payload: Record<string, unknown> = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to
      };
      if (messageType === "template") {
        const name = String(row.template_name || "");
        const language = String(row.template_language || "en_US");
        if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error("The approved WhatsApp template name is invalid.");
        const rawParams = Array.isArray(row.template_params) ? row.template_params as unknown[] : [];
        payload.type = "template";
        payload.template = {
          name,
          language: { code: language },
          ...(rawParams.length ? { components: [{ type: "body", parameters: rawParams.slice(0, 20).map(value => ({ type: "text", text: String(value).slice(0, 1024) })) }] } : {})
        };
      } else {
        const body = String(row.message || "").trim();
        if (!body || body.length > 4000) throw new Error("Message text must contain 1 to 4000 characters.");
        payload.type = "text";
        payload.text = { preview_url: false, body };
      }
      const response = await fetch("https://graph.facebook.com/" + graphVersion() + "/" + encodeURIComponent(phoneNumberId) + "/messages", {
        method: "POST",
        headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const providerError = String(result?.error?.message || ("WhatsApp returned HTTP " + response.status)).slice(0, 1400);
        await admin.rpc("finish_whatsapp_cloud_message", {
          target_message_id: id, final_status: "failed", provider_id: "", failure_reason: providerError
        });
        failed++;
        continue;
      }
      const providerMessageId = String(result?.messages?.[0]?.id || "");
      if (!providerMessageId) {
        await admin.rpc("finish_whatsapp_cloud_message", {
          target_message_id: id, final_status: "failed", provider_id: "", failure_reason: "WhatsApp accepted the request without returning a message ID; delivery is uncertain. Check the recipient chat before retrying."
        });
        failed++;
        continue;
      }
      const { error: finishError } = await admin.rpc("finish_whatsapp_cloud_message", {
        target_message_id: id, final_status: "sent", provider_id: providerMessageId, failure_reason: ""
      });
      if (finishError) {
        // Do not resend. WhatsApp has already accepted this message and its status must be reconciled manually.
        console.error("WhatsApp accepted a message but queue completion failed", id, finishError.message);
        failed++;
      } else {
        sent++;
      }
    } catch (error) {
      const reason = error instanceof Error
        ? "Send request failed; delivery may be uncertain. Check the WhatsApp chat before retrying. " + error.message
        : "Send request failed; delivery may be uncertain. Check the WhatsApp chat before retrying.";
      const { error: finishError } = await admin.rpc("finish_whatsapp_cloud_message", {
        target_message_id: id, final_status: "failed", provider_id: "", failure_reason: reason.slice(0, 1450)
      });
      if (finishError) console.error("WhatsApp uncertain-send status update failed", id, finishError.message);
      failed++;
    }
  }
  return jsonResponse(200, { ok: true, processed: (rows || []).length, sent, failed, note: "Sent means Meta accepted the API request, not that the recipient read the message." });
}
async function handleWebhook(request: Request, rawBody: string) {
  const secret = Deno.env.get("META_APP_SECRET") || "";
  const supplied = request.headers.get("x-hub-signature-256") || "";
  if (!secret || !/^sha256=[a-f0-9]{64}$/i.test(supplied)) return jsonResponse(401, { ok: false, error: "Webhook signature is missing or invalid." });
  const expected = "sha256=" + await hmacHex(secret, rawBody);
  if (!equalConstantTime(supplied.toLowerCase(), expected.toLowerCase())) return jsonResponse(401, { ok: false, error: "Webhook signature is invalid." });
  let body: Record<string, unknown>;
  try { body = JSON.parse(rawBody); } catch { return jsonResponse(400, { ok: false, error: "Webhook body is not valid JSON." }); }
  const entry = Array.isArray(body.entry) ? body.entry as Array<Record<string, unknown>> : [];
  const senders = new Set<string>();
  for (const item of entry) {
    const changes = Array.isArray(item.changes) ? item.changes as Array<Record<string, unknown>> : [];
    for (const change of changes) {
      const value = change.value && typeof change.value === "object" ? change.value as Record<string, unknown> : {};
      const messages = Array.isArray(value.messages) ? value.messages as Array<Record<string, unknown>> : [];
      for (const message of messages) {
        const from = digits(message.from);
        if (from.length >= 8 && from.length <= 15) senders.add(from);
      }
    }
  }
  if (senders.size) {
    try {
      const admin = getAdminClient();
      for (const phone of senders) {
        const { error } = await admin.rpc("cancel_whatsapp_cloud_followups_for_reply", { target_phone: phone });
        if (error) console.error("Reply-stop queue update failed", error.message);
      }
    } catch (error) {
      console.error("Reply-stop handler could not reach the cloud queue", error instanceof Error ? error.message : "unknown");
      return jsonResponse(500, { ok: false, error: "Could not update scheduled follow-ups." });
    }
  }
  return jsonResponse(200, { ok: true, inboundSendersProcessed: senders.size });
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(request.url);
  if (request.method === "GET" && url.searchParams.has("hub.mode")) {
    const verify = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") || "";
    const mode = url.searchParams.get("hub.mode") || "";
    const token = url.searchParams.get("hub.verify_token") || "";
    const challenge = url.searchParams.get("hub.challenge") || "";
    if (verify && mode === "subscribe" && equalConstantTime(token, verify)) {
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
    }
    return new Response("Forbidden", { status: 403 });
  }
  if (request.method === "GET") return jsonResponse(200, { ok: true, service: "AXIVESTRA WhatsApp cloud scheduler" });
  if (request.method !== "POST") return jsonResponse(405, { ok: false, error: "Use POST." });

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (signature) return await handleWebhook(request, rawBody);

  let body: Record<string, unknown>;
  try { body = JSON.parse(rawBody); } catch { return jsonResponse(400, { ok: false, error: "Request must contain valid JSON." }); }
  const action = String(body.action || "");
  if (action === "dispatch") {
    const expected = Deno.env.get("AXIVESTRA_SCHEDULER_SECRET") || "";
    const supplied = request.headers.get("x-axivestra-scheduler-secret") || "";
    if (expected.length < 32 || !equalConstantTime(supplied, expected)) return jsonResponse(401, { ok: false, error: "Scheduler authentication failed." });
    return await sendDueMessages();
  }
  if (action === "status") return await getCloudStatus(request, String(body.companyId || ""));
  return jsonResponse(400, { ok: false, error: "Unknown action." });
});
