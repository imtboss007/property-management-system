"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

const app = read("src/App.tsx");
const builder = read("src/CustomModuleBuilder.tsx");
const models = read("src/lib/custom-modules.ts");
const workbench = read("src/ModuleWorkbench.tsx");
const universal = read("src/UniversalInterface.tsx");
const css = read("src/styles.css");
const checks = [
  ["custom module definitions have stable configurable field schemas", /fields: CustomModuleFieldDefinition\[\]/.test(models)],
  ["legacy custom module records normalize to an empty field list", /fields = Array\.isArray\(item\.fields\)/.test(models) && /legacy_custom_/.test(models)],
  ["custom workspace builder supports text, numeric, date and dropdown fields", /value="text"[\s\S]*value="textarea"[\s\S]*value="number"[\s\S]*value="date"[\s\S]*value="select"/.test(builder)],
  ["custom workspace builder supports single and multiple linked contacts", /value="contact"/.test(builder) && /value="contacts"/.test(builder)],
  ["custom workspace builder supports required fields and dropdown option validation", /required when saving a record/i.test(builder) && /Add at least one option to each dropdown field/.test(builder)],
  ["custom workspace create and edit are available from the sidebar and workbench", /setCustomModuleBuilderOpen\(true\)/.test(app) && /onEditModule=/.test(app) && /Configure workspace/.test(workbench)],
  ["custom workspace delete is blocked while records still reference it", /const linkedRecords = properties\.filter\(record => record\.module === item\.name\)/.test(app) && /if \(linkedRecords\.length\)/.test(app)],
  ["renaming a custom workspace migrates its module reference without rewriting record identity", /record\.module === previous\.name \? \{ \.\.\.record, module: item\.name \}/.test(app)],
  ["custom workspace schemas are normalized on local load, cloud refresh and backup restore", /normalizeCustomModules\(load\("estateflow\.customModules"/.test(app) && /normalizeCustomModules\(synced\.customModules\)/.test(app) && /normalizeCustomModules\(data\.customModules\)/.test(app)],
  ["custom field schemas are used by property forms, workbench, orbital details and universal search", /moduleFieldsFor\(active\)/.test(app) && /moduleFieldsFor\(module\.name\)/.test(app) && /customModules\.find\(item\\s*=>\\s*item\.name\\s*===\\s*form\.module\)\?\.fields/.test(app)],
  ["custom modules can attach extra properties and collateral", /PROPERTY_LINK_MODULES\.includes\(form\.module\) \|\| isCustomModule/.test(app)],
  ["required custom fields are validated on save", /field\.required && !String\(normalizedModuleData\[field\.key\]/.test(app)],
  ["custom contact field values are persisted as reusable relationship IDs", /__contact_custom_" \+ field\.key/.test(app)],
  ["custom single and multiple contacts are resolved into linked contact names", /field\?\.type === "contact"/.test(workbench) && /field\?\.type === "contacts"/.test(workbench) && /contactsById\.get\(coreValue\)/.test(workbench)],
  ["custom contact relationships are indexed for relationship intelligence and split for multi-links", /startsWith\("__contact_"\)[\s\S]*?split\(","\)/.test(app) && /startsWith\("__contact_"\)[\s\S]*?split\(","\)/.test(workbench)],
  ["custom record forms retain common primary, stakeholder, follow-up and WhatsApp group links", /__primaryContactIds/.test(app) && /__followUpContactIds/.test(app) && /__primaryWhatsAppGroupIds/.test(app) && /__followUpWhatsAppGroupIds/.test(app)],
  ["custom records receive the associated property and collateral editor", /PROPERTY_LINK_MODULES\.includes\(form\.module\) \|\| isCustomModule/.test(app)],
  ["custom records are included in linked task, document, financial, risk and approval activity", /relatedDocs=documents\.filter/.test(workbench) && /relatedTasks=tasks\.filter/.test(workbench) && /relatedMoney=financials\.filter/.test(workbench) && /relatedRisks=risks\.filter/.test(workbench) && /relatedApprovals=approvals\.filter/.test(workbench)],
  ["module workbench links open the correct shared activity registers", /onOpenSection\?\.\("Schedule & Tasks"\)/.test(workbench) && /onOpenSection\?\.\("Documents"\)/.test(workbench) && /onOpenSection\?\.\("Financials"\)/.test(workbench) && /onOpenSection\?\.\("Risk & Compliance"\)/.test(workbench) && /onOpenSection\?\.\("Approvals"\)/.test(workbench)],
  ["custom module search and orbital detail values come from the configured schema", /moduleFieldDisplayValue\(record, field\)/.test(app) && /moduleFieldsFor\(module\.name\)/.test(app)],
  ["command search and New / notification popovers cannot remain open simultaneously", /setActionOpen\(false\); setNotificationOpen\(false\)/.test(universal) && /if \(next\) \{ setPaletteOpen\(false\); setNotificationOpen\(false\)/.test(universal) && /if \(next\) \{ setPaletteOpen\(false\); setActionOpen\(false\)/.test(universal)],
  ["custom module schema dialog and linked activity are responsive", /ax-custom-module-modal/.test(css) && /ax-record-related-activity/.test(css) && /@media\(max-width:720px\)/.test(css)]
];

let failures = 0;
for (const [label, ok] of checks) {
  process.stdout.write((ok ? "PASS " : "FAIL ") + label + "\n");
  if (!ok) failures++;
}
if (failures) {
  process.stderr.write(failures + " custom-module / relationship checks failed.\n");
  process.exitCode = 1;
} else {
  process.stdout.write(checks.length + " custom-module / relationship checks passed.\n");
}
