import Dexie, { type Table } from "dexie";

export type StoredDocument = {
  id: string;
  companyId?: string;
  propertyId: string;
  property: string;
  contactId?: string;
  name: string;
  category: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  expiresOn: string;
  notes: string;
  createdAt: string;
  file: Blob;
};

class AxivestraLocalDatabase extends Dexie {
  documents!: Table<StoredDocument, string>;
  syncState!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super("axivestra-local-vault");
    this.version(1).stores({
      documents: "&id,createdAt,propertyId,contactId,category,name"
    });
    this.version(2).stores({
      documents: "&id,createdAt,companyId,propertyId,contactId,category,name"
    });
    this.version(3).stores({
      documents: "&id,createdAt,companyId,propertyId,contactId,category,name",
      syncState: "&key"
    });
  }
}

export const localDb = new AxivestraLocalDatabase();

/**
 * Assign old vault records (created before company workspaces) to the company
 * only after the user explicitly chooses "Import and merge local records".
 * Company IDs are indexed in Dexie; file bytes remain on this device.
 */
export async function assignLegacyVaultToCompany(companyId: string): Promise<number> {
  const unassigned = await localDb.documents.filter(document => !document.companyId).toArray();
  if (!unassigned.length) return 0;
  const assigned = unassigned.map(document => ({ ...document, companyId }));
  await localDb.documents.bulkPut(assigned);
  return assigned.length;
}


const DEVICE_SYNC_BASELINE_KEY = "axivestra.deviceSyncBaseline";

/** Store large PC/mobile reconciliation metadata in IndexedDB, not Android localStorage. */
export async function loadDeviceSyncBaseline(): Promise<unknown> {
  const saved = await localDb.syncState.get("deviceSyncBaseline");
  if (saved) return saved.value;
  let legacy: unknown = null;
  try {
    const raw = localStorage.getItem(DEVICE_SYNC_BASELINE_KEY);
    if (raw) legacy = JSON.parse(raw);
  } catch { /* A missing or oversized legacy value is treated as a fresh baseline. */ }
  if (legacy !== null) {
    await localDb.syncState.put({ key: "deviceSyncBaseline", value: legacy });
    try { localStorage.removeItem(DEVICE_SYNC_BASELINE_KEY); } catch {}
  }
  return legacy;
}

export async function saveDeviceSyncBaseline(value: unknown): Promise<void> {
  await localDb.syncState.put({ key: "deviceSyncBaseline", value });
  try { localStorage.removeItem(DEVICE_SYNC_BASELINE_KEY); } catch {}
}


export async function clearDeviceSyncBaseline(): Promise<void> {
  await localDb.syncState.delete("deviceSyncBaseline");
  try { localStorage.removeItem(DEVICE_SYNC_BASELINE_KEY); } catch {}
}


/** Keep small workspace state in the existing IndexedDB state table instead of localStorage. */
export async function loadWorkspaceState<T>(key: string): Promise<T | null> {
  const row = await localDb.syncState.get("workspace:" + key);
  return row ? row.value as T : null;
}

export async function saveWorkspaceState(key: string, value: unknown): Promise<void> {
  await localDb.syncState.put({ key: "workspace:" + key, value });
}
