const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const filename = path.join(__dirname, "..", "src", "lib", "device-sync.ts");
const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const compiled = { exports: {} };
vm.runInNewContext(code, { module: compiled, exports: compiled.exports, require }, { filename });
const { reconcileDeviceSync, emptyDeviceSyncBaseline, deviceSyncCollectionsEqual, deviceSyncSnapshotsEqual } = compiled.exports;
const empty = () => ({ properties: [], contacts: [], whatsappGroups: [], tasks: [], financials: [], riskRecords: [], approvalRequests: [], auditEvents: [], customModules: [] });
const pc = empty();
pc.properties = [{ id: "p1", title: "PC property" }];
pc.contacts = [{ id: "c1", name: "Vendor" }];
pc.customModules = [{ id: "m1", name: "Construction Projects", fields: [{ key: "budget", label: "Budget", type: "currency" }] }];
const first = reconcileDeviceSync(pc, empty(), emptyDeviceSyncBaseline(), "2026-10-29T10:00:00.000Z");
assert.equal(first.snapshot.properties[0].title, "PC property");
assert.equal(first.snapshot.contacts[0].name, "Vendor");
assert.equal(first.snapshot.customModules[0].name, "Construction Projects");
assert.ok(first.snapshot.__axivestraSync.records.properties.p1.updatedAt);

const phoneInitial = reconcileDeviceSync(empty(), first.snapshot, emptyDeviceSyncBaseline(), "2026-10-29T10:01:00.000Z");
assert.equal(phoneInitial.snapshot.properties[0].title, "PC property");
assert.equal(phoneInitial.snapshot.contacts[0].name, "Vendor");
assert.equal(phoneInitial.snapshot.customModules[0].fields[0].key, "budget", "phone receives custom module definitions");

const phoneEdit = { ...phoneInitial.snapshot, properties: [{ id: "p1", title: "Edited on phone" }], customModules: [{ ...phoneInitial.snapshot.customModules[0], description: "Edited on phone" }], __axivestraSync: phoneInitial.snapshot.__axivestraSync };
const phoneResult = reconcileDeviceSync(phoneEdit, first.snapshot, phoneInitial.baseline, "2026-10-29T10:02:00.000Z");
assert.equal(phoneResult.snapshot.properties[0].title, "Edited on phone");

const pcNext = reconcileDeviceSync(pc, phoneResult.snapshot, first.baseline, "2026-10-29T10:03:00.000Z");
assert.equal(pcNext.snapshot.properties[0].title, "Edited on phone", "PC receives phone edits");
assert.equal(pcNext.snapshot.customModules[0].description, "Edited on phone", "PC receives custom-module changes");

const deletion = { ...phoneResult.snapshot, properties: [], __axivestraSync: phoneResult.snapshot.__axivestraSync };
const deleted = reconcileDeviceSync(deletion, phoneResult.snapshot, phoneResult.baseline, "2026-10-29T10:04:00.000Z");
assert.equal(deleted.snapshot.properties.length, 0);
assert.ok(deleted.snapshot.__axivestraSync.records.properties.p1.deletedAt);
const noResurrection = reconcileDeviceSync(pcNext.snapshot, deleted.snapshot, pcNext.baseline, "2026-10-29T10:05:00.000Z");
assert.equal(noResurrection.snapshot.properties.length, 0, "stale PC data cannot resurrect deleted records");


const baselineSeed = empty();
baselineSeed.properties = [{ id: "audit-target", title: "Baseline" }];
const auditBaseline = reconcileDeviceSync(
  baselineSeed, empty(), emptyDeviceSyncBaseline(), "2026-10-29T10:00:00.000Z"
).baseline;
const localConcurrent = empty();
localConcurrent.properties = [{ id: "audit-target", title: "Local edit" }];
localConcurrent.auditEvents = [{ id: "audit-event-1", entity: "Property", recordId: "audit-target", at: "2026-10-29T10:03:00.000Z" }];
const remoteConcurrent = empty();
remoteConcurrent.properties = [{ id: "audit-target", title: "Remote edit" }];
remoteConcurrent.__axivestraSync = {
  version: 1,
  records: { properties: { "audit-target": { updatedAt: "2026-10-29T10:02:00.000Z", deletedAt: "" } } }
};
const concurrentResult = reconcileDeviceSync(
  localConcurrent, remoteConcurrent, auditBaseline, "2026-10-29T10:04:00.000Z"
);
assert.equal(concurrentResult.snapshot.properties[0].title, "Local edit",
  "the latest indexed local audit event must win a concurrent edit conflict");

const sharedRowsA = [{ id: "same", value: 1 }, { id: "same-2", value: 2 }];
const sharedRowsB = [{ id: "same", value: 1 }, { id: "same-2", value: 2 }];
assert.equal(deviceSyncCollectionsEqual(sharedRowsA, sharedRowsB), true,
  "collection equality must compare equivalent rows even when arrays came from JSON transport");
assert.equal(deviceSyncCollectionsEqual(sharedRowsA, [{ id: "same", value: 9 }, { id: "same-2", value: 2 }]), false,
  "collection equality must detect changed record payloads");
assert.equal(deviceSyncSnapshotsEqual(empty(), empty()), true,
  "two empty sync snapshots should compare equal");

const manyProperties = Array.from({ length: 1200 }, (_, index) => ({ id: "p-" + index, title: "Property " + index }));
const manyAuditEvents = manyProperties.map((row, index) => ({
  id: "a-" + index, entity: "Property", recordId: row.id,
  at: new Date(Date.UTC(2026, 9, 29, 10, index % 60, 0)).toISOString()
}));
const indexedAuditLocal = empty();
indexedAuditLocal.properties = manyProperties.map(row => row.id === "p-1199" ? { ...row, title: "Updated property" } : row);
indexedAuditLocal.auditEvents = manyAuditEvents;
const indexedAuditBase = reconcileDeviceSync(
  { ...empty(), properties: manyProperties }, empty(), emptyDeviceSyncBaseline(), "2026-10-29T10:00:00.000Z"
).baseline;
const indexedAuditRemote = {
  ...empty(),
  properties: manyProperties.map(row => row.id === "p-1199" ? { ...row, title: "Remote property" } : row),
  __axivestraSync: {
    version: 1,
    records: { properties: { "p-1199": { updatedAt: "2026-10-29T10:58:00.000Z", deletedAt: "" } } }
  }
};
const indexedAuditResult = reconcileDeviceSync(
  indexedAuditLocal, indexedAuditRemote, indexedAuditBase, "2026-10-29T11:00:00.000Z"
);
assert.equal(indexedAuditResult.snapshot.properties.find(row => row.id === "p-1199").title, "Updated property",
  "large audit histories must retain the correct latest-edit conflict decision");

process.stdout.write("Device sync regression suite passed.\n");
