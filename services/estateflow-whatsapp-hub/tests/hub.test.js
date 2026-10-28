import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig, safeConfigSummary } from "../src/config.js";
import { isConnected, jidFor, normalizeQr } from "../src/provider.js";
import { parseIncoming } from "../src/webhook.js";

const secrets = {
  ESTATEFLOW_BRIDGE_TOKEN: "a".repeat(48),
  ESTATEFLOW_WEBHOOK_TOKEN: "b".repeat(48)
};

test("selects OpenWA automatically when only OpenWA is configured", () => {
  const config = loadConfig({
    ...secrets,
    OPENWA_BASE_URL: "http://127.0.0.1:2785/api",
    OPENWA_API_KEY: "test-key"
  });
  assert.equal(config.provider, "openwa");
  assert.equal(safeConfigSummary(config).provider, "openwa");
});

test("selects WA-AKG automatically when OpenWA is not configured", () => {
  const config = loadConfig({
    ...secrets,
    WA_AKG_BASE_URL: "http://localhost:3000/api",
    WA_AKG_API_KEY: "test-key"
  });
  assert.equal(config.provider, "wa-akg");
});

test("if both gateways are configured, chooses one transport only", () => {
  const config = loadConfig({
    ...secrets,
    OPENWA_BASE_URL: "http://127.0.0.1:2785/api",
    OPENWA_API_KEY: "openwa-test",
    WA_AKG_BASE_URL: "http://localhost:3000/api",
    WA_AKG_API_KEY: "wa-akg-test"
  });
  assert.equal(config.provider, "openwa");
  assert.match(config.providerReason, /not used for sends/);
});

test("rejects short secrets", () => {
  assert.throws(() => loadConfig({ ...secrets, ESTATEFLOW_BRIDGE_TOKEN: "short" }), /at least 32/);
});

test("rejects remote HTTP gateway URLs unless explicitly allowed", () => {
  assert.throws(() => loadConfig({
    ...secrets,
    OPENWA_BASE_URL: "http://gateway.example.com/api",
    OPENWA_API_KEY: "test-key"
  }), /must use HTTPS/);
});

test("normalizes phone numbers to the provider JID formats", () => {
  assert.equal(jidFor("+91 98765 43210", "openwa"), "919876543210@c.us");
  assert.equal(jidFor("9876543210", "wa-akg"), "919876543210@s.whatsapp.net");
});

test("normalizes QR images without guessing arbitrary QR text", () => {
  assert.equal(normalizeQr("data:image/png;base64,abc"), "data:image/png;base64,abc");
  assert.equal(normalizeQr("plain-qr-token"), "");
  assert.match(normalizeQr("A".repeat(120)), /^data:image\/png;base64,/);
});

test("maps gateway connection states conservatively", () => {
  assert.equal(isConnected("ready"), true);
  assert.equal(isConnected("CONNECTED"), true);
  assert.equal(isConnected("qr_ready"), false);
});

test("ignores outbound and group events, and normalizes private inbound replies", () => {
  assert.equal(parseIncoming({ event: "message.received", data: { from: "919876543210@s.whatsapp.net", key: { fromMe: true } } }).ignore, true);
  assert.equal(parseIncoming({ event: "message.received", data: { from: "123456789@g.us", isGroup: true } }).ignore, true);
  const result = parseIncoming({
    event: "message.received",
    data: { from: "919876543210@s.whatsapp.net", key: { fromMe: false, id: "message-1" } }
  });
  assert.equal(result.ignore, false);
  assert.equal(result.phone, "919876543210");
  assert.equal(result.messageId, "message-1");
});
