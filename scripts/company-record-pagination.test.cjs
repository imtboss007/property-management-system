const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const filename = path.join(__dirname, "..", "src", "lib", "company-record-pagination.ts");
const source = fs.readFileSync(filename, "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const compiled = { exports: {} };
vm.runInNewContext(code, { module: compiled, exports: compiled.exports, require }, { filename });
const { fetchAllCompanyRecords } = compiled.exports;

function makeClient(rows, options = {}) {
  const ranges = [];
  const orders = [];
  const filters = [];
  const client = {
    from(table) {
      assert.equal(table, "company_records");
      return {
        select(columns) {
          assert.equal(columns, "record_type,record_key,payload,updated_at,deleted_at");
          return {
            eq(column, value) {
              filters.push([column, value]);
              return this;
            },
            order(column, config) {
              orders.push([column, config?.ascending]);
              return this;
            },
            async range(from, to) {
              ranges.push([from, to]);
              if (options.errorAt === from) return { data: null, error: { message: "synthetic read failure" } };
              return { data: rows.slice(from, to + 1), error: null };
            }
          };
        }
      };
    }
  };
  return { client, ranges, orders, filters };
}

(async () => {
  const rows = Array.from({ length: 1207 }, (_, index) => ({
    record_type: index < 1001 ? "contact" : "property",
    record_key: "record-" + String(index).padStart(4, "0"),
    payload: { id: "record-" + index, index },
    updated_at: new Date(1760000000000 + index).toISOString(),
    deleted_at: null
  }));
  const fixture = makeClient(rows);
  const result = await fetchAllCompanyRecords(fixture.client, "company-abc");

  assert.equal(result.length, 1207, "pagination must load every row beyond the PostgREST first-page cap");
  assert.deepEqual(Array.from(result, row => row.record_key), rows.map(row => row.record_key),
    "pagination must preserve deterministic server page order without duplication or omissions");
  assert.deepEqual(fixture.ranges, [[0, 499], [500, 999], [1000, 1499]],
    "pages must be fetched in bounded, non-overlapping ranges");
  assert.deepEqual(fixture.orders, [
    ["record_type", true], ["record_key", true],
    ["record_type", true], ["record_key", true],
    ["record_type", true], ["record_key", true]
  ], "every page must use stable ordering");
  assert.deepEqual(fixture.filters, [["company_id", "company-abc"]],
    "every page must remain scoped to the requested company");

  const shortPage = makeClient(rows.slice(0, 7));
  const shortResult = await fetchAllCompanyRecords(shortPage.client, "small-company");
  assert.equal(shortResult.length, 7);
  assert.deepEqual(shortPage.ranges, [[0, 499]], "the reader must stop after the first partial page");

  const failing = makeClient(rows, { errorAt: 500 });
  await assert.rejects(
    () => fetchAllCompanyRecords(failing.client, "company-abc"),
    /row 500: synthetic read failure/,
    "a later-page failure must fail the sync instead of returning a partial dataset"
  );

  await assert.rejects(() => fetchAllCompanyRecords(makeClient(rows).client, "company-abc", 0), /between 1 and 1,000/);
  await assert.rejects(() => fetchAllCompanyRecords(makeClient(rows).client, "company-abc", 1001), /between 1 and 1,000/);

  process.stdout.write("Company cloud-record pagination tests passed.\\n");
})().catch(error => {
  process.stderr.write(String(error && error.stack || error) + "\\n");
  process.exitCode = 1;
});
