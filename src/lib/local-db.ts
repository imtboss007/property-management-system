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

  constructor() {
    super("axivestra-local-vault");
    this.version(1).stores({
      documents: "&id,createdAt,propertyId,contactId,category,name"
    });
    this.version(2).stores({
      documents: "&id,createdAt,companyId,propertyId,contactId,category,name"
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
