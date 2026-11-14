import { createClient } from "@supabase/supabase-js";
import { loadCompanySyncBaseline, saveCompanySyncBaseline } from "./local-db";

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
  customModules: Array<Record<string, unknown> & { id: string }>;
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
  { stateKey: "auditEvents", storageKey: "estateflow.auditEvents", recordType: "audit_event" },
  { stateKey: "customModules", storageKey: "estateflow.customModules", recordType: "custom_module" }
];

type CompanyRecordRow = {
  record_type: string;
  record_key: string;
  payload: unknown;
  deleted_at: string | null;
  updated_at?: string | null;
};

// PostgREST can cap a response at 1,000 rows. Read all company records in
// stable 500-row pages so large workspaces are never silently truncated.
async function fetchAllCompanyRecordRows(companyId: string, columns: string): Promise<CompanyRecordRow[]> {
  if (!supabase) throw new Error("Cloud authentication is not configured.");
  const pageSize = 500;
  const rows: CompanyRecordRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("company_records")
      .select(columns)
      .eq("company_id", companyId)
      .order("record_type", { ascending: true })
      .order("record_key", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error("Could not load all company records (page " + (Math.floor(from / pageSize) + 1) + "): " + error.message);
    const page = (data || []) as unknown as CompanyRecordRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
    if (rows.length > 250000) throw new Error("Company record count exceeds the safe synchronization limit.");
  }
  return rows;
}

export function scopedStorageKey(companyId: string, key: string) {
  return `axivestra.company.${companyId}.${key}`;
}

export function personalStorageKey(userId: string, key: string) {
  return `axivestra.personal.${userId}.${key}`;
}

export function hasPersonalWorkspaceCache(userId: string) {
  return typeof localStorage !== "undefined"
    && localStorage.getItem(personalStorageKey(userId, "estateflow.initialized")) === "1";
}

type PersonalRecordRow = {
  user_id: string;
  record_type: string;
  record_key: string;
  payload: Record<string, unknown>;
  created_by: string;
  updated_by: string;
  updated_at: string;
  deleted_at: string | null;
};

/** Initialize the signed-in user's independent personal workspace. Legacy local data is
 * imported only after an explicit choice; otherwise it remains untouched on the device. */
