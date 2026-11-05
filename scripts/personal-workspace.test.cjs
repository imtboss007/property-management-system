"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

const migration = read("supabase/migrations/20261105210412_axivestra_personal_workspaces.sql");
const client = read("src/lib/supabase.ts");
const gate = read("src/AuthGate.tsx");
const app = read("src/App.tsx");
const checks = [
  ["personal records table is present", /create table if not exists public\.personal_records/i.test(migration)],
  ["RLS is enabled", /alter table public\.personal_records enable row level security/i.test(migration)],
  ["read policy is limited to the signed-in user", /for select to authenticated using \(\(select auth\.uid\(\)\) = user_id\)/i.test(migration)],
  ["insert policy checks both owner and actor", /auth\.uid\(\)\) = user_id[\s\S]*auth\.uid\(\)\) = created_by[\s\S]*auth\.uid\(\)\) = updated_by/i.test(migration)],
  ["personal identity trigger prevents owner reassignment", /old\.user_id is distinct from new\.user_id/i.test(migration)],
  ["personal workspace cache is user-scoped", /axivestra\.personal\.\$\{userId\}/i.test(client)],
  ["personal workspace initialization reads personal_records", /preparePersonalWorkspace[\s\S]{0,900}from\("personal_records"\)/i.test(client)],
  ["personal workspace sync uses owner filtering", /syncPersonalWorkspace[\s\S]{0,900}from\("personal_records"\)[\s\S]{0,120}eq\("user_id", userId\)/i.test(client)],
  ["new users without company memberships default to Personal Mode", /memberships\.length === 0[\s\S]{0,220}choosePersonal\(\)/i.test(gate)],
  ["Personal Mode passes a user-scoped identity into the app", /<App key=\{"personal:" \+ userId\} personalUserId=\{userId\} userId=\{userId\}/i.test(gate)],
  ["Personal cloud sync is used by the app's workspace sync loop", /syncPersonalWorkspace\(personalUserId!/i.test(app)],
  ["company migration leaves personal records in the personal scope", /personalStorageKey\(userId, item\.storageKey\)/i.test(client) && /importingPersonalWorkspace/i.test(gate)],
  ["switching between workspace modes remounts isolated app state", /key=\{"company:"[\s\S]{0,400}key=\{"personal:"/.test(gate)],
  ["Personal Mode can switch workspaces without deleting its records", /const openWorkspaceChooser = \(\) => \{[\s\S]{0,220}removeItem\("axivestra\.activePersonalUserId"\)/i.test(gate) && /personalStorageKey/i.test(app)]
];

let failures = 0;
for (const [label, ok] of checks) {
  process.stdout.write((ok ? "PASS " : "FAIL ") + label + "\n");
  if (!ok) failures++;
}
if (failures) {
  process.stderr.write(failures + " personal workspace checks failed.\n");
  process.exitCode = 1;
} else {
  process.stdout.write(checks.length + " personal workspace checks passed.\n");
}
