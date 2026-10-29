const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const sourcePath = path.join(__dirname, "..", "src", "lib", "property-range-search.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const moduleObject = { exports: {} };
vm.runInNewContext(compiled, { module: moduleObject, exports: moduleObject.exports, require }, { filename: sourcePath });
const {
  parsePropertyRangeQuery,
  parsePropertyRangeQueries,
  propertyMatchesRange,
  getPropertyAreaInSquareFeet
} = moduleObject.exports;

const money = parsePropertyRangeQuery("1cr to 5cr");
assert.equal(money.kind, "price");
assert.equal(money.min, 10_000_000);
assert.equal(money.max, 50_000_000);

const combined = parsePropertyRangeQueries("1cr to 5cr and 400 sqft to 800 sqft");
assert.equal(combined.length, 2, "combined value and area constraints should both be parsed");
assert.equal(combined[0].kind, "price");
assert.equal(combined[1].kind, "area");
assert.equal(combined[1].min, 400);
assert.equal(combined[1].max, 800);

const rupeesAndArea = parsePropertyRangeQueries("₹1 crore to ₹5 crore, 100 sq m to 500 sq m");
assert.equal(rupeesAndArea.length, 2);
assert.equal(rupeesAndArea[0].kind, "price");
assert.equal(rupeesAndArea[1].kind, "area");
assert.ok(Math.abs(rupeesAndArea[1].min - 1076.39104167) < 0.001);
assert.ok(Math.abs(rupeesAndArea[1].max - 5381.95520835) < 0.001);

const acresAndGuntas = parsePropertyRangeQuery("1 acre to 10 guntas");
assert.equal(acresAndGuntas.kind, "area");
assert.equal(acresAndGuntas.min, 10 * 1089);
assert.equal(acresAndGuntas.max, 43560);

const lakhRange = parsePropertyRangeQuery("25 lakh to 75 lakhs");
assert.equal(lakhRange.kind, "price");
assert.equal(lakhRange.min, 2_500_000);
assert.equal(lakhRange.max, 7_500_000);

const record = { value: "₹2.5 crore", areaValue: "600", areaUnit: "sq ft", moduleData: {} };
assert.equal(propertyMatchesRange(record, combined[0]), true);
assert.equal(propertyMatchesRange(record, combined[1]), true);
assert.equal(getPropertyAreaInSquareFeet(record), 600);
assert.equal(propertyMatchesRange({ ...record, value: "₹6 crore" }, combined[0]), false);
assert.equal(propertyMatchesRange({ ...record, areaValue: "900" }, combined[1]), false);
assert.equal(propertyMatchesRange({ value: "₹2 crore", areaValue: "", areaUnit: "sq ft" }, combined[1]), false);

const acreageRecord = { value: "20000000", areaValue: "1.5", areaUnit: "acre", moduleData: {} };
assert.equal(propertyMatchesRange(acreageRecord, combined[0]), true);
assert.equal(propertyMatchesRange(acreageRecord, combined[1]), false);

assert.equal(parsePropertyRangeQuery("400 to 800"), null, "unit-free ambiguous ranges must not trigger numeric range mode");
assert.equal(parsePropertyRangeQueries("1cr to 5cr and 1 crore to 5 crore").length, 1, "duplicate semantic ranges should be de-duplicated");

process.stdout.write("Property range search: all 18 assertions passed.\n");
