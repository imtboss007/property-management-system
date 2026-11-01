const fs = require("node:fs");
const assert = require("node:assert/strict");
const read = path => fs.readFileSync(path, "utf8");
const app = read("src/App.tsx");
const contact = read("src/ContactPortfolioPanel.tsx");
const workbench = read("src/ModuleWorkbench.tsx");
const report = read("src/lib/axivestra-report.ts");
const pdf = read("src/lib/pdf-export.ts");
const repeatable = read("src/lib/axivestra-module-upgrades.tsx");
const mobile = read("src/lib/mobile-export.ts");
const register = read("src/FollowUpRegisterPanel.tsx");
const registerReport = read("src/lib/follow-up-register-report.ts");
const pkg = JSON.parse(read("package.json"));

for (const token of [
  "contactProfileId", "ContactPortfolioPanel", "Open Contact 360",
  "defaultContactId={propertyPrefill?.contactId", "downloadAxivestraPdf",
  "downloadRecordPdf", "onExportPdf={rows=>void downloadAxivestraPdf"
]) assert.ok(app.includes(token), "Missing App integration: " + token);

for (const token of [
  "All linked properties, deals and modules", "nextResponseDate", "nextResponseTime",
  "nextResponseType", "nextResponseDescription", "nextFollowUpDate", "nextFollowUpTime",
  "Save schedule", "Open full details", "Download full PDF", "onUpdateSchedule"
]) assert.ok(contact.includes(token), "Missing Contact 360 feature: " + token);

for (const token of [
  "Open full record", "Download complete module PDF", "onDownloadRecordPdf",
  "onExportPdf", "ax-record-detail-backdrop", "Calculated summaries"
]) assert.ok(workbench.includes(token), "Missing full-record/module export feature: " + token);

for (const token of [
  "buildAxivestraReportHtml", "nextResponseDate", "nextResponseTime",
  "nextFollowUpDate", "nextFollowUpTime", "axivestraRepeatableGroups",
  "buildModuleSummary", "field.key+\"Time\""
]) assert.ok(report.includes(token), "Missing complete PDF report data: " + token);

assert.ok(pdf.includes('from "jspdf"'), "PDF helper must use jsPDF vector rendering.");
assert.ok(pdf.includes("new jsPDF("), "PDF helper must create a real PDF document.");
assert.ok(pdf.includes('doc.output("arraybuffer")'), "PDF helper must validate the actual PDF byte stream.");
assert.ok(pdf.includes("saveBlobForUser(blob,filename)"), "PDF must use the common PC/Android delivery helper.");
assert.ok(!pdf.includes("html2canvas") && !pdf.includes("getImageData"), "PDF output must not rasterize pages through the old canvas capture path.");
assert.ok(mobile.includes("Capacitor.isNativePlatform()"), "PDF delivery must support Android native.");
assert.equal(pkg.dependencies["jspdf"], "^4.2.1");
assert.match(pkg.scripts.test, /axivestra-contact-portfolio\.test\.cjs/);

assert.ok(repeatable.includes('field.key + "Time"'), "Repeatable date fields need a paired time value.");

for (const token of [
  'active === "Contact 360"', 'name: "Contact 360"', 'SearchableGroupPicker',
  '__linkedWhatsAppGroupIds', 'onUpdateWhatsAppGroups', 'useDeferredValue',
  'slice(0,80)', 'groups={savedWhatsAppGroups}'
]) assert.ok(app.includes(token), "Missing standalone Contact 360 / group / fast-link feature: " + token);

for (const token of [
  "WhatsApp groups connected to this contact", "onUpdateWhatsAppGroups",
  "savedGroups", "__linkedWhatsAppGroupIds"
]) assert.ok(contact.includes(token), "Missing Contact 360 group linking: " + token);

