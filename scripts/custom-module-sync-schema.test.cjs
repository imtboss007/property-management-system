"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migration = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "20261114031500_axivestra_custom_module_sync.sql"), "utf8");
for (const scope of ["company_records", "personal_records"]) {
  assert.match(migration, new RegExp("alter table public\\." + scope + "\\s+drop constraint if exists " + scope + "_record_type_check", "i"));
  assert.match(migration, new RegExp("add constraint " + scope + "_record_type_check[\\s\\S]{0,500}'custom_module'", "i"));
}
process.stdout.write("Custom module cloud-sync schema regression tests passed.\\n");
