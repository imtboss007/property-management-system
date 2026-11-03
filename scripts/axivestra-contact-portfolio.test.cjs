const fs = require("node:fs");
const assert = require("node:assert/strict");
const read = path => fs.readFileSync(path, "utf8");
const app = read("src/App.tsx");
const contactPicker = read("src/SearchableContactPicker.tsx");
const contact = read("src/ContactPortfolioPanel.tsx");
const workbench = read("src/ModuleWorkbench.tsx");
const report = read("src/lib/axivestra-report.ts");
const pdf = read("src/lib/pdf-export.ts");
const repeatable = read("src/lib/axivestra-module-upgrades.tsx");
const mobile = read("src/lib/mobile-export.ts");
const register = read("src/FollowUpRegisterPanel.tsx");
const styles = read("src/styles.css");
const registerReport = read("src/lib/follow-up-register-report.ts");
const contactDirectory = read("src/lib/contact-directory.mjs");
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
  'slice(0,40)', 'groups={savedWhatsAppGroups}'
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
  "Follow-up Register", "Linked module record", "Description", "Final Amount (INR)",
  "Expected reach-back date", "Expected reach-back time", "WhatsApp groups", "onUpdateFollowUps",
  "onOpenContact360", "onEditRecord", "onDownloadRecord", "onExportPdf", "setPrimary", "dirty:true"
]) assert.ok(register.includes(token), "Missing standalone follow-up register capability: " + token);

for (const token of [
  'name: "Follow-up Register"', "FollowUpRegisterPanel", "buildContactFollowUpRegisterHtml",
  "downloadFollowUpRegisterPdf", "onUpdateFollowUps={updateContactFollowUps}"
]) assert.ok(app.includes(token), "Missing standalone follow-up module integration: " + token);
assert.ok(app.indexOf('{ name: "Contact 360"') < app.indexOf('{ name: "Follow-up Register"'), "Follow-up Register must sit directly after Contact 360 in navigation.");
assert.ok(registerReport.includes("buildContactFollowUpRegisterHtml"), "Missing cross-contact PDF report builder.");
for (const token of ["Module / transaction","Description","Final amount / principal","Monthly loan interest","Will reach back","WhatsApp groups","item.promisedTime","item.isPrimary"])
  assert.ok(registerReport.includes(token), "Missing follow-up register PDF field: " + token);
console.log("AXIVESTRA standalone cross-contact follow-up register and PDF export contracts passed.");


for (const token of [
  "followUpContactId?: string", '"Follow-up Person *"', "Choose a saved Follow-up Person",
  "syncModuleFollowUpFromRecord", "moduleFollowUpRowId", "module-follow-up:",
  "autoGenerated:true", "removedAutoRecords", "migratedProperties",
  "follow_up_contact_id: record.followUpContactId || null"
]) assert.ok(app.includes(token), "Missing required module-level follow-up assignment: " + token);

for (const token of [
  'type="search"', "const contactsById = useMemo", "setQuery(event.target.value)",
  'role="listbox"', "Type to search contacts for "
]) assert.ok(contactPicker.includes(token), "Shared contact selector must filter live as the user types: " + token);
assert.ok(!contactPicker.includes('<select className="searchable-contact-picker__select"'), "Single-contact selector must not fall back to a native dropdown.");

for (const token of [
  "FollowUpRegisterPanel", "matchingAddContacts",
  "addContactSearch", "ax-followup-register__add-contact-search",
  "onMouseDown={event=>event.preventDefault()}", "Created from module assignment",
  "Boolean(item.autoGenerated)"
]) assert.ok(register.includes(token), "Missing searchable, automatically linked Follow-up Register behavior: " + token);

for (const token of [
  "followUpContactId?: string", "Follow-up person", "followUpContactId",
  "ax-record-followup-owner", "Follow-up responsibility"
]) assert.ok(workbench.includes(token), "Missing Follow-up Person display in each module: " + token);

assert.ok(contact.includes("autoGenerated?: boolean"), "Contact 360 must identify automatic module assignments.");
assert.ok(contact.includes("Assigned from module record"), "Contact 360 must show the generated assignment source.");
assert.ok(contact.includes("disabled={Boolean(row.autoGenerated)} value={row.linkedRecordId}"), "Contact 360 must preserve generated row identity.");

assert.ok(contactDirectory.includes("followUpContactId: property.followUpContactId"), "Contact merging must preserve module follow-up owner IDs.");
assert.ok(report.includes("record.followUpContactId||\"\""), "Record PDFs must resolve the assigned follow-up person.");
assert.ok(registerReport.includes("record.followUpContactId||\"\""), "Register PDF must resolve the assigned follow-up person.");
console.log("AXIVESTRA per-module Follow-up Person assignment, automatic register creation, live contact typeahead and stable linkage contracts passed.");

