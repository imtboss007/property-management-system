const fs = require("node:fs");
const assert = require("node:assert/strict");

const app = fs.readFileSync("src/App.tsx", "utf8");
const desktopService = fs.readFileSync("electron/whatsapp-service.cjs", "utf8");
const windowsWorkflow = fs.readFileSync(".github/workflows/main.yml", "utf8");
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
assert.ok(app.includes('useState<Section>("Overview")'), "Preserve the original Overview as the familiar startup home.");
assert.ok(app.includes('onClick={() => go("Intelligence Hub")}'), "Expose VESTRA directly in the mobile dock without replacing existing navigation.");
assert.ok(app.includes('className="ax-mobile-dock"'), "The mobile quick-navigation dock must be mounted.");
assert.ok(styles.includes("grid-template-columns: repeat(6, minmax(0, 1fr))"), "The Motion dock must fit the added VESTRA shortcut.");
for (const label of ["Home", "Assets", "Contacts", "Tasks", "VESTRA", "Menu"]) {
  assert.ok(app.includes("<span>" + label + "</span>"), "Missing mobile navigation destination: " + label);
}
assert.ok(analytics.includes('useState<"donut" | "bar" | "line" | "3d">("3d")'), "Portfolio analytics should open in 3D mode.");
assert.ok(analytics.includes("<ThreeDHistogram"), "Portfolio analytics must render the interactive 3D histogram.");
assert.ok(analytics.includes("secondaryValue: row.outflow"), "Cashflow 3D mode must show the outflow as a second series.");
assert.ok(analytics.includes("value: item.value"), "Portfolio histograms must use saved analytics values.");
for (const token of ["role=\"button\"", "onSelect", "secondaryValue", "aria-label", "Perspective view", "floor", "depthX", "rotateZ(${r}deg)", "setZoom", "setTilt", "ax-3d-histogram-controls"]) {
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
  "no supported outstanding figure saved", "TRACEABLE CALCULATION BREAKDOWN", "showPortfolioBreakdown", "vs-finance-fact-button"
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
for (const token of [".vs-spatial-desk", ".vs-desk-grid", ".vs-desk-panel", ".vs-desk-resize", "touch-action:none", "resize:none", ".vs-startup-intro", ".vs-startup-prism", ".vs-prism-emblem:active", "--vs-prism-rotate-y"]) assert.ok(styles.includes(token), "Missing spatial / startup / prismatic interaction styling: " + token);
for (const token of ["type PanelSize=", "type PanelGesture=", "normalizeSizes", "const [sizes,setSizes]", "const beginGesture=", "const moveGesture=", "const endGesture=", "resizeWithKeyboard", "sizes:{...sizes}", "setSizes(normalizeSizes(item.sizes))", "className=\"vs-desk-resize\""]) assert.ok(desk.includes(token), "Missing saved / accessible VESTRA panel resizing capability: " + token);
for (const token of ["Highest amount", "Lowest amount", "amountSort", "parseDealNumber(b.item.amount)"]) assert.ok(followUpRegister.includes(token), "Missing amount-wise follow-up registry ordering: " + token);
for (const token of ["Assigned date", "Follow-up date", "Follow-up priority", "Follow-up next action", "item.createdAt", "item.nextAction"]) assert.ok(followUpRegister.includes(token), "Missing person-wise follow-up registry field: " + token);
console.log("AXIVESTRA VESTRA SHIFT adaptive spaces and theme contracts passed.");

assert.ok(vestra.includes('className="vs-atelier-ai-launch"'), "Atelier must have a real floating command and AI entry point.");
assert.ok(vestra.includes("atelierCopilotOpen&&<div className=\"vs-atelier-ai-backdrop\""), "Atelier must open its contextual command/assistant surface.");
assert.ok(vestra.includes("<VestraIntentCanvas properties={properties}"), "Atelier assistant must reuse the real-record Intent Canvas, not a mock chat.");
for (const token of [".vs-atelier-ai-launch",".vs-atelier-ai-backdrop",".vs-atelier-ai-panel","@media(max-width:760px)"]) assert.ok(styles.includes(token), "Missing responsive Atelier assistant surface: "+token);

assert.ok(app.includes("workspacePreferencesReady"), "VESTRA preferences must wait for the initial device/company sync before hydrating shared UI state.");
const supabaseSync = fs.readFileSync("src/lib/supabase.ts", "utf8");
assert.ok(supabaseSync.includes('recordType: "workspace_preference"'), "Shared company records must include the VESTRA preference collection.");
assert.ok(supabaseSync.includes('String(payload.scope || "") !== company.id + ":" + userId'), "Company initialization must not hydrate another member's VESTRA preferences.");
assert.ok(vestra.includes("workspacePreferencesReady:boolean"), "VESTRA SHIFT must gate preference writes until its first sync finishes.");
assert.ok(vestra.includes('hydratedPreferenceKeysRef.current.delete("views")'), "Saved VESTRA views must hydrate before local defaults are written back.");
assert.ok(desk.includes("hydratedPreferenceRef.current=false"), "Atelier layouts must not overwrite a remote layout during initial hydration.");
assert.ok(canvas.includes('hydratedPreferenceKeysRef.current.delete("canvas")'), "Motion saved canvases must hydrate before local defaults are written back.");
assert.ok(desktopService.includes('"workspacePreferences"'), "Windows PC companion must accept the new shared preference collection.");

assert.ok(vestra.includes('workspacePreferencesReady:boolean'), "Focus must receive cross-device preference readiness through VESTRA.");
const focus = fs.readFileSync("src/VestraFocusMode.tsx","utf8");
assert.ok(focus.includes('onSaveWorkspacePreference("vestraFocus.selection"'), "Focus context must persist across PC and mobile.");
assert.ok(focus.includes('hydratedPreferenceRef.current=false'), "Focus context must hydrate before writing local defaults.");

assert.ok(app.includes("cloudPreviousScopeRef=useRef"), "Cloud deletion tracking must be isolated by active company/member.");
assert.ok(app.includes("cloudPreviousScopeRef.current!==activeCloudScope"), "Switching company or member must reset prior deletion IDs before sync.");

assert.ok(windowsWorkflow.includes("Smoke test the packaged Windows renderer"), "Windows packaging must launch the actual packaged app and verify visible renderer content.");
assert.ok(windowsWorkflow.includes("npx electron-builder --win --dir --x64 --publish never"), "Windows renderer smoke check must run against the unpacked production package.");

assert.ok(vestra.includes('onSaveWorkspacePreference("displayDensity"'), "VESTRA must expose a working compact/comfortable density preference.");
assert.ok(vestra.includes('onSaveWorkspacePreference("motionMode"'), "VESTRA must expose a working motion intensity preference.");
assert.ok(vestra.includes('data-density={displayDensity} data-motion={motionMode}'), "Personalisation settings must affect the rendered workspace.");
for (const token of [".vs-personalization-panel",".vs-personalization-controls",".vs-shift[data-density=\"compact\"]",".vs-shift[data-motion=\"reduced\"]"]) assert.ok(styles.includes(token), "Missing visual personalisation style: "+token);


const motionSyncBlock = app.slice(app.indexOf("if (alreadyCurrent)"), app.indexOf("if (alreadyCurrent)") + 900);
assert.ok(motionSyncBlock.includes("setSyncStatus(current => current.startsWith(stableStatus) ? current : stableStatus)"), "Unchanged 5-second device polls must not trigger full App re-renders.");
assert.ok(!motionSyncBlock.includes('"Connected · up to date " + time'), "Unchanged device polls must not update the displayed timestamp every five seconds.");
for (const token of ["data-ax-motion={vestraWorkspacePreferences.motionMode", "data-ax-motion=\"balanced\"", "vsModuleFacet", "vsPrismOrbit 17s linear infinite", "content-visibility:auto", "backdrop-filter:none", "translate:0 -2px 3px"]) assert.ok(app.includes(token) || styles.includes(token), "Missing adaptive motion/performance control: " + token);
for (const token of ["onChartPointerDown", "onChartPointerMove", "onChartPointerEnd", "Drag the chart to rotate", "useMemo(()=>items.slice(0, 9)", "useId().replace", "export default memo(ThreeDHistogram)"]) assert.ok(histogram.includes(token), "Missing lightweight, direct-manipulation 3D chart feature: " + token);
assert.ok(histogram.includes("const chartTransform=(r:number,t:number,z:number)=>"), "Chart buttons and pointer dragging must share one stable perspective transform.");
for (const token of ["vsLiquidEnter", "translate3d(0,7px,0)", "data-ax-motion=\"balanced\"", "data-ax-motion=\"expressive\"", "data-ax-motion=\"reduced\"", "prefers-reduced-motion:reduce"]) assert.ok(styles.includes(token), "Missing motion-performance mode: " + token);

assert.ok(styles.includes("@keyframes vsFacetFold"), "Expressive mode must fold the original multi-facet prismatic identity in 3D.");
assert.ok(styles.includes('.ax-modern-shell[data-ax-motion="expressive"] .vs-prism-emblem i:nth-child(5)'), "Expressive mode must stagger the five prism facets rather than animate them in lockstep.");
assert.ok(styles.includes(".ax-3d-histogram:active{cursor:grabbing}"), "Direct chart rotation must expose a tactile drag state.");

assert.ok(vestra.includes('useState<"network"|"cards">("network")'), "Relationships must offer an interactive network map as well as detailed cards.");
assert.ok(vestra.includes('aria-label="Interactive person and record relationship map"'), "The network view must expose an accessible, described map.");
assert.ok(vestra.includes('connections.slice(0,7).map'), "Relationship nodes must be derived from saved linked contact records, not fabricated graph data.");
assert.ok(vestra.includes('onOpenRecord(record.id)'), "Selecting a relationship record node must open its exact source record.");
assert.ok(vestra.includes('onOpenContact(item.contact.id)'), "Selecting a relationship person node must open its saved Contact 360.");
assert.ok(vestra.includes('event.key==="Enter"||event.key===" "'), "Relationship nodes must support keyboard activation.");
assert.ok(vestra.includes('event.key.toLowerCase()==="k"'), "Ctrl/Cmd+K must open the global Command + AI workspace.");
assert.ok(vestra.includes('setSpace(SPACES[Number(event.key)-1].id)'), "Alt/Meta+1–7 workspace shortcuts must navigate the seven VESTRA spaces.");
assert.ok(vestra.includes('event.key==="Escape"&&atelierCopilotOpen'), "Escape must close the Command + AI surface.");
for (const token of [".vs-relationship-view-toggle", ".vs-relationship-network__edge", ".vs-relationship-network__person", ".vs-relationship-network__record", "@keyframes vsRelationshipTrace", "@media(prefers-reduced-motion:reduce)"]) {
  assert.ok(styles.includes(token), "Missing relationship-map visual / reduced-motion behavior: " + token);
}

for (const token of ["item.linkedTasks.length", "item.linkedFinancials.length", "item.linkedDocuments.length", "item.linkedRisks.length", "item.linkedApprovals.length", "item.linkedHistory.length", "item.followUps.length"]) {
  assert.ok(vestra.includes(token), "Relationship network must expose actual linked operational activity: " + token);
}
assert.ok(vestra.includes("vs-relationship-network__activity"), "The relationship map must render linked task, transaction, document, risk and history activity nodes.");
assert.ok(styles.includes(".vs-relationship-network__activity rect"), "Linked activity nodes must have a distinct visual identity.");

const magneticHandler = vestra.slice(vestra.indexOf("const handleMagneticPointerMove"), vestra.indexOf("const resetMagneticPointer"));
assert.ok(magneticHandler.includes('event.pointerType!=="mouse"'), "Magnetic interactions must stay off coarse touch pointers.");
assert.ok(magneticHandler.includes('.closest<HTMLElement>("[data-vs-magnetic=\'true\']")'), "Magnetic movement must be delegated to explicitly marked controls.");
assert.ok(magneticHandler.includes('target.style.setProperty("--vs-magnetic-x"'), "Magnetic movement must update the active control directly.");
assert.ok(!magneticHandler.includes("setState("), "Pointer movement must not trigger React re-renders on every frame.");
assert.ok(vestra.includes('onPointerMove={handleMagneticPointerMove}'), "The VESTRA workspace must activate its pointer interaction engine.");
for (const token of ['.vs-shift [data-vs-magnetic="true"]', '.vs-shift button:active{translate:', '@media(hover:none),(pointer:coarse)', '@media(prefers-reduced-motion:reduce)']) {
  assert.ok(styles.includes(token), "Missing adaptive magnetic / tactile interaction styling: " + token);
}

const dragFrame = desk.slice(desk.indexOf("const moveGesture"), desk.indexOf("const endGesture"));
const dragCommit = desk.slice(desk.indexOf("const endGesture"), desk.indexOf("const resizeWithKeyboard"));
assert.ok(desk.includes("currentX:number;currentY:number;currentWidth:number;currentHeight:number"), "Panel gesture state must retain the latest pointer geometry outside React state.");
assert.ok(dragFrame.includes('event.currentTarget.closest<HTMLElement>(".vs-desk-panel")'), "Panel drag should directly target the active panel DOM element.");
assert.ok(dragFrame.includes("panel.style.left=") && dragFrame.includes("panel.style.top="), "Panel movement must update position directly during pointer movement.");
assert.ok(dragFrame.includes("panel.style.width=") && dragFrame.includes("panel.style.height="), "Panel resizing must update dimensions directly during pointer movement.");
assert.ok(!dragFrame.includes("setPositions(") && !dragFrame.includes("setSizes("), "Per-frame panel pointer movement must not trigger React state updates.");
assert.ok(dragCommit.includes("setPositions(") && dragCommit.includes("setSizes("), "The final panel geometry must be committed to saved state on pointer release.");
assert.ok(styles.includes(".vs-desk-panel.is-gesturing") && styles.includes("cubic-bezier(.18,1,.32,1)"), "Spatial panels must settle with a spring-like release response.");

for (const token of ["workspaceAlerts=useMemo<WorkspaceAlert[]>", "notificationPreferences.tasks", "notificationPreferences.followUps", "notificationPreferences.deadlines", "notificationPreferences.risks", "notificationPreferences.approvals", "tasks.forEach", "contacts.forEach", "riskRecords.forEach", "approvalRequests.forEach", "overdueWorkspaceAlerts", "setNotificationPreference"]) {
  assert.ok(vestra.includes(token), "Missing saved-data alert intelligence capability: " + token);
}
assert.ok(vestra.includes('aria-label="VESTRA in-app notification centre"'), "VESTRA must expose its operational alert centre accessibly.");
assert.ok(vestra.includes("Background or operating-system notifications still require a separately deployed scheduler"), "In-app alerts must not be misrepresented as background push notifications.");
for (const token of [".vs-alert-center", ".vs-alert-item.is-urgent", ".vs-alert-preferences", "@media(max-width:600px)", '.vs-shift[data-theme="light"] .vs-alert-center']) {
  assert.ok(styles.includes(token), "Missing responsive alert centre visual styling: " + token);
}

assert.ok(vestra.includes('className="vs-prism-command-hub"'), "VESTRA must render its original angular prismatic workspace command hub.");
assert.equal((vestra.match(/className="vs-prism-shortcut"/g)||[]).length,7, "The prism command hub must provide one direct icon control for each of the seven VESTRA spaces.");
assert.ok(vestra.includes('aria-label="Quick workspace navigation"'), "Prismatic shortcuts must have an accessible group label.");
for (const token of ['aria-label="Open Spatial Desk"', 'aria-label="Open Intent Canvas"', 'aria-label="Open Financial Studio"', 'aria-label="Open Temporal workspace"', 'aria-label="Open Relationships"', 'aria-label="Open Simulation Studio"', 'aria-label="Open Mission workflow"']) {
  assert.ok(vestra.includes(token), "Missing accessible prismatic workspace shortcut: " + token);
}
assert.ok(!vestra.includes("vs-orbit-system")&&!vestra.includes("vs-core-sphere"), "VESTRA must not copy AXIMACH's rotating sphere or orbital navigation.");
for (const token of [".vs-prism-command-hub", ".vs-prism-shortcuts", ".vs-prism-shortcut:hover", "@keyframes vsPrismTileUnfold"]) {
  assert.ok(styles.includes(token), "Missing original angular prismatic command-hub styling: " + token);
}


assert.ok(vestra.includes('workspacePreferences["vestraShift.favoriteModules"]'), "Favourite modules must persist as per-workspace preferences.");
assert.ok(vestra.includes('onSaveWorkspacePreference("vestraShift.favoriteModules",next)'), "Changing favourite modules must save the selected module IDs.");
assert.ok(vestra.includes('aria-label="Favourite modules"'), "Favourite module shortcuts must be accessible.");
assert.ok(vestra.includes('onClick={()=>onOpenModule(name)}'), "A favourite module shortcut must open its actual AXIVESTRA module.");
for (const token of [".vs-personalization-favourites", ".vs-personalization-favourite-grid", ".vs-favourite-module-rail", "@media(max-width:720px)"]) {
  assert.ok(styles.includes(token), "Missing responsive favourite-module personalization: " + token);
}

assert.ok(vestra.includes('className="vs-quick-actions-launch"'), "VESTRA must expose a contextual quick-action menu.");
assert.ok(vestra.includes('aria-controls="vs-quick-actions-menu"'), "Quick actions must be linked accessibly to their menu.");
for (const token of ['onOpenTasks();','onOpenModule("Follow-up Register")','onOpenModule("All Properties")','onOpenFinancials();','onOpenContacts();','onOpenModule("Documents")','onOpenModule("Risk & Compliance")']) {
  assert.ok(vestra.includes(token), "Quick action must route to its actual workspace: " + token);
}
assert.ok(vestra.includes("quickActionsOpen||alertsOpen"), "Escape must close active VESTRA quick menus and alert centre.");
for (const token of [".vs-quick-actions-menu", ".vs-quick-actions-grid", "@media(max-width:760px)"]) {
  assert.ok(styles.includes(token), "Missing responsive quick-action menu styling: " + token);
}

for (const token of ["@keyframes vsOrigamiUnfold", "perspective(1300px) rotateX(-8deg)", '.ax-modern-shell[data-ax-motion="expressive"] .vs-space-page', ".vs-shift-tabs button.active{border-radius:13px", "@media(prefers-reduced-motion:reduce)"]) {
  assert.ok(styles.includes(token), "Missing accessible origami / morphing transition: " + token);
}
