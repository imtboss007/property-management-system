"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

const gate = read("src/AuthGate.tsx");
const app = read("src/App.tsx");
const checks = [
  ["local workspace choice is available before login", /Continue locally without login/.test(gate)],
  ["local workspace choice is also available for signed-in users", /Use this device locally/.test(gate)],
  ["local mode persists across app restarts", /axivestra\.workspaceMode[\s\S]{0,100}local/.test(gate)],
  ["entering local mode clears only active cloud scope selectors", /const enterLocalMode = \(\) => \{[\s\S]{0,500}removeItem\("axivestra\.activeCompanyId"\)[\s\S]{0,200}removeItem\("axivestra\.activePersonalUserId"\)[\s\S]{0,120}setItem\("axivestra\.workspaceMode", "local"\)/.test(gate)],
  ["local mode does not require sign-out or destroy the account session", /if \(localMode\) return <App onSwitchCompany=\{switchToCloudMode\} \/>/.test(gate)],
  ["local mode can return to cloud login from Settings", /Sign in \/ switch to cloud mode/.test(app)],
  ["workspace export includes custom module definitions", /createWorkspaceBackup\([\s\S]{0,350}customModules, properties, contacts/.test(app) && /"customModules"/.test(read("src/lib/workspace-backup.mjs"))],
  ["custom module definitions are persisted locally", /saveLocal\("estateflow\.customModules", customModules\)/.test(app)],
  ["custom module definitions are included in cloud sync collections", /customModules: customModules as WorkspaceCollections/.test(app) && /stateKey: "customModules"/.test(read("src/lib/supabase.ts"))],
  ["custom module definitions are included in desktop and mobile paired sync", /customModules, properties, contacts/.test(app) && /"customModules"/.test(read("src/lib/device-sync.ts"))],
  ["workspace export includes custom module definitions", /createWorkspaceBackup\([\s\S]{0,350}customModules, properties, contacts/.test(app) && /"customModules"/.test(read("src/lib/workspace-backup.mjs"))],
  ["custom modules persist in local storage", /saveLocal\("estateflow\.customModules", customModules\)/.test(app)],
  ["custom modules participate in authenticated cloud sync", /customModules: customModules as WorkspaceCollections/.test(app) && /stateKey: "customModules"/.test(read("src/lib/supabase.ts"))],
  ["custom modules participate in paired PC/mobile sync", /"customModules"/.test(read("src/lib/device-sync.ts")) && /customModules, properties, contacts/.test(app)],
  ["workspace export uses a versioned envelope", /createWorkspaceBackup\([\s\S]{0,350}customModules, properties, contacts, whatsappGroups: savedWhatsAppGroups, tasks/.test(app)],
  ["workspace import validates before applying state", /parseWorkspaceBackup\(parsed\)[\s\S]{0,2500}All collections are parsed and validated before any state changes are committed/.test(app)],
  ["mobile file picker is attached to document before click", (() => { const appended = app.indexOf("document.body.appendChild(input)"); const clicked = appended < 0 ? -1 : app.indexOf("input.click()", appended); return appended >= 0 && clicked > appended; })()],
  ["older mobile WebViews have a FileReader fallback", /async function readBrowserFileText[\s\S]{0,500}new FileReader\(\)/.test(app)],
  ["download URL is revoked after a delay", /window\.setTimeout\(\(\) => URL\.revokeObjectURL\(url\), 60000\)/.test(app)],
  ["document-file backup remains explicitly separate", /document files are backed up separately from the Documents workspace/.test(app)]
];

let failures = 0;
for (const [label, ok] of checks) {
  process.stdout.write((ok ? "PASS " : "FAIL ") + label + "\n");
  if (!ok) failures++;
}
if (failures) {
  process.stderr.write(failures + " local-first regression checks failed.\n");
  process.exitCode = 1;
} else {
  process.stdout.write(checks.length + " local-first regression checks passed.\n");
}
