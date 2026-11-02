const fs = require("node:fs");
const assert = require("node:assert/strict");

const app = fs.readFileSync("src/App.tsx", "utf8");
const commandCenter = fs.readFileSync("src/WorkspaceCommandCenter.tsx", "utf8");
const styles = fs.readFileSync("src/styles.css", "utf8");
const localDb = fs.readFileSync("src/lib/local-db.ts", "utf8");

for (const token of [
  'name: "Activity History"', "undoHistory", "suppressAuditRef",
  "undoLastChange", "beforeRecord", "WorkspaceCommandCenter",
  "openWorkspaceResult", "quickCreate", 'name: "Record Follow-up Tracker"', "RecordFollowUpTracker", "updateRecordFollowUpEntry", "followUpEntries"
]) assert.ok(app.includes(token), "Missing app integration: " + token);

for (const token of [
  "Universal search", "Search results", "onSearchChange", "properties",
  "contacts", "tasks", "financials", "documents", "risks", "approvals",
  "groups", "Reminders", "Overdue and next 7 days", "Quick add",
  "Welcome to AXIVESTRA", "Ctrl K", "onOpenHistory"
]) assert.ok(commandCenter.includes(token), "Missing workspace capability: " + token);

for (const token of [
  ".ax-universal-search", ".ax-search-results", ".ax-reminder-menu",
  ".ax-quick-menu", ".ax-help-menu", ".ax-onboarding-card",
  ".ax-history-page", "@media(max-width:780px)", "@media(max-width:520px)"
]) assert.ok(styles.includes(token), "Missing responsive workspace styling: " + token);

assert.ok(app.includes('saveWorkspaceState("undo-history"'), "Undo snapshots must persist in IndexedDB");
const tracker = fs.readFileSync("src/RecordFollowUpTracker.tsx", "utf8");
const trackerHelper = fs.readFileSync("src/lib/record-follow-up.ts", "utf8");
for (const token of ["Record name", "Follow person", "Follow-up date", "Follow-up time", "Remarks", "Next follow-up date", "Next follow-up time", "Download table (CSV)", "Add another follow-up"]) assert.ok(tracker.includes(token), "Missing record follow-up tracker capability: " + token);
for (const token of ["followPersonId", "upsertRecordFollowUp", "removeRecordFollowUp", "buildRecordFollowUpCsv"]) assert.ok(trackerHelper.includes(token), "Missing record follow-up persistence/export contract: " + token);
assert.ok(localDb.includes('key: "workspace:" + key'), "Workspace state must use its own IndexedDB key prefix");
assert.ok(app.includes("setUndoHistory(current => current.slice(1))"), "Undo must consume a single history entry");
assert.ok(!app.includes('localStorage.clear('), "Workspace upgrades must not clear browser storage");
console.log("AXIVESTRA workspace enhancement contracts passed.");
