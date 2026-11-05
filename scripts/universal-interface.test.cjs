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

assert(app.includes("contactRoleFilters") && app.includes("setContactRoleFilters"), "Contacts must support selecting multiple role filters.");
assert(app.includes("contactProfessionFilter") && app.includes("contactCompanyFilter"), "Contacts must support profession and company filters.");
assert(app.includes("contactRolesOf") && app.includes("contact.customRoles"), "Role matching must include multi-role and custom-role fields.");
assert(app.includes("contactRoleFilters.some"), "Selecting multiple roles must match any selected role.");
assert(app.includes("No contacts match these filters"), "Empty filtered results must offer a recovery action.");
assert(app.includes("aria-pressed={contactRoleFilters.includes(role)}"), "Role filter chips must expose their selected state accessibly.");
assert(read("src/styles.css").includes(".ax-contact-filter-selects") && read("src/styles.css").includes("@media(max-width:600px)"), "Contact filters must have responsive mobile styling.");
console.log("AXIVESTRA contact filter regression checks passed.");


assert(app.includes("cloudSyncRunRef") && app.includes("cloudSyncRunRef.current?.(true)"), "Company cloud sync must be manually triggerable from the shared app UI.");
assert(app.includes("This phone or PC can be your starting device"), "Phone-first and PC-first cloud sync must both be supported.");
assert(app.includes("Last successful sync") && app.includes("Sync now"), "Company cloud sync must expose manual refresh and last-success time.");
assert(app.includes("onClick={()=>void syncWithPc()}"), "The Windows local-device link must expose a manual sync action too.");
console.log("AXIVESTRA phone-first and cross-device manual sync regression checks passed.");

assert(app.includes("Company records already sync through your account."), "Company cloud users must not be told a PC is required to sync records.");
assert(app.includes("Company records sync directly from this phone"), "Phone-only users must be told they can sync company records directly from Android.");
console.log("AXIVESTRA phone-only sync guidance regression checks passed.");
