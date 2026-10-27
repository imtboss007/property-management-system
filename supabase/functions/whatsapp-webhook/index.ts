import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const textResponse = (body: string, status = 200) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async (request: Request) => {
  const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "";
  const appSecret = Deno.env.get("WHATSAPP_APP_SECRET") ?? "";

  if (request.method === "GET") {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && verifyToken && token === verifyToken && challenge) {
      return textResponse(challenge);
    }
    return textResponse("Webhook verification failed", 403);
  }
  if (request.method !== "POST") return textResponse("Method not allowed", 405);

  if (!verifyToken || !appSecret) return jsonResponse({ error: "Webhook secrets are not configured" }, 500);
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256") ?? "";
  if (!await verifySignature(rawBody, signature, appSecret)) {
    return jsonResponse({ error: "Invalid webhook signature" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Supabase secrets are missing" }, 500);
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const messages: any[] = [];
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      for (const message of change?.value?.messages ?? []) messages.push(message);
    }
  }

  let stopped = 0;
  for (const message of messages) {
    const from = normalizePhone(message?.from);
    const groupId = String(message?.group_id ?? "").trim();
    if (!from && !groupId) continue;
    const { data: candidates, error } = await admin.from("whatsapp_followups")
      .select("id,phone,status,recipient_type")
      .eq("stop_on_reply", true)
      .in("status", ["scheduled", "processing", "sent"]);
    if (error) return jsonResponse({ error: "Could not load follow-up queue", detail: error.message }, 500);

    const matchingIds = (candidates ?? [])
      .filter((row: { phone: string; recipient_type?: string }) => {
        if (groupId) return row.recipient_type === "group" && String(row.phone).trim() === groupId;
        return row.recipient_type !== "group" && normalizePhone(row.phone) === from;
      })
      .map((row: { id: string }) => row.id);

    if (matchingIds.length) {
      const { error: updateError } = await admin.from("whatsapp_followups")
        .update({ status: "replied", replied_at: new Date().toISOString(), last_error: null })
        .in("id", matchingIds)
        .in("status", ["scheduled", "processing", "sent"]);
      if (updateError) return jsonResponse({ error: "Could not stop follow-ups", detail: updateError.message }, 500);
      stopped += matchingIds.length;
    }
  }
  return jsonResponse({ received: messages.length, stopped });
});

function normalizePhone(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

async function verifySignature(body: string, provided: string, secret: string): Promise<boolean> {
  if (!provided.startsWith("sha256=")) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
  const expected = "sha256=" + Array.from(digest).map(value => value.toString(16).padStart(2, "0")).join("");
  if (expected.length !== provided.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return difference === 0;
}