assert.ok(pdf.includes("new DOMParser()"), "PDF helper must parse the supplied report document.");
assert.ok(pdf.includes("report has no visible record content"), "PDF helper must reject empty reports before generation.");
assert.ok(pdf.includes("The generated file is not a valid PDF document."), "PDF helper must verify its signature before delivery.");
assert.ok(pdf.includes("arrayBuffer.byteLength<1000"), "PDF helper must reject tiny/empty output.");
assert.ok(report.includes("Linked WhatsApp groups"), "Complete PDF must include linked group names.");
assert.ok(report.includes("Contact follow-up register"), "Linked record PDFs must include Contact 360 follow-up rows.");
assert.ok(report.includes("followUpRows") && report.includes("item.promisedTime") && report.includes("item.amount"), "Follow-up PDF must include people, dates, time and amounts.");


for (const token of [
  "Relationship timeline", "Log interaction", "onLogInteraction", "activityDraft",
  "Financial", "Document", "Approval", "Risk", "Schedule", "filteredTimeline",
  "timelineFilter", "relatedRecordId", "Save to timeline"
]) assert.ok(contact.includes(token), "Missing contact timeline capability: " + token);

for (const token of [
  'entity:"Interaction"', "activityType", "description", "relatedRecordId",
  "deferredSearch", "contact360Directory", "visibleContact360Directory"
]) assert.ok(app.includes(token), "Missing saved activity or indexed search capability: " + token);

for (const token of [
  "useDeferredValue(query)", "searchIndex", "const metrics=useMemo", "contactIndex"
]) assert.ok(workbench.includes(token), "Missing module performance optimization: " + token);


assert.ok(app.includes("previousById.get(id)"), "Audit snapshot should reuse unchanged record rows.");
assert.ok(app.includes("prior.source===record"), "Audit snapshot should skip deep serialization for unchanged rows.");
assert.ok(app.includes("source: record"), "Audit snapshot should track immutable source row identity.");
console.log("AXIVESTRA Contact 360 timeline, interactions, group linking, faster search and PDF export contracts passed.");

for (const token of [
  "type ContactFollowUp", "Contact follow-up register", "Add follow-up line",
  "Linked workstream", "Expected reach-back date", "Follow-up description",
  "Follow-up amount", "Primary", "onUpdateFollowUps", "saveFollowUp",
  "chooseFollowUpRecord", "isPrimary"
]) assert.ok(contact.includes(token), "Missing editable Contact 360 follow-up register: " + token);

for (const token of [
  "type ContactFollowUp", "followUps?: ContactFollowUp[]", "updateContactFollowUps",
  "syncPrimaryFollowUpsFromRecord", "updateContactRecordSchedule", "primaryByRecord"
]) assert.ok(app.includes(token), "Missing Contact 360 / linked module synchronization: " + token);

assert.ok(pdf.includes('from "jspdf"') && pdf.includes('doc.output("arraybuffer")'), "PDF path must use real vector PDF generation.");
console.log("AXIVESTRA editable multi-person Contact 360 follow-up register and bidirectional linked-record sync contracts passed.");

for (const token of [
  "Follow-up Register", "Module type / linked record", "Description / item", "Amount (INR)",
  "Expected reach-back date", "Expected reach-back time", "WhatsApp groups", "onUpdateFollowUps",
  "onOpenContact360", "onEditRecord", "onDownloadRecord", "onExportPdf", "setPrimary", "dirty:true"
]) assert.ok(register.includes(token), "Missing standalone follow-up register capability: " + token);

for (const token of [
  'name: "Follow-up Register"', "FollowUpRegisterPanel", "buildContactFollowUpRegisterHtml",
  "downloadFollowUpRegisterPdf", "onUpdateFollowUps={updateContactFollowUps}"
]) assert.ok(app.includes(token), "Missing standalone follow-up module integration: " + token);
assert.ok(app.indexOf('{ name: "Contact 360"') < app.indexOf('{ name: "Follow-up Register"'), "Follow-up Register must sit directly after Contact 360 in navigation.");
assert.ok(registerReport.includes("buildContactFollowUpRegisterHtml"), "Missing cross-contact PDF report builder.");
for (const token of ["Module type","Description","Amount (INR)","Will reach back","WhatsApp groups","item.promisedTime","item.isPrimary"])
  assert.ok(registerReport.includes(token), "Missing follow-up register PDF field: " + token);
console.log("AXIVESTRA standalone cross-contact follow-up register and PDF export contracts passed.");
