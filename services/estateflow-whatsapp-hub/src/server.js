import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { loadConfig, safeConfigSummary } from "./config.js";
import { createProvider } from "./provider.js";
import { createQueueStore } from "./queue.js";
import { parseIncoming, verifyWebhookSignature } from "./webhook.js";

const config = loadConfig();
const sessionStatePath = path.join(config.dataDir, "session.json");
const addressBookPath = path.join(config.dataDir, "address-book.json");
let addressBook = { contacts: [], groups: [], lastSyncedAt: "", accountNumber: "", activeGroupJids: [] };
let sessionState = { sessionId: "" };

await fs.mkdir(config.dataDir, { recursive: true });
try {
  const saved = JSON.parse(await fs.readFile(sessionStatePath, "utf8"));
  sessionState = { ...saved, sessionId: String(saved.sessionId || "") };
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
  sessionState = { sessionId: config.openwa.sessionId || config.waAkg.sessionId || "" };
}

try {
  const savedBook = JSON.parse(await fs.readFile(addressBookPath, "utf8"));
  addressBook = {
    contacts: Array.isArray(savedBook.contacts) ? savedBook.contacts : [],
    groups: Array.isArray(savedBook.groups) ? savedBook.groups : [],
    lastSyncedAt: String(savedBook.lastSyncedAt || ""),
    accountNumber: String(savedBook.accountNumber || ""),
    activeGroupJids: Array.isArray(savedBook.activeGroupJids) ? savedBook.activeGroupJids : []
  };
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

async function saveAddressBook() {
  const tmp = addressBookPath + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(addressBook, null, 2), { encoding: "utf8", mode: 0o600 });
  await fs.rename(tmp, addressBookPath);
}

function normalizeAddressBookContact(raw) {
  if (!raw || typeof raw !== "object") return null;
  const jid = String(raw.id || raw.jid || "");
  const rawDigits = String(raw.phoneNumber || raw.phone || (jid.includes("@") ? jid.split("@")[0] : jid)).replace(/\\D/g, "");
  const phone = rawDigits.length >= 8 && rawDigits.length <= 15 ? "+" + rawDigits : "";
  const whatsappName = String(raw.name || raw.verifiedName || raw.notify || raw.pushName || "").trim();
  if (!jid && !phone) return null;
  return {
    id: jid || rawDigits,
    jid,
    phone,
    name: whatsappName || phone || jid,
    whatsappName,
    notify: String(raw.notify || ""),
    verifiedName: String(raw.verifiedName || ""),
    lastSyncedAt: new Date().toISOString()
  };
}

function mergeAddressBookContacts(rawContacts) {
  let changed = false;
  for (const raw of Array.isArray(rawContacts) ? rawContacts : []) {
    const contact = normalizeAddressBookContact(raw);
    if (!contact) continue;
    const digits = String(contact.phone || "").replace(/\\D/g, "");
    const index = addressBook.contacts.findIndex(item =>
      (contact.jid && (item.jid === contact.jid || item.id === contact.jid)) ||
      (digits && String(item.phone || "").replace(/\\D/g, "") === digits)
    );
    if (index < 0) addressBook.contacts.push(contact);
    else addressBook.contacts[index] = {
      ...addressBook.contacts[index],
      ...contact,
      name: contact.whatsappName || addressBook.contacts[index].whatsappName || addressBook.contacts[index].name,
      whatsappName: contact.whatsappName || addressBook.contacts[index].whatsappName || "",
      notify: contact.notify || addressBook.contacts[index].notify || "",
      verifiedName: contact.verifiedName || addressBook.contacts[index].verifiedName || ""
    };
    changed = true;
  }
  addressBook.contacts.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return changed;
}

function mergeAddressBookGroups(rawGroups) {
  const activeGroupJids = [];
  let changed = false;
  for (const raw of Array.isArray(rawGroups) ? rawGroups : []) {
    if (!raw || typeof raw !== "object") continue;
    const jid = String(raw.id || raw.jid || "");
    if (!jid.endsWith("@g.us")) continue;
    activeGroupJids.push(jid);
    const name = String(raw.subject || raw.name || raw.groupName || "WhatsApp group").trim() || "WhatsApp group";
    const group = {
      id: jid, jid, name, subject: name,
      description: String(raw.desc || raw.description || ""),
      size: Number(raw.size || raw.memberCount || (Array.isArray(raw.participants) ? raw.participants.length : 0)),
      lastSyncedAt: new Date().toISOString()
    };
    const index = addressBook.groups.findIndex(item => item.jid === jid || item.id === jid);
    if (index < 0) addressBook.groups.push(group);
    else addressBook.groups[index] = { ...addressBook.groups[index], ...group };
    changed = true;
  }
  addressBook.activeGroupJids = [...new Set(activeGroupJids)];
  addressBook.groups.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return changed;
}

async function getAddressBook() {
  return {
    contacts: addressBook.contacts.slice(),
    groups: addressBook.groups.slice(),
    lastSyncedAt: addressBook.lastSyncedAt,
    accountNumber: addressBook.accountNumber,
    activeGroupJids: addressBook.activeGroupJids.slice(),
    connected: Boolean((await provider.status()).connected),
    counts: { contacts: addressBook.contacts.length, groups: addressBook.groups.length }
  };
}

async function syncAddressBook() {
  if (!config.provider) throw new Error("Configure a WhatsApp gateway before syncing its contacts or groups.");
  const connection = await provider.status();
  if (!connection.connected) throw new Error("Connect WhatsApp first to sync current contacts and groups. Saved contacts and groups remain available while disconnected.");
  const warnings = [];
  const contacts = await provider.listContacts();
  mergeAddressBookContacts(contacts);
  try {
    const groups = await provider.listGroups();
    mergeAddressBookGroups(groups);
  } catch (error) {
    addressBook.activeGroupJids = [];
    warnings.push("Could not refresh group list: " + (error instanceof Error ? error.message : String(error)));
  }
  addressBook.lastSyncedAt = new Date().toISOString();
  addressBook.accountNumber = String(connection.senderNumber || "");
  await saveAddressBook();
  const result = await getAddressBook();
  result.warnings = warnings;
  result.note = "WhatsApp contact names and phone numbers and group names are saved in the hub cache. Previous entries are retained when a later sync does not return them.";
  return result;
}

sessionState.save = async () => {
  const tmp = sessionStatePath + ".tmp";
  const { save, ...persisted } = sessionState;
  await fs.writeFile(tmp, JSON.stringify(persisted, null, 2), { mode: 0o600 });
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
    "Access-Control-Allow-Headers": "Content-Type, X-EstateFlow-Token, X-EstateFlow-Webhook-Token, X-Webhook-Signature, X-OpenWA-Signature, X-Hub-Signature-256",
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
  const signature = String(
    req.headers["x-webhook-signature"] ||
    req.headers["x-openwa-signature"] ||
    req.headers["x-hub-signature-256"] || ""
  );
  return verifyWebhookSignature(raw, signature, config.webhookToken);
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
