export function loadConfig(env = process.env) {
  const required = ["BRIDGE_BEARER_TOKEN", "ANYTHINGLLM_BASE_URL", "ANYTHINGLLM_API_KEY", "ANYTHINGLLM_WORKSPACE_SLUG"];
  const missing = required.filter((key) => !env[key] || !String(env[key]).trim());
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  let baseUrl;
  try {
    baseUrl = new URL(env.ANYTHINGLLM_BASE_URL);
  } catch {
    throw new Error("ANYTHINGLLM_BASE_URL must be a valid absolute URL");
  }
  if (!["http:", "https:"].includes(baseUrl.protocol)) {
    throw new Error("ANYTHINGLLM_BASE_URL must use HTTP or HTTPS");
  }
  if (env.NODE_ENV === "production" && baseUrl.protocol !== "https:" && !["localhost", "127.0.0.1", "anythingllm"].includes(baseUrl.hostname)) {
    throw new Error("Use HTTPS for a remote AnythingLLM endpoint in production");
  }
  if (String(env.BRIDGE_BEARER_TOKEN).length < 32) {
    throw new Error("BRIDGE_BEARER_TOKEN must be at least 32 characters");
  }

  return {
    bridgeToken: String(env.BRIDGE_BEARER_TOKEN),
    anythingBaseUrl: baseUrl.toString().replace(/\/$/, ""),
    anythingApiKey: String(env.ANYTHINGLLM_API_KEY),
    workspaceSlug: String(env.ANYTHINGLLM_WORKSPACE_SLUG),
    port: Number(env.PORT || 3000),
    host: env.HOST || "0.0.0.0",
    requestTimeoutMs: Number(env.REQUEST_TIMEOUT_MS || 30000),
    maxMessageChars: Number(env.MAX_MESSAGE_CHARS || 12000)
  };
}

export function workspaceChatUrl(config) {
  return `${config.anythingBaseUrl}/api/v1/workspace/${encodeURIComponent(config.workspaceSlug)}/chat`;
}