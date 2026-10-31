import test from "node:test";
import assert from "node:assert/strict";
import { parseIndianAmount, normalizeIndianAmount, formatIndianAmount } from "../src/lib/indian-amount.mjs";

const cases = [
  ["25000", 25000],
  ["25 thousand", 25000],
  ["5 lakh", 500000],
  ["2 crore", 20000000],
  ["₹2.5 crore", 25000000],
  ["1 crore 25 lakh", 12500000],
  ["1 lakh 25 thousand", 125000],
  ["1 crore and 20 lakh", 12000000],
  ["₹1,23,456", 123456],
  ["2cr 50k", 20050000],
  ["1.25 lakh", 125000],
  ["12.75", 12.75],
  ["1,00,000.50", 100000.5]
];

for (const [input, expected] of cases) {
  test(`parses ${input} as INR ${expected}`, () => {
    assert.equal(parseIndianAmount(input), expected);
  });
}

test("normalizes valid shorthand to a plain numeric string for existing records", () => {
  assert.equal(normalizeIndianAmount("5 lakh"), "500000");
  assert.equal(normalizeIndianAmount("2 crore"), "20000000");
  assert.equal(normalizeIndianAmount(""), "");
  assert.equal(normalizeIndianAmount("five lakh"), null);
});

test("rejects invalid, negative and trailing text", () => {
  for (const value of ["", "five lakh", "-5 lakh", "5 lakh approx", "₹", "12..5", "1 crore xyz"]) {
    assert.equal(parseIndianAmount(value), null, value);
  }
});

test("formats INR previews in Indian digit grouping", () => {
  assert.equal(formatIndianAmount("5 lakh"), "₹5,00,000");
  assert.equal(formatIndianAmount("2 crore"), "₹2,00,00,000");
});
