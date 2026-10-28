import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { loadConfig, safeConfigSummary } from "../src/config.js";
import { isConnected, jidFor, normalizeQr } from "../src/provider.js";
import { parseIncoming, verifyWebhookSignature } from "../src/webhook.js";

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

test("requires a public HTTPS callback for automatic stop-on-reply", () => {
  assert.throws(() => loadConfig({
    ...secrets,
    ESTATEFLOW_PUBLIC_WEBHOOK_URL: "http://gateway.example.com/api/webhook/incoming"
  }), /must use HTTPS/);
  const config = loadConfig({
    ...secrets,
    ESTATEFLOW_PUBLIC_WEBHOOK_URL: "https://estateflow.example.com/api/webhook/incoming"
  });
  assert.equal(config.publicWebhookUrl, "https://estateflow.example.com/api/webhook/incoming");
});

test("verifies HMAC-SHA256 webhook signatures for both provider header formats", () => {
  const rawBody = JSON.stringify({ event: "message.received", data: { from: "919876543210@s.whatsapp.net" } });
  const secret = "test-webhook-secret-that-is-long-enough";
  const signature = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  // Both WA-AKG (X-Webhook-Signature) and OpenWA (X-OpenWA-Signature) use this signature format.
  assert.equal(verifyWebhookSignature(rawBody, signature, secret), true);
  assert.equal(verifyWebhookSignature(rawBody + " ", signature, secret), false);
  assert.equal(verifyWebhookSignature(rawBody, "", secret), false);
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

test("ignores outbound events and normalizes private contact replies", () => {
  assert.equal(parseIncoming({ event: "message.received", data: { from: "919876543210@s.whatsapp.net", key: { fromMe: true } } }).ignore, true);
  const result = parseIncoming({
    event: "message.received",
    data: { from: "919876543210@s.whatsapp.net", key: { fromMe: false, id: "message-1" } }
  });
  assert.equal(result.ignore, false);
  assert.equal(result.phone, "919876543210");
  assert.equal(result.messageId, "message-1");
});

test("recognizes an inbound WhatsApp group message for stopping group follow-ups", () => {
  const result = parseIncoming({
    event: "message.received",
    data: { from: "120363000000000001@g.us", isGroup: true, key: { fromMe: false, id: "group-message-1" } }
  });
  assert.equal(result.ignore, false);
  assert.equal(result.isGroup, true);
  assert.equal(result.groupJid, "120363000000000001@g.us");
  assert.equal(result.messageId, "group-message-1");
});
