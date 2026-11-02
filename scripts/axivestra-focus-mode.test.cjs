const fs = require("node:fs");
const assert = require("node:assert/strict");

const shift = fs.readFileSync("src/VestraShift.tsx","utf8");
const focus = fs.readFileSync("src/VestraFocusMode.tsx","utf8");
const styles = fs.readFileSync("src/styles.css","utf8");
const pkg = JSON.parse(fs.readFileSync("package.json","utf8"));

assert.ok(shift.includes('import VestraFocusMode from "./VestraFocusMode"'),"Focus environment must be part of VESTRA SHIFT.");
assert.ok(shift.includes('className="vs-focus-launch"'),"Focus must be reachable from the main workspace header.");
assert.ok(shift.includes("focusOpen&&<VestraFocusMode"),"Focus must mount as a working environment, not a decorative preview.");
for (const token of [
  "Focus a task","Focus a record","CONNECTED CONTEXT","RELEVANT HISTORY","IMMEDIATE ACTIONS",
  "onOpenTask(selectedTask.id)","onOpenRecord(focusedRecord.id)","onOpenContact(relatedContact.id)",
  "onOpenFinancials","workspaceScope","localStorage.setItem","role=\"dialog\"","aria-modal=\"true\""
]) assert.ok(focus.includes(token),"Missing Focus environment capability: "+token);
for (const token of [
  ".vs-focus-backdrop",".vs-focus-panel",".vs-focus-mode-switch",".vs-focus-main",
  ".vs-focus-history",".vs-focus-actions","@media(max-width:760px)",
  "env(safe-area-inset-bottom","@media(prefers-reduced-motion:reduce)"
]) assert.ok(styles.includes(token),"Missing Focus responsive/accessibility styling: "+token);
assert.ok(pkg.scripts.test.includes("axivestra-focus-mode.test.cjs"),"Focus regression contract must run in npm test.");
console.log("AXIVESTRA Focus environment contracts passed.");
