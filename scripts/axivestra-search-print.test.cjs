const fs = require("node:fs");
const assert = require("node:assert/strict");
const app = fs.readFileSync("src/App.tsx", "utf8");
const workbench = fs.readFileSync("src/ModuleWorkbench.tsx", "utf8");

assert.match(workbench, /split\(\/\\s\+\//);
assert.match(workbench, /Object\.entries\(record\.moduleData/);
assert.match(workbench, /onPrintRecord\(record\)/);
assert.match(workbench, /Print \/ PDF/);
assert.match(app, /function printSimpleRecord/);
assert.match(app, /document\.createElement\("iframe"\)/);
assert.match(app, /printSimpleRecord\(item\.type\+" transaction"/);
assert.match(app, /printSimpleRecord\("Risk record"/);
assert.match(app, /printSimpleRecord\("Document details"/);
assert.match(app, /printSimpleRecord\("Approval request"/);
assert.match(app, /riskRecords\.filter\(record=>/);
assert.match(app, /documents\.filter\(record=>/);
assert.match(app, /financials\]\.filter\(item=>/);
console.log("AXIVESTRA search and print contracts passed.");
