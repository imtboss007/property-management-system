import assert from "node:assert/strict";

let capturedBlob = null;
let clicked = false;
let capturedAnchor = null;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
const originalSetTimeout = globalThis.setTimeout;
const originalDocument = globalThis.document;

try {
  URL.createObjectURL = blob => { capturedBlob = blob; return "blob:axivestra-test"; };
  URL.revokeObjectURL = () => {};
  globalThis.setTimeout = () => 0;
  const anchor = {
    href: "",
    download: "",
    rel: "",
    click() { clicked = true; },
    remove() {}
  };
  capturedAnchor = anchor;
  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, "a");
      return anchor;
    },
    body: { appendChild(node) { assert.equal(node, anchor); } }
  };

  const { downloadIntelligencePptx } = await import("../src/lib/report-export.mjs");
  downloadIntelligencePptx("QA Module", "11-column report", [{
    title: "QA settlement record", module: "Property Sale", location: "Bengaluru",
    value: "Rs 4 Cr", srValue: "Rs 3.5 Cr", marketValueTotal: "Rs 6.5 Cr",
    srRate: "Rs 2.5 Cr", marketRate: "Rs 5 Cr", settlementValue: "Rs 3 Cr",
    area: "1200 sq ft", builtUpSize: "850 sq ft",
    primaryContact: "Primary QA", followUpContact: "Follow-up QA",
    primaryGroup: "Primary group", followUpGroup: "Follow-up group",
    contactSummary: "Primary QA", followUpSummary: "Next date: 2026-11-15",
    detailsSummary: "Status: Active"
  }]);

  assert.equal(clicked, true, "PPTX export must trigger a download");
  assert.match(capturedAnchor.download, /\.pptx$/i);
  assert.ok(capturedBlob instanceof Blob);
  assert.equal(capturedBlob.type, "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  const bytes = Buffer.from(await capturedBlob.arrayBuffer());
  assert.equal(bytes.readUInt32LE(0), 0x04034b50, "PPTX must start with a ZIP local-file header");
  const firstNameLength = bytes.readUInt16LE(26);
  assert.equal(bytes.subarray(30, 30 + firstNameLength).toString("utf8"), "[Content_Types].xml");
  assert.ok(bytes.includes(Buffer.from("ppt/slides/slide1.xml")), "PPTX package must contain its first slide");
  assert.ok(bytes.includes(Buffer.from("SR Value")), "PPTX slide must include the added valuation fields");
  assert.ok(bytes.includes(Buffer.from("Built-up Size")), "PPTX slide must include built-up size");
  process.stdout.write("PowerPoint 11-column export regression tests passed.\n");
} finally {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  globalThis.setTimeout = originalSetTimeout;
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
}
