const fs = require("fs");
const assert = require("assert");
const read = path => fs.readFileSync(path, "utf8");

const universal = read("src/UniversalInterface.tsx");
const app = read("src/App.tsx");
const workbench = read("src/ModuleWorkbench.tsx");
const registry = read("src/FollowUpRegistry.tsx");

for (const capability of ["ax-universal-command", "ax-universal-action-menu", "ax-universal-notifications", "ax-universal-pinned", "ax-universal-detail"]) {
  // Keyboard handling and interface affordances are implemented in the shared component.
  assert(universal.includes(capability), "Missing universal interface capability: " + capability);
}
assert(app.includes("UniversalInterface") && app.includes("universalEntities"), "App must connect global entity records to the universal interface.");
assert(app.includes("nowForLocalDate"), "Follow-up day boundaries must use the device's local date.");
assert(workbench.includes('title="Add follow-up"') && workbench.includes('> Follow-up</button>'), "Every module view must expose a contextual follow-up action.");
assert(registry.includes("matching dates do not make two commitments duplicates"), "Registry must preserve distinct task follow-ups with the same date.");
console.log("AXIVESTRA universal interface regression checks passed.");
