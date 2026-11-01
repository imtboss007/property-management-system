const fs = require("node:fs");
const assert = require("node:assert/strict");

const app = fs.readFileSync("src/App.tsx", "utf8");
const studio = fs.readFileSync("src/CustomModuleStudio.tsx", "utf8");
const schema = fs.readFileSync("src/lib/custom-modules.ts", "utf8");
const sync = fs.readFileSync("src/lib/device-sync.ts", "utf8");
const cloud = fs.readFileSync("src/lib/supabase.ts", "utf8");
const workbench = fs.readFileSync("src/ModuleWorkbench.tsx", "utf8");
const styles = fs.readFileSync("src/styles.css", "utf8");
const windowsSync = fs.readFileSync("electron/whatsapp-service.cjs", "utf8");
const commandCenter = fs.readFileSync("src/WorkspaceCommandCenter.tsx", "utf8");

for (const token of [
  'load("axivestra.customModules", [])',
  'saveLocal("axivestra.customModules", customModules)',
  "customModules: customModules as WorkspaceCollections[\"customModules\"]",
  "custom_module: new Set(customModules.map(record => record.id))",
  "setCustomModules(current=>[...current,definition])",
  "Personalise dashboard",
  "saveLocal(\"estateflow.dashboardLayout\", dashboardLayout)",
  "dynamicModuleFields[active]",
  "availableModules={modules}",
  "moduleStatuses={dynamicModuleStatuses}",
  "customModules,exportedAt:new Date().toISOString()"
]) assert.ok(app.includes(token), "Missing custom-module app integration: " + token);

for (const token of [
  "Module Studio", "Module identity", "Build the data form",
  "Workflow stages", "Add field", "Create module", "Required field",
  "Dropdown options", "existingNames", "onSave"
]) assert.ok(studio.includes(token), "Missing Module Studio control: " + token);

for (const token of [
  "CustomModuleDefinition", "CustomModuleFieldType", "customModuleFieldKey",
  "validateCustomModule", "fields", "statuses", "archived"
]) assert.ok(schema.includes(token), "Missing custom module schema feature: " + token);

assert.ok(sync.includes('"customModules"'), "Custom modules must be included in PC/phone sync.");
assert.equal((windowsSync.match(/"customModules"/g) || []).length, 2, "Windows HTTP and desktop sync allow custom module records.");
assert.ok(commandCenter.includes('"module"') && commandCenter.includes("props.modules"), "Universal search must include module definitions.");
assert.ok(cloud.includes('stateKey: "customModules"'), "Custom module collection must be registered for company cloud sync.");
assert.ok(cloud.includes('recordType: "custom_module"'), "Custom modules must be included in company cloud records.");
for (const type of ["currency", "percent", "date", "select", "textarea", "email", "phone", "url", "checkbox"]) {
  assert.ok(studio.includes(type), "Module Studio should offer field type: " + type);
}
for (const token of [
  ".ax-dashboard-kpis", ".ax-dashboard-insights", ".ax-dashboard-bottom-grid",
  ".ax-dashboard-whatsapp", ".ax-dashboard-activity", ".ax-module-add-card",
  ".ax-module-studio", ".ax-studio-field-builder", ".ax-dashboard-customize", "@media(max-width:780px)"
]) assert.ok(styles.includes(token), "Missing responsive dashboard / studio style: " + token);

assert.ok(workbench.includes("Search all ") && workbench.includes("Print / Save PDF"), "Custom modules must reuse the search and PDF workbench.");
console.log("AXIVESTRA custom module and command-centre contracts passed.");
