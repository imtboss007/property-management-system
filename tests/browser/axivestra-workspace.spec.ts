import { test, expect } from "@playwright/test";

const expectedModules = [
  "Property Sale",
  "Property Loans",
  "JV / JDA / JD",
  "SR Rate Settlement",
  "Agricultural Land",
  "Commercial Land",
  "Startup",
  "Equity",
  "Unsecured Company Loan",
  "Personal Loan",
  "Housing Loan",
  "House Purchase",
  "Litigation",
  "Fund & Portfolio Management",
  "Investor Relations",
  "Compliance & KYC"
];

async function openExplorer(page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Understand assets, capital and exposure/i })).toBeVisible();
  if ((page.viewportSize()?.width || 1440) <= 720) await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByText("Workspace Explorer", { exact: true }).first().click();
  await expect(page.getByRole("region", { name: "AXIVESTRA orbital workspace navigation" })).toBeVisible();
}

test("desktop: all 16 workspaces, detail panels, view controls, filters and orbital motion", async ({ page }) => {
  await openExplorer(page);
  const hub = page.getByRole("region", { name: "AXIVESTRA orbital workspace navigation" });
  const nodes = hub.locator("button.ax-orbit-node");
  await expect(nodes).toHaveCount(16);

  for (const name of expectedModules) {
    const node = hub.getByRole("button", { name: new RegExp("^Open " + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ",") });
    await expect(node).toBeVisible();
    await node.click();
    await expect(node).toHaveAttribute("aria-pressed", "true");
    await expect(hub.getByRole("region", { name: name + " module details" })).toBeVisible();
    await hub.getByRole("button", { name: "Close module details" }).click();
  }

  await hub.getByRole("button", { name: "Grid", exact: true }).click();
  await expect(hub).toHaveClass(/is-grid-view/);
  await hub.getByRole("button", { name: "Orbit", exact: true }).click();
  await expect(hub).toHaveClass(/is-orbit-view/);

  const outerRing = hub.locator(".ax-orbit-ring--outer");
  await expect(outerRing).toHaveCSS("animation-name", "ax-orbit-node-orbit");
  await hub.getByRole("button", { name: "Pause rotation" }).click();
  await expect(hub).toHaveClass(/is-rotation-paused/);
  await expect(outerRing).toHaveCSS("animation-play-state", "paused");
  await hub.getByRole("button", { name: "Resume rotation" }).click();
  await expect(outerRing).toHaveCSS("animation-play-state", "running");

  await expect(hub.locator("svg.ax-orbit-routes path.ax-orbit-spoke").first()).toBeVisible();
  await expect(hub.locator("svg.ax-orbit-routes path.ax-orbit-route-path").first()).toHaveAttribute("d", /M/);

  const search = hub.getByRole("searchbox", { name: "Search workspaces or groups" });
  await search.fill("Litigation");
  await expect(nodes).toHaveCount(1);
  await expect(hub.getByRole("button", { name: /Open Litigation,/ })).toBeVisible();
  await search.fill("");
  await hub.getByRole("button", { name: /Credit\s*&\s*Lending/ }).click();
  await expect(nodes).toHaveCount(3);
  await hub.getByRole("button", { name: "All groups" }).click();
  await expect(nodes).toHaveCount(16);

  await page.getByText("Intelligence Hub", { exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Intelligence Hub" })).toBeVisible();
});

test("mobile: explorer and all workspaces remain usable in responsive layout", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openExplorer(page);
  const hub = page.getByRole("region", { name: "AXIVESTRA orbital workspace navigation" });
  await expect(hub.locator("button.ax-orbit-node")).toHaveCount(16);
  await expect(hub.getByRole("button", { name: "Pause rotation" })).toHaveCount(0);
  await hub.getByRole("button", { name: "Grid", exact: true }).click();
  await expect(hub).toHaveClass(/is-grid-view/);
  const target = hub.getByRole("button", { name: /^Open Property Sale,/ });
  await target.click();
  await expect(hub.getByRole("region", { name: "Property Sale module details" })).toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});
