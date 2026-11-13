"use strict";

const assert = require("node:assert/strict");

(async () => {
  const { createWorkspaceBackup, parseWorkspaceBackup } = await import("../src/lib/workspace-backup.mjs");
  const make = id => ({ id, title: id });
  const collections = {
    properties: [make("p1")], contacts: [make("c1")], whatsappGroups: [make("g1")],
    tasks: [make("t1")], financials: [make("f1")], riskRecords: [make("r1")],
    approvalRequests: [make("a1")], auditEvents: [make("e1")]
  };

  const created = createWorkspaceBackup(collections, "2026-11-13T00:00:00.000Z");
  assert.equal(created.format, "AXIVESTRA_WORKSPACE_BACKUP");
  assert.deepEqual(parseWorkspaceBackup(created), collections, "versioned backup round-trips every collection");

  const legacy = { properties: [make("old-p")], contacts: [], tasks: [], financials: [] };
  const parsedLegacy = parseWorkspaceBackup(legacy);
  assert.deepEqual(parsedLegacy.properties, legacy.properties, "legacy properties remain readable");
  assert.deepEqual(parsedLegacy.financials, [], "present optional legacy arrays remain readable");
  assert.equal(Object.hasOwn(parsedLegacy, "whatsappGroups"), false, "missing optional legacy arrays stay omitted");

  assert.throws(() => parseWorkspaceBackup("not an object"), /JSON object/);
  assert.throws(() => parseWorkspaceBackup({ properties: [], contacts: [] }), /missing 'tasks'/);
  assert.throws(() => parseWorkspaceBackup({ ...created, collections: { ...collections, auditEvents: null } }), /auditEvents.*array/);
  assert.throws(() => parseWorkspaceBackup({ ...created, collections: { ...collections, contacts: [{ name: "No id" }] } }), /invalid record/);
  assert.throws(() => parseWorkspaceBackup({ ...created, schemaVersion: 99 }), /not supported/);
  assert.throws(() => createWorkspaceBackup({ ...collections, tasks: "wrong" }), /tasks.*array/);

  console.log("AXIVESTRA workspace backup tests passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
