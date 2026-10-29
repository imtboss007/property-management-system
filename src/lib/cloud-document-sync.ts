import { localDb, type StoredDocument } from "./local-db";
import { supabase, type WorkspaceCompany } from "./supabase";

const BUCKET = "axivestra-company-documents";
const RECORD_TYPE = "document";
const LOCAL_TOMBSTONE_KEY = "axivestra.documentTombstones";
const CLOUD_TOMBSTONE_SEEN_KEY = "axivestra.cloudDocumentTombstonesSeen";

type Tombstone = { companyId: string; deletedAt: string };
type CloudDocument = Omit<StoredDocument, "file"> & { companyId: string };
type CloudRow = {
  record_key: string;
  payload: Record<string, unknown> | null;
  created_by?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

export type CloudDocumentSyncResult = {
  uploaded: number;
  downloaded: number;
  deleted: number;
};

function readObject<T>(key: string): Record<string, T> {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, T>
      : {};
  } catch {
    return {};
  }
}

function writeObject<T>(key: string, value: Record<string, T>): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function validSegment(value: string): boolean {
  return /^[a-zA-Z0-9_-]{1,160}$/.test(value);
}

function objectPath(companyId: string, documentId: string): string {
  if (!validSegment(companyId) || !validSegment(documentId)) {
    throw new Error("A document has an invalid company or file identifier. Export a vault backup before changing it.");
  }
  return companyId + "/" + documentId;
}

function toCloudDocument(record: Omit<StoredDocument, "file"> | StoredDocument, companyId: string): CloudDocument {
  return {
    id: String(record.id),
    companyId,
    propertyId: String(record.propertyId || ""),
    property: String(record.property || ""),
    contactId: String(record.contactId || ""),
    name: String(record.name || ""),
    category: String(record.category || "Other"),
    storagePath: objectPath(companyId, String(record.id)),
    mimeType: String(record.mimeType || "application/octet-stream"),
    sizeBytes: Number(record.sizeBytes || 0),
    expiresOn: String(record.expiresOn || ""),
    notes: String(record.notes || ""),
    createdAt: String(record.createdAt || new Date().toISOString())
  };
}

function stableMetadata(value: Record<string, unknown>): string {
  const ordered: Record<string, unknown> = {};
  for (const key of [
    "id", "companyId", "propertyId", "property", "contactId", "name", "category",
    "storagePath", "mimeType", "sizeBytes", "expiresOn", "notes", "createdAt"
  ]) ordered[key] = value[key] ?? "";
  return JSON.stringify(ordered);
}

function asCloudDocument(row: CloudRow, companyId: string): CloudDocument | null {
  const value = row.payload;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const id = String(value.id || row.record_key || "");
  if (!id || id !== row.record_key || !validSegment(id)) return null;
  return {
    id,
    companyId,
    propertyId: String(value.propertyId || ""),
    property: String(value.property || ""),
    contactId: String(value.contactId || ""),
    name: String(value.name || "Document"),
    category: String(value.category || "Other"),
    storagePath: objectPath(companyId, id),
    mimeType: String(value.mimeType || "application/octet-stream"),
    sizeBytes: Number(value.sizeBytes || 0),
    expiresOn: String(value.expiresOn || ""),
    notes: String(value.notes || ""),
    createdAt: String(value.createdAt || row.updated_at || new Date().toISOString())
  };
}

