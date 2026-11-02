import assert from "node:assert/strict";
import { buildPdfFilenameBase } from "../src/lib/pdf-filename.mjs";
import { applyPdfIdentityPrivacy } from "../src/lib/pdf-privacy.mjs";

const base = { reportLabel:"Property Loans", name:"Mohan Kumar", number:"SR-123/45" };
assert.equal(buildPdfFilenameBase({...base,mode:"name-only"}),"AXIVESTRA-Property-Loans-Mohan-Kumar");
assert.equal(buildPdfFilenameBase({...base,mode:"number-only"}),"AXIVESTRA-Property-Loans-SR-123-45");
assert.equal(buildPdfFilenameBase({...base,mode:"name-number"}),"AXIVESTRA-Property-Loans-Mohan-Kumar-SR-123-45");
assert.equal(buildPdfFilenameBase({...base,mode:"neither"}),"AXIVESTRA-Property-Loans");
assert.equal(buildPdfFilenameBase({reportLabel:"Follow-up Register",name:"",number:"",mode:"name-number"}),"AXIVESTRA-Follow-up-Register");
assert.doesNotMatch(buildPdfFilenameBase({...base,mode:"name-only"}),/SR-123/);
assert.doesNotMatch(buildPdfFilenameBase({...base,mode:"number-only"}),/Mohan/);

const html = "<p>Mohan Kumar · +91 9876543210</p>";
const contacts = [{name:"Mohan Kumar",phone:"+91 9876543210"}];
assert.equal(applyPdfIdentityPrivacy(html,contacts,"name-number"),html);
assert.ok(!applyPdfIdentityPrivacy(html,contacts,"name-only").includes("+91 9876543210"));
assert.ok(applyPdfIdentityPrivacy(html,contacts,"name-only").includes("Mohan Kumar"));
assert.ok(!applyPdfIdentityPrivacy(html,contacts,"number-only").includes("Mohan Kumar"));
assert.ok(applyPdfIdentityPrivacy(html,contacts,"number-only").includes("+91 9876543210"));
const blank = applyPdfIdentityPrivacy(html,contacts,"blank");
assert.ok(!blank.includes("Mohan Kumar") && !blank.includes("+91 9876543210"));
console.log("AXIVESTRA PDF privacy and four-way filename options passed.");
