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

test("desktop: all 16 workspaces, detail panels, view controls, filters and orbital motion", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop-only orbital interaction checks.");
  await openExplorer(page);
  const hub = page.getByRole("region", { name: "AXIVESTRA orbital workspace navigation" });
  await hub.getByRole("button", { name: "Pause rotation" }).click();
  const nodes = hub.locator("button.ax-orbit-node");
  await expect(nodes).toHaveCount(16);
  await expect(hub.locator(".ax-orbit-telemetry")).toBeVisible();
  await expect(hub.locator(".ax-orbit-telemetry__metric").first()).toContainText("16");
  await expect(hub.locator(".ax-orbit-constellation")).toBeVisible();
  await expect(hub.locator(".ax-orbit-atmosphere .ax-orbit-beacon")).toHaveCount(4);
  await expect(hub.locator(".ax-orbit-ring")).toHaveCount(1);
  await expect(hub.locator('.ax-orbit-node-slot[data-module-shell="outer"]')).toHaveCount(8);
  await expect(hub.locator('.ax-orbit-node-slot[data-module-shell="inner"]')).toHaveCount(8);
  const stage = hub.locator(".ax-orbit-stage");
  await expect(stage).toHaveAttribute("data-orbit-dimensionality", "3d");
  await expect(stage).toHaveCSS("perspective", "1250px");
  await expect(hub.locator(".ax-orbit-core__sphere")).toHaveCSS("animation-name", "none");
  await expect(hub.locator(".ax-orbit-ring--outer")).toHaveCSS("transform-style", "preserve-3d");
  await expect(hub.locator(".ax-orbit-node-slot").nth(2)).toHaveCSS("transform", /matrix3d/);
  const stageBox = await stage.boundingBox();
  const nodeBoxes = await nodes.evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  }));
  expect(stageBox).not.toBeNull();
  for (const rect of nodeBoxes) {
    expect(rect.left).toBeGreaterThanOrEqual(stageBox!.x - 1);
    expect(rect.right).toBeLessThanOrEqual(stageBox!.x + stageBox!.width + 1);
    expect(rect.top).toBeGreaterThanOrEqual(stageBox!.y - 1);
    expect(rect.bottom).toBeLessThanOrEqual(stageBox!.y + stageBox!.height + 1);
  }
  await expect(hub.locator(".ax-orbit-core__sphere")).toHaveCSS("animation-name", "none");
  await expect(hub.locator(".ax-orbit-core__surface")).toHaveCSS("animation-name", "ax-orbit-core-surface-spin");
  await stage.evaluate(element => element.scrollIntoView({ block: "center", inline: "center" }));
  const desktopTarget = await nodes.evaluateAll(elements => {
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      if (hit === element || element.contains(hit)) {
        return { label: element.getAttribute("aria-label"), name: element.querySelector("strong")?.textContent?.trim() };
      }
    }
    return null;
  });
  expect(desktopTarget).not.toBeNull();
  await hub.getByRole("button", { name: desktopTarget!.label! }).click({ force: true });
  await expect(page.getByRole("heading", { name: desktopTarget!.name!, level: 1 })).toBeVisible();
  await page.locator(".nav-list").getByRole("button", { name: "Workspace Explorer" }).click();
  await expect(hub).toBeVisible();

  await hub.getByRole("button", { name: "Grid", exact: true }).click();
  await expect(hub).toHaveClass(/is-grid-view/);
  for (const name of expectedModules) {
    const node = hub.getByRole("button", { name: "Inspect " + name + " details" });
    await expect(node).toBeVisible();
    await node.click({ force: true });
    await expect(node).toHaveAttribute("aria-pressed", "true");
    await expect(hub.getByRole("region", { name: name + " module details" })).toBeVisible();
    await hub.getByRole("button", { name: "Close module details" }).click();
  }

  await hub.getByRole("button", { name: "Orbit", exact: true }).click();
  await expect(hub).toHaveClass(/is-orbit-view/);

  await hub.getByRole("button", { name: "Resume rotation" }).click();
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