export async function preparePersonalWorkspace(
  userId: string,
  importLegacy: boolean
): Promise<{ counts: Record<string, number>; uploaded: number }> {
  if (!supabase || !userId) throw new Error("Sign in to prepare a personal workspace.");
  const { data: rows, error } = await supabase.from("personal_records")
    .select("record_type,record_key,payload,deleted_at")
    .eq("user_id", userId);
  if (error) throw new Error("Could not load your personal cloud workspace: " + error.message);

  const remoteByType = new Map<string, Array<Record<string, unknown> & { id: string }>>();
  const deletedByType = new Map<string, Set<string>>();
  for (const row of rows || []) {
    if (row.deleted_at) {
      const removed = deletedByType.get(row.record_type) || new Set<string>();
      removed.add(String(row.record_key));
      deletedByType.set(row.record_type, removed);
      continue;
    }
    const payload = row.payload as (Record<string, unknown> & { id?: string }) | null;
    if (!payload || typeof payload.id !== "string" || payload.id !== row.record_key) continue;
    const bucket = remoteByType.get(row.record_type) || [];
    bucket.push(payload as Record<string, unknown> & { id: string });
    remoteByType.set(row.record_type, bucket);
  }

  const initializedKey = personalStorageKey(userId, "estateflow.initialized");
  const counts: Record<string, number> = {};
  const baseline: Record<string, Record<string, string>> = {};
  const initialized = localStorage.getItem(initializedKey) === "1";

  for (const item of collectionKeys) {
    const scopedKey = personalStorageKey(userId, item.storageKey);
    let localRows: Array<Record<string, unknown> & { id: string }> = [];
    const localText = localStorage.getItem(scopedKey);
    if (initialized && localText !== null) {
      try {
        const parsed = JSON.parse(localText);
        if (!Array.isArray(parsed)) throw new Error("Expected an array.");
        localRows = parsed.filter((row): row is Record<string, unknown> & { id: string } => !!row && typeof row.id === "string");
      } catch {
        throw new Error("Your saved personal data is damaged for " + item.storageKey + ". Export a backup before proceeding.");
      }
    } else if (!initialized && importLegacy) {
      const legacyText = localStorage.getItem(item.storageKey);
      if (legacyText) {
        try {
          const parsed = JSON.parse(legacyText);
          if (!Array.isArray(parsed)) throw new Error("Expected an array.");
          localRows = parsed.filter((row): row is Record<string, unknown> & { id: string } => !!row && typeof row.id === "string");
        } catch {
          throw new Error("Existing device data is damaged for " + item.storageKey + ". Export a backup before proceeding.");
        }
      }
    }

    const merged = new Map<string, Record<string, unknown> & { id: string }>();
    for (const row of remoteByType.get(item.recordType) || []) merged.set(row.id, row);
    for (const row of localRows) merged.set(row.id, row);
    const tombstones = deletedByType.get(item.recordType) || new Set<string>();
    const safeRows = Array.from(merged.values()).filter(row => !tombstones.has(row.id));
    localStorage.setItem(scopedKey, JSON.stringify(safeRows));
    counts[item.storageKey] = safeRows.length;
    baseline[item.recordType] = {};
    for (const payload of safeRows) baseline[item.recordType][payload.id] = JSON.stringify(payload);
  }

  // On first initialization, existing personal cloud rows are enough. Device-local legacy
  // rows are merged and uploaded only when the user explicitly opted into that import.
  if (!initialized && importLegacy) {
    const toUpload: PersonalRecordRow[] = [];
    for (const item of collectionKeys) {
      const key = personalStorageKey(userId, item.storageKey);
      const records = JSON.parse(localStorage.getItem(key) || "[]") as Array<Record<string, unknown> & { id: string }>;
      for (const payload of records) {
        toUpload.push({
          user_id: userId, record_type: item.recordType, record_key: payload.id, payload,
          created_by: userId, updated_by: userId, updated_at: new Date().toISOString(), deleted_at: null
        });
      }
    }
    for (let i = 0; i < toUpload.length; i += 250) {
      const { error: writeError } = await supabase.from("personal_records")
        .upsert(toUpload.slice(i, i + 250), { onConflict: "user_id,record_type,record_key" });
      if (writeError) throw new Error("Could not import this device's records into your personal workspace: " + writeError.message);
    }
    // Keep the original device data until the cloud copy is verified and marked initialized.
    for (const item of collectionKeys) localStorage.removeItem(item.storageKey);
  }

  const personalBaselineId = "personal-sync:" + userId;
  await saveCompanySyncBaseline(personalBaselineId, userId, baseline);
  localStorage.removeItem(personalStorageKey(userId, "estateflow.syncBaseline"));
  localStorage.setItem(initializedKey, "1");
  localStorage.setItem(personalStorageKey(userId, "estateflow.lastCloudSync"), new Date().toISOString());
  return { counts, uploaded: 0 };
}

