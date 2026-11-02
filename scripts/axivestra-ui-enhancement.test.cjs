const fs = require("node:fs");
const assert = require("node:assert/strict");

const app = fs.readFileSync("src/App.tsx", "utf8");
const analytics = fs.readFileSync("src/PortfolioAnalytics.tsx", "utf8");
const histogram = fs.readFileSync("src/ThreeDHistogram.tsx", "utf8");
const styles = fs.readFileSync("src/styles.css", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

assert.ok(app.includes("ax-modern-shell"), "The application shell must enable the refreshed design system.");
assert.ok(app.includes('className="ax-mobile-dock"'), "The mobile quick-navigation dock must be mounted.");
for (const label of ["Home", "Assets", "Contacts", "Tasks", "Menu"]) {
  assert.ok(app.includes("<span>" + label + "</span>"), "Missing mobile navigation destination: " + label);
}
assert.ok(analytics.includes('useState<"donut" | "bar" | "line" | "3d">("3d")'), "Portfolio analytics should open in 3D mode.");
assert.ok(analytics.includes("<ThreeDHistogram"), "Portfolio analytics must render the interactive 3D histogram.");
assert.ok(analytics.includes("secondaryValue: row.outflow"), "Cashflow 3D mode must show the outflow as a second series.");
assert.ok(analytics.includes("value: item.value"), "Portfolio histograms must use saved analytics values.");
for (const token of ["role=\"button\"", "onSelect", "secondaryValue", "aria-label", "Perspective view", "floor", "depthX"]) {
  assert.ok(histogram.includes(token), "Missing accessible / interactive 3D histogram capability: " + token);
}
for (const token of [
  ".ax-modern-shell .sidebar", ".ax-modern-shell .topbar", ".ax-modern-shell .institutional-banner",
  ".ax-modern-shell .ax-dashboard-kpi", ".ax-modern-shell .module-card", ".ax-mobile-dock",
  ".ax-3d-histogram-wrap", ".ax-3d-histogram-group", "@media (max-width: 720px)",
  "env(safe-area-inset-bottom", "@media (prefers-reduced-motion: reduce)"
]) {
  assert.ok(styles.includes(token), "Missing responsive / design system styling: " + token);
}
assert.ok(!pkg.dependencies["echarts-gl"] && !pkg.dependencies["three"], "The visual refresh must not add a heavy WebGL runtime dependency.");
assert.ok(pkg.scripts.test.includes("axivestra-ui-enhancement.test.cjs"), "The new UI checks must run in the main regression suite.");

console.log("AXIVESTRA responsive UI, mobile navigation and 3D histogram contracts passed.");
