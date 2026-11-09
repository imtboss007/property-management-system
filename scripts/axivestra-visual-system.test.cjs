const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src", "App.tsx"), "utf8");
const css = fs.readFileSync(path.join(root, "src", "styles.css"), "utf8");
const orbit = fs.readFileSync(path.join(root, "src", "AxivestraOrbitalHub.tsx"), "utf8");
const mw = fs.readFileSync(path.join(root, "src", "ModuleWorkbench.tsx"), "utf8");
const supabase = fs.readFileSync(path.join(root, "src", "lib", "supabase.ts"), "utf8");
const localDb = fs.readFileSync(path.join(root, "src", "lib", "local-db.ts"), "utf8");
const followUps = fs.readFileSync(path.join(root, "src", "lib", "follow-ups.ts"), "utf8");
const registry = fs.readFileSync(path.join(root, "src", "FollowUpRegistry.tsx"), "utf8");
const followUpForm = fs.readFileSync(path.join(root, "src", "FollowUpForm.tsx"), "utf8");
const intentCanvas = fs.readFileSync(path.join(root, "src", "IntentCanvas.tsx"), "utf8");
const analytics = fs.readFileSync(path.join(root, "src", "PortfolioAnalytics.tsx"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const productArchitecture = fs.readFileSync(path.join(root, "AXIVESTRA-PRODUCT-ARCHITECTURE.md"), "utf8");

assert.match(
  app,
  /className=\{company\?\.role === "read_only" \? "app-shell ax-modern-shell workspace-readonly" : "app-shell ax-modern-shell"\}/,
  "The existing app shell must carry the visual-only AXIVESTRA scope class."
);

for (const selector of [
  ".ax-modern-shell {",
  ".ax-modern-shell .sidebar",
  ".ax-modern-shell .topbar",
  ".ax-modern-shell .institutional-banner",
  ".ax-modern-shell .module-card",
  ".ax-modern-shell .form-card"
]) {
  assert.ok(css.includes(selector), `Missing scoped visual rule: ${selector}`);
}

assert.match(css, /@media\s*\(max-width:\s*720px\)/, "The visual layer must retain a mobile layout.");
assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, "The visual layer must respect reduced-motion preferences.");
assert.match(css, /env\(safe-area-inset-bottom/, "Mobile spacing must account for device safe areas.");



assert.match(app, /import AxivestraOrbitalHub from "\.\/AxivestraOrbitalHub"/, "The existing application must load the orbital workspace component.");
assert.match(app, /<AxivestraOrbitalHub[\s\S]*?onOpen=\{name => go\(name\)\}/, "The orbital nodes must open the existing workspace navigation.");
assert.match(orbit, /aria-label="AXIVESTRA orbital workspace navigation"/, "The orbital navigation must have an accessible landmark.");
assert.match(orbit, /const filtered = items[\s\S]*?\.map\(\(item, sourceIndex\)/, "The orbital navigation must filter and map the supplied workspaces.");
assert.match(orbit, /setInspectedModule\(item\.name\)/, "Selecting a module node must open its in-command-centre detail panel.");
assert.match(orbit, /onClick=\{\(\) => openWorkspace\(inspectedDetail\.name\)\}/, "The detail panel must retain an explicit route to the full existing workspace.");
assert.match(orbit, /totalRecords|portfolioValue|openActions/, "The central command panel must use live workspace metrics.");
assert.match(css, /\.ax-orbit-core__sphere/, "The command hub must include its central 3D sphere.");
assert.match(css, /\.ax-orbit-track--outer/, "The command hub must render orbital tracks.");
assert.match(css, /\.ax-orbit-node/, "The command hub must style interactive module nodes.");
assert.match(css, /@media\s*\(max-width:\s*720px\)[\s\S]*?\.ax-orbit-nodes/, "Orbital navigation must reflow to a mobile-friendly grid.");
assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.ax-orbit-core__sphere/, "Orbital animation must respect reduced-motion preferences.");

assert.match(orbit, /if \(inspectedModule && !visibleOrbitItems\.some\(item => item\.name === inspectedModule\)\) setInspectedModule\(null\)/, "A module detail panel must close when search or group filters hide its selected workspace.");
assert.match(orbit, /if \(focused && !visibleOrbitItems\.some\(item => item\.name === focused\)\) setFocused\(null\)/, "A hidden workspace must not remain visually focused after filtering.");
assert.match(orbit, /setInspectedModule\(item\.name\); setRotationPaused\(true\)/, "Selecting a moving workspace must pause the orbit so its detail can be inspected reliably.");
assert.match(orbit, /aria-pressed=\{inspectedModule === item\.name\}/, "Selected workspace nodes must expose their selected state accessibly.");
assert.match(orbit, /focused === item\.name \|\| inspectedModule === item\.name/, "The selected workspace node must remain highlighted after pointer focus changes.");
assert.match(orbit, /const goldenAngle = Math\.PI \* \(3 - Math\.sqrt\(5\)\)/, "The 3D sphere must position modules with spherical Fibonacci coordinates.");
assert.match(orbit, /translate3d\(calc\(-50% \+ \$\{x\.toFixed\(2\)\}px\), calc\(-50% \+ \$\{y\.toFixed\(2\)\}px\), \$\{z\.toFixed\(2\)\}px\)/, "Each module must have a real depth coordinate relative to the center of the unified shell.");
assert.match(orbit, /data-orbit-dimensionality="3d"/, "The orbital scene must declare its 3D rendering mode.");
assert.match(css, /\.ax-modern-shell \.ax-orbit-hub\.is-orbit-view \.ax-orbit-stage\s*\{[^}]*perspective:\s*1250px/, "The desktop orbital stage must establish a real perspective camera.");
assert.match(css, /\.ax-modern-shell \.ax-orbit-hub\.is-orbit-view \.ax-orbit-ring\s*\{[^}]*transform-style:\s*preserve-3d/, "Both orbital shells must preserve 3D child transforms.");
assert.match(css, /@keyframes ax-orbit-core-surface-spin/, "The fixed-size central globe must rotate its surface without turning edge-on.");
assert.match(css, /@media \(max-width: 720px\)[\s\S]*?\.ax-modern-shell \.ax-orbit-hub\.is-orbit-view \.ax-orbit-core__sphere\s*\{[^}]*width:\s*88px/, "The mobile globe must retain a round, compact visible face.");
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.ax-orbit-core__surface/, "Globe surface motion must respect reduced-motion preferences.");
assert.match(orbit, /className="ax-orbit-card-float"/, "Every module card must have an independent animation wrapper.");
assert.match(orbit, /onClick=\{\(\) => openWorkspace\(item\.name\)\}/, "Clicking a module card must open that exact workspace.");
assert.match(orbit, /aria-label=\{\`Inspect \$\{item\.name\} details\`\}/, "Every module must retain a separate direct details action.");
assert.match(css, /\.ax-orbit-node-inspect\s*\{/, "The independent details action must remain visible and clickable.");


assert.match(orbit, /className="ax-orbit-card-float"/, "Every module card must have its own isolated animation wrapper.");
assert.match(orbit, /animationDelay:\s*`\$\{\(item\.sourceIndex % 8\) \* -0\.78\}s`/, "Each module card must receive a staggered animation delay.");
assert.match(css, /@keyframes ax-orbit-module-card-drift/, "Each module card must have its own subtle movement animation.");
assert.match(css, /@keyframes ax-orbit-module-card-glow/, "Each module card must have an independent perimeter glow.");
assert.match(css, /\.ax-orbit-hub\.is-rotation-paused[\s\S]*?\.ax-orbit-card-float/, "Pausing the orbit must also pause each module card's motion.");
assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.ax-orbit-card-float/, "Individual card animations must respect reduced-motion preferences.");

console.log("AXIVESTRA visual-system contract passed.");


assert.match(app, /name: "Intelligence Hub"/, "The Intelligence Hub must be present in primary navigation.");
assert.match(app, /name: "AXIVESTRA Shift"/, "AXIVESTRA Shift must be present in primary navigation.");
assert.match(app, /loadDeviceSyncBaseline\(/, "Device sync baselines must load from IndexedDB.");
assert.match(app, /saveDeviceSyncBaseline\(/, "Device sync baselines must be saved outside localStorage.");
assert.doesNotMatch(app, /localStorage\.setItem\(baselineKey/, "The large sync baseline must no longer be written to localStorage.");
assert.match(app, /onUpdateFollowUpContacts=\{updateRecordFollowUpContacts\}/, "Every module record must support multiple follow-up contacts.");
assert.match(mw, /Add follow-up person/, "Record cards must provide a quick add follow-up contact control.");
assert.match(mw, /__followUpContactIds/, "Follow-up contact links must persist independently from other stakeholders.");
assert.match(orbit, /is-zoomed/, "Selecting the sphere or a module node must trigger a visible zoom state.");
assert.match(css, /ax-record-followup-people/, "Follow-up people must have dedicated responsive UI.");
assert.match(css, /ax-intelligence-hub-page/, "Intelligence Hub must have a dedicated responsive layout.");
assert.match(css, /ax-shift-page/, "AXIVESTRA Shift must have a dedicated responsive layout.");

assert.match(localDb, /syncState: "&id,companyId,updatedAt"/, "IndexedDB must persist company sync baselines.");
assert.match(supabase, /loadCompanySyncBaseline\(/, "Company initialization and sync must load IndexedDB baselines.");
assert.match(supabase, /saveCompanySyncBaseline\(/, "Company initialization and sync must save IndexedDB baselines.");
assert.doesNotMatch(supabase, /localStorage\.setItem\([^\n]*syncBaseline/, "Large cloud baselines must not be written to localStorage.");
assert.match(mw, /<span>Add person<\/span>/, "Every module record must show a visible add follow-up person action.");
assert.match(css, /AXIVESTRA final mobile and follow-up control refinements/, "Final mobile refinements must remain present.");


assert.match(app, /name: "Follow-up Registry"/, "Follow-up Registry must be available in primary navigation.");
assert.match(app, /active === "Follow-up Registry"/, "Follow-up Registry must have a real route.");
assert.match(app, /saveFollowUp =/, "Follow-up creation must save into the linked source record.");
assert.match(app, /serializeFollowUps\(/, "Follow-up edits must persist back to linked source records.");
assert.match(app, /overdueFollowUps/, "The Intelligence Hub must calculate overdue follow-ups from saved records.");
assert.match(app, /followUpsWithMultiplePeople/, "The Intelligence Hub must surface multi-person assignments.");
assert.match(mw, /Add follow-up/, "Every module record must expose an add follow-up action.");
assert.match(registry, /peopleGroups/, "The registry must group assignments by person.");
assert.match(registry, /Overdue/, "The registry must expose overdue follow-ups.");
assert.match(registry, /Upcoming/, "The registry must expose upcoming follow-ups.");
assert.match(registry, /Completed/, "The registry must expose completed follow-ups.");
assert.match(registry, /amountSort/, "The registry must support amount-wise ordering.");
assert.match(registry, /view==="calendar"/, "The registry must include a calendar view.");
assert.match(followUps, /contactIds/, "Follow-up records must support multiple assigned people.");
assert.match(followUpForm, /Follow-up date/, "Follow-up form must capture a date.");
assert.match(followUpForm, /Follow-up time/, "Follow-up form must capture a time.");
assert.match(followUpForm, /Priority/, "Follow-up form must capture priority.");
assert.match(followUpForm, /Next action/, "Follow-up form must capture next action.");


assert.match(app, /import IntentCanvas from "\.\/IntentCanvas"/, "The Intelligence Hub must include the VESTRA SHIFT Intent Canvas.");
assert.match(app, /<IntentCanvas/, "The Intent Canvas must be mounted in the Intelligence Hub route.");
assert.match(intentCanvas, /Run command/, "The Intent Canvas must expose a working command composer.");
assert.match(intentCanvas, /onOpenFollowUps\("Today"\)/, "The composer must route today's follow-ups to the date-filtered registry.");
assert.match(intentCanvas, /onOpenApprovals\(\)/, "The composer must navigate to the approvals workflow.");
assert.match(intentCanvas, /onOpenRisks\(\)/, "The composer must navigate to the risk workflow.");
assert.match(intentCanvas, /localStorage\.setItem\("axivestra\.intentCanvas\.panels"/, "Users must be able to save their canvas panel arrangement.");
assert.match(intentCanvas, /setFocus\(/, "The canvas must support a single-panel focus workspace.");
assert.match(intentCanvas, /Temporal workspace/, "The canvas must include a dated activity timeline.");
assert.match(intentCanvas, /Financial movement/, "The canvas must include source-linked financial movement.");
assert.match(intentCanvas, /Cross-workspace relationship intelligence/, "The canvas must include the cross-workspace relationship intelligence panel.");
assert.match(intentCanvas, /buildRelationshipIntelligence/, "The relationship panel must use the explicit-ID relationship resolver.");
assert.match(intentCanvas, /financials,documents,risks/, "The relationship resolver must receive the document collection.");
assert.doesNotMatch(intentCanvas, /person\.name\.trim\(\)\.toLowerCase\(\)/, "Display-name equality must not create a relationship link.");
assert.match(intentCanvas, /unresolvedReferences/, "Unresolved contact IDs must be visible for data-quality review.");
assert.match(intentCanvas, /person\.records\.slice\(0,4\)/, "The relationship panel must show the contact's actual linked saved records.");
assert.match(intentCanvas, /record\.kind==="workspace"/, "Workspace relationship paths must open the linked module.");
assert.match(intentCanvas, /props\.onOpenDocuments\(\)/, "Document relationships must open the document workspace.");
assert.match(app, /documents=\{documents\}/, "The app must supply saved documents to relationship intelligence.");
assert.match(app, /onOpenDocuments=\{\(\)=>go\("Documents"\)\}/, "Document relationship navigation must use the existing Documents route.");
assert.doesNotMatch(app, /<span>PORTFOLIO VALUE<\/span>/, "Mixed record amounts must not be presented as pure portfolio value.");

assert.match(css, /VESTRA SHIFT — live intent canvas/, "The responsive intent canvas styling must be present.");


assert.match(orbit, /ringName:\s*ring === 0 \? "outer" : "inner"/, "Workspace metadata must retain the two logical orbital groups for relationship routes.");
assert.match(orbit, /className="ax-orbit-ring ax-orbit-ring--outer" data-orbit-shell="unified"/, "All modules must share one unified rotating 3D shell.");
assert.match(orbit, /visibleOrbitItems\.map\(item => \(/, "All 16 filtered modules must be children of the shared 3D shell.");
assert.match(orbit, /rotationPaused/, "Users must be able to pause and resume automatic orbital motion.");
assert.match(orbit, /Pause rotation|Resume rotation/, "The orbital motion control must have a clear accessible action label.");
assert.match(css, /@keyframes ax-orbit-node-orbit\s*\{/, "The outer module ring must have an automatic rotation animation.");
assert.match(css, /@keyframes ax-orbit-node-orbit-reverse\s*\{/, "The inner module ring must rotate independently in the opposite direction.");
assert.match(css, /ax-orbit-node-counter-outer/, "Outer-ring module cards must remain upright while orbiting.");
assert.match(css, /ax-orbit-node-counter-inner/, "Inner-ring module cards must remain upright while orbiting.");
assert.match(css, /is-rotation-paused[\s\S]*?animation-play-state:\s*paused/, "The pause control must stop decorative and module-orbit animation.");
assert.match(css, /@media\s*\(max-width:\s*720px\)[\s\S]*?\.ax-orbit-ring--outer\s*\{[^}]*display:\s*block\s*!important/, "Mobile orbit nodes must remain in one rotating 3D shell instead of falling into a flat grid.");
assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.ax-orbit-ring--outer/, "Reduced-motion users must not receive automatic orbital movement.");


assert.match(orbit, /const routePaths = useMemo\(/, "Directional route geometry must be derived from the live workspace layout.");
assert.match(orbit, /<svg className="ax-orbit-routes"/, "The orbital command centre must render a dedicated route overlay.");
assert.match(orbit, /markerMid=/, "Orbital paths must include visible directional arrowheads.");
assert.match(orbit, /className="ax-orbit-spoke"/, "Each workspace must have a visible hub-to-module connection.");
assert.match(orbit, /const groupSummaries = useMemo\(/, "Workspace group totals must be derived from actual module records.");
assert.match(orbit, /Records across intelligence groups/, "The command centre must expose its live workspace distribution panel.");
assert.match(orbit, /group\.records\.toLocaleString\("en-IN"\)/, "Distribution cards must display live grouped record counts.");
assert.match(orbit, /role="progressbar"/, "Distribution bars must expose accessible progress semantics.");
assert.match(css, /\.ax-orbit-route-ring--outer \.ax-orbit-route-path/, "The outer orbital route must have its own visual treatment.");
assert.match(css, /\.ax-orbit-route-ring--inner \.ax-orbit-route-path/, "The inner orbital route must have its own visual treatment.");
assert.match(css, /@keyframes ax-orbit-route-flow/, "Directional route dashes must animate along the route.");
assert.match(css, /\.ax-orbit-routes\s*\{[^}]*z-index:\s*1/, "Connection paths must sit behind workspace cards.");
assert.match(css, /\.ax-orbit-nodes\s*\{\s*z-index:\s*3/, "Selectable workspace nodes must remain above connection paths.");
assert.match(css, /\.ax-orbit-distribution__grid/, "Live group panels must use a responsive card grid.");
assert.match(css, /@media\s*\(max-width:\s*720px\)[\s\S]*?\.ax-orbit-routes\s*\{\s*display:\s*none/, "The route overlay must yield to the mobile workspace grid.");


assert.ok(orbit.includes('useState<"orbit" | "grid">("orbit")'), "The orbital command centre must expose Orbit and Grid view state.");
assert.ok(orbit.includes('aria-label="Workspace view"'), "Workspace layout controls must be grouped accessibly.");
assert.ok(orbit.includes('aria-pressed={viewMode === "orbit"}'), "Orbit view must expose its selected state.");
assert.ok(orbit.includes('aria-pressed={viewMode === "grid"}'), "Grid view must expose its selected state.");
assert.ok(orbit.includes('setViewMode("orbit")') && orbit.includes('setViewMode("grid")'), "Both layout controls must switch views.");
assert.ok(orbit.includes("setModuleSearch(event.target.value)"), "Workspace search must respond to typed input.");
assert.ok(orbit.includes('selectedGroup === "All" || item.group === selectedGroup'), "Group scope must filter workspaces by their real category.");
assert.ok(orbit.includes("!query ||") && orbit.includes("item.name") && orbit.includes("item.group"), "Workspace search must match names and groups.");
assert.ok(orbit.includes("const routePaths = useMemo(") && orbit.includes("visibleOrbitItems.filter(item => item.ringName === ring)"), "Route geometry must use the filtered workspace set.");
assert.match(orbit, /data-module-shell=\{item\.ringName\}/, "Each module must preserve its logical shell group while sharing one animated parent.");
assert.ok(!orbit.includes("orbitItems"), "The view must not retain a stale unfiltered workspace-node collection.");
assert.ok(orbit.includes("No workspaces match this filter"), "Empty search and group results must show a clear empty state.");
assert.ok(css.includes(".ax-orbit-hub.is-grid-view .ax-orbit-stage"), "Grid view must have an explicit non-orbital stage layout.");
assert.ok(css.includes(".ax-orbit-hub.is-grid-view .ax-orbit-nodes") && css.includes("display: grid"), "Grid view must arrange workspaces into a card grid.");
assert.ok(css.includes(".ax-orbit-hub.is-grid-view .ax-orbit-core { display: none !important; }"), "Grid view must hide the decorative central sphere.");
assert.ok(css.includes("@media (max-width: 720px)") && css.includes(".ax-orbit-hub.is-grid-view .ax-orbit-nodes { grid-template-columns: repeat(2"), "Grid view must remain responsive on mobile.");


assert.match(orbit, /type ModuleDetail =/, "The orbital detail panel must use a typed module-detail contract.");
assert.match(orbit, /details: ModuleDetail\[\]/, "The orbital hub must receive actual module detail data.");
assert.match(app, /details=\{modules\.map\(module => \{/, "The application must supply detail data for every existing module.");
assert.match(app, /fields: \(moduleFields\[module\.name\] \|\| \[\]\)\.map/, "Module subcategories must come from the configured module field definitions.");
assert.match(app, /records: moduleRecords\.map\(record =>/, "The detail panel must be backed by the saved records for each module.");
assert.match(app, /contacts: contacts\.filter\(contact => linkedContactIds\.has\(contact\.id\)\)/, "Contact relationships must use the saved contact links.");
assert.match(app, /tasks: tasks\.filter\(task =>/, "The module panel must connect its saved schedule tasks.");
assert.match(app, /financials: financials\.filter\(entry => recordIds\.has\(entry\.propertyId\)\)/, "Financial activity must be linked by the source record ID.");
assert.match(app, /risks: riskRecords\.filter\(risk => Boolean\(risk\.propertyId && recordIds\.has\(risk\.propertyId\)\)\)/, "Risk items must be linked by the source record ID.");
assert.match(app, /approvals: approvalRequests\.filter\(approval => Boolean\(approval\.propertyId && recordIds\.has\(approval\.propertyId\)\)\)/, "Approval items must be linked by the source record ID.");
assert.match(orbit, /documents: \{ id: string; name: string; category: string; expiresOn: string; sizeBytes: number \}\[\]/, "The module detail contract must include linked documents and evidence files.");
assert.match(app, /documents: documents\.filter\(document => recordIds\.has\(document\.propertyId\)\)/, "Documents must be linked to the module panel by persisted source record ID.");
assert.match(orbit, /Documents & files/, "The module detail panel must show the linked document/evidence section.");
assert.match(orbit, /onOpen\("Documents"\)/, "The linked evidence section must navigate to the document vault.");
assert.match(orbit, /inspectedDetail\.documents\.length/, "The module panel must show the saved linked document count.");
assert.match(orbit, /RELATIONSHIP GRAPH/, "The module panel must expose linked contacts.");
assert.match(orbit, /Subcategories & fields/, "The module panel must expose its configured subcategories.");
assert.match(orbit, /Recent workflow activity/, "The module panel must preview linked workflow activity.");
assert.match(orbit, /inspectedDetail\.financials\.slice/, "The module panel must preview saved financial entries.");
assert.match(orbit, /inspectedDetail\.risks\.slice/, "The module panel must preview saved risk items.");
assert.match(orbit, /inspectedDetail\.approvals\.slice/, "The module panel must preview saved approval items.");
assert.match(orbit, /target:"Schedule & Tasks"/, "The module panel must link to the schedule workflow.");
assert.match(orbit, /target:"Financials"/, "The module panel must link to the financial workflow.");
assert.match(orbit, /target:"Risk & Compliance"/, "The module panel must link to risk management.");
assert.match(orbit, /target:"Approvals"/, "The module panel must link to approvals.");
assert.match(orbit, /onClick=\{\(\) => onOpen\(workflow\.target\)\}/, "Connected workflow actions must route through the existing navigation callback.");
assert.match(css, /\.ax-orbit-detail__body/, "The module detail panel must have a responsive two-column layout.");
assert.match(css, /@media\s*\(max-width:\s*600px\)[\s\S]*?\.ax-orbit-detail__side/, "The module detail panel must adapt to mobile.");

assert.match(app, /name: "Workspace Explorer"/, "The orbital navigator must have a dedicated Workspace Explorer route.");
const explorerStart = app.indexOf('active === "Workspace Explorer" && <>');
assert.ok(explorerStart >= 0 && app.indexOf("<AxivestraOrbitalHub", explorerStart) > explorerStart, "The orbital navigator must be mounted only by the Workspace Explorer route.");
const overviewStart = app.indexOf('{active === "Overview" && !rangeSearch && <>');
const intelligenceStart = app.indexOf('{active === "Intelligence Hub" && <section', overviewStart);
assert.ok(overviewStart >= 0 && intelligenceStart > overviewStart, "The primary Asset Intelligence Overview route must be present.");
assert.doesNotMatch(app.slice(overviewStart, intelligenceStart), /<AxivestraOrbitalHub/, "The orbital navigator must not displace the primary product overview.");
assert.match(app, /ASSET INTELLIGENCE OVERVIEW/, "The default landing page must identify the asset-intelligence product.");
assert.match(app, /RECORDED VALUE \/ EXPOSURE/, "Mixed module amounts must be labelled as recorded value/exposure.");
assert.match(analytics, /Recorded value \/ exposure by workspace/, "Cross-module amount charts must not call mixed amounts asset allocation.");
assert.doesNotMatch(analytics, /Asset allocation/, "Generic values across assets, debt and legal exposure must not be described as asset allocation.");
assert.match(app, /company \? "Company cloud" : personalUserId \? "Personal cloud" : "Local-only"/, "The overview must report the configured workspace mode rather than always saying local device.");
assert.match(readme, /optional visual workspace explorer/, "The README must define the orbital interface as optional navigation.");
assert.match(productArchitecture, /Multi-Asset, Capital & Relationship Intelligence Operating Platform/, "The repository must contain the canonical AXIVESTRA product identity.");
assert.match(productArchitecture, /Global investor sourcing and enrichment/, "The architecture must document the investor-intelligence implementation gap.");


assert.match(orbit, /className="ax-orbit-telemetry"/, "The 3D explorer must include a compact live telemetry HUD.");
assert.match(orbit, /WORKSPACES IN VIEW/, "The telemetry HUD must report the current visible workspace count.");
assert.match(orbit, /INTELLIGENCE GROUPS/, "The telemetry HUD must show the intelligence group count.");
assert.match(orbit, /className="ax-orbit-atmosphere"/, "The 3D stage must include a decorative atmospheric layer.");
assert.match(orbit, /ax-orbit-constellation__path/, "The stage must have an SVG constellation network for richer depth cues.");
assert.match(orbit, /ax-orbit-beacon--four/, "The orbital scene must include four decorative satellite beacons.");
assert.match(css, /\.ax-modern-shell \.ax-orbit-core__surface\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0/, "The rotating globe surface must fill and remain clipped inside the fixed sphere.");
assert.match(css, /@keyframes ax-orbit-nebula-drift/, "The atmospheric lighting must have a slow ambient movement.");
assert.match(css, /@keyframes ax-orbit-constellation-flow/, "The constellation network must have a subtle animated signal path.");
assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.ax-orbit-atmosphere__nebula/, "The decorative atmosphere must respect reduced-motion preferences.");
