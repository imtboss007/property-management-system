#!/usr/bin/env node
"use strict";

// Static security-contract smoke tests. These validate repository guardrails only;
// they do not replace applying migrations or testing RLS against a real Supabase project.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const failures = [];
let passed = 0;
function check(name, condition) {
  try {
    assert.ok(condition, name);
    passed += 1;
    process.stdout.write("PASS  " + name + "\n");
  } catch (error) {
    failures.push(name);
    process.stderr.write("FAIL  " + name + (error && error.message ? ": " + error.message : "") + "\n");
  }
}
function has(source, regex) { return regex.test(source); }

const baseMigration = read("supabase/migrations/202610290001_auth_company_rbac.sql");
const hardening = read("supabase/migrations/202610290002_rbac_hardening.sql");
const metadata = read("supabase/migrations/202610290003_metadata_audit_hardening.sql");
const approvals = read("supabase/migrations/202610290004_approval_permissions.sql");
const authGate = read("src/AuthGate.tsx");
const cloud = read("src/lib/supabase.ts");
const invite = read("supabase/functions/invite-company-member/index.ts");
const envExample = read(".env.example");
const desktopWorkflow = read(".github/workflows/main.yml");
const downloadWorkflow = read(".github/workflows/estateflow-download-builds.yml");
const whatsappUi = read("src/WhatsAppScheduler.tsx");
const whatsappService = read("electron/whatsapp-service.cjs");
const electronMain = read("electron/main.cjs");

check("company, membership, records and governance-audit tables have RLS enabled",
  ["companies", "company_memberships", "company_records", "company_audit_events"]
    .every(table => has(baseMigration, new RegExp("alter table public\\." + table + " enable row level security", "i"))));
check("company creation requires an authenticated user and atomically grants first owner",
  has(baseMigration, /create or replace function public\.create_company_with_owner/i) &&
  has(baseMigration, /if caller_id is null then[\s\S]{0,80}Authentication required/i) &&
  has(baseMigration, /values \(new_company_id, caller_id, 'owner', caller_id\)/i) &&
  has(baseMigration, /grant execute on function public\.create_company_with_owner\(text\) to authenticated/i));
check("company records cannot be physically deleted through client grants",
  has(hardening, /revoke delete on table public\.company_records from authenticated/i));
check("cloud record company/type/key and creator identity are guarded",
  has(hardening, /old\.company_id is distinct from new\.company_id/i) &&
  has(hardening, /new\.created_by := old\.created_by/i) &&
  has(hardening, /company_records_identity_guard/i));
check("membership IDs cannot be reassigned and non-owner role operations are scoped",
  has(hardening, /guard_company_membership_identity/i) &&
  has(hardening, /old\.user_id is distinct from new\.user_id/i) &&
  has(baseMigration, /role <> 'owner'/i));
check("deleted records use tombstones and cannot be revived by routine sync",
  has(baseMigration + "\\n" + hardening, /Deleted records cannot be revived/i) &&
  has(baseMigration + "\\n" + hardening, /company_records_soft_delete_guard/i));
check("cloud record update timestamps are server controlled",
  has(metadata, /new\.updated_at := clock_timestamp\(\)/i) &&
  has(metadata, /company_record_metadata_stamp/i));
check("company rename is written to governance audit history by database trigger",
  has(metadata, /company_settings_changed/i) &&
  has(metadata, /company_name_change_audit/i));
check("staff can submit pending approvals but cannot update or decide approval records",
  has(approvals, /as restrictive[\s\S]{0,100}for update/i) &&
  has(approvals, /record_type <> 'approval'[\s\S]{0,120}has_company_role\(company_id, array\['owner','admin','manager'\]\)/i) &&
  has(approvals, /coalesce\(nullif\(payload ->> 'status', ''\), 'pending'\) = 'pending'/i));
check("approval decision buttons are blocked for staff and read-only UI roles",
  has(read("src/App.tsx"), /button\.classList\.contains\("decision-button"\)/i) &&
  has(read("src/App.tsx"), /Staff can submit approval requests but cannot approve or reject them/i));
