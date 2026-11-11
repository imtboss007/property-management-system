"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

const helper = read("src/lib/storage-mode.ts");
const app = read("src/App.tsx");
const gate = read("src/AuthGate.tsx");
const checks = [
  ["storage preference supports account and local modes", /AxivestraStorageMode = "account" \| "local"/.test(helper)],
  ["explicit device preference is read before account fallback", /readStoredStorageMode[\s\S]*if \(selected\) return selected/.test(helper)],
  ["existing signed-in accounts keep account-scoped storage by default", /activeCompanyId[\s\S]*activePersonalUserId[\s\S]*return "account"/.test(helper)],
  ["Local Only uses the device-local legacy record namespace", /getStorageMode\(\) === "local"\) return key/.test(app)],
  ["account cloud reconciliation is disabled in Local Only mode", /storageMode !== "account" \|\| \(!company && !personalUserId\)/.test(app)],
  ["paired PC and Android sync is enabled in Local Only mode", /if \(storageMode !== "local"\) return/.test(app)],
  ["storage setting can switch to Login ID", /chooseStorageMode\("account"\)/.test(app)],
  ["storage setting can switch to Local Only", /chooseStorageMode\("local"\)/.test(app)],
  ["storage mode is changed only after a confirmation and saved before reload", /window\.confirm\(explanation[\s\S]*persistStorageMode\(next\)[\s\S]*window\.location\.reload\(\)/.test(app)],
  ["Local Only can be opened without signing in", /if \(localOnlyAccess\) return <App \/>/.test(gate)],
  ["Local Only does not initialize login memberships or personal cloud", /if \(localOnlyAccess \|\| !supabase \|\| !userId\) return/.test(gate) && /!localOnlyAccess && userId && membershipsReady/.test(gate)],
  ["sign-in screen offers Local Only as an alternative", /Continue without login · Local storage only/.test(gate)],
  ["switching modes preserves separate datasets without automatic merge", /will remain saved separately and will not be deleted or copied/.test(app) && /does not delete or automatically merge either dataset/.test(app)]
];

let failures = 0;
for (const [label, ok] of checks) {
  process.stdout.write((ok ? "PASS " : "FAIL ") + label + "\n");
  if (!ok) failures++;
}
if (failures) {
  process.stderr.write(failures + " storage-mode checks failed.\n");
  process.exitCode = 1;
} else {
  process.stdout.write(checks.length + " storage-mode checks passed.\n");
}
