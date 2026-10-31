import { isSupabaseConfigured, supabase } from "./supabase";

export type CloudWhatsAppStatus = {
  ready: boolean;
  configured: boolean;
  companyId?: string;
  senderNumber?: string;
  displayName?: string;
  platform?: string;
  error?: string;
  webhookConfigured?: boolean;
};
export type CloudSchedulePayload = {
  destinationType?: "contact" | "group";
  groupJid?: string;
  phone: string;
  contactId?: string;
  contactName?: string;
  message: string;
  scheduledAt: string;
  repeatCount?: number;
  intervalDays?: number;
  consentConfirmed: boolean;
  stopOnReply?: boolean;
  propertyId?: string;
  propertyTitle?: string;
  taskId?: string;
  taskTitle?: string;
  templateName?: string;
  templateLanguage?: string;
  templateParameters?: string[];
};

function workerBaseUrl() {
  const enabled = String(import.meta.env.VITE_AXIVESTRA_WHATSAPP_CLOUD_ENABLED || "").toLowerCase() === "true";
  if (!enabled) return "";
  const value = String(import.meta.env.VITE_AXIVESTRA_WHATSAPP_WORKER_URL || "").trim();
  return value.replace(/\/+$/, "");
}
function activeCompanyId() {
  try { return localStorage.getItem("axivestra.activeCompanyId") || ""; }
  catch { return ""; }
}
function phoneDigits(value: string) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = "91" + digits;
  if (digits.length < 8 || digits.length > 15) {
    throw new Error("Enter a valid WhatsApp number with country code.");
  }
  return digits;
}
async function currentIdentity(companyIdOverride = "") {
  if (!isSupabaseConfigured || !supabase) throw new Error("AXIVESTRA cloud storage is not configured in this build.");
  const companyId = String(companyIdOverride || activeCompanyId());
  if (!companyId) throw new Error("Choose your AXIVESTRA cloud company first.");
  const [{ data: auth, error: authError }, { data: sessionData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession()
  ]);
  const session = sessionData?.session;
  if (authError || !auth.user || !session?.access_token) {
    throw new Error("Sign in to your AXIVESTRA cloud workspace on this device first.");
  }
  const { data: membership, error: memberError } = await supabase
    .from("company_memberships").select("role").eq("company_id", companyId).eq("user_id", auth.user.id).maybeSingle();
  if (memberError || !membership) throw new Error("This account does not have access to the selected AXIVESTRA company.");
  return { companyId, userId: auth.user.id, role: String(membership.role || ""), accessToken: session.access_token };
}

export async function getCloudWhatsAppStatus(companyIdOverride = ""): Promise<CloudWhatsAppStatus> {
  const base = workerBaseUrl();
  if (!base) {
    return { ready: false, configured: false, error: "The AXIVESTRA Cloudflare Worker URL has not been configured in this build." };
  }
  try {
    const identity = await currentIdentity(companyIdOverride);
    const response = await fetch(base + "/status", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + identity.accessToken },
      body: JSON.stringify({ companyId: identity.companyId }),
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok === false) {
      return {
        ready: false, configured: false, companyId: identity.companyId,
        error: String(data?.error || "The AXIVESTRA cloud messaging service is unavailable.")
      };
    }
    return {
      ready: Boolean(data?.ready),
      configured: Boolean(data?.configured),
      companyId: identity.companyId,
      senderNumber: String(data?.senderNumber || ""),
      displayName: String(data?.displayName || ""),
      platform: "cloud-whatsapp-business",
      error: String(data?.error || ""),
      webhookConfigured: Boolean(data?.webhookConfigured)
    };
  } catch (error) {
    return {
      ready: false, configured: false,
      error: error instanceof Error ? error.message : "Cloud messaging is not available."
    };
  }
}