/** Two-way personal cloud sync. Database RLS restricts every operation to auth.uid(). */
export async function syncPersonalWorkspace(
  userId: string,
  collections: WorkspaceCollections
): Promise<WorkspaceCollections> {
  if (!supabase || !userId) throw new Error("Personal cloud sync requires a signed-in user.");
  const { data: remoteRows, error: readError } = await supabase.from("personal_records")
    .select("record_type,record_key,payload,updated_at,deleted_at")
    .eq("user_id", userId);
  if (readError) throw new Error("Could not refresh personal cloud records: " + readError.message);

  type SyncRow = Record<string, unknown> & { id: string };
  type RemoteRow = { payload: SyncRow; updatedAt: string };
  const remoteByType = new Map<string, Map<string, RemoteRow>>();
  const deletedByType = new Map<string, Set<string>>();
  for (const row of remoteRows || []) {
    const id = String(row.record_key || "");
    if (!id) continue;
    if (row.deleted_at) {
      const bucket = deletedByType.get(row.record_type) || new Set<string>();
      bucket.add(id);
      deletedByType.set(row.record_type, bucket);
      continue;
    }
    const payload = row.payload as SyncRow | null;
    if (!payload || payload.id !== id) continue;
    const bucket = remoteByType.get(row.record_type) || new Map<string, RemoteRow>();
    bucket.set(id, { payload, updatedAt: String(row.updated_at || "") });
    remoteByType.set(row.record_type, bucket);
  }

  const baselineKey = personalStorageKey(userId, "estateflow.syncBaseline");
  const personalBaselineId = "personal-sync:" + userId;
  let oldBaseline = await loadCompanySyncBaseline(personalBaselineId);
  if (!oldBaseline) {
    try {
      const parsed = JSON.parse(localStorage.getItem(baselineKey) || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        oldBaseline = parsed as Record<string, Record<string, string>>;
        await saveCompanySyncBaseline(personalBaselineId, userId, oldBaseline);
      }
    } catch { oldBaseline = null; }
  }
  if (!oldBaseline) oldBaseline = {};

  const currentRows = new Map<string, Map<string, SyncRow>>();
  for (const item of collectionKeys) {
    const rows = collections[item.stateKey] || [];
    currentRows.set(item.recordType, new Map(rows
      .filter(row => row && typeof row.id === "string" && row.id)
      .map(row => [row.id, row as SyncRow])));
  }

  const auditEntityByType: Record<string, string> = {
    property: "Property", contact: "Contact", task: "Task", financial: "Financial",
    risk: "Risk", approval: "Approval"
  };
  const localChangedAt = (recordType: string, recordId: string, payload: SyncRow): number => {
    if (recordType === "audit_event") {
      const stamp = Date.parse(String(payload.at || ""));
      if (Number.isFinite(stamp)) return stamp;
    }
    if (recordType === "whatsapp_group") {
      const stamp = Date.parse(String(payload.lastSyncedAt || ""));
      if (Number.isFinite(stamp)) return stamp;
    }
    const entity = auditEntityByType[recordType];
    if (!entity) return 0;
    return collections.auditEvents
      .filter(event => event.recordId === recordId && event.entity === entity)
      .reduce((latest, event) => Math.max(latest, Date.parse(String(event.at || "")) || 0), 0);
  };

  const mergedSnapshot = {} as WorkspaceCollections;
  const nextBaseline: Record<string, Record<string, string>> = {};
  const toUpsert: PersonalRecordRow[] = [];
  const toDelete: Array<{ recordType: string; recordKey: string }> = [];
  const now = new Date().toISOString();

  for (const item of collectionKeys) {
    const local = currentRows.get(item.recordType) || new Map<string, SyncRow>();
    const remote = remoteByType.get(item.recordType) || new Map<string, RemoteRow>();
    const tombstones = deletedByType.get(item.recordType) || new Set<string>();
    const baseline = oldBaseline[item.recordType] || {};
    const ids = new Set<string>([...local.keys(), ...remote.keys(), ...Object.keys(baseline)]);
    const result: SyncRow[] = [];
    nextBaseline[item.recordType] = {};

    for (const id of ids) {
      if (tombstones.has(id)) continue;
      const localPayload = local.get(id);
      const remoteRow = remote.get(id);
      const baseText = typeof baseline[id] === "string" ? baseline[id] : "";
      const localText = localPayload ? JSON.stringify(localPayload) : "";
      const remoteText = remoteRow ? JSON.stringify(remoteRow.payload) : "";

      if (!localPayload && remoteRow) {
        if (baseText) { toDelete.push({ recordType: item.recordType, recordKey: id }); continue; }
        result.push(remoteRow.payload);
        nextBaseline[item.recordType][id] = remoteText;
        continue;
      }
      if (localPayload && !remoteRow) {
        // A remote absence after a known baseline is treated as a deletion, never resurrected.
        if (baseText) continue;
        result.push(localPayload);
        nextBaseline[item.recordType][id] = localText;
        toUpsert.push({
          user_id: userId, record_type: item.recordType, record_key: id, payload: localPayload,
          created_by: userId, updated_by: userId, updated_at: now, deleted_at: null
        });
        continue;
      }
      if (!localPayload || !remoteRow) continue;

      let selected: SyncRow;
      if (localText === remoteText) selected = localPayload;
      else if (!baseText) selected = remoteRow.payload;
      else {
        const localChanged = localText !== baseText;
        const remoteChanged = remoteText !== baseText;
        if (localChanged && !remoteChanged) selected = localPayload;
        else if (!localChanged && remoteChanged) selected = remoteRow.payload;
        else if (!localChanged && !remoteChanged) selected = localPayload;
        else {
          const localStamp = localChangedAt(item.recordType, id, localPayload);
          const remoteStamp = Date.parse(remoteRow.updatedAt) || 0;
          selected = localStamp > remoteStamp ? localPayload : remoteRow.payload;
        }
      }
      const selectedText = JSON.stringify(selected);
      result.push(selected);
      nextBaseline[item.recordType][id] = selectedText;
      if (selectedText !== remoteText) toUpsert.push({
        user_id: userId, record_type: item.recordType, record_key: id, payload: selected,
        created_by: userId, updated_by: userId, updated_at: now, deleted_at: null
      });
    }
    (mergedSnapshot[item.stateKey] as SyncRow[]) = result;
    localStorage.setItem(personalStorageKey(userId, item.storageKey), JSON.stringify(result));
  }

  for (const item of toDelete) {
    const { error } = await supabase.from("personal_records").update({
      deleted_at: now, updated_by: userId, updated_at: now
    }).eq("user_id", userId).eq("record_type", item.recordType)
      .eq("record_key", item.recordKey).is("deleted_at", null);
    if (error) throw new Error("Could not sync a personal deletion: " + error.message);
  }
  for (let i = 0; i < toUpsert.length; i += 250) {
    const { error } = await supabase.from("personal_records")
      .upsert(toUpsert.slice(i, i + 250), { onConflict: "user_id,record_type,record_key" });
    if (error) throw new Error("Could not upload personal workspace changes: " + error.message);
  }

  await saveCompanySyncBaseline(personalBaselineId, userId, nextBaseline);
  localStorage.removeItem(baselineKey);
  localStorage.setItem(personalStorageKey(userId, "estateflow.lastCloudSync"), now);
  return mergedSnapshot;
}

