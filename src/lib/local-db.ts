import Dexie, { type Table } from "dexie";

export type StoredDocument = {
  id: string;
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
  }
}

export const localDb = new AxivestraLocalDatabase();
