import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { phoneDigits } from "./provider.js";

export function createQueueStore({ dataDir, onChange = () => {} }) {
  const queuePath = path.join(dataDir, "queue.json");
  let rows = [];
  let loaded = false;
  let writes = Promise.resolve();

  async function save() {
    writes = writes.catch(() => {}).then(async () => {
      await fs.mkdir(dataDir, { recursive: true });
      const temp = queuePath + ".tmp";
      await fs.writeFile(temp, JSON.stringify(rows, null, 2), { encoding: "utf8", mode: 0o600 });
      await fs.rename(temp, queuePath);
    });
    await writes;
  }

  async function ensureLoaded() {
    if (loaded) return;
    await fs.mkdir(dataDir, { recursive: true });
    try {
      const text = await fs.readFile(queuePath, "utf8");
      const parsed = JSON.parse(text);
      rows = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      if (error?.code !== "ENOENT") throw new Error("Could not load WhatsApp queue: " + error.message);
      rows = [];
    }
    // Never auto-resend a row that may have reached WhatsApp before a process crash.
    for (const row of rows) {
      if (row.status === "sending") {
        row.status = "failed";
        row.lastError = "Hub stopped during delivery. Check gateway history before retrying to avoid duplicates.";
        row.updatedAt = new Date().toISOString();
      }
    }
    loaded = true;
    await save();
  }

  async function schedule(payload, immediate = false) {
    await ensureLoaded();
    const groupJid = String(payload?.groupJid || "").trim();
    const destinationType = groupJid ? "group" : "contact";
    if (destinationType === "group" && !groupJid.endsWith("@g.us")) {
      throw new Error("Choose a valid WhatsApp group that has been synced in EstateFlow.");
    }
    const phone = destinationType === "contact" ? phoneDigits(payload?.phone) : "";
    const message = String(payload?.message || "").trim();
    if (!message) throw new Error("Write a message before scheduling.");
    if (message.length > 4000) throw new Error("Messages must be 4000 characters or fewer.");
    if (payload?.consentConfirmed !== true) throw new Error("Confirm the recipient has agreed to receive these messages.");
    const dueMs = Date.parse(payload?.scheduledAt);
    if (!Number.isFinite(dueMs)) throw new Error("Choose a valid scheduled date and time.");
    if (!immediate && dueMs <= Date.now()) throw new Error("Choose a future date and time.");
    const repeatCount = Math.max(1, Math.min(20, Number.parseInt(payload?.repeatCount, 10) || 1));
    const intervalDays = Math.max(1, Math.min(365, Number.parseInt(payload?.intervalDays, 10) || 1));
    const seriesId = crypto.randomUUID();
    const contactId = String(payload?.contactId || "").slice(0, 120);
    const contactName = String(payload?.contactName || "").trim().slice(0, 160);
    const groupName = String(payload?.groupName || "").trim().slice(0, 240);
    const expectedSenderNumber = String(payload?.expectedSenderNumber || "").replace(/\\D/g, "").slice(0, 20);
    const propertyId = String(payload?.propertyId || "").slice(0, 120);
    const propertyTitle = String(payload?.propertyTitle || "").trim().slice(0, 240);
    const taskId = String(payload?.taskId || "").slice(0, 120);
    const taskTitle = String(payload?.taskTitle || "").trim().slice(0, 240);
    const rowsToAdd = [];

    for (let index = 0; index < repeatCount; index++) {
      rowsToAdd.push({
        id: crypto.randomUUID(),
        seriesId,
        sequence: index + 1,
        repeatCount,
        destinationType,
        groupJid,
        groupName,
        expectedSenderNumber,
        phone,
        contactId,
        contactName,
        propertyId,
        propertyTitle,
        taskId,
        taskTitle,
        message,
        scheduledAt: new Date(dueMs + index * intervalDays * 86400000).toISOString(),
        status: "scheduled",
        consentConfirmed: true,
        stopOnReply: payload?.stopOnReply !== false,
        provider: "",
        messageId: "",
        deliveryStatus: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sentAt: "",
        lastError: ""
      });
    }
    rows.push(...rowsToAdd);
    await save();
    onChange("scheduled");
    return { ok: true, rows: rowsToAdd };
  }

  async function cancel(id, reason = "Cancelled by user.") {
    await ensureLoaded();
    const row = rows.find(item => item.id === id);
    if (!row || row.status !== "scheduled") return { ok: false, message: "Only pending messages can be cancelled." };
    row.status = "cancelled";
    row.lastError = reason;
    row.updatedAt = new Date().toISOString();
    await save();
    onChange("cancelled");
    return { ok: true };
  }

  async function retry(id) {
    await ensureLoaded();
    const row = rows.find(item => item.id === id);
    if (!row || row.status !== "failed") return { ok: false, message: "Only failed messages can be retried." };
    row.status = "scheduled";
    row.scheduledAt = new Date(Date.now() + 60000).toISOString();
    row.lastError = "";
    row.updatedAt = new Date().toISOString();
    await save();
    onChange("retry-queued");
    return { ok: true };
  }

  async function list() {
    await ensureLoaded();
    // Include all active/recent queue records needed by EstateFlow; deployments should archive
    // old terminal rows periodically rather than silently hiding bulk schedules after row 500.
    return rows.slice().sort((a, b) => Date.parse(b.scheduledAt) - Date.parse(a.scheduledAt)).slice(0, 10000);
  }

  async function countSentSince(startTimeMs) {
    await ensureLoaded();
    return rows.filter(row => row.status === "sent" && row.sentAt && Date.parse(row.sentAt) >= startTimeMs).length;
  }

  async function nextDue() {
    await ensureLoaded();
    const due = rows.filter(row => row.status === "scheduled" && Date.parse(row.scheduledAt) <= Date.now())
      .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
    return due[0] || null;
  }

  async function update(row, reason) {
    await ensureLoaded();
    row.updatedAt = new Date().toISOString();
    await save();
    onChange(reason || row.status);
  }

  async function recordReply(rawPhoneOrGroupJid) {
    await ensureLoaded();
    const raw = String(rawPhoneOrGroupJid || "").trim();
    const groupJid = raw.endsWith("@g.us") ? raw : "";
    const phone = groupJid ? "" : phoneDigits(raw);
    let cancelled = 0;
    for (const row of rows) {
      if (row.status !== "scheduled" || !row.stopOnReply) continue;
      const matchesGroup = Boolean(groupJid && row.destinationType === "group" && row.groupJid === groupJid);
      const matchesContact = Boolean(!groupJid && row.destinationType !== "group" && row.phone === phone);
      if (!matchesGroup && !matchesContact) continue;
      row.status = "cancelled";
      row.lastError = matchesGroup
        ? "Pending group follow-ups stopped because a new message appeared in this WhatsApp group."
        : "Pending follow-ups stopped because this contact replied.";
      row.updatedAt = new Date().toISOString();
      cancelled++;
    }
    if (cancelled) {
      await save();
      onChange("reply-detected");
    }
    return cancelled;
  }

  async function findByMessageId(messageId) {
    await ensureLoaded();
    return rows.find(row => row.messageId && row.messageId === messageId) || null;
  }

  async function recordDeliveryStatus(messageId, status, details = "") {
    const row = await findByMessageId(messageId);
    if (!row) return false;
    const mapped = String(status || "").toLowerCase();
    if (["delivered", "read"].includes(mapped)) row.deliveryStatus = mapped;
    else if (mapped === "failed") {
      row.status = "failed";
      row.lastError = String(details || "The provider reported message delivery failure.").slice(0, 1000);
    } else return false;
    await update(row, "delivery-status");
    return true;
  }

  return { ensureLoaded, schedule, cancel, retry, list, countSentSince, nextDue, update, recordReply, recordDeliveryStatus };
}