async function readAllRows(companyId: string): Promise<CloudRow[]> {
  if (!supabase) return [];
  const rows: CloudRow[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("company_records")
      .select("record_key,payload,created_by,updated_at,deleted_at")
      .eq("company_id", companyId)
      .eq("record_type", RECORD_TYPE)
      .order("record_key", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error("Could not read company document metadata. Apply the cloud document vault migration and retry. " + error.message);
    const batch = (data || []) as CloudRow[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

async function upsertMetadata(company: WorkspaceCompany, userId: string, record: CloudDocument): Promise<void> {
  if (!supabase) throw new Error("Cloud database is not configured.");
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("company_records")
    .upsert({
      company_id: company.id,
      record_type: RECORD_TYPE,
      record_key: record.id,
      payload: record,
      created_by: userId,
      updated_by: userId,
      updated_at: now,
      deleted_at: null
    }, { onConflict: "company_id,record_type,record_key" });
  if (error) throw new Error("Document metadata could not be saved to the company cloud. " + error.message);
}

async function markDeleted(company: WorkspaceCompany, userId: string, id: string, deletedAt: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from("company_records")
    .update({ deleted_at: deletedAt, updated_by: userId, updated_at: deletedAt })
    .eq("company_id", company.id)
    .eq("record_type", RECORD_TYPE)
    .eq("record_key", id)
    .is("deleted_at", null);
  if (error) throw new Error("Document deletion could not be synchronized to the cloud. " + error.message);
}

async function removeCloudFile(companyId: string, id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.storage.from(BUCKET).remove([objectPath(companyId, id)]);
  if (error && !/not found|does not exist|no objects/i.test(error.message)) {
    throw new Error("Cloud document file cleanup failed. " + error.message);
  }
}

async function uploadCloudFile(companyId: string, record: StoredDocument): Promise<void> {
  if (!supabase) return;
  if (!record.file || record.file.size !== record.sizeBytes) {
    throw new Error("The local file is missing or damaged: " + record.name);
  }
  if (record.sizeBytes > 25 * 1024 * 1024) {
    throw new Error("The cloud document vault supports files up to 25 MB: " + record.name);
  }
  const { error } = await supabase.storage.from(BUCKET).upload(
    objectPath(companyId, record.id),
    record.file,
    { upsert: true, contentType: record.mimeType || "application/octet-stream", cacheControl: "3600" }
  );
  if (error) throw new Error("Could not upload document file '" + record.name + "' to the company cloud. " + error.message);
}

async function downloadCloudFile(companyId: string, metadata: CloudDocument): Promise<Blob> {
  if (!supabase) throw new Error("Cloud database is not configured.");
  const { data, error } = await supabase.storage.from(BUCKET).download(objectPath(companyId, metadata.id));
  if (error || !data) {
    throw new Error("The cloud file is missing for '" + metadata.name + "'. Re-upload it from a device that still has the original file." + (error ? " " + error.message : ""));
  }
  if (data.size !== metadata.sizeBytes) {
    throw new Error("Downloaded file failed its size check: " + metadata.name);
  }
  return data;
}

/**
 * Reconcile the private company document bucket with this device's IndexedDB vault.
 * Binary files stay on each device for offline access and are copied to private cloud
 * storage so the second device can restore them independently. company_records holds
 * metadata and durable deletion tombstones.
 */
export async function syncCloudDocumentVault(
  company: WorkspaceCompany,
  userId: string
): Promise<CloudDocumentSyncResult> {
  if (!supabase || !company.id || !userId) return { uploaded: 0, downloaded: 0, deleted: 0 };

  const canUpload = ["owner", "admin", "manager", "staff"].includes(company.role);
  const canDelete = ["owner", "admin", "manager"].includes(company.role);
  const rows = await readAllRows(company.id);
  const remoteById = new Map(rows.map(row => [String(row.record_key), row]));
  const localBefore = (await localDb.documents.toArray())
    .filter(document => String(document.companyId || "") === company.id);
  const localById = new Map(localBefore.map(document => [document.id, document]));
  const tombstones = readObject<Tombstone>(LOCAL_TOMBSTONE_KEY);
  const seenCloudTombstones = readObject<string>(CLOUD_TOMBSTONE_SEEN_KEY);
  const result: CloudDocumentSyncResult = { uploaded: 0, downloaded: 0, deleted: 0 };

  // Respect cloud deletions first and feed the PC companion's existing deletion outbox
  // only once. The durable company_records tombstone prevents stale devices reviving files.
  for (const row of rows) {
    if (!row.deleted_at) continue;
    const id = String(row.record_key || "");
    if (!id) continue;
    if (!seenCloudTombstones[id]) {
      tombstones[id] = { companyId: company.id, deletedAt: String(row.deleted_at) };
      seenCloudTombstones[id] = String(row.deleted_at);
    }
    if (localById.has(id)) {
      await localDb.documents.delete(id);
      localById.delete(id);
      result.deleted++;
    }
    if (canDelete) await removeCloudFile(company.id, id);
  }
  writeObject(LOCAL_TOMBSTONE_KEY, tombstones);
  writeObject(CLOUD_TOMBSTONE_SEEN_KEY, seenCloudTombstones);

  // Propagate locally queued deletions to cloud metadata before uploading any local files.
  for (const [id, tombstone] of Object.entries(tombstones)) {
    if (tombstone.companyId !== company.id || !remoteById.has(id) || remoteById.get(id)?.deleted_at || !canDelete) continue;
    const deletedAt = tombstone.deletedAt || new Date().toISOString();
    await markDeleted(company, userId, id, deletedAt);
    await removeCloudFile(company.id, id);
    const previous = remoteById.get(id)!;
    remoteById.set(id, { ...previous, deleted_at: deletedAt, updated_at: deletedAt });
  }

  // Upload missing/new files and metadata. If a local file is damaged but cloud metadata
  // exists, leave it for the download repair pass rather than replacing good cloud data.
  for (const local of localBefore) {
    const id = local.id;
    const tombstone = tombstones[id];
    const remote = remoteById.get(id);
    if (tombstone?.companyId === company.id || remote?.deleted_at) continue;
    const metadata = toCloudDocument(local, company.id);
    const remoteMetadata = remote ? asCloudDocument(remote, company.id) : null;
    const metadataMatches = Boolean(remoteMetadata && stableMetadata(remoteMetadata as unknown as Record<string, unknown>) === stableMetadata(metadata as unknown as Record<string, unknown>));
    const localFileHealthy = Boolean(local.file && local.file.size === local.sizeBytes);
    if (remote && metadataMatches && localFileHealthy) continue;
    if (!canUpload) continue;
    if (!localFileHealthy) {
      if (remote && !remote.deleted_at) continue;
      throw new Error("The local file is missing or damaged: " + local.name);
    }
    await uploadCloudFile(company.id, local);
    await upsertMetadata(company, userId, metadata);
    const savedRow: CloudRow = {
      record_key: id,
      payload: metadata as unknown as Record<string, unknown>,
      created_by: userId,
      updated_at: new Date().toISOString(),
      deleted_at: null
    };
    remoteById.set(id, savedRow);
    result.uploaded++;
  }

  // Download cloud-only documents or repair missing/corrupted local file bytes.
  for (const [id, row] of remoteById) {
    if (row.deleted_at || tombstones[id]?.companyId === company.id) continue;
    const metadata = asCloudDocument(row, company.id);
    if (!metadata) continue;
    const local = localById.get(id);
    if (local && local.file && local.file.size === metadata.sizeBytes &&
        stableMetadata(toCloudDocument(local, company.id) as unknown as Record<string, unknown>) ===
        stableMetadata(metadata as unknown as Record<string, unknown>)) continue;
    const file = await downloadCloudFile(company.id, metadata);
    await localDb.documents.put({ ...metadata, file });
    localById.set(id, { ...metadata, file });
    result.downloaded++;
  }

  return result;
}
