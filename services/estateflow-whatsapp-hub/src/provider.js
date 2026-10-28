import QRCode from "qrcode";
import { randomUUID } from "node:crypto";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function unwrap(payload) {
  if (payload && typeof payload === "object" && payload.data && typeof payload.data === "object") {
    return payload.data;
  }
  return payload && typeof payload === "object" ? payload : {};
}

export function phoneDigits(raw) {
  let digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = "91" + digits;
  if (digits.length < 8 || digits.length > 15) {
    throw new Error("Enter a valid WhatsApp phone number with country code.");
  }
  return digits;
}

export function jidFor(phone, provider) {
  const digits = phoneDigits(phone);
  return digits + (provider === "openwa" ? "@c.us" : "@s.whatsapp.net");
}

export function normalizeQr(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  const qr = value.trim();
  if (qr.startsWith("data:image/")) return qr;
  if (/^[A-Za-z0-9+/=\r\n]+$/.test(qr) && qr.length > 100) {
    return "data:image/png;base64," + qr.replace(/\s/g, "");
  }
  return "";
}

export function isConnected(status) {
  return ["ready", "connected", "open", "authenticated", "online"].includes(String(status || "").toLowerCase());
}

function statusValue(data) {
  return data.status ?? data.connectionStatus ?? data.state ?? data.connection ?? "";
}

function pickQr(data) {
  // WA-AKG's QR route returns a base64 image in `base64`; OpenWA typically returns qrCode.
  return normalizeQr(data.qrDataUrl || data.base64 || data.qrCode || data.qr || data.qrImage || data.qrcode || "");
}