for (const token of [
  "People-wise follow-up overview", "visibleByContact.size", "Array.from(visibleByContact.entries())",
  "contactRows.map", "Linked module record", "Description", "Final Amount (INR)",
  "Expected reach-back date", "Expected reach-back time", "What the person said",
  "roleFilters", "groupFilters",
  "ax-followup-register__filter-dropdown", "WhatsApp groups",
  "Each person appears once", "linked module record(s)"
]) assert.ok(register.includes(token), "Missing person-grouped follow-up overview/filter behavior: " + token);
assert.ok(!register.includes("visibleRows.map((row,index)"), "Do not duplicate the same module follow-up as a flat summary and grouped row.");
console.log("AXIVESTRA person-grouped follow-up overview, editable per-record fields, multi-role filtering and linked group filters passed.");

for (const token of [
  "Edit any field below", "onBlur={()=>save(row.key)}",
  'aria-label="Follow-up description"', 'aria-label="Final amount"',
  "Expected reach-back date", "Expected reach-back time",
  "What the person said / terms", "Follow-up channel"
]) assert.ok(register.includes(token), "Missing editable per-record follow-up row: " + token);
for (const token of [
  "nextFollowUpDate:primary.promisedDate", "nextFollowUpTime:primary.promisedTime",
  "__followUpStatus:primary.status", "__followUpNotes:primary.notes",
  "Follow-up saved and synchronized to Contact 360 and the linked module record.",
  "status:record.moduleData?.__followUpStatus", "record.nextFollowUpDate||record.nextResponseDate"
]) assert.ok(app.includes(token), "Missing bidirectional follow-up/module synchronization: " + token);
assert.ok(workbench.includes("Live follow-up snapshot") && workbench.includes("__followUpUpdatedAt"), "Module record detail must show the live synchronized follow-up snapshot.");
console.log("AXIVESTRA editable overview auto-save, module/Contact360 bidirectional schedule and status synchronization contracts passed.");

for (const token of [
  "__followUpNotes:data.nextAction", "__followUpUpdatedAt:followUpStamp",
  "__followUpUpdatedAt:stamp", "status:record.moduleData?.__followUpStatus",
  '"status","notes","isPrimary","autoGenerated","updatedAt"'
]) assert.ok(app.includes(token), "Module-originated follow-up edits and status/timestamp persistence must remain synchronized: " + token);
console.log("AXIVESTRA module-originated follow-up updates, notes and last-updated metadata contracts passed.");

for (const token of [
  "transactionFilter", "loanDirectionFilter", "monthlyInterestReceivable",
  "monthlyInterestPayable", "calculateMonthlyInterest", "Final Amount (INR)",
  "Loan direction", "ax-followup-register__interest-metric", "__transactionType",
  "roleFilters.some", "groupFilters.some"
]) assert.ok(register.includes(token), "Missing Follow-up Register transaction/loan view or filters: " + token);
for (const token of [
  "__loanPrincipal", "__loanInterestRate", "__loanInterestMethod",
  "__loanMonthlyInterest", "__loanRepaymentMethod", "__saleFinalAmount",
  "__settlementAgreedAmount", "__sharingModel", "__sharingFirstPercent",
  "__giftPercentage", "__transactionType"
]) assert.ok(app.includes(token), "Missing persistent shared deal field: " + token);
console.log("AXIVESTRA Follow-up Register monthly loan interest totals, transaction search and deal amount linkage passed.");

for (const token of [
  "ax-followup-register__board", "ax-followup-register__grid-wrap",
  "ax-followup-register__grid", "ax-followup-register__grid-control",
  "ax-followup-register__row-more", "ax-followup-register__grid-actions",
  "Final Amount (INR)", "Expected reach-back date",
  "Expected reach-back time", "Follow-up description", "onAddModule",
  "Add module record", "props.onAddModule(contactId)"
]) assert.ok(register.includes(token), "Missing column-based Follow-up Register / direct module creation: " + token);
assert.ok(app.includes('onAddModule={contactId=>{go("All Properties");openPropertyForm(null,{contactId});}}'),
  "Adding a module from a person column must prefill that follow-up person.");
console.log("AXIVESTRA person-grouped editable follow-up grid and direct module creation contracts passed.");

assert.ok(styles.includes(".ax-followup-register__board{display:grid;grid-template-columns:minmax(0,1fr)"),
  "Each person's follow-up group must occupy its own full-width row.");
assert.ok(styles.includes(".ax-followup-register__grid-wrap{width:100%;overflow-x:auto"),
  "Each person's editable follow-up fields must appear in a single horizontally structured grid.");
assert.ok(styles.includes(".ax-followup-register__grid{width:100%;min-width:1190px"),
  "Module, Description, Date, Time, Final Amount and Status must remain distinct table columns.");
for (const heading of ["Module","Description","Date","Time","Final Amount (INR)","Status"])
  assert.ok(register.includes(">"+heading+"</th>"), "Missing directly editable follow-up column: " + heading);
console.log("AXIVESTRA person-grouped six-column editable follow-up grid layout contracts passed.");


