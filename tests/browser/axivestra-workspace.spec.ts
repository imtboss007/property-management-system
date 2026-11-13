import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

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
  await expect(mobileStage).toHaveAttribute("data-mobile-orbit-layout", "staggered-ellipse");
  await expect(hub.locator(".ax-orbit-core__sphere")).toHaveCSS("animation-name", "none");
  const mobileOuterRing = hub.locator(".ax-orbit-ring--outer");
  await expect(hub.locator("button.ax-orbit-node").first()).toHaveCSS("width", "62px");
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
  await mobileStage.scrollIntoViewIfNeeded();
  await expect(mobileStage).toBeInViewport();
  const mobileTarget = await hub.locator("button.ax-orbit-node").evaluateAll(elements => {
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      const samples = [
        [rect.left + rect.width / 2, rect.top + rect.height / 2],
        [rect.left + 6, rect.top + rect.height / 2],
        [rect.right - 6, rect.top + rect.height / 2],
        [rect.left + rect.width / 2, rect.top + 6],
        [rect.left + rect.width / 2, rect.bottom - 6],
      ];
      for (const [x, y] of samples) {
        const hit = document.elementFromPoint(x, y);
        const actualCard = hit instanceof Element ? hit.closest("button.ax-orbit-node") : null;
        if (actualCard) {
          return { label: actualCard.getAttribute("aria-label"), name: actualCard.querySelector("strong")?.textContent?.trim() };
        }
      }
    }
    return null;
  });
  if (!mobileTarget) {
    const diagnostics = await hub.locator("button.ax-orbit-node").evaluateAll(elements => elements.slice(0, 8).map(element => {
      const rect = element.getBoundingClientRect();
      const samples = [
        [rect.left + rect.width / 2, rect.top + rect.height / 2],
        [rect.left + 6, rect.top + rect.height / 2],
        [rect.right - 6, rect.top + rect.height / 2],
        [rect.left + rect.width / 2, rect.top + 6],
        [rect.left + rect.width / 2, rect.bottom - 6],
      ];
      return {
        label: element.getAttribute("aria-label"),
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
        pointerEvents: getComputedStyle(element).pointerEvents,
        zIndex: getComputedStyle(element).zIndex,
        hits: samples.map(([x, y]) => {
          const hit = document.elementFromPoint(x, y);
          return {
            x, y,
            tag: hit?.tagName || null,
            className: typeof hit?.className === "string" ? hit.className : "",
            label: hit?.getAttribute?.("aria-label") || null,
          };
        }),
      };
    }));
    console.log("[AXIVESTRA MOBILE ORBIT HIT TEST]", JSON.stringify(diagnostics));
  }
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
    "Asset Intelligence", "Workspace Explorer", "Intelligence Hub", "AXIVESTRA Shift",
    "All Properties", "Contacts", "Follow-up Registry", "Client & Deal Hub",
    "Financials", "Documents", "Schedule & Tasks", "Risk & Compliance",
    "Approvals", "WhatsApp Automation"
  ];
  for (const route of routes) {
    await nav.getByRole("button", { name: new RegExp("^" + route) }).click();
    const expectedHeading = route === "Asset Intelligence" ? /Understand assets, capital and exposure/i : new RegExp("^" + route + "$");
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




test("desktop and mobile: all report views independently include or omit contact and group data", async ({ page }, testInfo) => {
  const sample = {
    properties: [{
      id: "qa-sr-settlement-001",
      title: "QA Bengaluru settlement record",
      module: "SR Rate Settlement",
      location: "Bengaluru",
      value: "350000000",
      status: "Active",
      contact: "Primary QA Contact",
      primaryContactId: "qa-primary-contact",
      createdAt: "2026-11-13T09:00:00.000Z",
      nextFollowUpDate: "2026-11-14",
      nextAction: "Confirm settlement terms",
      notes: "Browser-only seeded record; no live data is changed.",
      surveyNumber: "",
      ownershipDetails: "",
      areaValue: "86500",
      areaUnit: "sq ft",
      dimensions: "",
      ratePerUnit: "400000000",
      moduleData: {
        srRate: "400000000",
        marketRatePerUnit: "800000000",
        settlementAmount: "350000000",
        __followUpContactIds: "qa-follow-contact",
        __primaryGroupIds: "qa-primary-group",
        __followUpGroupIds: "qa-follow-group",
        __followUps: JSON.stringify([{
          id: "qa-follow-entry",
          contactIds: ["qa-follow-contact"],
          description: "QA follow-up for Bengaluru settlement",
          amount: "350000000",
          date: "2026-11-14",
          time: "10:30",
          priority: "High",
          status: "Open",
          notes: "Seeded for browser export verification",
          nextAction: "Call contact",
          assignedAt: "2026-11-13T09:00:00.000Z"
        }])
      }
    }],
    contacts: [
      { id: "qa-primary-contact", name: "Primary QA Contact", phone: "9000000001", role: "Owner", notes: "" },
      { id: "qa-follow-contact", name: "Follow-up QA Contact", phone: "9000000002", role: "Broker", notes: "" }
    ],
    groups: [
      { id: "qa-primary-group", jid: "qa-primary-group@g.us", name: "Primary QA Group" },
      { id: "qa-follow-group", jid: "qa-follow-group@g.us", name: "Follow-up QA Group" }
    ]
  };
  await page.addInitScript((seed) => {
    localStorage.setItem("estateflow.properties", JSON.stringify(seed.properties));
    localStorage.setItem("estateflow.contacts", JSON.stringify(seed.contacts));
    localStorage.setItem("estateflow.whatsappGroups", JSON.stringify(seed.groups));
    localStorage.setItem("estateflow.tasks", JSON.stringify([]));
  }, sample);
  await page.goto("/");
  const mobile = (page.viewportSize()?.width || 1440) <= 720;
  const openSection = async (name: string) => {
    if (mobile) await page.getByRole("button", { name: "Open menu" }).click();
    await page.locator(".nav-list").getByRole("button", { name: new RegExp("^" + name) }).click();
  };
  const assertFourOptions = async (labels: string[]) => {
    for (const label of labels) {
      const box = page.getByRole("checkbox", { name: label, exact: true });
      await expect(box).toBeVisible();
      await expect(box).toBeChecked();
    }
  };
  const setFourOptions = async (labels: string[], checked: boolean) => {
    for (const label of labels) {
      const box = page.getByRole("checkbox", { name: label, exact: true });
      if (checked) await box.check(); else await box.uncheck();
      await expect(box).toHaveJSProperty("checked", checked);
    }
  };
  const pdfText = async (label: string) => {
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: label, exact: true }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    const file = await download.path();
    if (!file) throw new Error("The browser did not provide the generated PDF file.");
    return readFileSync(file).toString("latin1");
  };
  const expectIncluded = (content: string) => {
    for (const value of ["Primary QA Contact", "Follow-up QA Contact", "Primary QA Group", "Follow-up QA Group"]) {
      expect(content).toContain(value);
    }
  };
  const pptxText = async (label: string) => {
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: label, exact: true }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toMatch(/\.pptx$/i);
    const file = await download.path();
    if (!file) throw new Error("The browser did not provide the generated PowerPoint file.");
    return readFileSync(file).toString("utf8");
  };
  const expectExcluded = (content: string) => {
    for (const value of ["Primary QA Contact", "Follow-up QA Contact", "Primary QA Group", "Follow-up QA Group"]) {
      expect(content).not.toContain(value);
    }
  };

  const hubOptions = ["Include primary names", "Include follow-up names", "Include primary groups", "Include follow-up groups"];
  await openSection("Intelligence Hub");
  await expect(page.getByRole("heading", { name: "Intelligence Hub" })).toBeVisible();
  await expect(page.locator(".ax-hub-export-summary strong")).toContainText("1 matching records");
  await assertFourOptions(hubOptions);
  expectIncluded(await pdfText("Download PDF"));
  await setFourOptions(hubOptions, false);
  expectExcluded(await pdfText("Download PDF"));
  expectExcluded(await pptxText("Download PPT"));

  const registryOptions = ["Primary names", "Follow-up names", "Primary groups", "Follow-up groups"];
  await openSection("Follow-up Registry");
  await expect(page.getByRole("heading", { name: "Follow-up Registry" })).toBeVisible();
  await assertFourOptions(registryOptions);
  expectIncluded(await pdfText("Download PDF"));
  await setFourOptions(registryOptions, false);
  expectExcluded(await pdfText("Download PDF"));
  expectExcluded(await pptxText("Download PPT"));

  const moduleOptions = ["Primary names", "Follow-up names", "Primary groups", "Follow-up groups"];
  await openSection("All Properties");
  await expect(page.getByRole("heading", { name: "All Properties", level: 2 })).toBeVisible();
  await assertFourOptions(moduleOptions);
  expectIncluded(await pdfText("PDF"));
  await setFourOptions(moduleOptions, false);
  expectExcluded(await pdfText("PDF"));
  expectExcluded(await pptxText("PPT"));
});


