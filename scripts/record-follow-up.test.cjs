const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const filename = path.join(__dirname, "..", "src", "lib", "record-follow-up.ts");
const source = fs.readFileSync(filename, "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const compiled = { exports: {} };
vm.runInNewContext(code, { module: compiled, exports: compiled.exports, require }, { filename });
const { upsertRecordFollowUp, removeRecordFollowUp, buildRecordFollowUpCsv } = compiled.exports;

const first = {
  id: "follow-1", followPersonId: "contact-1", followPersonName: "Anita",
  followDate: "2026-11-02", followTime: "10:15", remarks: "Called, asked for title copy",
  nextFollowUpDate: "2026-11-04", nextFollowUpTime: "11:30",
  description: "Collect title copy", amount: "125000", priority: "High", status: "Open", nextAction: "Request digital copy", notes: "Client asked to email the copy",
  createdAt: "2026-11-02T04:45:00.000Z", updatedAt: "2026-11-02T04:45:00.000Z"
};
const second = {
  ...first, id: "follow-2", followPersonId: "contact-2", followPersonName: "Bharath",
  followDate: "2026-11-02", followTime: "12:00", remarks: "Meeting confirmed, bring originals",
  nextFollowUpDate: "2026-11-05", nextFollowUpTime: "15:00"
};
let rows = upsertRecordFollowUp([], first);
rows = upsertRecordFollowUp(rows, second);
assert.equal(rows.length, 2, "one record must retain multiple follow-up entries");
const updated = { ...second, remarks: 'Updated, with "quoted" details' };
rows = upsertRecordFollowUp(rows, updated);
assert.equal(rows.length, 2, "editing one entry must not create a duplicate");
assert.equal(rows.find(row => row.id === "follow-1").remarks, first.remarks, "editing one entry must not replace its sibling");
assert.equal(rows.find(row => row.id === "follow-2").remarks, updated.remarks);
rows = removeRecordFollowUp(rows, "follow-1");
assert.equal(rows.length, 1, "deleting one entry must leave the other follow-up");
assert.equal(rows[0].id, "follow-2");
assert.throws(() => upsertRecordFollowUp([], { ...first, id: "" }), /ID is required/);

const csv = buildRecordFollowUpCsv([{
  id: "property-1", title: 'Plot 12, "North"', module: "Property Sale", followUpEntries: [updated]
}], [
  { id: "contact-1", name: "Anita" }, { id: "contact-2", name: "Bharath" }
]);
assert.ok(csv.startsWith("\uFEFF"), "CSV must include a UTF-8 BOM for Excel");
assert.ok(csv.includes('"Plot 12, ""North"""'), "CSV must quote commas and escape embedded quotes");
assert.ok(csv.includes('"Updated, with ""quoted"" details"'), "remarks must remain intact in CSV");
assert.ok(csv.includes("Bharath"), "follow person must resolve through the linked contact ID");
assert.ok(csv.includes("Next Follow-up Date"), "CSV must include the next follow-up columns");
assert.ok(csv.includes("Priority") && csv.includes("High"), "CSV must preserve follow-up priority");
assert.ok(csv.includes("125000") && csv.includes("Request digital copy"), "CSV must preserve amount and next action");
console.log("Record follow-up history, contact linking and CSV export tests passed.");
