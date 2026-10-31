const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const http = require("node:http");
const os = require("node:os");
const QRCode = require("qrcode");

const MAX_MESSAGE_LENGTH = 4000;
const MAX_REPEAT_COUNT = 20;
const DAILY_SEND_LIMIT = 60;
const SEND_COOLDOWN_MS = 12000;
const MISSED_SCHEDULE_GRACE_MS = 30 * 60 * 1000;

function normalizeDigits(raw) {
  return String(raw || "").replace(/\D/g, "");
}

function contactDigits(contact) {
  let digits = normalizeDigits(contact && (contact.phone || contact.phoneNumber));
  if (!digits) {
    const jid = String(contact && (contact.jid || contact.id) || "");
    if (jid.toLowerCase().endsWith("@s.whatsapp.net")) {
      digits = normalizeDigits(jid.split("@")[0].split(":")[0]);
    }
  }
  return digits.startsWith("00") ? digits.slice(2) : digits;
}

function whatsAppContactKeys(contact) {
  const keys = [];
  const digits = contactDigits(contact);
  if (digits) keys.push("phone:" + digits);
  for (const value of [contact && contact.jid, contact && contact.id]) {
    const jid = String(value || "").trim().toLowerCase();
    if (!jid) continue;
    if (jid.endsWith("@s.whatsapp.net")) {
      const jidDigits = normalizeDigits(jid.split("@")[0].split(":")[0]);
      if (jidDigits) keys.push("phone:" + (jidDigits.startsWith("00") ? jidDigits.slice(2) : jidDigits));
    } else {
      keys.push("jid:" + jid);
    }
  }
  return [...new Set(keys)];
}

function mergeWhatsAppContact(saved, incoming) {
  const merged = { ...saved, ...incoming };
  const incomingName = String(incoming.whatsappName || incoming.name || "").trim();
  const savedName = String(saved.whatsappName || saved.name || "").trim();
  const incomingLooksLikeNumber = /^\+?[\d\s().-]+$/.test(incomingName);
  merged.id = saved.id || incoming.id || incoming.jid || saved.jid || "";
  merged.jid = incoming.jid || saved.jid || merged.id;
  merged.phone = incoming.phone || saved.phone || "";
  merged.whatsappName = incoming.whatsappName || saved.whatsappName || "";
  merged.name = incoming.whatsappName || saved.whatsappName ||
    (incomingName && !incomingLooksLikeNumber ? incomingName : savedName || incomingName);
  for (const field of ["notify", "verifiedName", "source", "lastSyncedAt"]) {
    merged[field] = incoming[field] || saved[field] || "";
  }
  return merged;
}

function deduplicateWhatsAppContacts(records) {
  const result = [];
  const indexByKey = new Map();
  for (const contact of Array.isArray(records) ? records : []) {
    if (!contact || typeof contact !== "object") continue;
    const keys = whatsAppContactKeys(contact);
    const index = keys.map(key => indexByKey.get(key)).find(value => value !== undefined);
    if (index === undefined) {
      const nextIndex = result.push({ ...contact }) - 1;
      for (const key of keys) indexByKey.set(key, nextIndex);
    } else {
      result[index] = mergeWhatsAppContact(result[index], contact);
      for (const key of whatsAppContactKeys(result[index])) indexByKey.set(key, index);
    }
  }
  return result.sort((a, b) => String(a.name || a.whatsappName || "").localeCompare(String(b.name || b.whatsappName || "")));
}

function canonicalWhatsAppGroupJid(group) {
  const jid = String(group && (group.jid || group.id) || "").trim().toLowerCase();
  return jid.endsWith("@g.us") ? jid : "";
}

