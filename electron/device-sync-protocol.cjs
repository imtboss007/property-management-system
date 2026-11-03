function parseKnownRevision(value) {
  if (value === undefined || value === null || value === "") return null;
  const revision = Number(value);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : null;
}

/**
 * Return only the revision header when a client already has the current snapshot.
 * Older clients that omit sinceRevision continue to receive the full v1 response.
 */
function createDataSyncReadReply(store, sinceRevision) {
  const revision = Number.isSafeInteger(store && store.revision) && store.revision >= 0
    ? store.revision
    : 0;
  const base = {
    ok: true,
    schemaVersion: Number(store && store.schemaVersion) || 1,
    revision,
    updatedAt: String(store && store.updatedAt || "")
  };
  if (parseKnownRevision(sinceRevision) === revision) {
    return { ...base, unchanged: true };
  }
  return { ...base, snapshot: store && store.snapshot && typeof store.snapshot === "object" ? store.snapshot : {} };
}

module.exports = { createDataSyncReadReply };
