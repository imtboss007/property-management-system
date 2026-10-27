const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const QRCode = require("qrcode");

const MAX_MESSAGE_LENGTH = 4000;
const MAX_REPEAT_COUNT = 20;
const DAILY_SEND_LIMIT = 60;
const SEND_COOLDOWN_MS = 12000;
const MISSED_SCHEDULE_GRACE_MS = 30 * 60 * 1000;

function normalizePhone(raw) {
  let digits = String(raw || "").replace(/\\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = "91" + digits;
  if (digits.length < 8 || digits.length > 15) throw new Error("Enter a valid WhatsApp number with country code, such as +91 9876543210.");
  return digits;
}

function createWhatsAppService({ app, ipcMain, notify }) {
  const userData = app.getPath("userData");
  const authDir = path.join(userData, "whatsapp-linked-device");
  const queuePath = path.join(userData, "whatsapp-scheduled-messages.json");
  let socket = null;
  let socketInit = null;
  let authState = null;
  let baileys = null;
  let queue = [];
  let queueLoaded = false;
  let queueWrite = Promise.resolve();
  let sending = false;
  let lastSendAt = 0;
  let tick = null;
  let intentionalLogout = false;
  let pairingRequested = false;
  const status = {
    supported: true,
    platform: "windows-desktop",
    connected: false,
    connecting: false,
    senderNumber: "",
    displayName: "",
    qrDataUrl: "",
    pairingCode: "",
    error: "",
    lastConnectedAt: ""
  };

  function snapshotStatus() {
    return { ...status };
  }

  function publish(reason = "update") {
    if (typeof notify === "function") {
      try {
        notify({ reason, status: snapshotStatus(), queue: queue.slice(0, 200) });
      } catch (_) {}
    }
  }

  async function ensureQueueLoaded() {
    if (queueLoaded) return;
    queueLoaded = true;
    try {
      const text = await fs.readFile(queuePath, "utf8");
      const value = JSON.parse(text);
      queue = Array.isArray(value) ? value : [];
    } catch (error) {
      if (error && error.code !== "ENOENT") status.error = "Could not read saved schedule: " + error.message;
      queue = [];
    }
  }

  function saveQueue() {
    queueWrite = queueWrite.then(async () => {
      const tempPath = queuePath + ".tmp";
      await fs.writeFile(tempPath, JSON.stringify(queue, null, 2), { encoding: "utf8", mode: 0o600 });
      await fs.rename(tempPath, queuePath);
    });
    return queueWrite;
  }

  async function loadBaileys() {
    if (baileys) return baileys;
    const module = await import("@whiskeysockets/baileys");
    const makeWASocket = module.default || module.makeWASocket;
    if (typeof makeWASocket !== "function" || typeof module.useMultiFileAuthState !== "function") {
      throw new Error("The WhatsApp linked-device library did not load. Reinstall the latest EstateFlow desktop build.");
    }
    baileys = {
      makeWASocket,
      useMultiFileAuthState: module.useMultiFileAuthState,
      DisconnectReason: module.DisconnectReason || {}
    };
    return baileys;
  }

  async function startSocket() {
    if (status.connected || socket) return { ok: true };
    if (socketInit) return socketInit;
    socketInit = (async () => {
      status.connecting = true;
      status.error = "";
      publish("connecting");
      try {
        await fs.mkdir(authDir, { recursive: true, mode: 0o700 });
        const lib = await loadBaileys();
        const auth = await lib.useMultiFileAuthState(authDir);
        authState = auth.state;
        const nextSocket = lib.makeWASocket({
          auth: auth.state,
          printQRInTerminal: false,
          markOnlineOnConnect: false,
          syncFullHistory: false,
          generateHighQualityLinkPreview: false
        });
        socket = nextSocket;
        nextSocket.ev.on("creds.update", () => { void auth.saveCreds().catch(error => { status.error = "Could not save WhatsApp session: " + error.message; publish("error"); }); });
        nextSocket.ev.on("connection.update", async update => {
          if (socket !== nextSocket) return;
          if (update.qr && !pairingRequested) {
            try {
              status.qrDataUrl = await QRCode.toDataURL(update.qr, { width: 280, margin: 1, errorCorrectionLevel: "M" });
              status.pairingCode = "";
              status.error = "";
              publish("qr");
            } catch (error) {
              status.error = "Could not render the WhatsApp QR code: " + error.message;
              publish("error");
            }
          }
          if (update.connection === "open") {
            status.connected = true;
            status.connecting = false;
            status.qrDataUrl = "";
            status.pairingCode = "";
            status.error = "";
            status.lastConnectedAt = new Date().toISOString();
            const userId = String(nextSocket.user && nextSocket.user.id || "");
            const numberPart = userId.split("@")[0].split(":")[0];
            status.senderNumber = numberPart.replace(/\\D/g, "") || status.senderNumber;
            status.displayName = String(nextSocket.user && nextSocket.user.name || "");
            pairingRequested = false;
            publish("connected");
          }
          if (update.connection === "close") {
            const code = update.lastDisconnect && update.lastDisconnect.error && update.lastDisconnect.error.output && update.lastDisconnect.error.output.statusCode;
            const loggedOut = code === lib.DisconnectReason.loggedOut;
            socket = null;
            status.connected = false;
            status.connecting = false;
            status.qrDataUrl = "";
            status.pairingCode = "";
            if (intentionalLogout) {
              intentionalLogout = false;
              status.error = "";
              publish("disconnected");
              return;
            }
            if (loggedOut) {
              status.error = "WhatsApp logged this linked device out. Connect again using QR or the pairing code.";
              publish("logged-out");
              return;
            }
            status.error = "WhatsApp connection dropped. EstateFlow will try to reconnect.";
            publish("connection-lost");
            setTimeout(() => {
              if (!status.connected && !socket && !intentionalLogout) void startSocket();
            }, 5000);
          }
        });
        nextSocket.ev.on("messages.upsert", event => {
          if (event.type !== "notify") return;
          void handleIncomingMessages(event.messages || []);
        });
        status.connecting = true;
        publish("socket-started");
        return { ok: true };
      } catch (error) {
        socket = null;
        status.connected = false;
        status.connecting = false;
        status.error = error instanceof Error ? error.message : String(error);
        publish("error");
        throw error;
      } finally {
        socketInit = null;
      }
    })();
    return socketInit;
  }

  async function handleIncomingMessages(messages) {
    await ensureQueueLoaded();
    let changed = false;
    for (const message of messages) {
      if (!message || !message.key || message.key.fromMe) continue;
      const jid = String(message.key.remoteJidAlt || message.key.remoteJid || "");
      if (!jid || jid === "status@broadcast" || jid.endsWith("@g.us")) continue;
      const rawNumber = jid.split("@")[0].split(":")[0];
      let phone = "";
      try { phone = normalizePhone(rawNumber); } catch (_) { continue; }
      for (const row of queue) {
        if (row.status !== "scheduled" || !row.stopOnReply) continue;
        let rowPhone = "";
        try { rowPhone = normalizePhone(row.phone); } catch (_) { continue; }
        if (rowPhone === phone) {
          row.status = "cancelled";
          row.lastError = "Pending follow-ups stopped after this contact replied.";
          row.updatedAt = new Date().toISOString();
          changed = true;
        }
      }
    }
    if (changed) {
      await saveQueue();
      publish("reply-detected");
    }
  }

  async function sendDueMessage(row) {
    if (!socket || !status.connected) return;
    const now = Date.now();
    const sentToday = queue.filter(item => item.status === "sent" && item.sentAt && new Date(item.sentAt).toDateString() === new Date().toDateString()).length;
    if (sentToday >= DAILY_SEND_LIMIT) {
      row.status = "failed";
      row.lastError = "EstateFlow's daily safety limit of " + DAILY_SEND_LIMIT + " automated sends was reached. Reschedule this message for another day.";
      row.updatedAt = new Date().toISOString();
      await saveQueue();
      publish("daily-limit");
      return;
    }
    if (now - lastSendAt < SEND_COOLDOWN_MS) return;
    if (now - Date.parse(row.scheduledAt) > MISSED_SCHEDULE_GRACE_MS) {
      row.status = "failed";
      row.lastError = "The app or WhatsApp was offline at the scheduled time. Review and reschedule instead of sending a late message automatically.";
      row.updatedAt = new Date().toISOString();
      await saveQueue();
      publish("missed");
      return;
    }
    if (!row.consentConfirmed) {
      row.status = "failed";
      row.lastError = "Consent confirmation is required before delivery.";
      row.updatedAt = new Date().toISOString();
      await saveQueue();
      publish("consent");
      return;
    }
    sending = true;
    row.status = "sending";
    row.updatedAt = new Date().toISOString();
    await saveQueue();
    publish("sending");
    try {
      const phone = normalizePhone(row.phone);
      const result = await socket.sendMessage(phone + "@s.whatsapp.net", { text: row.message });
      row.status = "sent";
      row.sentAt = new Date().toISOString();
      row.messageId = String(result && result.key && result.key.id || "");
      row.lastError = "";
      lastSendAt = Date.now();
      await saveQueue();
      publish("sent");
    } catch (error) {
      row.status = "failed";
      row.lastError = error instanceof Error ? error.message : String(error);
      row.updatedAt = new Date().toISOString();
      await saveQueue();
      publish("send-failed");
    } finally {
      sending = false;
    }
  }

  async function schedulerTick() {
    if (sending || !socket || !status.connected) return;
    await ensureQueueLoaded();
    const now = Date.now();
    const due = queue.filter(row => row.status === "scheduled" && Date.parse(row.scheduledAt) <= now)
      .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
    if (!due.length) return;
    await sendDueMessage(due[0]);
  }

  async function schedule(payload, immediate = false) {
    await ensureQueueLoaded();
    const phone = normalizePhone(payload && payload.phone);
    const message = String(payload && payload.message || "").trim();
    if (!message) throw new Error("Write a message before scheduling.");
    if (message.length > MAX_MESSAGE_LENGTH) throw new Error("Messages must be " + MAX_MESSAGE_LENGTH + " characters or fewer.");
    if (!payload || payload.consentConfirmed !== true) throw new Error("Confirm that this client expects and has agreed to receive these messages.");
    const scheduledMs = Date.parse(payload.scheduledAt);
    if (!Number.isFinite(scheduledMs)) throw new Error("Choose a valid send date and time.");
    if (!immediate && scheduledMs <= Date.now()) throw new Error("Choose a future date and time.");
    const repeatCount = Math.max(1, Math.min(MAX_REPEAT_COUNT, Number.parseInt(payload.repeatCount, 10) || 1));
    const intervalDays = Math.max(1, Math.min(365, Number.parseInt(payload.intervalDays, 10) || 1));
    const seriesId = crypto.randomUUID();
    const contactName = String(payload.contactName || "").trim().slice(0, 160);
    const stopOnReply = payload.stopOnReply !== false;
    const rows = [];
    for (let index = 0; index < repeatCount; index++) {
      const dueAt = new Date(scheduledMs + (index * intervalDays * 24 * 60 * 60 * 1000));
      rows.push({
        id: crypto.randomUUID(),
        seriesId,
        sequence: index + 1,
        repeatCount,
        phone,
        contactName,
        message,
        scheduledAt: dueAt.toISOString(),
        status: "scheduled",
        consentConfirmed: true,
        stopOnReply,
        createdAt: new Date().toISOString(),
        sentAt: "",
        lastError: "",
        messageId: ""
      });
    }
    queue.push(...rows);
    await saveQueue();
    publish("scheduled");
    return { ok: true, rows };
  }

  async function sendNow(payload) {
    const result = await schedule({ ...payload, scheduledAt: new Date(Date.now() + 1000).toISOString(), repeatCount: 1 }, true);
    return result;
  }

  async function cancelMessage(id) {
    await ensureQueueLoaded();
    const row = queue.find(item => item.id === id);
    if (!row || row.status !== "scheduled") return { ok: false, message: "Only pending messages can be cancelled." };
    row.status = "cancelled";
    row.lastError = "Cancelled by user.";
    row.updatedAt = new Date().toISOString();
    await saveQueue();
    publish("cancelled");
    return { ok: true };
  }

  async function retryMessage(id) {
    await ensureQueueLoaded();
    const row = queue.find(item => item.id === id);
    if (!row || row.status !== "failed") return { ok: false, message: "Only failed messages can be rescheduled." };
    row.status = "scheduled";
    row.scheduledAt = new Date(Date.now() + 60 * 1000).toISOString();
    row.lastError = "";
    row.updatedAt = new Date().toISOString();
    await saveQueue();
    publish("retry-queued");
    return { ok: true };
  }

  async function disconnect() {
    intentionalLogout = true;
    pairingRequested = false;
    const current = socket;
    socket = null;
    status.connected = false;
    status.connecting = false;
    status.senderNumber = "";
    status.displayName = "";
    status.qrDataUrl = "";
    status.pairingCode = "";
    status.error = "";
    if (current) {
      try { await current.logout(); } catch (_) {}
      try { current.end(undefined); } catch (_) {}
    }
    try { await fs.rm(authDir, { recursive: true, force: true }); } catch (_) {}
    authState = null;
    publish("disconnected");
    return { ok: true };
  }

  async function requestPairingCode(rawPhone) {
    const phone = normalizePhone(rawPhone);
    pairingRequested = true;
    status.qrDataUrl = "";
    status.pairingCode = "";
    await startSocket();
    if (!socket || status.connected) throw new Error("A pairing code is only needed when WhatsApp is not already connected.");
    if (authState && authState.creds && authState.creds.registered) throw new Error("This WhatsApp account is already registered in EstateFlow. Disconnect it first before pairing another number.");
    const code = await socket.requestPairingCode(phone);
    status.pairingCode = String(code || "");
    status.qrDataUrl = "";
    status.error = "";
    publish("pairing-code");
    return { ok: true, code: status.pairingCode };
  }

  async function getQueue() {
    await ensureQueueLoaded();
    return queue.slice().sort((a, b) => Date.parse(b.scheduledAt) - Date.parse(a.scheduledAt)).slice(0, 500);
  }

  async function getStatus() {
    await ensureQueueLoaded();
    return snapshotStatus();
  }

  ipcMain.handle("estateflow:wa:get-status", getStatus);
  ipcMain.handle("estateflow:wa:get-queue", getQueue);
  ipcMain.handle("estateflow:wa:connect", async () => {
    pairingRequested = false;
    status.pairingCode = "";
    return startSocket();
  });
  ipcMain.handle("estateflow:wa:pairing-code", async (_event, phone) => requestPairingCode(phone));
  ipcMain.handle("estateflow:wa:disconnect", disconnect);
  ipcMain.handle("estateflow:wa:schedule", async (_event, payload) => schedule(payload, false));
  ipcMain.handle("estateflow:wa:send-now", async (_event, payload) => sendNow(payload));
  ipcMain.handle("estateflow:wa:cancel", async (_event, id) => cancelMessage(String(id || "")));
  ipcMain.handle("estateflow:wa:retry", async (_event, id) => retryMessage(String(id || "")));

  tick = setInterval(() => { void schedulerTick().catch(error => { status.error = error instanceof Error ? error.message : String(error); publish("scheduler-error"); }); }, 4000);
  void ensureQueueLoaded().then(async () => {
    try {
      await fs.access(path.join(authDir, "creds.json"));
      await startSocket();
    } catch (_) {}
  });
  publish("ready");

  return {
    stop() {
      if (tick) clearInterval(tick);
      tick = null;
      intentionalLogout = true;
      if (socket) {
        try { socket.end(undefined); } catch (_) {}
        socket = null;
      }
    }
  };
}

module.exports = { createWhatsAppService };
