"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "supabase.ts"), "utf8");

assert.match(source, /async function fetchAllPersonalRecordRows\(userId: string, columns: string\)/,
  "Personal cloud records must be read through the paginated reader.");
assert.match(source, /const pageSize = 500/);
assert.match(source, /\.from\("personal_records"\)[\s\S]*?\.order\("record_type", \{ ascending: true \}\)[\s\S]*?\.order\("record_key", \{ ascending: true \}\)[\s\S]*?\.range\(from, from \+ pageSize - 1\)/,
  "Personal pages must use stable ordering and bounded ranges.");
assert.match(source, /rows\.length > 250000/,
  "Personal sync must stop safely instead of exhausting device memory.");
assert.equal((source.match(/fetchAllPersonalRecordRows\(userId/g) || []).length, 2,
  "Both Personal Mode initialization and recurring two-way sync must read every page.");
assert.doesNotMatch(source, /from\("personal_records"\)[\s\S]{0,160}\.eq\("user_id", userId\);/,
  "No direct unpaginated personal_records list read may remain.");

console.log("Personal workspace pagination regression contract passed.");
