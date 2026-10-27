const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "POST required" }, 405);
  // Supabase Functions gateway verifies the user's JWT (verify_jwt=true in config.toml).
  if (!request.headers.get("authorization")?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "";
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
  const graphVersion = Deno.env.get("WHATSAPP_GRAPH_API_VERSION") ?? "";
  const groupsEnabled = (Deno.env.get("WHATSAPP_GROUPS_API_ENABLED") ?? "").toLowerCase() === "true";
  if (!accessToken || !phoneNumberId || !/^v\d+\.\d+$/.test(graphVersion)) {
    return json({
      configured: false, connected: false, senderNumber: "", verifiedName: "",
      qualityRating: "", groupsEnabled: false,
      message: "WhatsApp sender is not configured. Add the Meta access token, Phone Number ID and supported Graph API version to Supabase Edge Function secrets."
    });
  }

  try {
    const response = await fetch("https://graph.facebook.com/" + graphVersion + "/" + phoneNumberId + "?fields=display_phone_number,verified_name,quality_rating,code_verification_status", {
      headers: { Authorization: "Bearer " + accessToken },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return json({
        configured: true, connected: false, senderNumber: "", verifiedName: "",
        qualityRating: "", groupsEnabled: false,
        error: String(result?.error?.message ?? ("Meta connection check failed (HTTP " + response.status + ").")).slice(0, 500)
      });
    }
    return json({
      configured: true,
      connected: true,
      senderNumber: String(result?.display_phone_number ?? ""),
      verifiedName: String(result?.verified_name ?? ""),
      qualityRating: String(result?.quality_rating ?? ""),
      groupsEnabled,
      message: groupsEnabled
        ? "Meta WhatsApp sender connected; official Groups API routing is enabled by server configuration."
        : "Meta WhatsApp sender connected; individual messaging is available."
    });
  } catch (error) {
    return json({
      configured: true, connected: false, senderNumber: "", verifiedName: "",
      qualityRating: "", groupsEnabled: false,
      error: error instanceof Error ? error.message.slice(0, 500) : "Meta connection check failed."
    }, 502);
  }
});