export type CloudQueueRow = {
  id: string;
  seriesId?: string;
  sequence?: number;
  repeatCount?: number;
  destinationType: "contact";
  phone: string;
  contactId?: string;
  contactName: string;
  message: string;
  scheduledAt: string;
  propertyId?: string;
  propertyTitle?: string;
  taskId?: string;
  taskTitle?: string;
  status: string;
  consentConfirmed: boolean;
  stopOnReply: boolean;
  createdAt: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  lastError?: string;
  deliveryStatus?: string;
  providerMessageId?: string;
  templateName?: string;
};
function mapRow(row: Record<string, unknown>): CloudQueueRow {
  return {
    id: String(row.id || ""),
    seriesId: String(row.series_id || ""),
    sequence: Number(row.sequence || 1),
    repeatCount: Number(row.repeat_count || 1),
    destinationType: "contact",
    phone: "+" + String(row.to_phone || ""),
    contactId: String(row.contact_id || ""),
    contactName: String(row.recipient_name || ""),
    message: String(row.message || (row.template_name ? "Approved template: " + row.template_name : "")),
    scheduledAt: String(row.scheduled_at || ""),
    propertyId: String(row.property_id || ""),
    propertyTitle: String(row.property_title || ""),
    taskId: String(row.task_id || ""),
    taskTitle: String(row.task_title || ""),
    status: String(row.status || "scheduled"),
    consentConfirmed: row.consent_confirmed === true,
    stopOnReply: row.stop_on_reply === true,
    createdAt: String(row.created_at || ""),
    sentAt: String(row.sent_at || ""),
    deliveredAt: String(row.delivered_at || ""),
    readAt: String(row.read_at || ""),
    lastError: String(row.last_error || ""),
    deliveryStatus: String(row.provider_status || ""),
    providerMessageId: String(row.provider_message_id || ""),
    templateName: String(row.template_name || "")
  };
}
export async function listCloudWhatsAppMessages(companyIdOverride = ""): Promise<CloudQueueRow[]> {
  const { companyId } = await currentIdentity(companyIdOverride);
  if (!supabase) return [];
  const { data, error } = await supabase.from("whatsapp_cloud_messages").select("*")
    .eq("company_id", companyId).order("scheduled_at", { ascending: false }).limit(500);
  if (error) throw new Error("Could not load cloud scheduled messages. The AXIVESTRA cloud queue migration may not be deployed yet.");
  return (data || []).map(row => mapRow(row as Record<string, unknown>));
}
export async function scheduleCloudWhatsAppMessages(payload: CloudSchedulePayload, immediate = false, companyIdOverride = ""): Promise<CloudQueueRow[]> {
  if (payload.destinationType === "group" || payload.groupJid) {
    throw new Error("The official cloud sender supports individual contacts only. Choose an individual contact.");
  }
  if (payload.consentConfirmed !== true) throw new Error("Confirm that the recipient expects and has agreed to receive these messages.");
  const cloudStatus = await getCloudWhatsAppStatus(companyIdOverride);
  if (!cloudStatus.configured || !cloudStatus.ready) {
    throw new Error(cloudStatus.error || "The official WhatsApp cloud sender is not ready yet. No message has been queued.");
  }
  if (payload.stopOnReply !== false && !cloudStatus.webhookConfigured) {
    throw new Error("Meta webhook credentials are not configured. Set up the signed Meta webhook first, or turn off stop-on-reply for this message.");
  }
  const { companyId, userId, role } = await currentIdentity(companyIdOverride);
  if (role === "read_only") throw new Error("Your cloud role cannot schedule messages.");
  if (!supabase) throw new Error("Cloud storage is not configured.");
  const toPhone = phoneDigits(payload.phone);
  const templateName = String(payload.templateName || "").trim();
  const message = String(payload.message || "").trim();
  if (templateName && !/^[A-Za-z0-9_]+$/.test(templateName)) {
    throw new Error("Enter the exact approved WhatsApp template name using letters, digits and underscores.");
  }
  if (!templateName && !message) throw new Error("Write a message or choose an approved template.");
  if (!immediate && !templateName) {
    throw new Error("For scheduled cloud sends, choose an approved Meta template. The 24-hour customer-service window may expire before delivery.");
  }
  if (message.length > 4000) throw new Error("Messages must be 4000 characters or fewer.");
  const count = Math.max(1, Math.min(20, Number.parseInt(String(payload.repeatCount || 1), 10) || 1));
  const intervalDays = Math.max(1, Math.min(365, Number.parseInt(String(payload.intervalDays || 1), 10) || 1));
  const initialTime = immediate ? Date.now() + 5000 : Date.parse(payload.scheduledAt);
  if (!Number.isFinite(initialTime)) throw new Error("Choose a valid send date and time.");
  if (!immediate && initialTime <= Date.now()) throw new Error("Choose a future send time.");
  const seriesId = count > 1 ? crypto.randomUUID() : null;
  const params = Array.isArray(payload.templateParameters) ? payload.templateParameters.slice(0, 20).map(item => String(item).slice(0, 1024)) : [];
  const records = Array.from({ length: count }, (_, index) => ({
    company_id: companyId,
    created_by: userId,
    series_id: seriesId,
    sequence: index + 1,
    repeat_count: count,
    to_phone: toPhone,
    recipient_name: String(payload.contactName || "").trim().slice(0, 160),
    contact_id: String(payload.contactId || ""),
    message,
    message_type: templateName ? "template" : "text",
    template_name: templateName || null,
    template_language: String(payload.templateLanguage || "en_US").trim().slice(0, 20) || "en_US",
    template_params: params,
    scheduled_at: new Date(initialTime + index * intervalDays * 86400000).toISOString(),
    status: "scheduled",
    consent_confirmed: true,
    stop_on_reply: payload.stopOnReply !== false,
    property_id: String(payload.propertyId || ""),
    property_title: String(payload.propertyTitle || "").slice(0, 240),
    task_id: String(payload.taskId || ""),
    task_title: String(payload.taskTitle || "").slice(0, 240)
  }));
  const { data, error } = await supabase.from("whatsapp_cloud_messages").insert(records).select("*");
  if (error) throw new Error("Could not save the cloud message queue. Confirm that the AXIVESTRA cloud messaging migration is deployed. " + error.message);
  return (data || []).map(row => mapRow(row as Record<string, unknown>));
}
export async function cancelCloudWhatsAppMessage(id: string, companyIdOverride = ""): Promise<void> {
  if (!supabase) throw new Error("Cloud storage is not configured.");
  const { companyId } = await currentIdentity(companyIdOverride);
  const { data, error } = await supabase.rpc("cancel_whatsapp_cloud_message", { target_message_id: id, target_company_id: companyId });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("This message is already being sent or can no longer be cancelled.");
}
export async function retryCloudWhatsAppMessage(id: string, companyIdOverride = ""): Promise<void> {
  if (!supabase) throw new Error("Cloud storage is not configured.");
  const { companyId } = await currentIdentity(companyIdOverride);
  const { data, error } = await supabase.rpc("retry_whatsapp_cloud_message", { target_message_id: id, target_company_id: companyId });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("This message cannot be retried.");
}
