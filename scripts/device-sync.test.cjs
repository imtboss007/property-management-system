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
const { reconcileDeviceSync, emptyDeviceSyncBaseline } = compiled.exports;
const empty = () => ({ properties: [], contacts: [], whatsappGroups: [], tasks: [], financials: [], riskRecords: [], approvalRequests: [], auditEvents: [] });
const pc = empty();
pc.properties = [{ id: "p1", title: "PC property" }];
pc.contacts = [{ id: "c1", name: "Vendor" }];
const first = reconcileDeviceSync(pc, empty(), emptyDeviceSyncBaseline(), "2026-10-29T10:00:00.000Z");
assert.equal(first.snapshot.properties[0].title, "PC property");
assert.equal(first.snapshot.contacts[0].name, "Vendor");
assert.ok(first.snapshot.__axivestraSync.records.properties.p1.updatedAt);

const phoneInitial = reconcileDeviceSync(empty(), first.snapshot, emptyDeviceSyncBaseline(), "2026-10-29T10:01:00.000Z");
assert.equal(phoneInitial.snapshot.properties[0].title, "PC property");
assert.equal(phoneInitial.snapshot.contacts[0].name, "Vendor");

const phoneEdit = { ...phoneInitial.snapshot, properties: [{ id: "p1", title: "Edited on phone" }], __axivestraSync: phoneInitial.snapshot.__axivestraSync };
const phoneResult = reconcileDeviceSync(phoneEdit, first.snapshot, phoneInitial.baseline, "2026-10-29T10:02:00.000Z");
assert.equal(phoneResult.snapshot.properties[0].title, "Edited on phone");

const pcNext = reconcileDeviceSync(pc, phoneResult.snapshot, first.baseline, "2026-10-29T10:03:00.000Z");
assert.equal(pcNext.snapshot.properties[0].title, "Edited on phone", "PC receives phone edits");

const deletion = { ...phoneResult.snapshot, properties: [], __axivestraSync: phoneResult.snapshot.__axivestraSync };
const deleted = reconcileDeviceSync(deletion, phoneResult.snapshot, phoneResult.baseline, "2026-10-29T10:04:00.000Z");
assert.equal(deleted.snapshot.properties.length, 0);
assert.ok(deleted.snapshot.__axivestraSync.records.properties.p1.deletedAt);
const noResurrection = reconcileDeviceSync(pcNext.snapshot, deleted.snapshot, pcNext.baseline, "2026-10-29T10:05:00.000Z");
assert.equal(noResurrection.snapshot.properties.length, 0, "stale PC data cannot resurrect deleted records");

process.stdout.write("Device sync regression suite passed.\n");
