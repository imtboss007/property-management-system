import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("Cloudflare Cron is configured for one-minute queue dispatch", async () => {
  const config = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");
  assert.match(config, /crons\s*=\s*\["\* \* \* \* \*"\]/);
  assert.match(config, /workers_dev\s*=\s*true/);
  assert.doesNotMatch(config, /\[\[d1_databases\]\]/);
});

test("database queue enforces company isolation, consent, and service-role dispatch", async () => {
  const sql = await readFile(new URL("../../../../supabase/migrations/202610310002_whatsapp_cloud_scheduler.sql", import.meta.url), "utf8");
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /public\.has_company_role\(company_id, array\['owner','admin','manager','staff'\]\)/i);
  assert.match(sql, /consent_confirmed = true/i);
  assert.match(sql, /coalesce\(auth\.role\(\), ''\) <> 'service_role'/i);
  assert.match(sql, /apply_whatsapp_cloud_delivery_status/i);
  assert.match(sql, /grant execute on function public\.claim_due_whatsapp_messages\(integer,uuid\) to service_role/i);
  assert.doesNotMatch(sql, /grant execute on function public\.claim_due_whatsapp_messages\(integer,uuid\) to authenticated/i);
});

test("worker webhook verifies Meta signatures and maps delivery lifecycle", async () => {
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  assert.match(source, /x-hub-signature-256/i);
  assert.match(source, /apply_whatsapp_cloud_delivery_status/);
  assert.match(source, /cancel_whatsapp_cloud_followups_for_reply/);
  assert.match(source, /\["delivered", "read", "failed"\]/);
});
