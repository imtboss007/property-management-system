import fs from "node:fs/promises";
import path from "node:path";
import makeWASocket, { Browsers, DisconnectReason, useMultiFileAuthState } from "@whiskeysockets/baileys";
import QRCode from "qrcode";

function digits(raw) {
  let value = String(raw || "").replace(/\D/g, "");
  if (value.startsWith("00")) value = value.slice(2);
  if (value.length === 11 && value.startsWith("0")) value = value.slice(1);
  if (value.length === 10) value = "91" + value;
  if (value.length < 8 || value.length > 15) {
    throw new Error("Enter a valid WhatsApp phone number including country code.");
  }
  return value;
}

function phoneFromJid(jid) {
  const raw = String(jid || "");
  if (!raw.endsWith("@s.whatsapp.net") && !raw.endsWith("@c.us")) return "";
  const value = raw.split("@")[0].split(":")[0].replace(/\D/g, "");
  return value.length >= 8 && value.length <= 15 ? "+" + value : "";
}

function connectionCode(error) {
  return error?.output?.statusCode ?? error?.data?.statusCode ?? error?.statusCode ?? 0;
}

export function createBaileysProvider(config) {
  // The linked-device credentials are session secrets; default all new files to owner-only permissions.
  process.umask(0o077);
  const authDir = path.join(config.dataDir, "baileys-auth");
  let socket = null;
  let connected = false;
  let connecting = false;
  let qrDataUrl = "";
  let connectionState = "disconnected";
  let lastConnectedAt = "";
  let lastError = "";
  let senderNumber = "";
  let displayName = "";
  let manualDisconnect = false;
  let startPromise = null;
  let reconnectTimer = null;
  let incomingHandler = () => {};
  const contacts = new Map();

  function publishContact(raw) {
    if (!raw || typeof raw !== "object") return;
    const jid = String(raw.id || raw.jid || "");
    if (!jid || jid.endsWith("@g.us") || jid.endsWith("@broadcast")) return;
    const phone = phoneFromJid(jid) || (raw.phoneNumber ? phoneFromJid(String(raw.phoneNumber).replace(/^\+/, "") + "@s.whatsapp.net") : "");
    const key = jid || phone;
    if (!key) return;
    const previous = contacts.get(key) || {};
    contacts.set(key, {
      id: jid || key,
      jid,
      phone: phone || previous.phone || "",
      name: String(raw.name || raw.notify || raw.verifiedName || raw.pushName || previous.name || phone || jid),
      whatsappName: String(raw.name || raw.notify || raw.verifiedName || raw.pushName || previous.whatsappName || ""),
      notify: String(raw.notify || previous.notify || ""),
      verifiedName: String(raw.verifiedName || previous.verifiedName || ""),
      lastSyncedAt: new Date().toISOString()
    });
  }

  function currentStatus() {
    return {
      supported: true,
      platform: "cloud-baileys",
      connected,
      connecting,
      senderNumber,
      displayName,
      qrDataUrl,
      pairingCode: "",
      error: lastError,
      connectionState,
      lastConnectedAt
    };
  }

  async function startSocket() {
    if (connected && socket) return socket;
    if (startPromise) return startPromise;
    manualDisconnect = false;
    startPromise = (async () => {
      await fs.mkdir(authDir, { recursive: true, mode: 0o700 });
      await fs.chmod(authDir, 0o700);
      const auth = await useMultiFileAuthState(authDir);
      connecting = true;
      connectionState = auth.state.creds.registered ? "reconnecting" : "starting";
      lastError = "";
      socket = makeWASocket({
        auth: auth.state,
        printQRInTerminal: false,
        browser: Browsers.macOS("AXIVESTRA Cloud"),
        markOnlineOnConnect: false,
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => false,
        connectTimeoutMs: 30000,
        defaultQueryTimeoutMs: 30000
      });
      socket.ev.on("creds.update", () => { void auth.saveCreds().catch(error => { lastError = "Could not persist WhatsApp session credentials: " + String(error?.message || error); }); });
      socket.ev.on("contacts.upsert", rows => { for (const row of rows || []) publishContact(row); });
      socket.ev.on("contacts.update", rows => { for (const row of rows || []) publishContact(row); });
      socket.ev.on("messages.upsert", event => {
        for (const message of event?.messages || []) {
          const key = message?.key || {};
          const remoteJid = String(key.remoteJid || "");
          if (key.fromMe || !remoteJid || remoteJid === "status@broadcast" || remoteJid.endsWith("@broadcast")) continue;
          const messageName = String(message?.pushName || "");
          if (!remoteJid.endsWith("@g.us")) {
            publishContact({ id: remoteJid, pushName: messageName });
          }
          try {
            incomingHandler({ remoteJid, phone: phoneFromJid(remoteJid), fromMe: Boolean(key.fromMe), pushName: messageName });
          } catch (_) {}
        }
      });
      socket.ev.on("connection.update", update => {
        if (update.qr) {
          connectionState = "qr_ready";
          connected = false;
          connecting = true;
          void QRCode.toDataURL(update.qr, { margin: 1, width: 320 })
            .then(value => { qrDataUrl = value; })
            .catch(error => { lastError = "Could not prepare the WhatsApp QR code: " + String(error?.message || error); });
        }
        if (update.connection === "open") {
          connected = true;
          connecting = false;
          connectionState = "connected";
          qrDataUrl = "";
          lastError = "";
          lastConnectedAt = new Date().toISOString();
          const userId = String(socket?.user?.id || "");
          senderNumber = phoneFromJid(userId) || "";
          displayName = String(socket?.user?.name || "");
        }
        if (update.connection === "close") {
          connected = false;
          connecting = false;
          qrDataUrl = "";
          const code = connectionCode(update.lastDisconnect?.error);
          const loggedOut = code === DisconnectReason.loggedOut;
          connectionState = loggedOut ? "logged_out" : "disconnected";
          if (loggedOut) {
            lastError = "WhatsApp unlinked this cloud session. Reconnect with a fresh QR code.";
            senderNumber = "";
            displayName = "";
          } else {
            lastError = update.lastDisconnect?.error?.message
              ? "WhatsApp connection interrupted; the cloud sender will try to reconnect."
              : "";
          }
          socket = null;
          if (!manualDisconnect && !loggedOut) {
            clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(() => { void startSocket().catch(() => {}); }, 3000);
            reconnectTimer.unref?.();
          }
        }
      });
      return socket;
    })().finally(() => { startPromise = null; });
    return startPromise;
  }

  async function connect() {
    manualDisconnect = false;
    await startSocket();
    return currentStatus();
  }

  async function status() {
    return currentStatus();
  }

  async function requestPairingCode(rawPhone) {
    const phone = digits(rawPhone);
    if (connected) throw new Error("This WhatsApp account is already connected to the cloud sender.");
    await startSocket();
    if (!socket) throw new Error("The cloud WhatsApp session is not ready. Try Connect with QR first.");
    try {
      const code = await socket.requestPairingCode(phone);
      return { ok: true, code: String(code || "") };
    } catch (error) {
      throw new Error("Could not create a WhatsApp pairing code. Try scanning the QR code instead. " + String(error?.message || error).slice(0, 220));
    }
  }

  async function disconnect() {
    manualDisconnect = true;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    try { if (socket) await socket.logout(); } catch (_) {}
    socket = null;
    connected = false;
    connecting = false;
    qrDataUrl = "";
    senderNumber = "";
    displayName = "";
    connectionState = "disconnected";
    lastError = "";
    await fs.rm(authDir, { recursive: true, force: true });
    return { ok: true };
  }

  async function listContacts() {
    if (!connected || !socket) throw new Error("Connect WhatsApp on the cloud sender before syncing contacts.");
    return [...contacts.values()];
  }

  async function listGroups() {
    if (!connected || !socket) throw new Error("Connect WhatsApp on the cloud sender before syncing groups.");
    if (typeof socket.groupFetchAllParticipating !== "function") {
      throw new Error("This WhatsApp connection cannot fetch group details right now.");
    }
    const groups = await socket.groupFetchAllParticipating();
    return Object.entries(groups || {}).map(([id, group]) => ({
      id,
      jid: id,
      subject: String(group?.subject || "WhatsApp group"),
      name: String(group?.subject || "WhatsApp group"),
      desc: String(group?.desc || ""),
      size: Array.isArray(group?.participants) ? group.participants.length : 0
    }));
  }

  async function sendText(rawPhoneOrJid, message) {
    if (!connected || !socket) throw new Error("The cloud WhatsApp sender is not connected.");
    const raw = String(rawPhoneOrJid || "").trim();
    const destination = raw.endsWith("@g.us") || raw.endsWith("@s.whatsapp.net") || raw.endsWith("@c.us") || raw.endsWith("@lid")
      ? raw
      : digits(raw) + "@s.whatsapp.net";
    const result = await socket.sendMessage(destination, { text: String(message || "") });
    return { ok: true, messageId: String(result?.key?.id || "") };
  }

  const provider = {
    name: "baileys",
    status,
    connect,
    requestPairingCode,
    disconnect,
    listContacts,
    listGroups,
    sendText,
    setIncomingHandler(callback) { incomingHandler = typeof callback === "function" ? callback : () => {}; }
  };

  // Reconnect from the persistent linked-device credentials after host restarts.
  void fs.readFile(path.join(authDir, "creds.json"), "utf8")
    .then(text => JSON.parse(text))
    .then(creds => { if (creds?.registered) return startSocket(); })
    .catch(() => {});

  return provider;
}
