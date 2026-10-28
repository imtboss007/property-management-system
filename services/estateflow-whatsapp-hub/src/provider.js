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
  return normalizeQr(data.qrDataUrl || data.qrCode || data.qr || data.qrImage || data.qrcode || "");
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
    const created = await request("/sessions", "POST", { name: "estateflow" });
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
    let qrDataUrl = pickQr(data);
    if (!connected && !qrDataUrl) {
      try {
        const qrPayload = await request("/sessions/" + encodeURIComponent(id) + "/qr");
        qrDataUrl = pickQr(unwrap(qrPayload));
      } catch (_) {}
    }
    const sender = data.senderNumber || data.phoneNumber || data.phone || data.number || data.user?.id || "";
    return {
      supported: true,
      platform: "gateway-" + providerName,
      connected,
      connecting: ["connecting", "starting", "initializing", "qr_ready", "scan_qr"].includes(String(rawStatus).toLowerCase()),
      senderNumber: String(sender).replace(/\D/g, ""),
      displayName: String(data.displayName || data.name || data.pushName || ""),
      qrDataUrl,
      pairingCode: String(data.pairingCode || data.pairing_code || ""),
      lastConnectedAt: String(data.lastConnectedAt || data.connectedAt || ""),
      error: ""
    };
  }

  return {
    name: providerName,
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
      return fetchSession();
    },
    async requestPairingCode(rawPhone) {
      const id = await ensureSession();
      const phoneNumber = phoneDigits(rawPhone);
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
          message: { text: message }
        });
      }
      const data = unwrap(payload);
      const messageId = data.messageId || data.id || data.key?.id || data.message?.id || data.messages?.[0]?.id || "";
      return { ok: true, messageId: String(messageId) };
    }
  };
}
