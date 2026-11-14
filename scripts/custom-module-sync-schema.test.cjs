"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migration = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "20261114035526_axivestra_custom_module_sync.sql"), "utf8");
const syncSource = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "supabase.ts"), "utf8");
for (const scope of ["company_records", "personal_records"]) {
  assert.match(migration, new RegExp("alter table public\\." + scope + "\\s+drop constraint if exists " + scope + "_record_type_check", "i"));
  assert.match(migration, new RegExp("add constraint " + scope + "_record_type_check[\\s\\S]{0,500}'custom_module'", "i"));
}
assert.equal(syncSource.split('if (recordType === "custom_module")').length - 1, 2, "personal and company sync must use custom module edit timestamps");
assert.equal(syncSource.split('item.recordType === "custom_module"').length - 1, 2, "both merge paths must compare matching remote custom module timestamps");
process.stdout.write("Custom module cloud-sync schema and conflict regression tests passed.\n");
