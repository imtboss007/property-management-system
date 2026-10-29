import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig, safeConfigSummary } from "../src/config.js";

function env(provider = "baileys") {
  return {
    NODE_ENV: "test",
    HOST: "127.0.0.1",
    PORT: "47822",
    ESTATEFLOW_GATEWAY_PROVIDER: provider,
    ESTATEFLOW_BRIDGE_TOKEN: "a".repeat(40),
    ESTATEFLOW_WEBHOOK_TOKEN: "b".repeat(40),
    MAX_DAILY_SENDS: "60",
    SEND_COOLDOWN_MS: "12000",
    REQUEST_TIMEOUT_MS: "10000"
  };
}

test("supports a standalone Baileys cloud sender without a second gateway", () => {
  const config = loadConfig(env());
  assert.equal(config.provider, "baileys");
  assert.match(config.providerReason, /hosted Baileys/i);
  assert.equal(config.openwa.baseUrl, "");
  assert.equal(config.waAkg.baseUrl, "");
});

test("does not leak bridge or webhook secrets in the public health summary", () => {
  const config = loadConfig(env());
  const summary = JSON.stringify(safeConfigSummary(config));
  assert.equal(summary.includes(config.bridgeToken), false);
  assert.equal(summary.includes(config.webhookToken), false);
  assert.match(summary, /bridgeConfigured/);
});

test("requires long random secrets for the hosted sender", () => {
  assert.throws(
    () => loadConfig({ ...env(), ESTATEFLOW_BRIDGE_TOKEN: "short" }),
    /ESTATEFLOW_BRIDGE_TOKEN must be at least 32 characters/
  );
});

test("does not silently accept misspelled provider names", () => {
  assert.throws(
    () => loadConfig({ ...env(), ESTATEFLOW_GATEWAY_PROVIDER: "bailey" }),
    /must be auto, openwa, wa-akg, or baileys/
  );
});
