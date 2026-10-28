import path from "node:path";

function hasValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function safeBaseUrl(raw, label, allowInsecureHttp) {
  if (!hasValue(raw)) return "";
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error(label + " must be a valid absolute URL.");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(label + " must use HTTP or HTTPS.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(label + " must not contain credentials, query parameters, or a fragment.");
  }
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase());
  if (url.protocol === "http:" && !localHost && !allowInsecureHttp) {
    throw new Error(label + " must use HTTPS unless the target is local or ALLOW_INSECURE_GATEWAY_HTTP=true on a trusted private network.");
  }
  return url.toString().replace(/\/+$/, "");
}

export function loadConfig(env = process.env) {
  const allowInsecureHttp = String(env.ALLOW_INSECURE_GATEWAY_HTTP || "").toLowerCase() === "true";
  const openwaBase = safeBaseUrl(env.OPENWA_BASE_URL, "OPENWA_BASE_URL", allowInsecureHttp);
  const waAkgBase = safeBaseUrl(env.WA_AKG_BASE_URL, "WA_AKG_BASE_URL", allowInsecureHttp);
  const publicWebhookUrl = safeBaseUrl(env.ESTATEFLOW_PUBLIC_WEBHOOK_URL, "ESTATEFLOW_PUBLIC_WEBHOOK_URL", false);
  if (publicWebhookUrl) {
    const callback = new URL(publicWebhookUrl);
    if (callback.protocol !== "https:") {
      throw new Error("ESTATEFLOW_PUBLIC_WEBHOOK_URL must use HTTPS so the gateway can securely call back into EstateFlow.");
    }
    if (!callback.pathname.replace(/\\/+$/, "").endsWith("/api/webhook/incoming")) {
      throw new Error("ESTATEFLOW_PUBLIC_WEBHOOK_URL must end with /api/webhook/incoming.");
    }
  }
  const openwaConfigured = Boolean(openwaBase && hasValue(env.OPENWA_API_KEY));
  const waAkgConfigured = Boolean(waAkgBase && hasValue(env.WA_AKG_API_KEY));
  const requestedProvider = String(env.ESTATEFLOW_GATEWAY_PROVIDER || "auto").trim().toLowerCase();

  if (!["auto", "openwa", "wa-akg"].includes(requestedProvider)) {
    throw new Error("ESTATEFLOW_GATEWAY_PROVIDER must be auto, openwa, or wa-akg.");
  }
  if (requestedProvider === "openwa" && !openwaConfigured) {
    throw new Error("OpenWA was selected but OPENWA_BASE_URL or OPENWA_API_KEY is missing.");
  }
  if (requestedProvider === "wa-akg" && !waAkgConfigured) {
    throw new Error("WA-AKG was selected but WA_AKG_BASE_URL or WA_AKG_API_KEY is missing.");
  }

  // A single transport is active per hub. If both are present under auto mode, OpenWA wins
  // deterministically; messages are never duplicated across the two providers.
  const provider = requestedProvider === "openwa"
    ? "openwa"
    : requestedProvider === "wa-akg"
      ? "wa-akg"
      : openwaConfigured
        ? "openwa"
        : waAkgConfigured
          ? "wa-akg"
          : "";

  const bridgeToken = String(env.ESTATEFLOW_BRIDGE_TOKEN || "");
  const webhookToken = String(env.ESTATEFLOW_WEBHOOK_TOKEN || "");
  if (bridgeToken.length < 32) throw new Error("ESTATEFLOW_BRIDGE_TOKEN must be at least 32 characters.");
  if (webhookToken.length < 32) throw new Error("ESTATEFLOW_WEBHOOK_TOKEN must be at least 32 characters.");

  const port = Number.parseInt(env.PORT || "47822", 10);
  const cooldown = Number.parseInt(env.SEND_COOLDOWN_MS || "12000", 10);
  const maxDaily = Number.parseInt(env.MAX_DAILY_SENDS || "60", 10);
  const requestTimeout = Number.parseInt(env.REQUEST_TIMEOUT_MS || "10000", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be between 1 and 65535.");
  if (!Number.isInteger(cooldown) || cooldown < 1000) throw new Error("SEND_COOLDOWN_MS must be at least 1000.");
  if (!Number.isInteger(maxDaily) || maxDaily < 1 || maxDaily > 1000) throw new Error("MAX_DAILY_SENDS must be between 1 and 1000.");
  if (!Number.isInteger(requestTimeout) || requestTimeout < 1000 || requestTimeout > 120000) throw new Error("REQUEST_TIMEOUT_MS must be between 1000 and 120000.");

  return {
    nodeEnv: env.NODE_ENV || "development",
    host: env.HOST || "127.0.0.1",
    port,
    bridgeToken,
    webhookToken,
    publicWebhookUrl,
    provider,
    providerReason: requestedProvider === "auto" && openwaConfigured && waAkgConfigured
      ? "Both gateways are configured; OpenWA is the active transport and WA-AKG is not used for sends."
      : provider
        ? "Active transport: " + provider
        : "No gateway is configured yet. Add credentials for OpenWA or WA-AKG.",
    dataDir: path.resolve(env.ESTATEFLOW_DATA_DIR || "./data"),
    maxDaily,
    cooldown,
    requestTimeout,
    openwa: {
      baseUrl: openwaBase,
      apiKey: String(env.OPENWA_API_KEY || "").trim(),
      sessionId: String(env.OPENWA_SESSION_ID || "").trim()
    },
    waAkg: {
      baseUrl: waAkgBase,
      apiKey: String(env.WA_AKG_API_KEY || "").trim(),
      sessionId: String(env.WA_AKG_SESSION_ID || "").trim()
    }
  };
}

export function safeConfigSummary(config) {
  return {
    provider: config.provider || "unconfigured",
    providerReason: config.providerReason,
    bridgeConfigured: Boolean(config.bridgeToken),
    webhookConfigured: Boolean(config.webhookToken),
    port: config.port
  };
}
