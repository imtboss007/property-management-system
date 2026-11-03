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

/**
 * Keep the device reconciliation baseline in IndexedDB, not localStorage.
 * Large contact/property directories can exceed Android WebView's small
 * localStorage quota even though IndexedDB has ample space for this metadata.
 * Migrate the old localStorage value once, without touching business records.
 */
export async function loadDeviceSyncBaseline(): Promise<unknown> {
  const saved = await localDb.syncState.get("deviceSyncBaseline");
  if (saved) return saved.value;
  let legacy: unknown = null;
  try {
    const raw = localStorage.getItem(DEVICE_SYNC_BASELINE_KEY);
    if (raw) legacy = JSON.parse(raw);
  } catch {
    // An absent, malformed or quota-constrained legacy value is a fresh baseline.
  }
  if (legacy !== null) {
    await localDb.syncState.put({ key: "deviceSyncBaseline", value: legacy });
    try { localStorage.removeItem(DEVICE_SYNC_BASELINE_KEY); } catch {}
  }
  return legacy;
}

export async function saveDeviceSyncBaseline(value: unknown): Promise<void> {
  await localDb.syncState.put({ key: "deviceSyncBaseline", value });
  // Remove any old oversized duplicate only after the IndexedDB write succeeds.
  try { localStorage.removeItem(DEVICE_SYNC_BASELINE_KEY); } catch {}
}
