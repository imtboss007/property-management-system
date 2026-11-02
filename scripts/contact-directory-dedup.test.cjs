"use strict";

const assert = require("node:assert/strict");
const {
  canonicalContactPhone,
  deduplicateMasterContacts,
  mergeMasterContactsById,
  remapWorkspaceContactReferences
} = require("../src/lib/contact-directory.mjs");

assert.equal(canonicalContactPhone("98765 43210"), "919876543210");
assert.equal(canonicalContactPhone("+91 (98765) 43210"), "919876543210");
assert.equal(canonicalContactPhone("0044 20 7946 0958"), "442079460958");

const source = [
  { id: "keep", name: "@APEX_Titan_invictus", phone: "+91 98806 96994", whatsappName: "@APEX_Titan_invictus", whatsappJid: "919880696994@s.whatsapp.net", role: "Other", notes: "WhatsApp import" },
  { id: "duplicate", name: "@APEX_Titan_invictus", phone: "9880696994", role: "Investor", email: "apex@example.test", notes: "Verified by user", customRoles: "Broker" },
  { id: "shared-phone-other-person", name: "Different person", phone: "+91 98806 96994", role: "Client", notes: "Shared office phone" },
  { id: "no-phone-a", name: "Unnamed WhatsApp entry", phone: "", whatsappJid: "opaque@lid" },
  { id: "no-phone-b", name: "Unnamed WhatsApp entry", phone: "", whatsappJid: "opaque-2@lid" }
];
const result = deduplicateMasterContacts(source);
assert.equal(result.duplicatesRemoved, 1, "only the actual repeated WhatsApp identity is merged");
assert.equal(result.contacts.length, 4);
assert.equal(result.remap.duplicate, "keep");
const master = result.contacts.find(contact => contact.id === "keep");
assert.equal(master.email, "apex@example.test", "email survives merge");
assert.match(master.notes, /WhatsApp import/);
assert.match(master.notes, /Verified by user/);
assert.deepEqual(master.roles.sort(), ["Investor", "Other"]);
assert.equal(master.customRoles, "Broker");
assert.equal(result.contacts.find(contact => contact.id === "shared-phone-other-person").name, "Different person");

const snapshot = {
  properties: [{
    id: "property",
    primaryContactId: "duplicate",
    moduleData: { __contact_lender: "duplicate", __linkedContactIds: "keep,duplicate,other" }
  }],
  tasks: [{ id: "task", contactId: "duplicate" }],
  financials: [{ id: "financial", contactId: "duplicate" }],
  riskRecords: [{ id: "risk", contactId: "duplicate" }],
  approvalRequests: [{ id: "approval", contactId: "duplicate" }]
};
const rewired = remapWorkspaceContactReferences(snapshot, result.remap);
assert.equal(rewired.properties[0].primaryContactId, "keep");
assert.equal(rewired.properties[0].moduleData.__contact_lender, "keep");
assert.equal(rewired.properties[0].moduleData.__linkedContactIds, "keep,other");
for (const collection of ["tasks", "financials", "riskRecords", "approvalRequests"]) {
  assert.equal(rewired[collection][0].contactId, "keep", collection + " contact reference");
}

const explicitSource = [
  { id: "owner", name: "Preferred name", phone: "+91 99999 11111", notes: "Primary source", followUps: [{ id: "f1", description: "Call" }] },
  { id: "alias", name: "Alternate identity", phone: "+91 99999 11111", email: "other@example.test", notes: "Secondary source", followUps: [{ id: "f2", description: "Meeting", updatedAt: "2026-11-02T05:00:00Z" }] },
  { id: "unrelated", name: "Other person", phone: "88888 00000" }
];
const explicitMerge = mergeMasterContactsById(explicitSource, "owner", "alias");
assert.equal(explicitMerge.keptId, "owner");
assert.equal(explicitMerge.removedId, "alias");
assert.deepEqual(explicitMerge.remap, { alias: "owner" });
assert.equal(explicitMerge.contacts.length, 2);
assert.equal(explicitMerge.contacts.find(item => item.id === "owner").name, "Preferred name");
assert.deepEqual(explicitMerge.contacts.find(item => item.id === "owner").followUps.map(item => item.id).sort(), ["f1","f2"]);
assert.throws(() => mergeMasterContactsById(explicitSource, "owner", "missing"), /must still exist/);

process.stdout.write("AXIVESTRA contact deduplication and reference-preservation tests passed.\n");