export function hasLegacyLocalRecords() {
  if (typeof localStorage === "undefined") return false;
  const keys = [...collectionKeys.map(item => item.storageKey), "estateflow.documents"];
  return keys.some(key => {
    try {
      const value = localStorage.getItem(key);
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
  if (company.role === "read_only") importLegacy = false;
  const rows = await fetchAllCompanyRecordRows(company.id, "record_type,record_key,payload,deleted_at");

  const remoteByType = new Map<string, Array<Record<string, unknown> & { id: string }>>();
  const deletedByType = new Map<string, Set<string>>();
  for (const row of rows || []) {
    if (row.deleted_at) {
      const deleted = deletedByType.get(row.record_type) || new Set<string>();
      deleted.add(String(row.record_key));
      deletedByType.set(row.record_type, deleted);
      continue;
    }
    const payload = row.payload as (Record<string, unknown> & { id?: string }) | null;
    if (!payload || typeof payload.id !== "string") continue;
    const bucket = remoteByType.get(row.record_type) || [];
    bucket.push(payload as Record<string, unknown> & { id: string });
    remoteByType.set(row.record_type, bucket);
  }

  const initialized = localStorage.getItem(scopedStorageKey(company.id, "estateflow.initialized")) === "1";
  const baselineKey = scopedStorageKey(company.id, "estateflow.syncBaseline");
  const baselineId = "company-sync:" + company.id;
  let cachedBaseline = await loadCompanySyncBaseline(baselineId);
  if (!cachedBaseline) {
    let legacyBaseline: unknown = null;
    try { legacyBaseline = JSON.parse(localStorage.getItem(baselineKey) || "null"); } catch { legacyBaseline = null; }
    if (legacyBaseline && typeof legacyBaseline === "object" && !Array.isArray(legacyBaseline)) {
      cachedBaseline = legacyBaseline as Record<string, Record<string, string>>;
      // Commit the legacy copy to IndexedDB before clearing its localStorage source.
      await saveCompanySyncBaseline(baselineId, company.id, cachedBaseline);
    }
  }
  if (cachedBaseline) {
    try { localStorage.removeItem(baselineKey); } catch { /* keep sync independent of legacy cleanup */ }
  }
  const counts: Record<string, number> = {};

  // Existing company caches are not blindly pushed on every login: the IndexedDB baseline
  // distinguishes local edits, cloud edits, offline new records and deletions.
  if (initialized && cachedBaseline !== null && !importLegacy) {
    for (const item of collectionKeys) {
      const key = scopedStorageKey(company.id, item.storageKey);
      const scopedText = localStorage.getItem(key);
      let localRows: Array<Record<string, unknown> & { id: string }> = [];
      if (scopedText !== null) {
        try {
          const value = JSON.parse(scopedText);
          if (!Array.isArray(value)) throw new Error("Expected a JSON array.");
          localRows = value.filter(row => row && typeof row.id === "string");
        } catch {
          throw new Error("Saved local company data is damaged for " + item.storageKey + ". Export a backup before proceeding.");
        }
      } else {
        // Missing cache key is treated as cache loss, not user intent to delete every record.
        localRows = remoteByType.get(item.recordType) || [];
      }
      const tombstones = deletedByType.get(item.recordType) || new Set<string>();
      const safeRows = localRows.filter(row => !tombstones.has(row.id));
      localStorage.setItem(key, JSON.stringify(safeRows));
      counts[item.storageKey] = safeRows.length;
    }
    localStorage.setItem(scopedStorageKey(company.id, "estateflow.initialized"), "1");
    return { counts, uploaded: 0 };
  }

  // First initialization or an explicit local-data import. This deliberately uses the
  // selected device's version for ID collisions, preserves cloud-only rows and excludes
  // cloud tombstones. A baseline is committed only after cloud writes succeed.
  const toUpload: Array<{ company_id: string; record_type: string; record_key: string; payload: Record<string, unknown>; created_by: string; updated_by: string; updated_at: string; deleted_at: null }> = [];
  const baseline: Record<string, Record<string, string>> = {};
  for (const item of collectionKeys) {
    const key = scopedStorageKey(company.id, item.storageKey);
    let localRows: Array<Record<string, unknown> & { id: string }> = [];
    const scopedText = localStorage.getItem(key);
    if (scopedText !== null && company.role !== "read_only") {
      try {
        const value = JSON.parse(scopedText);
        if (!Array.isArray(value)) throw new Error("Expected a JSON array.");
        localRows = value.filter(row => row && typeof row.id === "string");
      } catch {
        throw new Error("Saved local company data is damaged for " + item.storageKey + ". Export a backup before proceeding.");
      }
    }
    if (importLegacy) {
      const importedById = new Map<string, Record<string, unknown> & { id: string }>();
      const sourceKeys = [item.storageKey, personalStorageKey(userId, item.storageKey)];
      for (const sourceKey of sourceKeys) {
        const sourceText = localStorage.getItem(sourceKey);
        if (!sourceText) continue;
        try {
          const value = JSON.parse(sourceText);
          if (!Array.isArray(value)) throw new Error("Expected a JSON array.");
          for (const row of value) if (row && typeof row.id === "string") importedById.set(row.id, row);
        } catch {
          throw new Error("Existing local / personal data is damaged for " + item.storageKey + ". Export a backup before proceeding.");
        }
      }
      // Company-scoped copies take priority; personal source records are copied, never removed.
      for (const row of localRows) importedById.set(row.id, row);
      localRows = Array.from(importedById.values());
    }

    const merged = new Map<string, Record<string, unknown> & { id: string }>();
    const tombstones = deletedByType.get(item.recordType) || new Set<string>();
    for (const row of remoteByType.get(item.recordType) || []) merged.set(row.id, row);
    for (const row of localRows) if (!tombstones.has(row.id)) merged.set(row.id, row);
    const result = Array.from(merged.values());
    localStorage.setItem(key, JSON.stringify(result));
    counts[item.storageKey] = result.length;
    baseline[item.recordType] = {};
    for (const payload of result) {
      baseline[item.recordType][payload.id] = JSON.stringify(payload);
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
    for (let i = 0; i < toUpload.length; i += 250) {
      const batch = toUpload.slice(i, i + 250);
      const { error: upsertError } = await supabase
        .from("company_records")
        .upsert(batch, { onConflict: "company_id,record_type,record_key" });
      if (upsertError) throw new Error("Cloud merge could not be saved: " + upsertError.message);
      uploaded += batch.length;
    }
  }
  await saveCompanySyncBaseline(baselineId, company.id, baseline);
  try { localStorage.removeItem(baselineKey); } catch { /* legacy cleanup is best effort */ }
  localStorage.setItem(scopedStorageKey(company.id, "estateflow.initialized"), "1");
  localStorage.setItem(scopedStorageKey(company.id, "estateflow.lastCloudSync"), new Date().toISOString());
  if (importLegacy) {
    // Once the user explicitly assigns legacy data to this company and cloud/local
    // initialization succeeds, remove unscoped sources so another company cannot import
    // the same records by accident.
    for (const item of collectionKeys) localStorage.removeItem(item.storageKey);
  }
  return { counts, uploaded };
}

export type DeletedCompanyRecord = { recordType: string; recordKey: string };

export async function softDeleteCompanyRecords(
  company: WorkspaceCompany,
  userId: string,
  deleted: DeletedCompanyRecord[]
): Promise<void> {
  if (!supabase || !deleted.length) return;
  if (!["owner", "admin", "manager"].includes(company.role)) {
    throw new Error("Your company role cannot delete shared records. Ask a manager or owner.");
  }
  const stamp = new Date().toISOString();
  for (const item of deleted) {
    const { error } = await supabase.from("company_records")
      .update({ deleted_at: stamp, updated_by: userId, updated_at: stamp })
      .eq("company_id", company.id)
      .eq("record_type", item.recordType)
      .eq("record_key", item.recordKey)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
  }
}

export async function syncCompanyWorkspace(
  company: WorkspaceCompany,
  userId: string,
  collections: WorkspaceCollections
): Promise<WorkspaceCollections> {
  if (!supabase) return collections;

  const remoteRows = await fetchAllCompanyRecordRows(company.id, "record_type,record_key,payload,updated_at,deleted_at");

  type SyncRow = Record<string, unknown> & { id: string };
  type RemoteRow = { payload: SyncRow; updatedAt: string };
  const remoteByType = new Map<string, Map<string, RemoteRow>>();
  const deletedByType = new Map<string, Set<string>>();
  for (const row of remoteRows || []) {
    const id = String(row.record_key || "");
    if (!id) continue;
    if (row.deleted_at) {
      const deleted = deletedByType.get(row.record_type) || new Set<string>();
      deleted.add(id);
      deletedByType.set(row.record_type, deleted);
      continue;
    }
    const payload = row.payload as SyncRow | null;
    if (!payload || typeof payload.id !== "string" || payload.id !== id) continue;
    const items = remoteByType.get(row.record_type) || new Map<string, RemoteRow>();
    items.set(id, { payload, updatedAt: String(row.updated_at || "") });
    remoteByType.set(row.record_type, items);
  }

  const baselineKey = scopedStorageKey(company.id, "estateflow.syncBaseline");
  const baselineId = "company-sync:" + company.id;
  let oldBaseline = await loadCompanySyncBaseline(baselineId);
  if (!oldBaseline) {
    try {
      const parsed = JSON.parse(localStorage.getItem(baselineKey) || "null");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        oldBaseline = parsed as Record<string, Record<string, string>>;
        // Preserve the old baseline in IndexedDB before removing the legacy entry.
        await saveCompanySyncBaseline(baselineId, company.id, oldBaseline);
      }
    } catch { /* an invalid legacy baseline is treated as absent */ }
  }
  if (oldBaseline) {
    try { localStorage.removeItem(baselineKey); } catch { /* legacy cleanup is best effort */ }
  }
  oldBaseline = oldBaseline || {};

  const currentRows = new Map<string, Map<string, SyncRow>>();
  for (const item of collectionKeys) {
    const rows = collections[item.stateKey] || [];
    currentRows.set(item.recordType, new Map(rows.filter(row => row && typeof row.id === "string" && row.id).map(row => [row.id, row as SyncRow])));
  }

  const auditEntityByType: Record<string, string> = {
    property: "Property", contact: "Contact", task: "Task", financial: "Financial",
    risk: "Risk", approval: "Approval"
  };
  const localChangedAt = (recordType: string, recordId: string, payload: SyncRow): number => {
    if (recordType === "audit_event") {
      const stamp = Date.parse(String(payload.at || ""));
      if (Number.isFinite(stamp)) return stamp;
    }
    if (recordType === "whatsapp_group") {
      const stamp = Date.parse(String(payload.lastSyncedAt || ""));
      if (Number.isFinite(stamp)) return stamp;
    }
    const entity = auditEntityByType[recordType];
    if (entity) {
      const matching = collections.auditEvents
        .filter(event => event.recordId === recordId && event.entity === entity)
        .reduce((latest, event) => Math.max(latest, Date.parse(String(event.at ?? "")) || 0), 0);
      if (matching) return matching;
    }
    return 0;
  };

  const mergedSnapshot = {} as WorkspaceCollections;
  const nextBaseline: Record<string, Record<string, string>> = {};
  const toUpsert: Array<{ company_id: string; record_type: string; record_key: string; payload: SyncRow; created_by: string; updated_by: string; updated_at: string; deleted_at: null }> = [];
  const toDelete: Array<{ recordType: string; recordKey: string }> = [];
  const now = new Date().toISOString();

  for (const item of collectionKeys) {
    const local = currentRows.get(item.recordType) || new Map<string, SyncRow>();
    const remote = remoteByType.get(item.recordType) || new Map<string, RemoteRow>();
    const tombstones = deletedByType.get(item.recordType) || new Set<string>();
    const baseline = oldBaseline[item.recordType] && typeof oldBaseline[item.recordType] === "object" ? oldBaseline[item.recordType] : {};
    const ids = new Set<string>([...local.keys(), ...remote.keys(), ...Object.keys(baseline)]);
    const result: SyncRow[] = [];
    nextBaseline[item.recordType] = {};

    for (const id of ids) {
      if (tombstones.has(id)) continue;
      const localPayload = local.get(id);
      const remoteRow = remote.get(id);
      const baseText = typeof baseline[id] === "string" ? baseline[id] : "";
      const localText = localPayload ? JSON.stringify(localPayload) : "";
      const remoteText = remoteRow ? JSON.stringify(remoteRow.payload) : "";

      // Local absence after a known baseline means a deletion. A missing cache key was
      // already recovered in prepareCompanyWorkspace, so explicit empty collections are honoured.
      if (!localPayload && remoteRow && baseText) {
        if (["owner", "admin", "manager"].includes(company.role)) {
          toDelete.push({ recordType: item.recordType, recordKey: id });
          continue;
        }
        result.push(remoteRow.payload);
        nextBaseline[item.recordType][id] = remoteText;
        continue;
      }

      if (!localPayload && remoteRow) {
        result.push(remoteRow.payload);
        nextBaseline[item.recordType][id] = remoteText;
        continue;
      }
      if (localPayload && !remoteRow) {
        // A read-only user must not see stale device-only rows that do not exist in the
        // authorized cloud workspace (for example, from a role change or old local cache).
        if (company.role === "read_only") continue;
        result.push(localPayload);
        nextBaseline[item.recordType][id] = localText;
        toUpsert.push({
          company_id: company.id, record_type: item.recordType, record_key: id,
          payload: localPayload, created_by: userId, updated_by: userId, updated_at: now, deleted_at: null
        });
        continue;
      }
      if (!localPayload || !remoteRow) continue;

      let selected: SyncRow;
      if (company.role === "read_only") {
        selected = remoteRow.payload;
      } else if (localText === remoteText) {
        selected = localPayload;
      } else if (!baseText) {
        // No history exists for this ID (e.g. concurrent first sync); prefer the remote
        // version to avoid an unknown stale local record overwriting cloud data.
        selected = remoteRow.payload;
      } else {
        const localChanged = localText !== baseText;
        const remoteChanged = remoteText !== baseText;
        if (localChanged && !remoteChanged) {
          selected = localPayload;
        } else if (!localChanged && remoteChanged) {
          selected = remoteRow.payload;
        } else if (!localChanged && !remoteChanged) {
          selected = localPayload;
        } else {
          // Both sides changed since the baseline. Prefer the side with the later edit time;
          // cloud updated_at is the last successful server sync time. Ties safely prefer remote.
          const localStamp = localChangedAt(item.recordType, id, localPayload);
          const remoteStamp = Date.parse(remoteRow.updatedAt) || 0;
          selected = localStamp > remoteStamp ? localPayload : remoteRow.payload;
        }
      }

      const selectedText = JSON.stringify(selected);
      result.push(selected);
      nextBaseline[item.recordType][id] = selectedText;
      if (selectedText !== remoteText && company.role !== "read_only") {
        toUpsert.push({
          company_id: company.id, record_type: item.recordType, record_key: id,
          payload: selected, created_by: userId, updated_by: userId, updated_at: now, deleted_at: null
        });
      }
    }

    (mergedSnapshot[item.stateKey] as SyncRow[]) = result;
    const localKey = scopedStorageKey(company.id, item.storageKey);
    localStorage.setItem(localKey, JSON.stringify(result));
  }

  if (toDelete.length && company.role !== "read_only") await softDeleteCompanyRecords(company, userId, toDelete);
  for (let i = 0; i < toUpsert.length; i += 250) {
    const { error } = await supabase.from("company_records")
      .upsert(toUpsert.slice(i, i + 250), { onConflict: "company_id,record_type,record_key" });
    if (error) throw new Error("Could not upload changed company records: " + error.message);
  }

  await saveCompanySyncBaseline(baselineId, company.id, nextBaseline);
  try { localStorage.removeItem(baselineKey); } catch { /* legacy cleanup is best effort */ }
  localStorage.setItem(scopedStorageKey(company.id, "estateflow.lastCloudSync"), new Date().toISOString());
  return mergedSnapshot;
}
