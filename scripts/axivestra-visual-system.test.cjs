const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src", "App.tsx"), "utf8");
const css = fs.readFileSync(path.join(root, "src", "styles.css"), "utf8");
const orbit = fs.readFileSync(path.join(root, "src", "AxivestraOrbitalHub.tsx"), "utf8");

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



assert.match(app, /import AxivestraOrbitalHub from "\.\/AxivestraOrbitalHub"/, "The existing application must load the orbital workspace component.");
assert.match(app, /<AxivestraOrbitalHub[\s\S]*?onOpen=\{name => go\(name\)\}/, "The orbital nodes must open the existing workspace navigation.");
assert.match(orbit, /aria-label="AXIVESTRA orbital workspace navigation"/, "The orbital navigation must have an accessible landmark.");
assert.match(orbit, /items\.map\(/, "The orbital navigation must render the supplied workspaces.");
assert.match(orbit, /onClick=\{\(\) => onOpen\(item\.name\)\}/, "Each orbital node must navigate to its existing workspace.");
assert.match(orbit, /totalRecords|portfolioValue|openActions/, "The central command panel must use live workspace metrics.");
assert.match(css, /\.ax-orbit-core__sphere/, "The command hub must include its central 3D sphere.");
assert.match(css, /\.ax-orbit-track--outer/, "The command hub must render orbital tracks.");
assert.match(css, /\.ax-orbit-node/, "The command hub must style interactive module nodes.");
assert.match(css, /@media\s*\(max-width:\s*720px\)[\s\S]*?\.ax-orbit-nodes/, "Orbital navigation must reflow to a mobile-friendly grid.");
assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.ax-orbit-core__sphere/, "Orbital animation must respect reduced-motion preferences.");

console.log("AXIVESTRA visual-system contract passed.");
