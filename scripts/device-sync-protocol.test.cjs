const assert = require("node:assert/strict");
const { createDataSyncReadReply } = require("../electron/device-sync-protocol.cjs");

const snapshot = {
  properties: [{ id: "property-1", title: "Office" }],
  contacts: [{ id: "contact-1", name: "Supplier" }]
};
const store = { schemaVersion: 1, revision: 12, updatedAt: "2026-11-02T00:00:00.000Z", snapshot };

const full = createDataSyncReadReply(store);
assert.equal(full.ok, true);
assert.equal(full.revision, 12);
assert.deepEqual(full.snapshot, snapshot);
assert.equal(full.unchanged, undefined, "legacy clients receive the normal full response");

const unchanged = createDataSyncReadReply(store, "12");
assert.equal(unchanged.ok, true);
assert.equal(unchanged.revision, 12);
assert.equal(unchanged.unchanged, true);
assert.equal(Object.prototype.hasOwnProperty.call(unchanged, "snapshot"), false,
  "an unchanged response must not serialize or transmit the large record snapshot");

const stale = createDataSyncReadReply(store, 11);
assert.deepEqual(stale.snapshot, snapshot, "stale clients still receive the full current snapshot");
assert.equal(stale.unchanged, undefined);

for (const invalid of [null, undefined, "", "-1", "not-a-number", "12.5"]) {
  const response = createDataSyncReadReply(store, invalid);
  assert.deepEqual(response.snapshot, snapshot, "invalid revision hints must fall back to a full snapshot");
}

const emptyStore = { schemaVersion: 1, revision: 0, updatedAt: "", snapshot: {} };
assert.equal(createDataSyncReadReply(emptyStore, 0).unchanged, true,
  "revision zero is a valid unchanged state after an empty store has been read once");

process.stdout.write("Revision-aware device sync protocol tests passed.\n");
