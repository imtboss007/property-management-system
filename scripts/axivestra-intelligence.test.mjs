import assert from "node:assert/strict";
import { extractWhatsAppCommitment } from "../src/lib/whatsapp-message-intelligence.mjs";
import { applyPdfIdentityPrivacy } from "../src/lib/pdf-privacy.mjs";

const extracted=extractWhatsAppCommitment("I will pay ₹10 lakh tomorrow at 4 PM.", "2026-11-02");
assert.equal(extracted.amount,"1000000");
assert.equal(extracted.promisedDate,"2026-11-03");
assert.equal(extracted.promisedTime,"16:00");
assert.equal(extracted.responseType,"WhatsApp");

const weekday=extractWhatsAppCommitment("I can transfer 2.5 cr next Friday at 11:30 am.", "2026-11-02");
assert.equal(weekday.amount,"25000000");
assert.equal(weekday.promisedDate,"2026-11-06");
assert.equal(weekday.promisedTime,"11:30");

const contacts=[{name:"Asha Rao",phone:"+91 98765 43210"}];
const html="<p>Asha Rao · +91 98765 43210 · ₹10,00,000</p>";
assert.equal(applyPdfIdentityPrivacy(html,contacts,"name-number"),html);
const nameOnly=applyPdfIdentityPrivacy(html,contacts,"name-only");
assert.ok(nameOnly.includes("Asha Rao"));
assert.ok(!nameOnly.includes("+91 98765 43210"));
const blank=applyPdfIdentityPrivacy(html,contacts,"blank");
assert.ok(!blank.includes("Asha Rao"));
assert.ok(!blank.includes("+91 98765 43210"));
assert.ok(blank.includes("₹10,00,000"),"Privacy export must preserve transaction values.");
console.log("AXIVESTRA WhatsApp commitment extraction and PDF identity privacy tests passed.");

import fs from "node:fs";
const app=fs.readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
const hub=fs.readFileSync(new URL("../src/IntelligenceHub.tsx",import.meta.url),"utf8");
for (const token of ["Intelligence Hub","createFollowUpFromWhatsApp","applyPdfIdentityPrivacy","pendingPdfExport","Name + Number","Name only","Blank — hide name and number"])
  assert.ok(app.includes(token), "Missing App integration: "+token);
for (const token of ["DEAL COPILOT","WHATSAPP → AXIVESTRA","Review before saving","onCreateFollowUp","Nothing is changed automatically"])
  assert.ok(hub.includes(token), "Missing Intelligence Hub workflow: "+token);