function deduplicateWhatsAppGroups(records) {
  const byJid = new Map();
  for (const group of Array.isArray(records) ? records : []) {
    if (!group || typeof group !== "object") continue;
    const jid = canonicalWhatsAppGroupJid(group);
    if (!jid) continue;
    const saved = byJid.get(jid);
    if (!saved) {
      byJid.set(jid, { ...group, id: group.id || jid, jid });
      continue;
    }
    const incomingName = String(group.name || group.subject || "").trim();
    const savedName = String(saved.name || saved.subject || "").trim();
    const name = incomingName && incomingName !== "WhatsApp group" ? incomingName : savedName || incomingName || "WhatsApp group";
    byJid.set(jid, {
      ...saved,
      ...group,
      id: saved.id || group.id || jid,
      jid,
      name,
      subject: group.subject || saved.subject || name,
      description: group.description || saved.description || "",
      size: Number(group.size) > 0 ? Number(group.size) : Number(saved.size) || 0,
      lastSyncedAt: group.lastSyncedAt || saved.lastSyncedAt || ""
    });
  }
  return [...byJid.values()].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

function normalizePhone(raw) {
  let digits = normalizeDigits(raw);
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
  const addressBookPath = path.join(userData, "whatsapp-address-book.json");
  const dataSyncPath = path.join(userData, "axivestra-data-sync.json");
  const documentIndexPath = path.join(userData, "axivestra-document-vault.json");
  const documentFilesDir = path.join(userData, "axivestra-document-vault");
  let dataSyncWrite = Promise.resolve();
  let dataSyncTransaction = Promise.resolve();
  let documentIndexWrite = Promise.resolve();
  let documentIndexTransaction = Promise.resolve();
  const bridgeTokenPath = path.join(userData, "whatsapp-companion-token.txt");
  const deviceTokenPath = path.join(userData, "axivestra-device-companion-token.txt");
  let bridgeToken = "";
  let deviceToken = "";
  let devicePairingCode = "";
  let devicePairingExpiresAt = 0;
  let bridgeServer = null;
  let bridgePort = 47821;
  let socket = null;
  let socketInit = null;
  let authState = null;
  let baileys = null;
  let queue = [];
  let queueLoaded = false;
  let queueWrite = Promise.resolve();
  let addressBookLoaded = false;
  let addressBookWrite = Promise.resolve();
  let whatsappContacts = [];
  let whatsappGroups = [];
  let addressBookMeta = { lastSyncedAt: "", accountNumber: "", activeGroupJids: [] };
  let addressBookDuplicatesRemoved = { contacts: 0, groups: 0 };
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
        notify({ reason, status: snapshotStatus(), queue: queue.slice(0, 10000) });
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
      return;
    }

    // A process may exit after recording a send as in-flight but before its final status is saved.
    // Never automatically resend that row: delivery may already have reached WhatsApp.
    let recoveredInterruptedSend = false;
    for (const row of queue) {
      if (!row || row.status !== "sending") continue;
      row.status = "failed";
      row.lastError = "AXIVESTRA restarted while this message was being sent. Delivery is uncertain; check the WhatsApp chat before retrying to avoid a duplicate.";
      row.updatedAt = new Date().toISOString();
      recoveredInterruptedSend = true;
    }
    if (recoveredInterruptedSend) {
      try {
        await saveQueue();
      } catch (error) {
        status.error = "Could not persist interrupted-message recovery: " + (error instanceof Error ? error.message : String(error));
      }
      publish("queue-recovered");
    }
  }

  function saveQueue() {
    queueWrite = queueWrite.catch(() => {}).then(async () => {
      const tempPath = queuePath + ".tmp";
      await fs.writeFile(tempPath, JSON.stringify(queue, null, 2), { encoding: "utf8", mode: 0o600 });
      await fs.rename(tempPath, queuePath);
    });
    return queueWrite;
  }

  async function ensureAddressBookLoaded() {
    if (addressBookLoaded) return;
    addressBookLoaded = true;
    try {
      const saved = JSON.parse(await fs.readFile(addressBookPath, "utf8"));
      whatsappContacts = Array.isArray(saved.contacts) ? saved.contacts : [];
      whatsappGroups = Array.isArray(saved.groups) ? saved.groups : [];
      addressBookMeta = { lastSyncedAt: String(saved.lastSyncedAt || ""), accountNumber: String(saved.accountNumber || ""), activeGroupJids: Array.isArray(saved.activeGroupJids) ? saved.activeGroupJids : [] };
    } catch (error) {
      if (error && error.code !== "ENOENT") {
        status.error = "Could not read the saved WhatsApp contacts/groups cache: " + error.message;
      }
      whatsappContacts = [];
      whatsappGroups = [];
      addressBookMeta = { lastSyncedAt: "", accountNumber: "", activeGroupJids: [] };
    }
    const previousContactCount = whatsappContacts.length;
    const previousGroupCount = whatsappGroups.length;
    whatsappContacts = deduplicateWhatsAppContacts(whatsappContacts);
    whatsappGroups = deduplicateWhatsAppGroups(whatsappGroups);
    addressBookDuplicatesRemoved = {
      contacts: Math.max(0, previousContactCount - whatsappContacts.length),
      groups: Math.max(0, previousGroupCount - whatsappGroups.length)
    };
    if (addressBookDuplicatesRemoved.contacts || addressBookDuplicatesRemoved.groups) {
      await saveAddressBook();
    }
  }

  function saveAddressBook() {
    addressBookWrite = addressBookWrite.catch(() => {}).then(async () => {
      await fs.mkdir(userData, { recursive: true });
      const tempPath = addressBookPath + ".tmp";
      await fs.writeFile(tempPath, JSON.stringify({
        contacts: whatsappContacts,
        groups: whatsappGroups,
        lastSyncedAt: addressBookMeta.lastSyncedAt,
        accountNumber: addressBookMeta.accountNumber,
        activeGroupJids: addressBookMeta.activeGroupJids
      }, null, 2), { encoding: "utf8", mode: 0o600 });
      await fs.rename(tempPath, addressBookPath);
    });
    return addressBookWrite;
  }

  function normalizeWaContact(raw) {
    if (!raw || typeof raw !== "object") return null;
    const rawJid = String(raw.id || raw.jid || "");
    let digits = normalizeDigits(raw.phoneNumber || raw.phone);
    if (!digits && rawJid.endsWith("@s.whatsapp.net")) {
      digits = normalizeDigits(rawJid.split("@")[0].split(":")[0]);
    }
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (digits.length < 8 || digits.length > 15) return null;
    const jid = rawJid.endsWith("@s.whatsapp.net") ? rawJid : digits + "@s.whatsapp.net";
    const suppliedName = String(raw.name || raw.verifiedName || raw.notify || raw.pushName || "").trim();
    const displayName = suppliedName || "+" + digits;
    return {
      id: jid,
      jid,
      phone: "+" + digits,
      name: displayName,
      whatsappName: suppliedName,
      notify: String(raw.notify || ""),
      verifiedName: String(raw.verifiedName || ""),
      source: "whatsapp",
      lastSyncedAt: new Date().toISOString()
    };
  }

  async function upsertWhatsAppContacts(records) {
    await ensureAddressBookLoaded();
    let changed = false;
    for (const raw of Array.isArray(records) ? records : []) {
      const incoming = normalizeWaContact(raw);
      if (!incoming) continue;
      const existingIndex = whatsappContacts.findIndex(item => item.id === incoming.id ||
        normalizeDigits(item.phone) === normalizeDigits(incoming.phone));
      if (existingIndex >= 0) {
        const previous = whatsappContacts[existingIndex];
        whatsappContacts[existingIndex] = {
          ...previous,
          ...incoming,
          whatsappName: incoming.whatsappName || previous.whatsappName || "",
          name: incoming.whatsappName || previous.whatsappName || previous.name || incoming.name,
          notify: incoming.notify || previous.notify || "",
          verifiedName: incoming.verifiedName || previous.verifiedName || ""
        };
      } else {
        whatsappContacts.push(incoming);
      }
      changed = true;
    }
    const contactCountBeforeCleanup = whatsappContacts.length;
    whatsappContacts = deduplicateWhatsAppContacts(whatsappContacts);
    const removedContacts = contactCountBeforeCleanup - whatsappContacts.length;
    if (removedContacts > 0) {
      addressBookDuplicatesRemoved.contacts += removedContacts;
      changed = true;
    }
    if (changed) {
      whatsappContacts.sort((a, b) => String(a.name).localeCompare(String(b.name)));
      await saveAddressBook();
      publish("address-book-updated");
    }
    return changed;
  }

  async function upsertWhatsAppGroups(records) {
    await ensureAddressBookLoaded();
    let changed = false;
    const items = Array.isArray(records) ? records : [];
    for (const raw of items) {
      if (!raw || typeof raw !== "object") continue;
      const jid = String(raw.id || raw.jid || "").trim().toLowerCase();
      if (!jid.endsWith("@g.us")) continue;
      const previous = whatsappGroups.find(item => item.jid === jid || item.id === jid);
      const subject = String(raw.subject || raw.name || previous?.name || "WhatsApp group").trim();
      const incoming = {
        id: jid,
        jid,
        name: subject || "WhatsApp group",
        subject: subject || "WhatsApp group",
        description: String(raw.desc || raw.description || previous?.description || ""),
        size: Number(raw.size || (Array.isArray(raw.participants) ? raw.participants.length : previous?.size || 0)),
        source: "whatsapp",
        lastSyncedAt: new Date().toISOString()
      };
      if (previous) {
        Object.assign(previous, incoming);
      } else {
        whatsappGroups.push(incoming);
      }
      changed = true;
    }
    const groupCountBeforeCleanup = whatsappGroups.length;
    whatsappGroups = deduplicateWhatsAppGroups(whatsappGroups);
    const removedGroups = groupCountBeforeCleanup - whatsappGroups.length;
    if (removedGroups > 0) {
      addressBookDuplicatesRemoved.groups += removedGroups;
      changed = true;
    }
    if (changed) {
      whatsappGroups.sort((a, b) => String(a.name).localeCompare(String(b.name)));
      await saveAddressBook();
      publish("address-book-updated");
    }
    return changed;
  }

  async function getAddressBook() {
    await ensureAddressBookLoaded();
    return {
      contacts: whatsappContacts.slice(),
      groups: whatsappGroups.slice(),
      lastSyncedAt: addressBookMeta.lastSyncedAt,
      accountNumber: addressBookMeta.accountNumber,
      activeGroupJids: addressBookMeta.activeGroupJids || [],
      connected: Boolean(status.connected && socket),
      counts: { contacts: whatsappContacts.length, groups: whatsappGroups.length },
      duplicatesRemoved: { ...addressBookDuplicatesRemoved }
    };
  }

  async function syncAddressBook() {
    await ensureAddressBookLoaded();
    if (!socket || !status.connected) {
      throw new Error("Connect WhatsApp first to sync current contacts and groups. Previously saved contacts and groups remain available while disconnected.");
    }
    const warnings = [];
    let activeGroupJids = [];
    if (typeof socket.groupFetchAllParticipating === "function") {
      try {
        const found = await socket.groupFetchAllParticipating();
        const values = Object.entries(found || {}).map(([jid, group]) => ({ ...group, id: group?.id || jid }));
        activeGroupJids = values.map(group => canonicalWhatsAppGroupJid(group)).filter(Boolean);
        await upsertWhatsAppGroups(values);
      } catch (error) {
        warnings.push("Could not refresh WhatsApp groups: " + (error instanceof Error ? error.message : String(error)));
      }
    } else {
      warnings.push("This WhatsApp session does not expose group-list sync.");
    }
    addressBookMeta.activeGroupJids = activeGroupJids;
    addressBookMeta.accountNumber = String(status.senderNumber || "");
    addressBookMeta.lastSyncedAt = new Date().toISOString();
    await saveAddressBook();
    const result = await getAddressBook();
    result.warnings = warnings;
    result.note = result.contacts.length
      ? "Synced the contacts made available by the linked WhatsApp session and refreshed group membership."
      : "WhatsApp did not provide contact entries to this linked session yet. Saved contacts remain available; keep WhatsApp linked and try again.";
    publish("address-book-synced");
    return result;
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
      Browsers: module.Browsers || {},
      DisconnectReason: module.DisconnectReason || {},
      fetchLatestBaileysVersion: module.fetchLatestBaileysVersion
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
        // Negotiate the current WhatsApp Web protocol version when online. Older
        // bundled defaults can be rejected before a QR is delivered. Keep a safe
        // fallback so temporary version-endpoint failures do not block connection.
        let webVersion;
        if (typeof lib.fetchLatestBaileysVersion === "function") {
          try {
            const latest = await lib.fetchLatestBaileysVersion();
            if (latest && Array.isArray(latest.version) && latest.version.length === 3) {
              webVersion = latest.version;
            }
          } catch (_) {}
        }
        const nextSocket = lib.makeWASocket({
          auth: auth.state,
          ...(webVersion ? { version: webVersion } : {}),
          // This sender runs as a Windows desktop app. Prefer a matching desktop fingerprint
          // rather than advertising itself as macOS; keep fallbacks for older Baileys builds.
          browser: typeof lib.Browsers.windows === "function"
            ? lib.Browsers.windows("AXIVESTRA")
            : typeof lib.Browsers.macOS === "function"
              ? lib.Browsers.macOS("Desktop")
              : undefined,
          printQRInTerminal: false,
          markOnlineOnConnect: false,
          // Avoid forcing a full history download during first-time device linking.
          // Contacts/groups are still synced from events and the explicit sync action.
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
            status.senderNumber = numberPart.replace(/\D/g, "") || status.senderNumber;
            status.displayName = String(nextSocket.user && nextSocket.user.name || "");
            pairingRequested = false;
            publish("connected");
            // Re-verify the linked account's current group list after QR pairing or reconnect.
            // This refreshes group eligibility automatically while the existing contact cache is
            // kept additive; users do not need to re-enter saved groups after an app restart.
            void syncAddressBook().catch(error => {
              status.error = "WhatsApp is linked, but automatic group refresh could not be saved. Saved contacts and scheduled messages are unchanged. " +
                (error instanceof Error ? error.message : String(error));
              publish("address-book-sync-error");
            });
          }
          if (update.connection === "close") {
            const disconnectError = update.lastDisconnect && update.lastDisconnect.error;
            const code = disconnectError && disconnectError.output && disconnectError.output.statusCode;
            const loggedOut = code === lib.DisconnectReason.loggedOut;
            const detail = String(disconnectError && (disconnectError.message || disconnectError.data || disconnectError.output?.payload?.message) || "").trim();
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
              status.error = "WhatsApp logged this linked device out. Connect again using QR or the pairing code." + (code ? " (code " + code + ")" : "");
              publish("logged-out");
              return;
            }
            // Keep the protocol close code visible: 401/405/428 often indicate a WhatsApp
            // handshake/session rejection, not a QR-rendering problem.
            status.error = "WhatsApp connection closed" + (code ? " (code " + code + ")" : "") +
              (detail ? ": " + detail : ".") + " Check the internet connection, then try a fresh QR. If this repeats, the linked-device library/session handshake may be rejected by WhatsApp.";
            publish("connection-lost");
            setTimeout(() => {
              if (!status.connected && !socket && !intentionalLogout) void startSocket();
            }, 5000);
          }
        });
        nextSocket.ev.on("contacts.upsert", records => { void upsertWhatsAppContacts(records).catch(error => { status.error = "Contact sync failed: " + error.message; publish("address-book-error"); }); });
        nextSocket.ev.on("contacts.update", records => { void upsertWhatsAppContacts(records).catch(error => { status.error = "Contact update failed: " + error.message; publish("address-book-error"); }); });
        nextSocket.ev.on("messaging-history.set", batch => {
          void (async () => {
            if (Array.isArray(batch?.contacts)) await upsertWhatsAppContacts(batch.contacts);
            if (Array.isArray(batch?.chats)) {
              await upsertWhatsAppGroups(batch.chats.filter(chat => String(chat.id || "").endsWith("@g.us")).map(chat => ({
                id: chat.id, subject: chat.name || chat.subject || "", size: chat.participantsCount || 0
              })));
            }
          })().catch(error => { status.error = "WhatsApp history sync failed: " + error.message; publish("address-book-error"); });
        });
        nextSocket.ev.on("groups.upsert", records => { void upsertWhatsAppGroups(records).catch(error => { status.error = "Group sync failed: " + error.message; publish("address-book-error"); }); });
        nextSocket.ev.on("groups.update", records => { void upsertWhatsAppGroups(records).catch(error => { status.error = "Group update failed: " + error.message; publish("address-book-error"); }); });
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
      if (!jid || jid === "status@broadcast") continue;
      if (jid.endsWith("@g.us")) {
        for (const row of queue) {
          if (row.status !== "scheduled" || !row.stopOnReply || row.groupJid !== jid) continue;
          row.status = "cancelled";
          row.lastError = "Pending group follow-ups stopped because a new message appeared in this WhatsApp group.";
          row.updatedAt = new Date().toISOString();
          changed = true;
        }
        continue;
      }
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
    if (row.destinationType === "group" && row.expectedSenderNumber && status.senderNumber !== row.expectedSenderNumber) {
      row.status = "failed";
      row.lastError = "The linked WhatsApp account changed after this group was scheduled. Reconnect the original account, verify the group, and schedule again.";
      row.updatedAt = new Date().toISOString();
      await saveQueue();
      publish("group-account-mismatch");
      return;
    }
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
      const destination = row.destinationType === "group" && String(row.groupJid || "").endsWith("@g.us")
        ? row.groupJid
        : normalizePhone(row.phone) + "@s.whatsapp.net";
      const result = await socket.sendMessage(destination, { text: row.message });
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
    await ensureAddressBookLoaded();
    const groupJid = String(payload && payload.groupJid || "").trim();
    const destinationType = groupJid ? "group" : "contact";
    let phone = "";
    let groupName = "";
    if (destinationType === "group") {
      if (!groupJid.endsWith("@g.us") || !whatsappGroups.some(group => group.jid === groupJid)) {
        throw new Error("Choose a group saved from your synced WhatsApp group list. Re-sync if this group is missing.");
      }
      if (!(addressBookMeta.activeGroupJids || []).includes(groupJid) || (status.senderNumber && addressBookMeta.accountNumber && status.senderNumber !== addressBookMeta.accountNumber)) {
        throw new Error("This group was not verified with the currently linked WhatsApp account. Connect that account and sync groups before scheduling to it.");
      }
      groupName = String(payload && payload.groupName || whatsappGroups.find(group => group.jid === groupJid)?.name || "WhatsApp group").trim();
    } else {
      phone = normalizePhone(payload && payload.phone);
    }
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
    const contactId = String(payload.contactId || "").slice(0, 120);
    const contactName = String(payload.contactName || "").trim().slice(0, 160);
    const propertyId = String(payload.propertyId || "").slice(0, 120);
    const propertyTitle = String(payload.propertyTitle || "").trim().slice(0, 240);
    const taskId = String(payload.taskId || "").slice(0, 120);
    const taskTitle = String(payload.taskTitle || "").trim().slice(0, 240);
    const stopOnReply = payload.stopOnReply !== false;
    const rows = [];
    for (let index = 0; index < repeatCount; index++) {
      const dueAt = new Date(scheduledMs + (index * intervalDays * 24 * 60 * 60 * 1000));
      rows.push({
        id: crypto.randomUUID(),
        seriesId,
        sequence: index + 1,
        repeatCount,
        destinationType,
        groupJid,
        groupName,
        expectedSenderNumber: destinationType === "group" ? addressBookMeta.accountNumber : "",
        phone,
        contactId,
        contactName,
        propertyId,
        propertyTitle,
        taskId,
        taskTitle,
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
    if (status.connected) throw new Error("WhatsApp is already connected. Disconnect the linked device before pairing a different number.");
    pairingRequested = true;
    status.qrDataUrl = "";
    status.pairingCode = "";
    status.error = "";
    publish("pairing-requested");
    try {
      await startSocket();
      if (!socket || status.connected) throw new Error("WhatsApp connected before a pairing code was needed. Refresh the status and try again.");
      if (authState && authState.creds && authState.creds.registered) {
        throw new Error("This WhatsApp account already has a saved linked-device session. Choose Disconnect first, then pair the intended number.");
      }
      // Baileys needs a live socket before requesting a phone-number pairing code.
      const activeSocket = socket;
      const code = await activeSocket.requestPairingCode(phone);
      if (socket !== activeSocket) throw new Error("The WhatsApp connection changed while generating the pairing code. Reconnect and try again.");
      const normalizedCode = String(code || "").replace(/\s+/g, "");
      if (!normalizedCode) throw new Error("WhatsApp did not return a pairing code. Try QR linking instead.");
      status.pairingCode = normalizedCode;
      status.qrDataUrl = "";
      status.error = "";
      publish("pairing-code");
      return { ok: true, code: status.pairingCode };
    } catch (error) {
      // Critical: never leave QR generation suppressed after a failed pairing-code request.
      pairingRequested = false;
      status.pairingCode = "";
      status.qrDataUrl = "";
      status.error = error instanceof Error ? error.message : String(error);
      publish("pairing-error");
      // If this was a fresh/unregistered session, recreate the socket so WhatsApp can emit
      // a new QR event. The QR event may have arrived while pairingRequested was true and
      // therefore was intentionally hidden; simply flipping the flag is not enough.
      if (!(authState && authState.creds && authState.creds.registered) && socket && !status.connected) {
        const previousSocket = socket;
        socket = null;
        try { previousSocket.end(undefined); } catch (_) {}
        status.connecting = false;
        try { await startSocket(); } catch (restartError) {
          status.error = (status.error ? status.error + " " : "") + "QR fallback could not restart: " +
            (restartError instanceof Error ? restartError.message : String(restartError));
          publish("pairing-fallback-error");
        }
      }
      throw error;
    }
  }

  async function getQueue() {
    await ensureQueueLoaded();
    return queue.slice().sort((a, b) => Date.parse(b.scheduledAt) - Date.parse(a.scheduledAt)).slice(0, 10000);
  }

  async function getStatus() {
    await ensureQueueLoaded();
    await ensureAddressBookLoaded();
    return snapshotStatus();
  }


  async function ensureBridgeToken() {
    if (bridgeToken) return bridgeToken;
    try {
      bridgeToken = (await fs.readFile(bridgeTokenPath, "utf8")).trim();
    } catch (_) {}
    if (!bridgeToken) {
      bridgeToken = crypto.randomBytes(32).toString("hex");
      await fs.writeFile(bridgeTokenPath, bridgeToken, { encoding: "utf8", mode: 0o600 });
    }
    return bridgeToken;
  }

  async function ensureDeviceToken() {
    if (deviceToken) return deviceToken;
    try { deviceToken = (await fs.readFile(deviceTokenPath, "utf8")).trim(); } catch (_) {}
    if (!deviceToken) await rotateDeviceToken();
    return deviceToken;
  }

  async function rotateDeviceToken() {
    deviceToken = crypto.randomBytes(32).toString("hex");
    await fs.writeFile(deviceTokenPath, deviceToken, { encoding: "utf8", mode: 0o600 });
    return deviceToken;
  }

  function getDevicePairingCode() {
    if (!devicePairingCode || Date.now() >= devicePairingExpiresAt) {
      devicePairingCode = crypto.randomBytes(32).toString("hex");
      devicePairingExpiresAt = Date.now() + 5 * 60 * 1000;
    }
    return { pairCode: devicePairingCode, pairExpiresAt: devicePairingExpiresAt };
  }

  function timingSafeTokenMatch(provided, expected) {
    const a = Buffer.from(String(provided || ""));
    const b = Buffer.from(String(expected || ""));
    return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
  }

    async function readDocumentIndex() {
    await fs.mkdir(documentFilesDir, { recursive: true });
    try {
      const saved = JSON.parse(await fs.readFile(documentIndexPath, "utf8"));
      return {
        version: 1,
        records: saved && saved.records && typeof saved.records === "object" && !Array.isArray(saved.records)
          ? saved.records : {}
      };
    } catch (error) {
      if (error && error.code !== "ENOENT") throw new Error("Could not read the saved AXIVESTRA document index: " + error.message);
      return { version: 1, records: {} };
    }
  }

  async function saveDocumentIndex(index) {
    documentIndexWrite = documentIndexWrite.catch(() => {}).then(async () => {
      const tempPath = documentIndexPath + ".tmp";
      await fs.writeFile(tempPath, JSON.stringify(index, null, 2), { encoding: "utf8", mode: 0o600 });
      await fs.rename(tempPath, documentIndexPath);
    });
    await documentIndexWrite;
  }

  async function withDocumentIndex(operation) {
    const previous = documentIndexTransaction;
    let release;
    documentIndexTransaction = new Promise(resolve => { release = resolve; });
    await previous.catch(() => {});
    try {
      const index = await readDocumentIndex();
      const result = await operation(index);
      await saveDocumentIndex(index);
      return result;
    } finally {
      release();
    }
  }

  function sanitizeDocumentRecord(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("A valid document record is required.");
    const id = String(value.id || "");
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error("Invalid document ID.");
    const sizeBytes = Number(value.sizeBytes);
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > 25 * 1024 * 1024) {
      throw new Error("Documents must be no larger than 25 MB.");
    }
    const companyId = String(value.companyId || "");
    return {
      id, companyId: companyId.slice(0, 128),
      propertyId: String(value.propertyId || "").slice(0, 128),
      property: String(value.property || "").slice(0, 500),
      contactId: String(value.contactId || "").slice(0, 128),
      name: String(value.name || "Document").slice(0, 255),
      category: String(value.category || "Other").slice(0, 120),
      storagePath: id,
      mimeType: String(value.mimeType || "application/octet-stream").slice(0, 160),
      sizeBytes,
      expiresOn: String(value.expiresOn || "").slice(0, 40),
      notes: String(value.notes || "").slice(0, 5000),
      createdAt: String(value.createdAt || new Date().toISOString()).slice(0, 60)
    };
  }

  async function listSyncedDocuments(companyIdInput = "") {
    const index = await readDocumentIndex();
    const companyId = String(companyIdInput || "");
    return Object.values(index.records).filter(item => String(item.companyId || "") === companyId).map(item => ({
      id: item.id, companyId: item.companyId || "",
      record: item.record || null, sha256: item.sha256 || "",
      updatedAt: item.updatedAt || "", deletedAt: item.deletedAt || ""
    }));
  }

  async function uploadSyncedDocument(body) {
    const record = sanitizeDocumentRecord(body.record);
    const base64 = String(body.base64 || "");
    if (!base64 || base64.length > 36 * 1024 * 1024 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) {
      throw new Error("Invalid document file data.");
    }
    const bytes = Buffer.from(base64, "base64");
    if (bytes.length !== record.sizeBytes || bytes.length > 25 * 1024 * 1024) {
      throw new Error("The document file size does not match its metadata or exceeds 25 MB.");
    }
    const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    return await withDocumentIndex(async index => {
      const previous = index.records[record.id];
      if (previous?.deletedAt) throw new Error("This document was deleted from the shared vault and cannot be restored by routine sync.");
      if (previous && String(previous.companyId || "") !== record.companyId) {
        throw new Error("This document ID already belongs to a different company workspace.");
      }
      const filePath = path.join(documentFilesDir, record.id + ".bin");
      const tempPath = filePath + ".tmp";
      await fs.writeFile(tempPath, bytes, { mode: 0o600 });
      await fs.rename(tempPath, filePath);
      const entry = { id: record.id, companyId: record.companyId, record, sha256,
        updatedAt: new Date().toISOString(), deletedAt: "" };
      index.records[record.id] = entry;
      return { id: record.id, companyId: record.companyId, sha256, updatedAt: entry.updatedAt };
    });
  }

  async function getSyncedDocumentFile(idInput, companyIdInput) {
    const id = String(idInput || "");
    const companyId = String(companyIdInput || "");
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error("Invalid document ID.");
    const index = await readDocumentIndex();
    const item = index.records[id];
    if (!item || item.deletedAt || !item.record) throw new Error("This shared document is not available.");
    if (String(item.companyId || "") !== companyId) throw new Error("This document belongs to a different company workspace.");
    const bytes = await fs.readFile(path.join(documentFilesDir, id + ".bin"));
    return { id, record: item.record, sha256: item.sha256, updatedAt: item.updatedAt, base64: bytes.toString("base64") };
  }

  async function deleteSyncedDocument(body) {
    const id = String(body.id || "");
    const companyId = String(body.companyId || "");
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error("Invalid document ID.");
    return await withDocumentIndex(async index => {
      const now = new Date().toISOString();
      const previous = index.records[id];
      if (previous && String(previous.companyId || "") !== companyId) {
        throw new Error("This document belongs to a different company workspace.");
      }
      index.records[id] = {
        id, companyId,
        record: previous?.record || null,
        sha256: previous?.sha256 || "",
        updatedAt: now, deletedAt: previous?.deletedAt || now
      };
      try { await fs.rm(path.join(documentFilesDir, id + ".bin"), { force: true }); } catch (_) {}
      return { id, companyId, deletedAt: index.records[id].deletedAt };
    });
  }

  async function readDataSyncStore() {
    try {
      const value = JSON.parse(await fs.readFile(dataSyncPath, "utf8"));
      return {
        schemaVersion: 1,
        revision: Number.isSafeInteger(value.revision) && value.revision >= 0 ? value.revision : 0,
        updatedAt: String(value.updatedAt || ""),
        snapshot: value.snapshot && typeof value.snapshot === "object" ? value.snapshot : {}
      };
    } catch (error) {
      if (error && error.code !== "ENOENT") throw new Error("Could not read the saved AXIVESTRA sync store: " + error.message);
      return { schemaVersion: 1, revision: 0, updatedAt: "", snapshot: {} };
    }
  }

  async function saveDataSyncStore(value) {
    dataSyncWrite = dataSyncWrite.catch(() => {}).then(async () => {
      const tempPath = dataSyncPath + ".tmp";
      await fs.writeFile(tempPath, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600 });
      await fs.rename(tempPath, dataSyncPath);
    });
    await dataSyncWrite;
  }

  async function commitDataSync(expectedRevision, snapshot) {
    const previous = dataSyncTransaction;
    let release;
    dataSyncTransaction = new Promise(resolve => { release = resolve; });
    await previous.catch(() => {});
    try {
      const current = await readDataSyncStore();
      if (current.revision !== expectedRevision) return { conflict: true, current };
      const next = { schemaVersion: 1, revision: current.revision + 1, updatedAt: new Date().toISOString(), snapshot };
      await saveDataSyncStore(next);
      return { conflict: false, next };
    } finally {
      release();
    }
  }

  function bridgeInfo() {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    const isPrivateIPv4 = address => /^10\./.test(address)
      || /^192\.168\./.test(address)
      || /^172\.(1[6-9]|2\d|3[01])\./.test(address);
    for (const entries of Object.values(interfaces)) {
      for (const item of entries || []) {
        if (!item || item.internal || !(item.family === "IPv4" || item.family === 4) || !isPrivateIPv4(item.address)) continue;
        addresses.push("http://" + item.address + ":" + bridgePort);
      }
    }
    return { port: bridgePort, urls: Array.from(new Set(addresses)), ...getDevicePairingCode() };
  }

  function bridgeReply(response, code, value) {
    response.writeHead(code, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-EstateFlow-Token",
      "Access-Control-Allow-Private-Network": "true",
      "Cache-Control": "no-store"
    });
    response.end(JSON.stringify(value));
  }

  async function readBridgeBody(request, maxBytes = 1024 * 1024) {
    let raw = "";
    for await (const chunk of request) {
      raw += chunk.toString("utf8");
      if (raw.length > maxBytes) throw new Error("Request body is too large.");
    }
    return raw.trim() ? JSON.parse(raw) : {};
  }

  function suppliedBridgeToken(request, url) {
    return String(request.headers["x-estateflow-token"] || url.searchParams.get("token") || "");
  }

  function bridgeTokenValid(request, url) {
    const value = suppliedBridgeToken(request, url);
    return timingSafeTokenMatch(value, bridgeToken) || timingSafeTokenMatch(value, deviceToken);
  }

  async function handleBridgeRequest(request, response) {
    if (request.method === "OPTIONS") {
      bridgeReply(response, 204, {});
      return;
    }
    const url = new URL(request.url || "/", "http://localhost");
    if (!url.pathname.startsWith("/api/")) {
      bridgeReply(response, 404, { ok: false, error: "Not found." });
      return;
    }
    // QR codes contain only a short-lived, single-use pairing ticket, never a live API token.
    if (request.method === "POST" && url.pathname === "/api/pair") {
      try {
        const body = await readBridgeBody(request, 64 * 1024);
        const supplied = String(body.pairCode || "");
        if (!devicePairingCode || Date.now() >= devicePairingExpiresAt
          || !timingSafeTokenMatch(supplied, devicePairingCode)) {
          bridgeReply(response, 401, { ok: false, error: "This link code expired or was already used. Refresh the code on the Windows PC." });
          return;
        }
        devicePairingCode = "";
        devicePairingExpiresAt = 0;
        bridgeReply(response, 200, { ok: true, token: deviceToken });
      } catch (error) {
        bridgeReply(response, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
      }
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/unpair" && bridgeTokenValid(request, url)) {
      if (!timingSafeTokenMatch(suppliedBridgeToken(request, url), deviceToken)) {
        bridgeReply(response, 403, { ok: false, error: "Only the linked phone can revoke its device token." });
        return;
      }
      try {
        await rotateDeviceToken();
        bridgeReply(response, 200, { ok: true });
      } catch (error) {
        bridgeReply(response, 500, { ok: false, error: "Could not revoke the phone link." });
      }
      return;
    }
    if (!bridgeTokenValid(request, url)) {
      bridgeReply(response, 401, { ok: false, error: "Invalid EstateFlow desktop companion code." });
      return;
    }
    try {
      const route = url.pathname;
      const bodyLimit = route === "/api/data-sync" ? 25 * 1024 * 1024
        : route === "/api/documents/upload" ? 36 * 1024 * 1024 : 1024 * 1024;
      const body = request.method === "POST" ? await readBridgeBody(request, bodyLimit) : {};
      if (request.method === "GET" && route === "/api/data-sync") {
        const store = await readDataSyncStore();
        bridgeReply(response, 200, { ok: true, schemaVersion: store.schemaVersion, revision: store.revision, updatedAt: store.updatedAt, snapshot: store.snapshot });
        return;
      }
      if (request.method === "GET" && route === "/api/documents") {
        bridgeReply(response, 200, { ok: true, documents: await listSyncedDocuments(url.searchParams.get("companyId") || "") });
        return;
      }
      if (request.method === "GET" && route === "/api/documents/file") {
        const file = await getSyncedDocumentFile(url.searchParams.get("id"), url.searchParams.get("companyId"));
        bridgeReply(response, 200, { ok: true, ...file });
        return;
      }
      if (request.method === "POST" && route === "/api/data-sync") {
        const expectedRevision = Number(body.expectedRevision);
        if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new Error("A valid sync revision is required.");
        const snapshot = body.snapshot;
        if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) throw new Error("A valid AXIVESTRA data snapshot is required.");
        const allowed = ["properties", "contacts", "whatsappGroups", "tasks", "financials", "riskRecords", "approvalRequests", "auditEvents"];
        for (const key of allowed) {
          if (snapshot[key] !== undefined && !Array.isArray(snapshot[key])) throw new Error("Invalid data collection: " + key);
          if (Array.isArray(snapshot[key]) && snapshot[key].length > 50000) throw new Error("Collection exceeds the 50,000-record safety limit: " + key);
        }
        const committed = await commitDataSync(expectedRevision, snapshot);
        if (committed.conflict) {
          const current = committed.current;
          bridgeReply(response, 409, { ok: false, error: "The PC sync store changed since it was read. Sync again to merge the latest version.", revision: current.revision, updatedAt: current.updatedAt, snapshot: current.snapshot });
          return;
        }
        const next = committed.next;
        bridgeReply(response, 200, { ok: true, schemaVersion: next.schemaVersion, revision: next.revision, updatedAt: next.updatedAt });
        return;
      }
      if (request.method === "GET" && route === "/api/status") {
        bridgeReply(response, 200, { ok: true, status: await getStatus() });
        return;
      }
      if (request.method === "GET" && route === "/api/queue") {
        bridgeReply(response, 200, { ok: true, queue: await getQueue() });
        return;
      }
      if (request.method === "GET" && route === "/api/address-book") {
        bridgeReply(response, 200, { ok: true, addressBook: await getAddressBook() });
        return;
      }
      if (request.method !== "POST") {
        bridgeReply(response, 405, { ok: false, error: "Method not allowed." });
        return;
      }
      let result;
      if (route === "/api/documents/upload") {
        result = await uploadSyncedDocument(body);
      } else if (route === "/api/documents/delete") {
        result = await deleteSyncedDocument(body);
      } else if (route === "/api/sync-address-book") {
        result = await syncAddressBook();
      } else if (route === "/api/connect") {
        pairingRequested = false;
        status.pairingCode = "";
        result = await startSocket();
      } else if (route === "/api/pairing-code") {
        result = await requestPairingCode(body.phone);
      } else if (route === "/api/disconnect") {
        result = await disconnect();
      } else if (route === "/api/schedule") {
        result = await schedule(body, false);
      } else if (route === "/api/send-now") {
        result = await sendNow(body);
      } else if (route === "/api/cancel") {
        result = await cancelMessage(String(body.id || ""));
      } else if (route === "/api/retry") {
        result = await retryMessage(String(body.id || ""));
      } else {
        bridgeReply(response, 404, { ok: false, error: "Unknown endpoint." });
        return;
      }
      bridgeReply(response, 200, { ...result, status: snapshotStatus(), queue: queue.slice(0, 200) });
    } catch (error) {
      bridgeReply(response, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  async function startBridge() {
    await ensureBridgeToken();
    await ensureDeviceToken();
    if (bridgeServer) return;
    const server = http.createServer((request, response) => {
      void handleBridgeRequest(request, response).catch(error => {
        try { bridgeReply(response, 500, { ok: false, error: error instanceof Error ? error.message : String(error) }); } catch (_) {}
      });
    });
    let started = false;
    for (let port = 47821; port <= 47840; port++) {
      try {
        await new Promise((resolve, reject) => {
          const onError = error => { server.removeListener("listening", onListening); reject(error); };
          const onListening = () => { server.removeListener("error", onError); resolve(); };
          server.once("error", onError);
          server.once("listening", onListening);
          server.listen(port, "0.0.0.0");
        });
        bridgePort = port;
        started = true;
        break;
      } catch (_) {}
    }
    if (!started) throw new Error("Could not start the local companion server. Ports 47821–47840 may already be in use.");
    bridgeServer = server;
  }

  ipcMain.handle("estateflow:wa:get-status", getStatus);
  ipcMain.handle("estateflow:wa:get-queue", getQueue);
  ipcMain.handle("estateflow:wa:get-address-book", getAddressBook);
  ipcMain.handle("estateflow:wa:sync-address-book", syncAddressBook);
  ipcMain.handle("estateflow:wa:get-bridge-info", async () => { await startBridge(); return bridgeInfo(); });
  ipcMain.handle("estateflow:wa:get-local-sync-connection", async () => {
    await startBridge();
    return { host: "http://127.0.0.1:" + bridgePort, token: deviceToken };
  });
  ipcMain.handle("estateflow:wa:get-data-sync", async () => {
    const store = await readDataSyncStore();
    return { ok: true, revision: store.revision, updatedAt: store.updatedAt, snapshot: store.snapshot };
  });
  ipcMain.handle("estateflow:wa:save-data-sync", async (_event, payload) => {
    const expectedRevision = Number(payload && payload.expectedRevision);
    const snapshot = payload && payload.snapshot;
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new Error("A valid sync revision is required.");
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) throw new Error("A valid AXIVESTRA data snapshot is required.");
    const allowed = ["properties", "contacts", "whatsappGroups", "tasks", "financials", "riskRecords", "approvalRequests", "auditEvents", "__axivestraSync"];
    for (const key of allowed) {
      if (key === "__axivestraSync") continue;
      if (snapshot[key] !== undefined && !Array.isArray(snapshot[key])) throw new Error("Invalid data collection: " + key);
      if (Array.isArray(snapshot[key]) && snapshot[key].length > 50000) throw new Error("Collection exceeds the 50,000-record safety limit: " + key);
    }
    const committed = await commitDataSync(expectedRevision, snapshot);
    if (committed.conflict) {
      return { ok: false, conflict: true, revision: committed.current.revision, updatedAt: committed.current.updatedAt, snapshot: committed.current.snapshot };
    }
    return { ok: true, revision: committed.next.revision, updatedAt: committed.next.updatedAt, snapshot: committed.next.snapshot };
  });
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
  void startBridge().catch(error => { status.error = "Local phone companion is unavailable: " + (error instanceof Error ? error.message : String(error)); publish("bridge-error"); });
  void Promise.all([ensureQueueLoaded(), ensureAddressBookLoaded()]).then(async () => {
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
      if (bridgeServer) { try { bridgeServer.close(); } catch (_) {} bridgeServer = null; }
    }
  };
}

module.exports = {
  createWhatsAppService,
  normalizeDigits,
  deduplicateWhatsAppContacts,
  deduplicateWhatsAppGroups
};