export function createProvider(config, sessionState) {
  const providerName = config.provider;
  if (!providerName) {
    return {
      name: "unconfigured",
      async status() {
        return {
          supported: true, platform: "gateway-unconfigured", connected: false, connecting: false,
          senderNumber: "", displayName: "", qrDataUrl: "", pairingCode: "", lastConnectedAt: "",
          error: "No WhatsApp gateway is configured. The hub cannot link or send until gateway credentials are added."
        };
      },
      async connect() { throw new Error("Configure OpenWA or WA-AKG gateway credentials before connecting."); },
      async requestPairingCode() { throw new Error("Configure OpenWA or WA-AKG gateway credentials before pairing."); },
      async disconnect() { throw new Error("No WhatsApp gateway is configured."); },
      async sendText() { throw new Error("No WhatsApp gateway is configured."); }
    };
  }

  const options = providerName === "openwa" ? config.openwa : config.waAkg;

  async function request(route, method = "GET", body) {
    const base = options.baseUrl.replace(/\/+$/, "");
    const requestPath = route.startsWith("/") ? route : "/" + route;
    let response;
    try {
      response = await fetch(base + requestPath, {
        method,
        headers: {
          "X-API-Key": options.apiKey,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(config.requestTimeout)
      });
    } catch (error) {
      if (error && (error.name === "TimeoutError" || error.name === "AbortError")) {
        throw new Error("WhatsApp gateway timed out.");
      }
      throw new Error("Could not reach the configured WhatsApp gateway: " + (error instanceof Error ? error.message : String(error)));
    }

    const raw = await response.text();
    let payload = {};
    try { payload = raw ? JSON.parse(raw) : {}; }
    catch { payload = { rawText: raw.slice(0, 300) }; }
    if (!response.ok) {
      const message = payload?.message || payload?.error || payload?.detail || ("Gateway returned HTTP " + response.status);
      throw new Error(String(message).slice(0, 600));
    }
    return payload;
  }

  async function ensureSession() {
    if (sessionState.sessionId) return sessionState.sessionId;
    if (options.sessionId) {
      sessionState.sessionId = options.sessionId;
      await sessionState.save();
      return sessionState.sessionId;
    }
    const created = await request("/sessions", "POST", { name: "estateflow-" + randomUUID().slice(0, 8) });
    const data = unwrap(created);
    const id = String(data.id || data.sessionId || data.session_id || "");
    if (!id) throw new Error("The gateway did not return a session ID after session creation.");
    sessionState.sessionId = id;
    await sessionState.save();
    return id;
  }

  async function fetchSession() {
    const id = sessionState.sessionId || options.sessionId;
    if (!id) {
      return {
        supported: true, platform: "gateway-" + providerName, connected: false, connecting: false,
        senderNumber: "", displayName: "", qrDataUrl: "", pairingCode: "", lastConnectedAt: "", error: ""
      };
    }
    if (!sessionState.sessionId) {
      sessionState.sessionId = id;
      await sessionState.save();
    }
    const payload = await request("/sessions/" + encodeURIComponent(id));
    const data = unwrap(payload);
    const rawStatus = statusValue(data);
    const connected = typeof data.connected === "boolean" ? data.connected : isConnected(rawStatus);
    const qrCandidates = [
      data.qrDataUrl, data.qrCode, data.qr, data.qrImage, data.qrcode
    ].filter(value => typeof value === "string" && value.trim());
    let qrDataUrl = pickQr(data);
    if (!connected && !qrDataUrl) {
      try {
        const qrPayload = await request("/sessions/" + encodeURIComponent(id) + "/qr");
        const qrData = unwrap(qrPayload);
        qrDataUrl = pickQr(qrData);
        qrCandidates.push(qrData.qrDataUrl, qrData.qrCode, qrData.qr, qrData.qrImage, qrData.qrcode);
      } catch (_) {}
    }
    if (!connected && !qrDataUrl) {
      // WA-AKG may return the QR payload string rather than a PNG data URL.
      const rawQr = qrCandidates.find(value => typeof value === "string" && value.trim() && !value.startsWith("data:image/"));
      if (rawQr) {
        try { qrDataUrl = await QRCode.toDataURL(rawQr, { width: 280, margin: 1, errorCorrectionLevel: "M" }); }
        catch (_) {}
      }
    }
    const sender = data.senderNumber || data.phoneNumber || data.phone || data.number || data.user?.id || "";
    return {
      supported: true,
      platform: "gateway-" + providerName,
      connected,
      connecting: ["connecting", "starting", "initializing", "qr_ready", "scan_qr"].includes(String(rawStatus).toLowerCase()),
      connectionState: String(rawStatus || "").toLowerCase(),
      senderNumber: String(sender).replace(/\D/g, ""),
      displayName: String(data.displayName || data.name || data.pushName || ""),
      qrDataUrl,
      pairingCode: String(data.pairingCode || data.pairing_code || ""),
      lastConnectedAt: String(data.lastConnectedAt || data.connectedAt || ""),
      webhook: config.publicWebhookUrl
        ? (sessionState.webhookRegistration?.url === config.publicWebhookUrl &&
           sessionState.webhookRegistration?.sessionId === id &&
           sessionState.webhookRegistration?.configured === true
            ? { configured: true, provider: providerName }
            : {
                configured: false,
                reason: sessionState.webhookRegistration?.lastError ||
                  "Stop-on-reply webhook has not been verified by registration yet."
              })
        : { configured: false, reason: "Set ESTATEFLOW_PUBLIC_WEBHOOK_URL before relying on automatic stop-on-reply." },
      error: ""
    };
  }

  async function configureWebhook() {
    if (!config.publicWebhookUrl) {
      return {
        configured: false,
        reason: "Stop-on-reply is not active yet. Set ESTATEFLOW_PUBLIC_WEBHOOK_URL to this hub's public HTTPS /api/webhook/incoming address."
      };
    }

    try {
      const id = await ensureSession();
      const previous = sessionState.webhookRegistration;
      if (previous?.provider === providerName && previous?.sessionId === id &&
          previous?.url === config.publicWebhookUrl && previous?.configured === true) {
        return { configured: true, provider: providerName, url: config.publicWebhookUrl };
      }

      const route = providerName === "openwa"
        ? "/sessions/" + encodeURIComponent(id) + "/webhooks"
        : "/webhooks/" + encodeURIComponent(id);
      const webhookBody = {
        url: config.publicWebhookUrl,
        secret: config.webhookToken,
        events: ["message.received"]
      };
      if (providerName === "wa-akg") webhookBody.name = "EstateFlow stop-on-reply";
      await request(route, "POST", webhookBody);

      sessionState.webhookRegistration = {
        configured: true,
        provider: providerName,
        sessionId: id,
        url: config.publicWebhookUrl,
        registeredAt: new Date().toISOString()
      };
      await sessionState.save();
      return { configured: true, provider: providerName, url: config.publicWebhookUrl };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sessionState.webhookRegistration = {
        configured: false,
        provider: providerName,
        sessionId: sessionState.sessionId || options.sessionId || "",
        url: config.publicWebhookUrl,
        lastError: message,
        failedAt: new Date().toISOString()
      };
      await sessionState.save();
      return { configured: false, provider: providerName, error: message };
    }
  }

  return {
    name: providerName,
    async configureWebhook() {
      try { return await configureWebhook(); }
      catch (error) {
        const result = {
          configured: false,
          provider: providerName,
          error: error instanceof Error ? error.message : String(error)
        };
        sessionState.webhookRegistration = {
          configured: false,
          provider: providerName,
          sessionId: sessionState.sessionId || options.sessionId || "",
          url: config.publicWebhookUrl || "",
          lastError: result.error,
          failedAt: new Date().toISOString()
        };
        await sessionState.save();
        return result;
      }
    },
    async status() {
      try {
        return await fetchSession();
      } catch (error) {
        return {
          supported: true, platform: "gateway-" + providerName, connected: false, connecting: false,
          senderNumber: "", displayName: "", qrDataUrl: "", pairingCode: "", lastConnectedAt: "",
          error: error instanceof Error ? error.message : String(error)
        };
      }
    },
    async connect() {
      const id = await ensureSession();
      await request("/sessions/" + encodeURIComponent(id) + "/start", "POST");
      await sleep(250);
      const webhook = await configureWebhook();
      return { ...(await fetchSession()), webhook };
    },
    async requestPairingCode(rawPhone) {
      const id = await ensureSession();
      const phoneNumber = phoneDigits(rawPhone);
      let current = await fetchSession();
      if (current.connected) {
        throw new Error("This WhatsApp session is already connected. Disconnect it first only if you intend to replace the linked account.");
      }

      // Pairing-code endpoints differ across gateway versions, but both require a live session.
      if (!current.qrDataUrl && !["qr_ready", "scan_qr", "pairing_code"].includes(String(current.connectionState || "").toLowerCase())) {
        try {
          await request("/sessions/" + encodeURIComponent(id) + "/start", "POST");
        } catch (error) {
          if (!/already|started|connecting|running/i.test(error instanceof Error ? error.message : String(error))) throw error;
        }
        let ready = false;
        for (let attempt = 0; attempt < 10; attempt++) {
          await sleep(750);
          current = await fetchSession();
          if (current.connected) {
            throw new Error("WhatsApp connected while preparing a pairing code. Keep the connected session instead of replacing it.");
          }
          if (current.qrDataUrl || ["qr_ready", "scan_qr", "pairing_code"].includes(String(current.connectionState || "").toLowerCase())) {
            ready = true;
            break;
          }
        }
        if (!ready) {
          throw new Error("The gateway has not produced a pairing-ready session. Try Connect with QR first, then request a pairing code.");
        }
      }

      const route = providerName === "openwa"
        ? "/sessions/" + encodeURIComponent(id) + "/pairing-code"
        : "/sessions/" + encodeURIComponent(id) + "/pair";
      const payload = await request(route, "POST", { phoneNumber });
      const data = unwrap(payload);
      const code = String(data.pairingCode || data.pairingCodeValue || data.code || "");
      if (!code) throw new Error("The gateway did not return a pairing code. Check session status and try again.");
      return { ok: true, code };
    },
    async disconnect() {
      const id = sessionState.sessionId || options.sessionId;
      if (!id) return { ok: true };
      await request("/sessions/" + encodeURIComponent(id) + "/logout", "POST");
      return { ok: true };
    },
    async sendText(rawPhone, message) {
      const id = sessionState.sessionId || options.sessionId;
      if (!id) throw new Error("Create or link a WhatsApp session before sending.");
      const phone = phoneDigits(rawPhone);
      let payload;
      if (providerName === "openwa") {
        payload = await request("/sessions/" + encodeURIComponent(id) + "/messages/send-text", "POST", {
          chatId: jidFor(phone, providerName),
          text: message
        });
      } else {
        payload = await request("/messages/" + encodeURIComponent(id) + "/" + encodeURIComponent(jidFor(phone, providerName)) + "/send", "POST", {
          message
        });
      }
      const data = unwrap(payload);
      const messageId = data.messageId || data.id || data.key?.id || data.message?.id || data.messages?.[0]?.id || "";
      return { ok: true, messageId: String(messageId) };
    }
  };
}
