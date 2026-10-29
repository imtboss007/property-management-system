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
  const { data: rows, error } = await supabase
    .from("company_records")
    .select("record_type,record_key,payload,deleted_at")
    .eq("company_id", company.id);
  if (error) throw new Error("Could not load this company's cloud records. Confirm the SQL migration is applied: " + error.message);

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
  const baselineText = localStorage.getItem(scopedStorageKey(company.id, "estateflow.syncBaseline"));
  const counts: Record<string, number> = {};

  // Existing company caches are not blindly pushed on every login: the sync baseline lets
  // the next sync distinguish local edits, cloud edits, offline new records and deletions.
  if (initialized && baselineText && !importLegacy) {
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
    if (scopedText !== null) {
      try {
        const value = JSON.parse(scopedText);
        if (!Array.isArray(value)) throw new Error("Expected a JSON array.");
        localRows = value.filter(row => row && typeof row.id === "string");
      } catch {
        throw new Error("Saved local company data is damaged for " + item.storageKey + ". Export a backup before proceeding.");
      }
    }
    if (importLegacy) {
      const legacyText = localStorage.getItem(item.storageKey);
      if (legacyText) {
        let legacyRows: Array<Record<string, unknown> & { id: string }> = [];
        try {
          const value = JSON.parse(legacyText);
          if (!Array.isArray(value)) throw new Error("Expected a JSON array.");
          legacyRows = value.filter(row => row && typeof row.id === "string");
        } catch {
          throw new Error("Legacy local data is damaged for " + item.storageKey + ". Export a backup before proceeding.");
        }
        // Keep company-scoped versions on ID collision; import only legacy-only records.
        const localById = new Map<string, Record<string, unknown> & { id: string }>();
        for (const row of legacyRows) localById.set(row.id, row);
        for (const row of localRows) localById.set(row.id, row);
        localRows = Array.from(localById.values());
      }
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
  localStorage.setItem(scopedStorageKey(company.id, "estateflow.syncBaseline"), JSON.stringify(baseline));
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

  const { data: remoteRows, error: readError } = await supabase
    .from("company_records")
    .select("record_type,record_key,payload,updated_at,deleted_at")
    .eq("company_id", company.id);
  if (readError) throw new Error("Could not refresh cloud records: " + readError.message);

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

  let oldBaseline: Record<string, Record<string, string>> = {};
  const baselineKey = scopedStorageKey(company.id, "estateflow.syncBaseline");
  try {
    const parsed = JSON.parse(localStorage.getItem(baselineKey) || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) oldBaseline = parsed;
  } catch { oldBaseline = {}; }

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
        result.push(localPayload);
        nextBaseline[item.recordType][id] = localText;
        if (company.role !== "read_only") {
          toUpsert.push({
            company_id: company.id, record_type: item.recordType, record_key: id,
            payload: localPayload, created_by: userId, updated_by: userId, updated_at: now, deleted_at: null
          });
        }
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

  localStorage.setItem(baselineKey, JSON.stringify(nextBaseline));
  localStorage.setItem(scopedStorageKey(company.id, "estateflow.lastCloudSync"), new Date().toISOString());
  return mergedSnapshot;
}
