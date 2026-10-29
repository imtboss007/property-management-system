"use strict";

const assert = require("node:assert/strict");
const { normalizeDigits } = require("../electron/whatsapp-service.cjs");

const cases = [
  ["+91 (98765) 43210", "919876543210"],
  ["919876543210", "919876543210"],
  ["98765-43210", "9876543210"],
  ["No phone number", ""],
  ["+1 202-555-0109", "12025550109"],
  ["  0044 20 7946 0958  ", "00442079460958"]
];

for (const [input, expected] of cases) {
  assert.equal(normalizeDigits(input), expected, `normalizeDigits(${JSON.stringify(input)})`);
}

process.stdout.write(`WhatsApp contact normalisation tests passed (${cases.length} cases).\\n`);
