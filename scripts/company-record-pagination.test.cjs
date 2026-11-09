const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const supabase = fs.readFileSync(path.join(root, "src/lib/supabase.ts"), "utf8");
const electron = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");

assert.match(supabase, /async function fetchAllCompanyRecordRows\(companyId: string, columns: string\)/);
assert.match(supabase, /const pageSize = 500/);
assert.match(supabase, /\.order\("record_type", \{ ascending: true \}\)/);
assert.match(supabase, /\.order\("record_key", \{ ascending: true \}\)/);
assert.match(supabase, /\.range\(from, from \+ pageSize - 1\)/);
assert.match(supabase, /rows\.length > 250000/);
assert.equal((supabase.match(/fetchAllCompanyRecordRows\(company\.id/g) || []).length, 2,
  "Company workspace initialization and recurring sync must both fetch every page.");

assert.match(electron, /app\.requestSingleInstanceLock\(\)/,
  "Only one Electron process may own the WhatsApp auth directory.");
assert.match(electron, /app\.on\("second-instance"/,
  "A second launch must focus the existing app window.");
assert.match(electron, /if \(!hasSingleInstanceLock\) return;/,
  "A process without the lock must not initialize the sender.");

console.log("Company pagination and Electron single-instance contract passed.");
