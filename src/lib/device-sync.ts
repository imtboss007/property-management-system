export const DEVICE_SYNC_COLLECTIONS = [
  "properties", "contacts", "whatsappGroups", "tasks",
  "financials", "riskRecords", "approvalRequests", "auditEvents", "customModules"
] as const;

export type DeviceSyncCollection = typeof DEVICE_SYNC_COLLECTIONS[number];
export type DeviceSyncRow = { id: string };
export type DeviceSyncMeta = { updatedAt: string; deletedAt: string };
export type DeviceSyncMetadata = {
  version: 1;
  records: Record<string, Record<string, DeviceSyncMeta>>;
};
export type DeviceSyncSnapshot = Record<DeviceSyncCollection, DeviceSyncRow[]> & {
  __axivestraSync?: DeviceSyncMetadata;
};
export type DeviceSyncBaseline = {
  version: 1;
  payloads: Record<string, Record<string, string>>;
  records: Record<string, Record<string, DeviceSyncMeta>>;
};
export type DeviceSyncResult = { snapshot: DeviceSyncSnapshot; baseline: DeviceSyncBaseline };

const entityByType: Record<string, string> = {
  properties: "Property", contacts: "Contact", tasks: "Task",
  financials: "Financial", riskRecords: "Risk", approvalRequests: "Approval"
};

const emptyObject = <T,>(): Record<string, T> => Object.create(null) as Record<string, T>;

export function emptyDeviceSyncBaseline(): DeviceSyncBaseline {
  return { version: 1, payloads: emptyObject<Record<string, string>>(), records: emptyObject<Record<string, DeviceSyncMeta>>() };
}

export function parseDeviceSyncBaseline(value: unknown): DeviceSyncBaseline {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyDeviceSyncBaseline();
  const candidate = value as Partial<DeviceSyncBaseline>;
  if (candidate.version !== 1 || !candidate.payloads || !candidate.records) return emptyDeviceSyncBaseline();
  return {
    version: 1,
    payloads: candidate.payloads as Record<string, Record<string, string>>,
    records: candidate.records as Record<string, Record<string, DeviceSyncMeta>>
  };
}

function rowsFor(snapshot: Partial<DeviceSyncSnapshot>, key: DeviceSyncCollection): DeviceSyncRow[] {
  const rows = snapshot[key];
  return Array.isArray(rows) ? rows.filter(row => row && typeof row.id === "string" && row.id.length > 0) : [];
}
const serializedObjectCache = new WeakMap<object, string>();

function jsonOf(value: DeviceSyncRow | undefined): string {
  if (!value) return "";
  const object = value as object;
  const cached = serializedObjectCache.get(object);
  if (cached !== undefined) return cached;
  const serialized = JSON.stringify(value);
  serializedObjectCache.set(object, serialized);
  return serialized;
}

export function deviceSyncCollectionsEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  for (let index = 0; index < left.length; index++) {
    const leftRow = left[index];
    const rightRow = right[index];
    if (!leftRow || !rightRow || leftRow.id !== rightRow.id || jsonOf(leftRow) !== jsonOf(rightRow)) return false;
  }
  return true;
}
function validMeta(value: unknown): DeviceSyncMeta | undefined {
  if (!value || typeof value !== "object") return undefined;
  const meta = value as Partial<DeviceSyncMeta>;
  if (typeof meta.updatedAt !== "string" || typeof meta.deletedAt !== "string") return undefined;
  return { updatedAt: meta.updatedAt, deletedAt: meta.deletedAt };
}
function timestamp(value: string | undefined): number {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}
function buildAuditTimeIndex(auditEvents: DeviceSyncRow[]): Map<string, string> {
  const latestByRecord = new Map<string, string>();
  for (const event of auditEvents) {
    const value = event as Record<string, unknown>;
    const entity = String(value.entity || "");
    const recordId = String(value.recordId || "");
    const at = String(value.at || "");
    if (!entity || !recordId || !timestamp(at)) continue;
    const key = entity + "\u0000" + recordId;
    const previous = latestByRecord.get(key) || "";
    if (timestamp(at) > timestamp(previous)) latestByRecord.set(key, at);
  }
  return latestByRecord;
}

