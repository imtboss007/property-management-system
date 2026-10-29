import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim() || "";
const publishableKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ""
).trim();

export const isSupabaseConfigured = Boolean(url && publishableKey);
export const supabase = isSupabaseConfigured
  ? createClient(url, publishableKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
  : null;

export type CompanyRole = "owner" | "admin" | "manager" | "staff" | "read_only";
export type WorkspaceCompany = { id: string; name: string; role: CompanyRole };
export type WorkspaceCollections = {
  properties: Array<Record<string, unknown> & { id: string }>;
  contacts: Array<Record<string, unknown> & { id: string }>;
  whatsappGroups: Array<Record<string, unknown> & { id: string }>;
  tasks: Array<Record<string, unknown> & { id: string }>;
  financials: Array<Record<string, unknown> & { id: string }>;
  riskRecords: Array<Record<string, unknown> & { id: string }>;
  approvalRequests: Array<Record<string, unknown> & { id: string }>;
  auditEvents: Array<Record<string, unknown> & { id: string }>;
};

export const collectionKeys: Array<{
  stateKey: keyof WorkspaceCollections;
  storageKey: string;
  recordType: string;
}> = [
  { stateKey: "properties", storageKey: "estateflow.properties", recordType: "property" },
  { stateKey: "contacts", storageKey: "estateflow.contacts", recordType: "contact" },
  { stateKey: "whatsappGroups", storageKey: "estateflow.whatsappGroups", recordType: "whatsapp_group" },
  { stateKey: "tasks", storageKey: "estateflow.tasks", recordType: "task" },
  { stateKey: "financials", storageKey: "estateflow.financials", recordType: "financial" },
  { stateKey: "riskRecords", storageKey: "estateflow.risks", recordType: "risk" },
  { stateKey: "approvalRequests", storageKey: "estateflow.approvals", recordType: "approval" },
  { stateKey: "auditEvents", storageKey: "estateflow.auditEvents", recordType: "audit_event" }
];

export function scopedStorageKey(companyId: string, key: string) {
  return `axivestra.company.${companyId}.${key}`;
}

export function hasLegacyLocalRecords() {
  if (typeof localStorage === "undefined") return false;
  return collectionKeys.some(item => {
    try {
      const value = localStorage.getItem(item.storageKey);
      if (!value) return false;
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  });
}

export async function prepareCompanyWorkspace(
  company: WorkspaceCompany,
  userId: string,
  importLegacy: boolean
): Promise<{ counts: Record<string, number>; uploaded: number }> {
  if (!supabase) throw new Error("Cloud authentication is not configured.");
  const { data: rows, error } = await supabase
    .from("company_records")
    .select("record_type,record_key,payload")
    .eq("company_id", company.id)
    .is("deleted_at", null);
  if (error) throw new Error("Could not load this company's cloud records. Confirm the SQL migration is applied: " + error.message);

  const remoteByType = new Map<string, Array<Record<string, unknown> & { id: string }>>();
  for (const row of rows || []) {
    const payload = row.payload as (Record<string, unknown> & { id?: string }) | null;
    if (!payload || typeof payload.id !== "string") continue;
    const bucket = remoteByType.get(row.record_type) || [];
    bucket.push(payload as Record<string, unknown> & { id: string });
    remoteByType.set(row.record_type, bucket);
  }

  const toUpload: Array<{ company_id: string; record_type: string; record_key: string; payload: Record<string, unknown>; created_by: string; updated_by: string; updated_at: string; deleted_at: null }> = [];
  const counts: Record<string, number> = {};
  for (const item of collectionKeys) {
    const key = scopedStorageKey(company.id, item.storageKey);
    let localRows: Array<Record<string, unknown> & { id: string }> = [];
    const scopedText = localStorage.getItem(key);
    if (scopedText) {
      try {
        const value = JSON.parse(scopedText);
        if (Array.isArray(value)) localRows = value.filter(row => row && typeof row.id === "string");
      } catch {
        throw new Error("Saved local company data is damaged for " + item.storageKey + ". Export a backup before proceeding.");
      }
    } else if (importLegacy) {
      const legacyText = localStorage.getItem(item.storageKey);
      if (legacyText) {
        try {
          const value = JSON.parse(legacyText);
          if (Array.isArray(value)) localRows = value.filter(row => row && typeof row.id === "string");
        } catch {
          throw new Error("Legacy local data is damaged for " + item.storageKey + ". Export a backup before proceeding.");
        }
      }
    }

    const merged = new Map<string, Record<string, unknown> & { id: string }>();
    for (const row of remoteByType.get(item.recordType) || []) merged.set(row.id, row);
    // Preserve the currently selected device's version for an ID collision; keep cloud-only records.
    for (const row of localRows) merged.set(row.id, row);
    const result = Array.from(merged.values());
    localStorage.setItem(key, JSON.stringify(result));
    counts[item.storageKey] = result.length;
    for (const payload of result) {
      toUpload.push({
        company_id: company.id,
        record_type: item.recordType,
        record_key: payload.id,
        payload,
        created_by: userId,
        updated_by: userId,
        updated_at: new Date().toISOString(),
        deleted_at: null
      });
    }
  }

  let uploaded = 0;
  if (company.role !== "read_only" && toUpload.length > 0) {
    // Bounded batches avoid sending the full workspace in one request.
    for (let i = 0; i < toUpload.length; i += 250) {
      const batch = toUpload.slice(i, i + 250);
      const { error: upsertError } = await supabase
        .from("company_records")
        .upsert(batch, { onConflict: "company_id,record_type,record_key" });
      if (upsertError) throw new Error("Cloud merge could not be saved: " + upsertError.message);
      uploaded += batch.length;
    }
  }
  localStorage.setItem(scopedStorageKey(company.id, "estateflow.initialized"), "1");
  localStorage.setItem(scopedStorageKey(company.id, "estateflow.lastCloudSync"), new Date().toISOString());
  return { counts, uploaded };
}

export async function syncCompanyWorkspace(
  company: WorkspaceCompany,
  userId: string,
  collections: WorkspaceCollections
): Promise<void> {
  if (!supabase || company.role === "read_only") return;
  const stamp = new Date().toISOString();
  const rows = collectionKeys.flatMap(item => {
    const values = collections[item.stateKey] || [];
    return values.filter(record => record && typeof record.id === "string" && record.id).map(payload => ({
      company_id: company.id,
      record_type: item.recordType,
      record_key: payload.id,
      payload,
      created_by: userId,
      updated_by: userId,
      updated_at: stamp,
      deleted_at: null
    }));
  });
  for (let i = 0; i < rows.length; i += 250) {
    const { error } = await supabase.from("company_records")
      .upsert(rows.slice(i, i + 250), { onConflict: "company_id,record_type,record_key" });
    if (error) throw new Error(error.message);
  }
  localStorage.setItem(scopedStorageKey(company.id, "estateflow.lastCloudSync"), stamp);
}
