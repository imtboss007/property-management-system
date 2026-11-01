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
console.log("AXIVESTRA Contact 360, date-time scheduling and full PDF export contracts passed.");