function localEditTime(
  collection: DeviceSyncCollection,
  id: string,
  row: DeviceSyncRow | undefined,
  auditTimeIndex: Map<string, string>,
  fallback: string
): string {
  if (collection === "auditEvents") {
    const rowTime = String((row as Record<string, unknown> | undefined)?.at || "");
    if (timestamp(rowTime)) return rowTime;
  }
  if (collection === "whatsappGroups") {
    const rowTime = String((row as Record<string, unknown> | undefined)?.lastSyncedAt || "");
    if (timestamp(rowTime)) return rowTime;
  }
  const entity = entityByType[collection];
  if (entity) {
    const matching = auditTimeIndex.get(entity + "\u0000" + id) || "";
    if (timestamp(matching)) return matching;
  }
  return fallback;
}

export function reconcileDeviceSync(
  localInput: Partial<DeviceSyncSnapshot>,
  remoteInput: Partial<DeviceSyncSnapshot>,
  baselineInput: DeviceSyncBaseline | null | undefined,
  now = new Date().toISOString()
): DeviceSyncResult {
  const baseline = parseDeviceSyncBaseline(baselineInput);
  const remoteMetadata = remoteInput.__axivestraSync?.records || {};
  const nextMetadata: Record<string, Record<string, DeviceSyncMeta>> = emptyObject();
  const nextPayloads: Record<string, Record<string, string>> = emptyObject();
  const merged = {} as DeviceSyncSnapshot;
  const auditEvents = rowsFor(localInput, "auditEvents");
  // Build this once. Filtering the full audit log for every record made reconciliation
  // O(records × audit events), which became visibly slow on larger workspaces.
  const auditTimeIndex = buildAuditTimeIndex(auditEvents);

  for (const collection of DEVICE_SYNC_COLLECTIONS) {
    const localRows = rowsFor(localInput, collection);
    const remoteRows = rowsFor(remoteInput, collection);
    const localById = new Map(localRows.map(row => [row.id, row]));
    const remoteById = new Map(remoteRows.map(row => [row.id, row]));
    const baseById = baseline.payloads[collection] || {};
    const baseMetaById = baseline.records[collection] || {};
    const remoteMetaById = remoteMetadata[collection] || {};
    const ids = new Set([
      ...localById.keys(), ...remoteById.keys(),
      ...Object.keys(baseById), ...Object.keys(remoteMetaById)
    ]);
    const resultRows: DeviceSyncRow[] = [];
    const collectionMeta: Record<string, DeviceSyncMeta> = emptyObject();
    const collectionBaseline: Record<string, string> = emptyObject();

    for (const id of Array.from(ids).sort()) {
      const localRow = localById.get(id);
      const remoteRow = remoteById.get(id);
      const localText = jsonOf(localRow);
      const remoteText = jsonOf(remoteRow);
      const knownAtBaseline = Object.prototype.hasOwnProperty.call(baseById, id);
      const baseText = knownAtBaseline ? String(baseById[id] || "") : "";
      const baseMeta = validMeta(baseMetaById[id]);
      const remoteMeta = validMeta(remoteMetaById[id]);
      const tombstone = remoteMeta?.deletedAt || "";

      // Once a record is deleted on either device, a tombstone prevents stale offline
      // copies from silently resurrecting it.
      if (tombstone) {
        collectionMeta[id] = remoteMeta!;
        collectionBaseline[id] = "";
        continue;
      }

      const localChanged = knownAtBaseline
        ? localText !== baseText
        : Boolean(localText && !remoteText);
      const remoteChanged = knownAtBaseline
        ? Boolean(remoteMeta?.deletedAt) || Boolean(remoteText && (
          remoteText !== baseText || Boolean(remoteMeta && baseMeta && remoteMeta.updatedAt !== baseMeta.updatedAt)
        ))
        : Boolean(remoteText);
      const localDeleted = !localText && knownAtBaseline && Boolean(baseText);
      const localChangedAt = localEditTime(collection, id, localRow, auditTimeIndex, now);
      let chosen: DeviceSyncRow | undefined;
      let chosenMeta: DeviceSyncMeta;

      if (localChanged && !remoteChanged) {
        if (localDeleted) {
          chosenMeta = { updatedAt: localChangedAt, deletedAt: localChangedAt };
          collectionMeta[id] = chosenMeta;
          collectionBaseline[id] = "";
          continue;
        }
        chosen = localRow;
        chosenMeta = {
          updatedAt: localText === remoteText && remoteMeta ? remoteMeta.updatedAt : localChangedAt,
          deletedAt: ""
        };
      } else if (remoteChanged && !localChanged) {
        chosen = remoteRow;
        chosenMeta = remoteMeta || { updatedAt: now, deletedAt: "" };
      } else if (localChanged && remoteChanged) {
        const remoteTime = timestamp(remoteMeta?.updatedAt);
        if (localText === remoteText) {
          chosen = remoteRow || localRow;
          chosenMeta = remoteMeta || { updatedAt: localChangedAt, deletedAt: "" };
        } else if (timestamp(localChangedAt) > remoteTime) {
          if (localDeleted) {
            chosenMeta = { updatedAt: localChangedAt, deletedAt: localChangedAt };
            collectionMeta[id] = chosenMeta;
            collectionBaseline[id] = "";
            continue;
          }
          chosen = localRow;
          chosenMeta = { updatedAt: localChangedAt, deletedAt: "" };
        } else {
          chosen = remoteRow;
          chosenMeta = remoteMeta || { updatedAt: now, deletedAt: "" };
        }
      } else {
        chosen = remoteRow || localRow;
        chosenMeta = remoteMeta || baseMeta || { updatedAt: now, deletedAt: "" };
      }

      if (chosen) {
        resultRows.push(chosen);
        const stableMeta = {
          updatedAt: chosenMeta.updatedAt || now,
          deletedAt: ""
        };
        collectionMeta[id] = stableMeta;
        collectionBaseline[id] = jsonOf(chosen);
      } else if (knownAtBaseline && baseText) {
        // A local deletion is the only reason a previously known row can disappear
        // without a remote tombstone.
        const deletedAt = localChangedAt || now;
        collectionMeta[id] = { updatedAt: deletedAt, deletedAt };
        collectionBaseline[id] = "";
      }
    }

    if (collection === "auditEvents") {
      resultRows.sort((a, b) => {
        const aAt = String((a as Record<string, unknown>).at || "");
        const bAt = String((b as Record<string, unknown>).at || "");
        return timestamp(bAt) - timestamp(aAt) || a.id.localeCompare(b.id);
      });
    } else {
      resultRows.sort((a, b) => a.id.localeCompare(b.id));
    }
    (merged as unknown as Record<string, unknown>)[collection] = resultRows;
    nextMetadata[collection] = collectionMeta;
    nextPayloads[collection] = collectionBaseline;
  }

  merged.__axivestraSync = { version: 1, records: nextMetadata };
  return {
    snapshot: merged,
    baseline: { version: 1, payloads: nextPayloads, records: nextMetadata }
  };
}

export function deviceSyncSnapshotsEqual(left: Partial<DeviceSyncSnapshot>, right: Partial<DeviceSyncSnapshot>): boolean {
  for (const collection of DEVICE_SYNC_COLLECTIONS) {
    if (!deviceSyncCollectionsEqual(left[collection], right[collection])) return false;
  }
  return jsonOf(left.__axivestraSync as unknown as DeviceSyncRow | undefined)
    === jsonOf(right.__axivestraSync as unknown as DeviceSyncRow | undefined);
}
