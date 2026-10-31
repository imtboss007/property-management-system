import test from "node:test";
import assert from "node:assert/strict";
import worker, { workerInternals } from "../src/index.js";

test("normalizes phone digits without inventing country codes", () => {
  assert.equal(workerInternals.digits("+91 (98765) 43210"), "919876543210");
  assert.equal(workerInternals.digits("001-202-555-0100"), "0012025550100");
  assert.equal(workerInternals.digits(null), "");
});

test("constant-time comparator rejects unequal values", () => {
  assert.equal(workerInternals.equalConstantTime("same", "same"), true);
  assert.equal(workerInternals.equalConstantTime("same", "diff"), false);
  assert.equal(workerInternals.equalConstantTime("same", "same-long"), false);
});

test("uses only supported Graph API version format", () => {
  assert.equal(workerInternals.graphVersion({ META_GRAPH_API_VERSION: "v26.0" }), "v26.0");
  assert.equal(workerInternals.graphVersion({ META_GRAPH_API_VERSION: "unstable" }), "v26.0");
});

test("health endpoint is available without any secrets and never mutates resources", async () => {
  const response = await worker.fetch(new Request("https://worker.example/health"), {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.service, "AXIVESTRA WhatsApp Worker");
});

test("status endpoint refuses unauthenticated requests before contacting Meta", async () => {
  const response = await worker.fetch(new Request("https://worker.example/status", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId: "00000000-0000-4000-8000-000000000000" })
  }), { SUPABASE_URL: "https://project.supabase.co", SUPABASE_ANON_KEY: "public-key" });
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.match(body.error, /Sign in to AXIVESTRA/);
});

test("dispatch endpoint rejects an incorrect scheduler secret", async () => {
  const response = await worker.fetch(new Request("https://worker.example/dispatch", {
    method: "POST", headers: { "x-axivestra-scheduler-secret": "incorrect" }
  }), { AXIVESTRA_SCHEDULER_SECRET: "correct-secret-with-at-least-32-characters" });
  assert.equal(response.status, 401);
});