check("sign-in, sign-up, recovery and explicit local-only mode are implemented",
  has(authGate, /signInWithPassword/i) && has(authGate, /signUp\(/i) &&
  has(authGate, /resetPasswordForEmail/i) && has(authGate, /LOCAL WORKSPACE/i));
check("read-only membership cannot invoke the legacy local-record import path",
  has(authGate, /company\.role !== "read_only" && !initialized && hasLegacyLocalRecords\(\)/));
check("cloud sync is company scoped and enforces role-aware deletion",
  has(cloud, /\.eq\("company_id", company\.id\)/i) &&
  has(cloud, /company\.role === "read_only"/i) &&
  has(cloud, /softDeleteCompanyRecords/i));
check("overlapping cloud sync runs queue the newest snapshot instead of dropping changes",
  has(read("src/App.tsx"), /cloudSyncPendingRef/i) &&
  has(read("src/App.tsx"), /Coalesce edits that occur while a previous cloud sync is in flight/i));
check("WhatsApp contact and group selectors support text search",
  has(read("src/WhatsAppScheduler.tsx"), /recipientSearch/i) &&
  has(read("src/WhatsAppScheduler.tsx"), /recipientGroupSearch/i) &&
  has(read("src/WhatsAppScheduler.tsx"), /directoryContactSearch/i) &&
  has(read("src/WhatsAppScheduler.tsx"), /directoryGroupSearch/i) &&
  has(read("src/WhatsAppScheduler.tsx"), /type="search"/i));
check("Windows message queue runs in tray and starts hidden at user login",
  has(read("electron/main.cjs"), /app\.setLoginItemSettings\(\{ openAtLogin: true/i) &&
  has(read("electron/main.cjs"), /process\.argv\.includes\("--hidden"\)/i) &&
  has(read("electron/main.cjs"), /win\.hide\(\)/i) &&
  has(read("electron/whatsapp-service.cjs"), /tick = setInterval\(\(\) => \{ void schedulerTick/i) &&
  has(read("electron/whatsapp-service.cjs"), /whatsapp-scheduled-messages\.json/i));
check("WhatsApp contact sync only upserts the persistent cache and does not clear it on disconnect",
  has(read("electron/whatsapp-service.cjs"), /async function upsertWhatsAppContacts/i) &&
  has(read("electron/whatsapp-service.cjs"), /await saveAddressBook\(\)/i) &&
  has(read("src/WhatsAppScheduler.tsx"), /function mergeAddressBookCache/i) &&
  has(read("src/WhatsAppScheduler.tsx"), /const merged = mergeAddressBookCache\(addressBook, book\)/i) &&
  has(read("src/App.tsx"), /They remain in AXIVESTRA when WhatsApp is disconnected/i));
check("one-time and repeated messages support individual contacts and groups",
  has(read("src/WhatsAppScheduler.tsx"), /sendMode === "repeat"/i) &&
  has(read("src/WhatsAppScheduler.tsx"), /destinationType: recipientMode/i) &&
  has(read("electron/whatsapp-service.cjs"), /const repeatCount = Math\.max\(1, Math\.min\(MAX_REPEAT_COUNT/i) &&
  has(read("electron/whatsapp-service.cjs"), /queue\.push\(\.\.\.rows\)/i));

check("property, multi-stakeholder and role-specific contact selectors are searchable",
  has(read("src/App.tsx"), /function SearchableContactPicker/i) &&
  has(read("src/App.tsx"), /Other linked stakeholders \(select multiple\)/i) &&
  has(read("src/App.tsx"), /label="Primary contact"/i) &&
  has(read("src/App.tsx"), /moduleContactFields\[form\.module\][\s\S]{0,220}SearchableContactPicker/i) &&
  has(read("src/styles.css"), /searchable-contact-picker__options/i));
check("WhatsApp directory sync is persistent and does not prune previously synced entries",
  has(whatsappService, /whatsapp-address-book\.json/i) &&
  has(whatsappService, /async function upsertWhatsAppContacts/i) &&
  has(whatsappService, /async function upsertWhatsAppGroups/i) &&
  has(whatsappService, /await saveAddressBook\(\)/i));
check("repeat schedules support individual/group targets, consent, stop-on-reply and persistence",
  has(whatsappService, /MAX_REPEAT_COUNT/i) &&
  has(whatsappService, /destinationType === "group"/i) &&
  has(whatsappService, /consentConfirmed !== true/i) &&
  has(whatsappService, /stopOnReply/i) &&
  has(whatsappService, /whatsapp-scheduled-messages\.json/i));
check("Windows background sender starts at login and remains active while window is hidden",
  has(electronMain, /app\.setLoginItemSettings\(\{ openAtLogin: true/i) &&
  has(electronMain, /args: \["--hidden"\]/i) &&
  has(electronMain, /event\.preventDefault\(\);\s*win\.hide\(\)/i) &&
  has(whatsappService, /setInterval\(\(\) => \{ void schedulerTick/i));
check("invitation function verifies the caller's JWT and owner/admin membership",
  has(invite, /auth\.getUser\(token\)/i) &&
  has(invite, /\["owner", "admin"\]\.includes\(callerMembership\.role\)/i) &&
  has(invite, /"admin", "manager", "staff", "read_only"/i) &&
  has(invite, /Owner access cannot be invited/i));
const viteAssignments = envExample.split(/\r?\n/)
  .map(line => line.trim())
  .filter(line => /^VITE_[A-Z0-9_]+\s*=/.test(line))
  .map(line => line.split("=")[0]);
check("sample environment exposes only public Supabase client settings",
  viteAssignments.length === 2 &&
  viteAssignments.includes("VITE_SUPABASE_URL") &&
  viteAssignments.includes("VITE_SUPABASE_PUBLISHABLE_KEY") &&
  !viteAssignments.some(name => /SERVICE_ROLE|SECRET_KEY|DATABASE_PASSWORD/i.test(name)));
check("Windows/Android workflows pass only public Supabase build values",
  has(desktopWorkflow, /VITE_SUPABASE_PUBLISHABLE_KEY:/i) &&
  has(downloadWorkflow, /VITE_SUPABASE_PUBLISHABLE_KEY:/i) &&
  !has(desktopWorkflow, /VITE_SUPABASE_SERVICE_ROLE_KEY/i) &&
  !has(downloadWorkflow, /VITE_SUPABASE_SERVICE_ROLE_KEY/i));

process.stdout.write("\n" + passed + " security-contract checks passed.\n");
if (failures.length) {
  process.stderr.write(failures.length + " security-contract check(s) failed. These are static source checks, not live database tests.\n");
  process.exitCode = 1;
} else {
  process.stdout.write("Live Supabase RLS, email delivery, and real-device tests are still required before production release.\n");
}
