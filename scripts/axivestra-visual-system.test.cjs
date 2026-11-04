const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src", "App.tsx"), "utf8");
const css = fs.readFileSync(path.join(root, "src", "styles.css"), "utf8");

assert.match(
  app,
  /className=\{company\?\.role === "read_only" \? "app-shell ax-modern-shell workspace-readonly" : "app-shell ax-modern-shell"\}/,
  "The existing app shell must carry the visual-only AXIVESTRA scope class."
);

for (const selector of [
  ".ax-modern-shell {",
  ".ax-modern-shell .sidebar",
  ".ax-modern-shell .topbar",
  ".ax-modern-shell .institutional-banner",
  ".ax-modern-shell .module-card",
  ".ax-modern-shell .form-card"
]) {
  assert.ok(css.includes(selector), `Missing scoped visual rule: ${selector}`);
}

assert.match(css, /@media\s*\(max-width:\s*720px\)/, "The visual layer must retain a mobile layout.");
assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, "The visual layer must respect reduced-motion preferences.");
assert.match(css, /env\(safe-area-inset-bottom/, "Mobile spacing must account for device safe areas.");

console.log("AXIVESTRA visual-system contract passed.");
