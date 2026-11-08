"use strict";
const assert = require("node:assert/strict");
const { buildRelationshipIntelligence } = require("../src/lib/relationship-intelligence.mjs");

const result = buildRelationshipIntelligence({
  contacts: [
    { id: "person-1", name: "Alex Morgan", role: "Investor", roles: ["Advisor"] },
    { id: "person-2", name: "Alex Morgan", role: "Lender" },
    { id: "person-3", name: "No links" }
  ],
  properties: [
    {
      id: "deal-1", title: "Commercial site", module: "Commercial Land",
      primaryContactId: "person-1",
      moduleData: {
        __contact_seller: "person-2",
        __linkedContactIds: "person-1,person-3",
        __followUpContactIds: "person-2"
      }
    },
    {
      id: "deal-2", title: "Loan file", module: "Property Loans",
      moduleData: { __contact_lender: "missing-person" }
    }
  ],
  tasks: [{ id: "task-1", title: "Due diligence call", contactId: "person-1", followUpContactIds: ["person-2"] }],
  financials: [{ id: "txn-1", reference: "Receipt 001", contactId: "person-2" }],
  risks: [{ id: "risk-1", title: "Title check", contactId: "person-1" }],
  approvals: [{ id: "approval-1", title: "Purchase approval", contactId: "person-2" }],
  documents: [{ id: "doc-1", name: "Sale deed", contactId: "person-1" }]
});

const person1 = result.contacts.find(item => item.id === "person-1");
const person2 = result.contacts.find(item => item.id === "person-2");
const person3 = result.contacts.find(item => item.id === "person-3");
assert.equal(person1.recordCount, 4, "primary/participant, task, risk and document links resolve by ID");
assert.equal(person2.recordCount, 4, "role, follow-up, task, finance and approval references resolve by ID, grouped by source record");
assert.deepEqual(person1.workspaces, ["Commercial Land"]);
assert.equal(person3.recordCount, 1, "explicit participant ID is counted");
assert.equal(result.unlinkedContacts, 0);
assert.equal(result.unresolvedReferences, 1, "unknown contact IDs are surfaced, not silently discarded");
assert.ok(person2.records.some(item => item.relations.includes("seller")));
assert.equal(person2.records.find(item => item.relations.includes("seller")).recordId, "deal-1", "relationship results retain the source record ID for navigation and traceability");
assert.ok(person1.records.some(item => item.relations.includes("Primary contact")));
assert.equal(result.contacts.filter(item => item.name === "Alex Morgan").length, 2,
  "same-name people remain separate; display-name matching is not a relationship");
const noLinks = buildRelationshipIntelligence({
  contacts: [{ id: "known", name: "Same name" }],
  properties: [{ id: "record", title: "Same name", contact: "Same name", module: "Property Sale" }]
});
assert.equal(noLinks.contacts[0].recordCount, 0, "matching display text without a saved contact ID creates no relationship");

process.stdout.write("AXIVESTRA ID-based relationship intelligence tests passed.\n");
