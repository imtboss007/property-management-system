import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { loadConfig, safeConfigSummary } from "./config.js";
import { createProvider } from "./provider.js";
import { createQueueStore } from "./queue.js";
import { parseIncoming } from "./webhook.js";

const config = loadConfig();
const sessionStatePath = path.join(config.dataDir, "session.json");
let sessionState = { sessionId: "" };

await fs.mkdir(config.dataDir, { recursive: true });
try {
  const saved = JSON.parse(await fs.readFile(sessionStatePath, "utf8"));
  sessionState = { sessionId: String(saved.sessionId || "") };
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
  sessionState = { sessionId: config.openwa.sessionId || config.waAkg.sessionId || "" };
}

sessionState.save = async () => {
  const tmp = sessionStatePath + ".tmp";
  await fs.writeFile(tmp, JSON.stringify({ sessionId: sessionState.sessionId }, null, 2), { mode: 0o600 });
  await fs.rename(tmp, sessionStatePath);
};

let lastSendAt = 0;
let sending = false;
const provider = createProvider(config, sessionState);
const queue = createQueueStore({ dataDir: config.dataDir });
await queue.ensureLoaded();

function timingSafeMatch(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function reply(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-EstateFlow-Token, X-EstateFlow-Webhook-Token, X-Webhook-Signature, X-Hub-Signature-256",
    "Access-Control-Allow-Private-Network": "true"
  });
  res.end(status === 204 ? "" : JSON.stringify(body));
}

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk.toString("utf8");
    if (raw.length > 1024 * 1024) throw new Error("Request body is too large.");
  }
  return { raw, value: raw.trim() ? JSON.parse(raw) : {} };
}

function authenticated(req) {
  return timingSafeMatch(req.headers["x-estateflow-token"], config.bridgeToken);
}

function verifyWebhook(req, raw) {
  if (timingSafeMatch(req.headers["x-estateflow-webhook-token"], config.webhookToken)) return true;
  const signature = String(req.headers["x-webhook-signature"] || req.headers["x-hub-signature-256"] || "");
  if (!signature.startsWith("sha256=")) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", config.webhookToken).update(raw).digest("hex");
  return timingSafeMatch(signature, expected);
}

async function statusResponse() {
  const status = await provider.status();
  return { ok: true, status: { ...status, platform: status.platform || "gateway-" + provider.name } };
}

async function schedulerTick() {
  if (sending || !config.provider) return;
  const row = await queue.nextDue();
  if (!row) return;

  // Do not send unexpectedly after the hub or network has been offline for a long period.
  if (Date.now() - Date.parse(row.scheduledAt) > 30 * 60 * 1000) {
    row.status = "failed";
    row.lastError = "The hub or WhatsApp gateway was offline at the scheduled time. Review and reschedule manually.";
    await queue.update(row, "missed");
    return;
  }

  const localMidnight = new Date();
  localMidnight.setHours(0, 0, 0, 0);
  const sentToday = await queue.countSentSince(localMidnight.getTime());
  if (sentToday >= config.maxDaily) {
    row.status = "failed";
    row.lastError = "Daily automated-send safety cap reached. Review and reschedule for another day.";
    await queue.update(row, "daily-limit");
    return;
  }
  if (Date.now() - lastSendAt < config.cooldown) return;

  const connection = await provider.status();
  if (!connection.connected) return;

  sending = true;
  row.status = "sending";
  row.provider = provider.name;
  await queue.update(row, "sending");
  try {
    const result = await provider.sendText(row.phone, row.message);
    row.status = "sent";
    row.sentAt = new Date().toISOString();
    row.messageId = result.messageId || "";
    row.deliveryStatus = "accepted";
    row.lastError = "";
    lastSendAt = Date.now();
    await queue.update(row, "sent");
  } catch (error) {
    row.status = "failed";
    row.lastError = (error instanceof Error ? error.message : String(error)).slice(0, 1000);
    await queue.update(row, "send-failed");
  } finally {
    sending = false;
  }
}