test("desktop and mobile: every module formats crores and opens table details, hub dates and linked follow-ups", async ({ page }) => {
  const seededProperties = expectedModules.map((module,index)=>({
    id:"qa-module-"+(index+1),title:"QA "+module+" record",module,location:"Bengaluru",
    value:"40000000",status:"Active",contact:"QA Primary Contact",primaryContactId:"qa-primary",
    createdAt:"2026-11-13T09:00:00.000Z",targetDeadline:"2026-12-01",nextFollowUpDate:"2026-11-14",
    nextAction:"Confirm next step for "+module,notes:"QA-only record for automated browser coverage.",
    surveyNumber:"QA-"+(index+1),ownershipDetails:"QA owner",areaValue:"1200",areaUnit:"sq ft",dimensions:"",
    ratePerUnit:"25000000",
    moduleData:{srRate:"25000000",marketRatePerUnit:"50000000",settlementAmount:"30000000",
      __followUpContactIds:"qa-follow",__primaryGroupIds:"qa-primary-group",__followUpGroupIds:"qa-follow-group",
      __followUps:JSON.stringify([{id:"qa-follow-"+index,contactIds:["qa-follow"],description:"QA appointment · "+module,
        amount:"40000000",date:"2026-11-14",time:"10:30",priority:"High",status:"Open",
        notes:"Automated follow-up note",nextAction:"Call QA contact",assignedAt:"2026-11-13T09:00:00.000Z"}])}
  }));
  const seed={properties:seededProperties,contacts:[
    {id:"qa-primary",name:"QA Primary Contact",phone:"9000000001",role:"Owner",notes:""},
    {id:"qa-follow",name:"QA Follow-up Contact",phone:"9000000002",role:"Broker",notes:""}
  ],groups:[
    {id:"qa-primary-group",jid:"qa-primary-group@g.us",name:"QA Primary Group"},
    {id:"qa-follow-group",jid:"qa-follow-group@g.us",name:"QA Follow-up Group"}
  ]};
  await page.addInitScript((data)=>{
    localStorage.setItem("axivestra.workspaceMode","local");
    localStorage.setItem("estateflow.properties",JSON.stringify(data.properties));
    localStorage.setItem("estateflow.contacts",JSON.stringify(data.contacts));
    localStorage.setItem("estateflow.whatsappGroups",JSON.stringify(data.groups));
    localStorage.setItem("estateflow.tasks",JSON.stringify([]));
  },seed);
  await page.goto("/");
  const mobile=(page.viewportSize()?.width||1440)<=720;
  test.setTimeout(240_000);
  const openSection=async(name:string)=>{
    if(mobile)await page.getByRole("button",{name:"Open menu"}).click();
    if(expectedModules.includes(name)) await page.getByTestId("module-directory-"+name).click();
    else await page.locator(".nav-list").getByRole("button",{name:new RegExp("^"+name)}).click();
  };
  for(const module of expectedModules){
    await openSection(module);
    const workbench=page.locator(".ax-module-workbench");
    await expect(workbench).toBeVisible();
    await workbench.getByRole("tab",{name:/Table/}).click();
    const row=workbench.getByRole("row",{name:new RegExp("QA "+module+" record")});
    await expect(row).toBeVisible();
    await expect(row.getByRole("cell").nth(3)).toContainText("₹4 Cr");
    await expect(row.getByRole("cell").nth(4)).toContainText("₹2.5 Cr");
    await expect(row.getByRole("cell").nth(5)).toContainText("₹5 Cr");
    await expect(row.getByRole("cell").nth(6)).toContainText("₹3 Cr");
    await row.getByRole("button",{name:"View details for QA "+module+" record"}).click();
    const dialog=page.getByRole("dialog",{name:"Record details: QA "+module+" record"});
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("₹4 Cr");
    await expect(dialog).toContainText("Settlement value");
    await expect(dialog).toContainText("QA Primary Group");
    await expect(dialog).toContainText("QA Follow-up Group");
    await expect(dialog).toContainText("QA Follow-up Contact");
    await dialog.getByRole("button",{name:"Close record details"}).click();
    if(module===expectedModules[0] || module===expectedModules[expectedModules.length-1]){
      await row.getByRole("button",{name:"Edit record"}).click();
      const valuationInputs=page.locator(".ax-valuation-fields").getByLabel("Amount in Indian rupees");
      await expect(valuationInputs).toHaveCount(3);
      if(module===expectedModules[0]){
        const amountInputs=page.getByLabel("Amount in Indian rupees");
        await expect(amountInputs.first()).toHaveValue("4");
        await expect(valuationInputs.nth(0)).toHaveValue("2.5");
        await expect(valuationInputs.nth(1)).toHaveValue("5");
        await expect(valuationInputs.nth(2)).toHaveValue("3");
        await expect(page.locator(".ax-valuation-fields").getByLabel("Amount unit").first()).toHaveValue("crore");
      } else {
        await expect(page.locator(".ax-valuation-fields")).toContainText("SR / guidance rate per unit");
        await expect(page.locator(".ax-valuation-fields")).toContainText("Market rate per unit");
        await expect(page.locator(".ax-valuation-fields")).toContainText("Settlement value");
      }
      await page.getByRole("button",{name:"Cancel",exact:true}).click();
    }
  }
  await openSection("Intelligence Hub");
  const dateButton=page.getByTestId("hub-date-open-qa-module-1");
  await expect(dateButton).toBeVisible();
  await dateButton.click();
  const hubDialog=page.getByRole("dialog",{name:"Record details: QA Property Sale record"});
  await expect(hubDialog).toBeVisible();
  await expect(hubDialog).toContainText("QA Primary Contact");
  await expect(hubDialog).toContainText("QA Follow-up Group");
  await expect(hubDialog).toContainText("₹4 Cr");
  await expect(hubDialog).toContainText("QA Follow-up Contact");
  await expect(hubDialog).toContainText("QA appointment · Property Sale");
  await expect(hubDialog).toContainText("10:30");
  await hubDialog.getByRole("button",{name:"Edit date / time and follow-up"}).click();
  await expect(page.getByLabel("Follow-up date *")).toHaveValue("2026-11-14");
  await expect(page.getByLabel("Follow-up time")).toHaveValue("10:30");
  await page.getByRole("button",{name:"Cancel",exact:true}).click();
  await expect(hubDialog).toBeVisible();
  await hubDialog.getByRole("button",{name:"Close record details"}).click();
  await expect(page.getByText("Area / size range")).toBeVisible();
  await expect(page.getByText("SR / guidance rate")).toBeVisible();
  await expect(page.getByText("Market value / rate")).toBeVisible();
  await page.getByRole("checkbox",{name:/Property Sale/}).check();
  await expect(page.getByText("1 matching records")).toBeVisible();
  const primaryGroups=page.locator(".ax-hub-checklist").filter({hasText:"Primary WhatsApp group"});
  const followGroups=page.locator(".ax-hub-checklist").filter({hasText:"Follow-up WhatsApp group"});
  await expect(primaryGroups.getByText("QA Primary Group")).toBeVisible();
  await expect(primaryGroups.getByText("QA Follow-up Group")).toHaveCount(0);
  await expect(followGroups.getByText("QA Follow-up Group")).toBeVisible();
  await expect(followGroups.getByText("QA Primary Group")).toHaveCount(0);
  await page.getByRole("button",{name:"Clear all filters"}).click();
  await expect(page.getByText("16 matching records")).toBeVisible();
  await openSection("Follow-up Registry");
  await expect(page.getByRole("heading",{name:"Follow-up Registry"})).toBeVisible();
  await expect(page.locator(".ax-followup-banner .banner-aside strong")).toContainText("16");
  await expect(page.getByText("QA appointment · Property Sale",{exact:true}).first()).toBeVisible();
  await expect(page.getByText("QA Primary Group").first()).toBeVisible();
  await expect(page.getByText("QA Follow-up Group").first()).toBeVisible();
  await expect(page.getByRole("checkbox",{name:"QA Follow-up Contact · Broker"})).toBeVisible();
  await expect(page.getByRole("checkbox",{name:"QA Primary Contact · Owner"})).toBeVisible();
  await expect(page.getByRole("checkbox",{name:"QA Primary Group"})).toBeVisible();
  await expect(page.getByRole("checkbox",{name:"QA Follow-up Group"})).toBeVisible();
});
