import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store"
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

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(405, { error: "Use POST to invite a company member." });

  const authorization = request.headers.get("Authorization") || "";
  if (!/^Bearer\s+\S+/i.test(authorization)) return jsonResponse(401, { error: "Sign in before inviting a company member." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") || defaultKeyFromJson("SUPABASE_PUBLISHABLE_KEYS");
  const secretKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || defaultKeyFromJson("SUPABASE_SECRET_KEYS");
  if (!supabaseUrl || !publicKey || !secretKey) {
    console.error("invite-company-member: required Supabase server environment is missing");
    return jsonResponse(503, { error: "Company invitations are not configured on this Supabase project yet." });
  }

  const token = authorization.replace(/^Bearer\s+/i, "");
  const userClient = createClient(supabaseUrl, publicKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });

  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  const caller = authData.user;
  if (authError || !caller) return jsonResponse(401, { error: "Your session is invalid or expired. Sign in again." });

  let body: { companyId?: unknown; email?: unknown; role?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "Request must contain valid JSON." });
  }
  const companyId = String(body.companyId || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const role = String(body.role || "staff");
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(companyId)) return jsonResponse(400, { error: "A valid company ID is required." });
  if (!emailPattern.test(email) || email.length > 254) return jsonResponse(400, { error: "Enter a valid email address." });
  if (!["admin", "manager", "staff", "read_only"].includes(role)) {
    return jsonResponse(400, { error: "Choose Admin, Manager, Staff or Read-only. Owner access cannot be invited." });
  }

  const { data: callerMembership, error: membershipLookupError } = await admin
    .from("company_memberships")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", caller.id)
    .maybeSingle();
  if (membershipLookupError) {
    console.error("invite-company-member: caller membership lookup failed", membershipLookupError.message);
    return jsonResponse(500, { error: "Could not verify your company permissions." });
  }
  if (!callerMembership || !["owner", "admin"].includes(callerMembership.role)) {
    return jsonResponse(403, { error: "Only this company's owner or admin can invite members." });
  }

  const redirectTo = Deno.env.get("AXIVESTRA_INVITE_REDIRECT_URL") || "";
  const inviteOptions = {
    data: { axivestra_company_id: companyId },
    ...(redirectTo ? { redirectTo } : {})
  };
  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, inviteOptions);
  if (inviteError || !inviteData.user) {
    const message = String(inviteError?.message || "No user was returned.");
    console.error("invite-company-member: Supabase invite failed", message);
    if (/already registered|already been registered|already exists|user already/i.test(message)) {
      return jsonResponse(409, { error: "This email already has a Supabase account. Use the existing user UUID field below to grant company access." });
    }
    return jsonResponse(400, { error: "Supabase could not send this invitation. Check Auth email settings and rate limits, then retry." });
  }

  const invitedUserId = inviteData.user.id;
  const { data: existingMembership, error: existingError } = await admin
    .from("company_memberships")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", invitedUserId)
    .maybeSingle();
  if (existingError) {
    console.error("invite-company-member: target membership lookup failed", existingError.message);
    return jsonResponse(500, { error: "Invitation was sent, but company membership could not be checked. Review the Supabase function logs." });
  }
  if (existingMembership?.role === "owner") {
    return jsonResponse(409, { error: "This user is already an owner. Owner roles cannot be changed by invitations." });
  }

  const membershipQuery = existingMembership
    ? admin.from("company_memberships").update({ role, updated_by: caller.id }).eq("company_id", companyId).eq("user_id", invitedUserId)
    : admin.from("company_memberships").insert({ company_id: companyId, user_id: invitedUserId, role, created_by: caller.id, updated_by: caller.id });
  const { error: saveMembershipError } = await membershipQuery;
  if (saveMembershipError) {
    console.error("invite-company-member: membership save failed", saveMembershipError.message);
    return jsonResponse(500, { error: "Invitation email was sent, but company access could not be saved. Review the Supabase function logs before retrying." });
  }

  return jsonResponse(200, {
    ok: true,
    userId: invitedUserId,
    email,
    role,
    message: "Invitation sent to " + email + ". Access is limited to " + role.replace("_", " ") + " in this company."
  });
});