function isDeliveryEvent(body) {
  const event = String(body?.event || body?.type || body?.name || "").toLowerCase();
  return ["message.status", "message.status_update", "message.delivered", "message.read", "message.failed", "message.ack"].includes(event)
    || ["delivered", "read", "failed"].includes(String(body?.status || body?.data?.status || "").toLowerCase())
       && Boolean(body?.messageId || body?.data?.messageId || body?.data?.key?.id);
}

const timer = setInterval(() => {
  void schedulerTick().catch(error => {
    process.stderr.write("[estateflow-whatsapp-hub] scheduler error: " + (error instanceof Error ? error.message : String(error)) + "\n");
  });
}, 5000);
timer.unref();

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    reply(res, 204, {});
    return;
  }
  const url = new URL(req.url || "/", "http://localhost");
  if (req.method === "GET" && url.pathname === "/health") {
    reply(res, 200, { ok: true, service: "estateflow-whatsapp-hub", ...safeConfigSummary(config) });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/webhook/incoming") {
    try {
      const { raw, value } = await readBody(req);
      if (!verifyWebhook(req, raw)) {
        reply(res, 401, { ok: false, error: "Webhook signature/token is invalid." });
        return;
      }
      if (isDeliveryEvent(value)) {
        const data = value?.data && typeof value.data === "object" ? value.data : value;
        const key = data?.key || {};
        const messageId = String(value.messageId || data.messageId || data.id || key.id || "");
        const rawStatus = String(value.status || data.status || "").toLowerCase();
        const eventName = String(value.event || value.type || value.name || "").toLowerCase();
        const deliveryStatus = ["delivered", "read", "failed"].includes(rawStatus)
          ? rawStatus
          : eventName.endsWith(".delivered") ? "delivered"
            : eventName.endsWith(".read") ? "read"
              : eventName.endsWith(".failed") ? "failed" : rawStatus;
        const recorded = messageId ? await queue.recordDeliveryStatus(messageId, deliveryStatus, value.error || data.error || "") : false;
        reply(res, 200, { ok: true, deliveryStatusRecorded: recorded });
        return;
      }
      const incoming = parseIncoming(value);
      if (incoming.ignore) {
        reply(res, 200, { ok: true, ignored: true, reason: incoming.reason });
        return;
      }
      const cancelled = await queue.recordReply(incoming.phone);
      reply(res, 200, { ok: true, replyDetected: true, cancelledFollowUps: cancelled });
    } catch (error) {
      reply(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  if (!url.pathname.startsWith("/api/")) {
    reply(res, 404, { ok: false, error: "Not found." });
    return;
  }
  if (!authenticated(req)) {
    reply(res, 401, { ok: false, error: "Invalid EstateFlow hub token." });
    return;
  }

  try {
    if (req.method === "GET" && url.pathname === "/api/status") {
      reply(res, 200, await statusResponse());
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/queue") {
      reply(res, 200, { ok: true, queue: await queue.list() });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/connect") {
      const status = await provider.connect();
      reply(res, 200, { ok: true, status });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/pairing-code") {
      const { value } = await readBody(req);
      const result = await provider.requestPairingCode(value.phone);
      reply(res, 200, { ok: true, code: result.code });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/disconnect") {
      await provider.disconnect();
      reply(res, 200, { ok: true });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/schedule") {
      const { value } = await readBody(req);
      const result = await queue.schedule(value, false);
      reply(res, 200, result);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/send-now") {
      const { value } = await readBody(req);
      const result = await queue.schedule({
        ...value, scheduledAt: new Date(Date.now() + 1000).toISOString(), repeatCount: 1
      }, true);
      reply(res, 200, result);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/cancel") {
      const { value } = await readBody(req);
      const result = await queue.cancel(String(value.id || ""));
      reply(res, result.ok ? 200 : 409, { ok: result.ok, message: result.message });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/retry") {
      const { value } = await readBody(req);
      const result = await queue.retry(String(value.id || ""));
      reply(res, result.ok ? 200 : 409, { ok: result.ok, message: result.message });
      return;
    }

    reply(res, 404, { ok: false, error: "Unknown hub endpoint." });
  } catch (error) {
    reply(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(config.port, config.host, () => {
  process.stdout.write(
    "[estateflow-whatsapp-hub] listening on " + config.host + ":" + config.port +
    "; " + config.providerReason + "\n"
  );
});

function shutdown() {
  clearInterval(timer);
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
