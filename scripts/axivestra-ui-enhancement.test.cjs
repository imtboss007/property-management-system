const fs = require("node:fs");
const assert = require("node:assert/strict");

const app = fs.readFileSync("src/App.tsx", "utf8");
const analytics = fs.readFileSync("src/PortfolioAnalytics.tsx", "utf8");
const histogram = fs.readFileSync("src/ThreeDHistogram.tsx", "utf8");
const vestra = fs.readFileSync("src/VestraShift.tsx", "utf8");
const intent = fs.readFileSync("src/IntelligenceHub.tsx", "utf8");
const canvas = fs.readFileSync("src/VestraIntentCanvas.tsx", "utf8");
const finance = fs.readFileSync("src/VestraFinance.tsx", "utf8");
const desk = fs.readFileSync("src/VestraSpatialDesk.tsx", "utf8");
const recordTracker = fs.readFileSync("src/RecordFollowUpTracker.tsx", "utf8");
const followUpRegister = fs.readFileSync("src/FollowUpRegisterPanel.tsx", "utf8");
const recordFollowUpLib = fs.readFileSync("src/lib/record-follow-up.ts", "utf8");
const contactMerge = fs.readFileSync("src/lib/contact-directory.mjs", "utf8");
const styles = fs.readFileSync("src/styles.css", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

assert.ok(app.includes("ax-modern-shell"), "The application shell must enable the refreshed design system.");
assert.ok(app.includes('className="ax-mobile-dock"'), "The mobile quick-navigation dock must be mounted.");
for (const label of ["Home", "Assets", "Contacts", "Tasks", "Menu"]) {
  assert.ok(app.includes("<span>" + label + "</span>"), "Missing mobile navigation destination: " + label);
}
assert.ok(analytics.includes('useState<"donut" | "bar" | "line" | "3d">("3d")'), "Portfolio analytics should open in 3D mode.");
assert.ok(analytics.includes("<ThreeDHistogram"), "Portfolio analytics must render the interactive 3D histogram.");
assert.ok(analytics.includes("secondaryValue: row.outflow"), "Cashflow 3D mode must show the outflow as a second series.");
assert.ok(analytics.includes("value: item.value"), "Portfolio histograms must use saved analytics values.");
for (const token of ["role=\"button\"", "onSelect", "secondaryValue", "aria-label", "Perspective view", "floor", "depthX", "rotateZ(${rotation}deg)", "setZoom", "setTilt", "ax-3d-histogram-controls"]) {
  assert.ok(histogram.includes(token), "Missing accessible / interactive 3D histogram capability: " + token);
}
for (const token of [
  ".ax-modern-shell .sidebar", ".ax-modern-shell .topbar", ".ax-modern-shell .institutional-banner",
  ".ax-modern-shell .ax-dashboard-kpi", ".ax-modern-shell .module-card", ".ax-mobile-dock",
  ".ax-3d-histogram-wrap", ".ax-3d-histogram-group", "@media (max-width: 720px)",
  "env(safe-area-inset-bottom", "@media (prefers-reduced-motion: reduce)"
]) {
  assert.ok(styles.includes(token), "Missing responsive / design system styling: " + token);
}

for (const token of [
  "AXIVESTRA immersive night-mode command centre",
  ".ax-modern-shell .main-panel",
  ".ax-modern-shell .institutional-banner",
  ".ax-modern-shell .module-card:hover",
  "perspective(650px) rotateX(11deg) rotateY(-13deg)",
  ".ax-modern-shell .ax-dashboard-kpi:nth-child(5)",
  ".ax-modern-shell .ax-mobile-dock button.active",
  "touch-action: manipulation",
  "@keyframes axIconFloat",
  "@media (prefers-reduced-motion: reduce)"
]) {
  assert.ok(styles.includes(token), "Missing immersive / 3D / touch-first UI behavior: " + token);
}

assert.ok(!pkg.dependencies["echarts-gl"] && !pkg.dependencies["three"], "The visual refresh must not add a heavy WebGL runtime dependency.");
assert.ok(pkg.scripts.test.includes("axivestra-ui-enhancement.test.cjs"), "The new UI checks must run in the main regression suite.");

for (const token of [
  'space==="timeline"', 'space==="connections"', 'space==="simulation"', 'space==="workflow"',
  'calculateMonthlyInterest({...selectedLoan.moduleData,__loanPrincipal:scenarioPrincipal||"0",__loanInterestRate:scenarioInput||"0"}',
  'window.localStorage.setItem(contextKey', 'vs-prism-emblem', 'onOpenRecord(event.recordId)'
]) assert.ok(vestra.includes(token), "Missing VESTRA SHIFT workspace feature: " + token);
for (const token of [
  'name: "Intelligence Hub", label: "VESTRA SHIFT"', 'onOpenRecord={recordId=>',
  'onOpenContact={contactId=>', 'ax-theme-light'
]) assert.ok(app.includes(token), "Missing VESTRA SHIFT activation in App: " + token);
for (const token of ["People: ", "onOpenRecord(entry.recordId)", "onOpenContact(entry.contactId)", "commitments.length"]) assert.ok(intent.includes(token), "Intent Canvas must expose source-linked loan owners and result navigation: " + token);

for (const token of [
  "COMMAND COMPOSER", "FAVOURITE COMMANDS", "runCommand", "saveCommand", "onOpenTask(result.taskId)", "onOpenTransaction(result.transactionId)", "RECENTLY OPENED", "commandInputRef", "person.?wise|contact report", "overdue\\s+payments?",
  "/\\b(loan|interest|lender|borrow)\\b/.test(query)", "commandResults"
]) assert.ok(canvas.includes(token), "Missing natural-language Command Composer feature: " + token);
for (const token of ["makeContextAnswer", "contextRecords", "contextContacts", "ax-copilot-context", "Current intent context"]) assert.ok(intent.includes(token), "Missing selected-record contextual companion: " + token);
for (const token of [
  "selectedRecordIds", "selectedContactIds", "pinnedIds", "compareFields",
  "draggable onDragStart", "setSavedCanvases", "vs-canvas-pins",
  "onOpenRecord(record.id)", "onOpenContact(contact.id)", "moduleNames.map"
]) assert.ok(canvas.includes(token), "Missing interactive Intent Canvas capability: " + token);
for (const token of [
  "ThreeDHistogram", "calculateMonthlyInterest", "outstandingPrincipal", "loanTransactions",
  "onOpenTransaction(item.id)", "recentMonths", "selectedMonth",
  "No supported outstanding figure saved", "TRACEABLE CALCULATION BREAKDOWN", "showPortfolioBreakdown", "vs-finance-fact-button"
]) assert.ok(finance.includes(token), "Missing source-traceable Financial Intelligence: " + token);
for (const token of [
  "linkedFinancials", "linkedDocuments", "linkedRisks", "linkedApprovals", "duplicateReviewPairs",
  "Same name, different or missing phone", "Same phone, different name",
  "auditEvents.forEach", "timelineKind", "dateFrom", "dateTo",
  "scenarioFullSchedule", "scenarioMode===\"compound\"", "DEADLINE WHAT-IF", "deadlinesBefore", "deadlinesAfter", "missionLinks",
  "onOpenTask(taskId)"
]) assert.ok(vestra.includes(token), "Missing relationship / temporal / simulation / mission feature: " + token);
for (const token of ["description?: string", "amount?: string", "priority?: string", "status?: string", "nextAction?: string", "notes?: string", "Assigned At", "Next Action"]) assert.ok(recordFollowUpLib.includes(token), "Missing record-level follow-up data field / export: " + token);
for (const token of ['aria-label="Follow-up description"', 'aria-label="Follow-up amount"', 'aria-label="Follow-up priority"', 'aria-label="Follow-up status"', 'aria-label="Follow-up next action"', 'aria-label="Follow-up notes"']) assert.ok(recordTracker.includes(token), "Missing editable record follow-up control: " + token);
for (const token of ["mergeContactsWithAuthorization", "MERGE CONTACT RECORDS", "onMergeContacts={mergeContactsWithAuthorization}"]) assert.ok(app.includes(token), "Missing user-authorized duplicate merge: " + token);
for (const token of ["mergeMasterContactsById", 'new Set(["roles", "whatsappAliases", "followUps"])', "merged.followUps ="]) assert.ok(contactMerge.includes(token), "Missing safe merge preservation: " + token);
for (const token of ["mergeContactsWithAuthorization", "MERGE CONTACT RECORDS", "onMergeContacts={mergeContactsWithAuthorization}"]) assert.ok(app.includes(token), "Missing user-authorized contact merge safeguard: " + token);
for (const token of ['space==="finance"', 'temporalView==="calendar"', "calendarCells", "onMergeContacts", "scenarioFullSchedule", "missionLinks"]) assert.ok(vestra.includes(token), "Missing VESTRA temporal / finance / workflow capability: " + token);
for (const token of ["vs-calendar-grid", "vs-duplicate-merge-action", "--vs-color-porcelain"]) assert.ok(styles.includes(token), "Missing VESTRA visual system surface: " + token);
for (const token of ["SPATIAL WORKSPACE", "Drag to reposition", "onDragStart", "onDrop", "expanded", "minimized", "savedLayouts", "setStates({...item.states})", "ThreeDHistogram", "monthlyData"]) assert.ok(desk.includes(token), "Missing spatial dashboard manager capability: " + token);
for (const token of ["vs-startup-intro", "Skip introduction", "axivestra.vestraIntroSeen", "1600"]) assert.ok(app.includes(token), "Missing skippable first-launch VESTRA experience: " + token);
for (const token of [".vs-spatial-desk", ".vs-desk-grid", ".vs-desk-panel", "resize:both", ".vs-startup-intro", ".vs-startup-prism", ".vs-prism-emblem:active", "--vs-prism-rotate-y"]) assert.ok(styles.includes(token), "Missing spatial / startup / prismatic interaction styling: " + token);
for (const token of ["Assigned date", "Follow-up date", "Follow-up priority", "Follow-up next action", "item.createdAt", "item.nextAction"]) assert.ok(followUpRegister.includes(token), "Missing person-wise follow-up registry field: " + token);
console.log("AXIVESTRA VESTRA SHIFT adaptive spaces and theme contracts passed.");
