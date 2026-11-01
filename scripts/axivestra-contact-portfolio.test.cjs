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

assert.ok(pdf.includes('from "html2pdf.js"'), "PDF helper must use a real PDF renderer.");
assert.ok(pdf.includes("worker.outputPdf(\"blob\")"), "PDF helper must generate a PDF Blob.");
assert.ok(pdf.includes("saveBlobForUser(blob, filename)"), "PDF must use the common PC/Android delivery helper.");
assert.ok(mobile.includes("Capacitor.isNativePlatform()"), "PDF delivery must support Android native.");
assert.equal(pkg.dependencies["html2pdf.js"], "^0.10.3");
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
assert.ok(pdf.includes('clonedRoot.style.cssText'), "PDF clone must be moved into the capture viewport.");
assert.ok(pdf.includes("empty or invalid PDF file"), "PDF helper must reject blank or invalid PDFs.");
assert.ok(report.includes("Linked WhatsApp groups"), "Complete PDF must include linked group names.");


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
