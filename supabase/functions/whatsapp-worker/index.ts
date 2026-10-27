import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "POST required" }, 405);

  const workerSecret = Deno.env.get("ESTATEFLOW_WORKER_SECRET") ?? "";
  const providedSecret = request.headers.get("x-estateflow-worker-secret") ?? "";
  if (!workerSecret || providedSecret.length !== workerSecret.length ||
      !cryptoSafeEqual(providedSecret, workerSecret)) {
    return json({ error: "Unauthorized worker request" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "";
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
  const graphVersion = Deno.env.get("WHATSAPP_GRAPH_API_VERSION") ?? "";
  const groupsEnabled = (Deno.env.get("WHATSAPP_GROUPS_API_ENABLED") ?? "").toLowerCase() === "true";
  if (!supabaseUrl || !serviceRoleKey || !accessToken || !phoneNumberId || !/^v\d+\.\d+$/.test(graphVersion)) {
    return json({ error: "Missing Supabase or WhatsApp worker secrets" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: dueRows, error: claimError } = await admin.rpc(
    "estateflow_claim_due_whatsapp_followups",
    { batch_size: 100 },
  );
  if (claimError) return json({ error: "Could not claim due follow-ups", detail: claimError.message }, 500);

  let sent = 0;
  let failed = 0;
  for (const row of dueRows ?? []) {
    try {
      if (!row.consent_confirmed || !row.template_name || !row.template_language) {
        throw new Error("Consent or approved template is missing");
      }

      // A reply may have arrived after the row was claimed; re-check before sending.
      const { data: current, error: currentError } = await admin
        .from("whatsapp_followups")
        .select("status,stop_on_reply,consent_confirmed")
        .eq("id", row.id)
        .maybeSingle();
      if (currentError) throw currentError;
      if (!current || current.status !== "processing" || !current.consent_confirmed) continue;

      const recipientType = row.recipient_type === "group" ? "group" : "individual";
      if (recipientType === "group" && !groupsEnabled) throw new Error("Official Groups API sending is not enabled for this account.");
      const target = recipientType === "group" ? String(row.phone ?? "").trim() : String(row.phone ?? "").replace(/\D/g, "");
      if (recipientType === "individual" && (target.length < 8 || target.length > 15)) throw new Error("Recipient phone number is invalid");
      if (recipientType === "group" && target.length < 8) throw new Error("Official WhatsApp Groups API group ID is missing or invalid");
      const params = Array.isArray(row.template_parameters) ? row.template_parameters : [];
      const components = params.length
        ? [{ type: "body", parameters: params.map((value: unknown) => ({ type: "text", text: String(value) })) }]
        : undefined;

      const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: recipientType,
          to: target,
          type: "template",
          template: {
            name: row.template_name,
            language: { code: row.template_language },
            ...(components ? { components } : {}),
          },
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = result?.error?.message ?? `WhatsApp API returned HTTP ${response.status}`;
        throw new Error(String(detail).slice(0, 1800));
      }

      const providerMessageId = result?.messages?.[0]?.id ?? null;
      const { error: updateError } = await admin.from("whatsapp_followups").update({
        status: "sent",
        provider_message_id: providerMessageId,
        sent_at: new Date().toISOString(),
        last_error: null,
      }).eq("id", row.id).eq("status", "processing");
      if (updateError) throw updateError;
      sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await admin.from("whatsapp_followups").update({
        status: "failed",
        last_error: message.slice(0, 1900),
      }).eq("id", row.id).eq("status", "processing");
      failed++;
    }
  }

  return json({ claimed: (dueRows ?? []).length, sent, failed });
});

function cryptoSafeEqual(left: string, right: string): boolean {
  let difference = 0;
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}
