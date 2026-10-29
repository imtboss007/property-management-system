import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createQueueStore } from "../src/queue.js";

async function sandbox(run) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "estateflow-wa-hub-"));
  try { await run(dataDir); }
  finally { await fs.rm(dataDir, { recursive: true, force: true }); }
}

const allowed = {
  phone: "+91 98765 43210",
  contactName: "Test Client",
  message: "Following up on the property we discussed.",
  propertyId: "property-42",
  propertyTitle: "Test property",
  scheduledAt: new Date(Date.now() + 60_000).toISOString(),
  repeatCount: 3,
  intervalDays: 3,
  consentConfirmed: true,
  stopOnReply: true
};

test("creates property-linked, repeat follow-ups only when opt-in is confirmed", async () => {
  await sandbox(async dataDir => {
    const queue = createQueueStore({ dataDir });
    await assert.rejects(
      queue.schedule({ ...allowed, consentConfirmed: false }),
      /agreed to receive/
    );
    const result = await queue.schedule(allowed);
    assert.equal(result.rows.length, 3);
    assert.equal(result.rows[0].phone, "919876543210");
    assert.equal(result.rows[0].propertyId, "property-42");
    assert.equal(result.rows[0].propertyTitle, "Test property");
    assert.equal(result.rows[2].sequence, 3);
    assert.equal(result.rows[2].scheduledAt,
      new Date(Date.parse(allowed.scheduledAt) + 2 * 3 * 86400000).toISOString());
  });
});

test("incoming reply cancels all future scheduled follow-ups for that number", async () => {
  await sandbox(async dataDir => {
    const queue = createQueueStore({ dataDir });
    await queue.schedule(allowed);
    const cancelled = await queue.recordReply("919876543210@s.whatsapp.net");
    const rows = await queue.list();
    assert.equal(cancelled, 3);
    assert.ok(rows.every(row => row.status === "cancelled"));
    assert.ok(rows.every(row => row.lastError.includes("contact replied")));
  });
});

test("recovered rows that were sending are marked failed rather than auto-sent twice", async () => {
  await sandbox(async dataDir => {
    const queueFile = path.join(dataDir, "queue.json");
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(queueFile, JSON.stringify([{
      id: "row-1", phone: "919876543210", message: "test", scheduledAt: new Date().toISOString(),
      status: "sending", consentConfirmed: true, stopOnReply: true
    }]));
    const queue = createQueueStore({ dataDir });
    await queue.ensureLoaded();
    const [row] = await queue.list();
    assert.equal(row.status, "failed");
    assert.match(row.lastError, /avoid duplicates/);
  });
});


test("schedules WhatsApp group messages against the exact group JID and stops the sequence on group activity", async () => {
  await sandbox(async dataDir => {
    const queue = createQueueStore({ dataDir });
    const groupPayload = {
      groupJid: "120363000000000001@g.us",
      groupName: "Property Loan Follow-ups",
      expectedSenderNumber: "919876543210",
      message: "Reminder: please share the loan status update.",
      scheduledAt: new Date(Date.now() + 60_000).toISOString(),
      repeatCount: 3,
      intervalDays: 2,
      consentConfirmed: true,
      stopOnReply: true,
      propertyId: "loan-deal-7",
      propertyTitle: "Loan deal 7"
    };
    const result = await queue.schedule(groupPayload);
    assert.equal(result.rows.length, 3);
    assert.equal(result.rows[0].destinationType, "group");
    assert.equal(result.rows[0].groupJid, groupPayload.groupJid);
    assert.equal(result.rows[0].groupName, groupPayload.groupName);
    assert.equal(result.rows[0].expectedSenderNumber, "919876543210");
    assert.equal(result.rows[0].propertyId, "loan-deal-7");

    const cancelled = await queue.recordReply(groupPayload.groupJid);
    assert.equal(cancelled, 3);
    const rows = await queue.list();
    assert.ok(rows.every(row => row.status === "cancelled"));
    assert.ok(rows.every(row => row.lastError.includes("group")));
  });
});

test("rejects invalid group JIDs while allowing the saved exact JID to be supplied", async () => {
  await sandbox(async dataDir => {
    const queue = createQueueStore({ dataDir });
    await assert.rejects(queue.schedule({
      groupJid: "not-a-group",
      message: "Test message",
      scheduledAt: new Date(Date.now() + 60_000).toISOString(),
      consentConfirmed: true
    }), /valid WhatsApp group/);
  });
});
