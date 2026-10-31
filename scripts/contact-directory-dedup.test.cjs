"use strict";

const assert = require("node:assert/strict");
const {
  canonicalContactPhone,
  deduplicateMasterContacts,
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

process.stdout.write("AXIVESTRA contact deduplication and reference-preservation tests passed.\n");