test("mobile: explorer and all workspaces remain usable in responsive layout", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile-only responsive checks.");
  await page.setViewportSize({ width: 390, height: 844 });
  await openExplorer(page);
  const hub = page.getByRole("region", { name: "AXIVESTRA orbital workspace navigation" });
  await expect(hub.locator("button.ax-orbit-node")).toHaveCount(16);
  await expect(hub.locator(".ax-orbit-telemetry")).toBeVisible();
  await expect(hub.locator(".ax-orbit-telemetry__metric").first()).toContainText("16");
  await expect(hub.locator(".ax-orbit-constellation")).toBeVisible();
  await expect(hub.locator(".ax-orbit-atmosphere .ax-orbit-beacon")).toHaveCount(4);
  await expect(hub.locator(".ax-orbit-ring")).toHaveCount(1);
  await expect(hub.locator('.ax-orbit-node-slot[data-module-shell="outer"]')).toHaveCount(8);
  await expect(hub.locator('.ax-orbit-node-slot[data-module-shell="inner"]')).toHaveCount(8);
  const mobileStage = hub.locator(".ax-orbit-stage");
  await expect(mobileStage).toHaveAttribute("data-orbit-dimensionality", "3d");
  await expect(hub.locator(".ax-orbit-core__sphere")).toHaveCSS("animation-name", "none");
  const mobileOuterRing = hub.locator(".ax-orbit-ring--outer");
  await expect(hub.locator("button.ax-orbit-node").first()).toHaveCSS("width", "58px");
  await expect(mobileOuterRing).toHaveCSS("animation-name", "ax-orbit-node-orbit");
  await expect(mobileOuterRing).toHaveCSS("transform-style", "preserve-3d");
  await expect(hub.getByRole("button", { name: "Pause rotation" })).toBeVisible();
  await hub.getByRole("button", { name: "Pause rotation" }).click();
  await expect(mobileOuterRing).toHaveCSS("animation-play-state", "paused");
  await hub.getByRole("button", { name: "Resume rotation" }).click();
  await expect(mobileOuterRing).toHaveCSS("animation-play-state", "running");
  await expect(hub.locator(".ax-orbit-node-slot").nth(2)).toHaveCSS("transform", /matrix3d/);
  const mobileStageBox = await mobileStage.boundingBox();
  const mobileNodeBoxes = await hub.locator("button.ax-orbit-node").evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  }));
  expect(mobileStageBox).not.toBeNull();
  for (const rect of mobileNodeBoxes) {
    expect(rect.left).toBeGreaterThanOrEqual(mobileStageBox!.x - 1);
    expect(rect.right).toBeLessThanOrEqual(mobileStageBox!.x + mobileStageBox!.width + 1);
    expect(rect.top).toBeGreaterThanOrEqual(mobileStageBox!.y - 1);
    expect(rect.bottom).toBeLessThanOrEqual(mobileStageBox!.y + mobileStageBox!.height + 1);
  }
  await expect(hub.locator(".ax-orbit-core__sphere")).toHaveCSS("animation-name", "none");
  await expect(hub.locator(".ax-orbit-core__surface")).toHaveCSS("animation-name", "ax-orbit-core-surface-spin");
  await mobileStage.evaluate(element => element.scrollIntoView({ block: "center", inline: "center" }));
  const mobileTarget = await hub.locator("button.ax-orbit-node").evaluateAll(elements => {
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      if (hit === element || element.contains(hit)) {
        return { label: element.getAttribute("aria-label"), name: element.querySelector("strong")?.textContent?.trim() };
      }
    }
    return null;
  });
  expect(mobileTarget).not.toBeNull();
  await hub.getByRole("button", { name: mobileTarget!.label! }).click({ force: true });
  await expect(page.getByRole("heading", { name: mobileTarget!.name!, level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByText("Workspace Explorer", { exact: true }).first().click();
  await expect(hub).toBeVisible();
  await hub.getByRole("button", { name: "Grid", exact: true }).click();
  await expect(hub).toHaveClass(/is-grid-view/);
  for (const name of expectedModules) {
    const node = hub.getByRole("button", { name: "Inspect " + name + " details" });
    await expect(node).toBeVisible();
    await node.click({ force: true });
    await expect(hub.getByRole("region", { name: name + " module details" })).toBeVisible();
    await hub.getByRole("button", { name: "Close module details" }).click();
  }
  const search = hub.getByRole("searchbox", { name: "Search workspaces or groups" });
  await search.fill("Litigation");
  await expect(hub.locator("button.ax-orbit-node")).toHaveCount(1);
  await search.fill("");
  await hub.getByRole("button", { name: "Credit & Lending", exact: false }).click();
  await expect(hub.locator("button.ax-orbit-node")).toHaveCount(3);
  await hub.getByRole("button", { name: "All groups" }).click();
  await expect(hub.locator("button.ax-orbit-node")).toHaveCount(16);
  const horizontalOverflow = await page.evaluate(() =>
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
});

test("desktop: all primary workspaces are reachable from navigation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Primary route sweep runs on desktop only.");
  await page.goto("/");
  const nav = page.locator(".nav-list");
  const routes = [
    "Overview", "Workspace Explorer", "Intelligence Hub", "AXIVESTRA Shift",
    "All Properties", "Contacts", "Follow-up Registry", "Client & Deal Hub",
    "Financials", "Documents", "Schedule & Tasks", "Risk & Compliance",
    "Approvals", "WhatsApp Automation"
  ];
  for (const route of routes) {
    await nav.getByRole("button", { name: new RegExp("^" + route) }).click();
    const expectedHeading = route === "Overview" ? /Understand assets, capital and exposure/i : new RegExp("^" + route + "$");
    await expect(page.getByRole("heading", { name: expectedHeading }).first()).toBeVisible();
    await expect(nav.getByRole("button", { name: new RegExp("^" + route) })).toHaveClass(/active/);
  }
});

test("desktop: Explorer quick links open the linked operational views", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Explorer shortcut checks run on desktop only.");
  await openExplorer(page);
  let hub = page.getByRole("region", { name: "AXIVESTRA orbital workspace navigation" });
  await hub.getByRole("button", { name: "AXIVESTRA Shift", exact: true }).click();
  await expect(page.getByRole("heading", { name: "AXIVESTRA Shift" })).toBeVisible();
  await page.locator(".nav-list").getByRole("button", { name: "Workspace Explorer" }).click();
  hub = page.getByRole("region", { name: "AXIVESTRA orbital workspace navigation" });
  await hub.getByRole("button", { name: "Open all records" }).click();
  await expect(page.getByRole("heading", { name: "All Properties", level: 1 })).toBeVisible();
});
