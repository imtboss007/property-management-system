"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const filename = path.join(__dirname, "..", "src", "lib", "follow-ups.ts");
const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const compiled = { exports: {} };
vm.runInNewContext(code, { module: compiled, exports: compiled.exports, require }, { filename });
const { recordFollowUps } = compiled.exports;

const saved = {
  id: "saved-1", contactIds: ["c1"], description: "Settlement call",
  date: "2026-11-14", time: "10:30", status: "Open"
};
const base = {
  id: "p1", title: "Bengaluru property", module: "Property Sale",
  nextFollowUpDate: "2026-11-14", nextAction: "Call owner",
  moduleData: { __followUps: JSON.stringify([saved]) }
};
assert.deepEqual(Array.from(recordFollowUps(base), item => item.id), ["saved-1"]);
const edited = {
  ...base,
  moduleData: { __followUps: JSON.stringify([{ ...saved, date: "2026-11-15" }]) }
};
assert.deepEqual(
  Array.from(recordFollowUps(edited), item => item.id),
  ["saved-1"],
  "moving a saved follow-up must not leave its former legacy date as a duplicate"
);
const legacyOnly = { ...base, moduleData: {} };
assert.deepEqual(Array.from(recordFollowUps(legacyOnly), item => item.id), ["legacy:p1"]);
const none = { ...base, nextFollowUpDate: "", moduleData: {} };
assert.equal(recordFollowUps(none).length, 0);

process.stdout.write("Follow-up precedence regression tests passed.\\n");
