import Dexie, { type Table } from "dexie";
import { parseDeviceSyncBaseline, type DeviceSyncBaseline } from "./device-sync";

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

type StoredDeviceSyncBaseline = {
  id: string;
  companyId: string;
  baseline: DeviceSyncBaseline;
  updatedAt: string;
};

type StoredCompanySyncBaseline = {
  id: string;
  companyId: string;
  value: Record<string, Record<string, string>>;
  updatedAt: string;
};

class AxivestraLocalDatabase extends Dexie {
  documents!: Table<StoredDocument, string>;
  syncBaselines!: Table<StoredDeviceSyncBaseline, string>;
  syncState!: Table<StoredCompanySyncBaseline, string>;

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
      syncBaselines: "&id,companyId,updatedAt"
    });
    this.version(4).stores({
      documents: "&id,createdAt,companyId,propertyId,contactId,category,name",
      syncBaselines: "&id,companyId,updatedAt",
      syncState: "&id,companyId,updatedAt"
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


/**
 * Keep the device reconciliation baseline in IndexedDB, not localStorage.
 * It contains a serialized shadow of every synced record and can exceed the
 * small synchronous browser storage quota on phones.
 */
export async function loadDeviceSyncBaseline(id: string, legacyValue?: unknown): Promise<DeviceSyncBaseline> {
  const stored = await localDb.syncBaselines.get(id);
  if (stored?.baseline) return parseDeviceSyncBaseline(stored.baseline);

  const hasLegacy = Boolean(legacyValue && typeof legacyValue === "object"
    && (legacyValue as { version?: unknown }).version === 1);
  const baseline = hasLegacy ? parseDeviceSyncBaseline(legacyValue) : parseDeviceSyncBaseline(null);
  if (hasLegacy) {
    await localDb.syncBaselines.put({
      id,
      companyId: id.replace(/^device-sync:/, ""),
      baseline,
      updatedAt: new Date().toISOString()
    });
  }
  return baseline;
}

export async function saveDeviceSyncBaseline(id: string, baseline: DeviceSyncBaseline): Promise<void> {
  await localDb.syncBaselines.put({
    id,
    companyId: id.replace(/^device-sync:/, ""),
    baseline: parseDeviceSyncBaseline(baseline),
    updatedAt: new Date().toISOString()
  });
}


/**
 * Keep company-wide cloud reconciliation shadows in IndexedDB rather than
 * localStorage. These maps can grow with every saved record and exceed a
 * phone browser's small synchronous storage quota.
 */
export async function loadCompanySyncBaseline(
  id: string
): Promise<Record<string, Record<string, string>> | null> {
  const stored = await localDb.syncState.get(id);
  if (!stored?.value || typeof stored.value !== "object" || Array.isArray(stored.value)) return null;
  return stored.value;
}

export async function saveCompanySyncBaseline(
  id: string,
  companyId: string,
  value: Record<string, Record<string, string>>
): Promise<void> {
  await localDb.syncState.put({
    id,
    companyId,
    value,
    updatedAt: new Date().toISOString()
  });
}
