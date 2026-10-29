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
const authGate = read("src/AuthGate.tsx");
const cloud = read("src/lib/supabase.ts");
const invite = read("supabase/functions/invite-company-member/index.ts");
const envExample = read(".env.example");
const desktopWorkflow = read(".github/workflows/main.yml");
const downloadWorkflow = read(".github/workflows/estateflow-download-builds.yml");

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
  has(hardening, /Deleted records cannot be revived/i) &&
  has(hardening, /company_records_soft_delete_guard/i));
check("cloud record update timestamps are server controlled",
  has(metadata, /new\.updated_at := clock_timestamp\(\)/i) &&
  has(metadata, /company_record_metadata_stamp/i));
check("company rename is written to governance audit history by database trigger",
  has(metadata, /company_settings_changed/i) &&
  has(metadata, /company_name_change_audit/i));
check("sign-in, sign-up, recovery and explicit local-only mode are implemented",
  has(authGate, /signInWithPassword/i) && has(authGate, /signUp\(/i) &&
  has(authGate, /resetPasswordForEmail/i) && has(authGate, /LOCAL WORKSPACE/i));
check("read-only membership cannot invoke the legacy local-record import path",
  has(authGate, /company\.role !== "read_only" && !initialized && hasLegacyLocalRecords\(\)/));
check("cloud sync is company scoped and enforces role-aware deletion",
  has(cloud, /\.eq\("company_id", company\.id\)/i) &&
  has(cloud, /company\.role === "read_only"/i) &&
  has(cloud, /softDeleteCompanyRecords/i));
check("invitation function verifies the caller's JWT and owner/admin membership",
  has(invite, /auth\.getUser\(token\)/i) &&
  has(invite, /\["owner", "admin"\]\.includes\(callerMembership\.role\)/i) &&
  has(invite, /"admin", "manager", "staff", "read_only"/i) &&
  has(invite, /Owner access cannot be invited/i));
check("sample environment exposes only public Supabase client settings",
  has(envExample, /VITE_SUPABASE_URL=/i) &&
  has(envExample, /VITE_SUPABASE_PUBLISHABLE_KEY=/i) &&
  !has(envExample, /SERVICE_ROLE|SECRET_KEY|DATABASE_PASSWORD/i));
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
