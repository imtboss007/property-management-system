"use strict";

const assert = require("node:assert/strict");
const {
  normalizeDigits,
  deduplicateWhatsAppContacts,
  deduplicateWhatsAppGroups
} = require("../electron/whatsapp-service.cjs");

const cases = [
  ["+91 (98765) 43210", "919876543210"],
  ["919876543210", "919876543210"],
  ["98765-43210", "9876543210"],
  ["No phone number", ""],
  ["+1 202-555-0109", "12025550109"],
  ["  0044 20 7946 0958  ", "00442079460958"]
];

for (const [input, expected] of cases) {
  assert.equal(normalizeDigits(input), expected, `normalizeDigits(${JSON.stringify(input)})`);
}

const duplicateContacts = deduplicateWhatsAppContacts([
  { id: "919876543210:1@s.whatsapp.net", jid: "919876543210:1@s.whatsapp.net", phone: "+91 98765 43210", name: "+919876543210", lastSyncedAt: "2026-10-01T00:00:00.000Z" },
  { id: "919876543210@s.whatsapp.net", jid: "919876543210@s.whatsapp.net", phone: "91-98765-43210", name: "Prabhakaran", whatsappName: "Prabhakaran", notify: "Prabhakaran", lastSyncedAt: "2026-10-02T00:00:00.000Z" },
  { id: "12025550109@s.whatsapp.net", jid: "12025550109@s.whatsapp.net", phone: "+1 202-555-0109", name: "Other contact" }
]);
assert.equal(duplicateContacts.length, 2, "same phone in different formats/device JIDs collapses to one contact");
assert.equal(duplicateContacts.find(contact => contact.phone.includes("98765"))?.name, "Prabhakaran", "the better WhatsApp contact name is retained");
assert.equal(duplicateContacts.find(contact => contact.phone.includes("98765"))?.notify, "Prabhakaran", "non-empty contact metadata is preserved");

const duplicateGroups = deduplicateWhatsAppGroups([
  { id: "120363000000000001@g.us", jid: "120363000000000001@g.us", name: "Family", size: 4 },
  { id: "120363000000000001@G.US", jid: "120363000000000001@G.US", name: "Family", description: "Family group", size: 8 },
  { id: "120363000000000002@g.us", jid: "120363000000000002@g.us", name: "Family", size: 12 }
]);
assert.equal(duplicateGroups.length, 2, "same group JID is deduplicated case-insensitively");
assert.equal(duplicateGroups.filter(group => group.name === "Family").length, 2, "different group JIDs with the same name remain separate");
assert.equal(duplicateGroups.find(group => group.jid === "120363000000000001@g.us")?.size, 8, "group metadata is merged without losing the newest participant count");
assert.equal(duplicateGroups.find(group => group.jid === "120363000000000001@g.us")?.description, "Family group", "group descriptions are preserved");

process.stdout.write(`WhatsApp contact normalisation and directory deduplication tests passed (${cases.length} phone cases plus 7 directory assertions).\n`);
