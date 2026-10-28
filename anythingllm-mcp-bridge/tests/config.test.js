import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig, workspaceChatUrl } from "../src/config.js";

const validEnv = {
  BRIDGE_BEARER_TOKEN: "a".repeat(40),
  ANYTHINGLLM_BASE_URL: "http://anythingllm:3001",
  ANYTHINGLLM_API_KEY: "test-api-key",
  ANYTHINGLLM_WORKSPACE_SLUG: "legal-workspace",
  NODE_ENV: "test"
};

test("loads required settings without exposing secrets", () => {
  const config = loadConfig(validEnv);
  assert.equal(config.workspaceSlug, "legal-workspace");
  assert.equal(config.port, 3000);
  assert.equal(config.bridgeToken, validEnv.BRIDGE_BEARER_TOKEN);
});

test("rejects missing required variables", () => {
  assert.throws(() => loadConfig({}), /Missing required environment variables/);
});

test("rejects a short bridge bearer token", () => {
  assert.throws(() => loadConfig({ ...validEnv, BRIDGE_BEARER_TOKEN: "short" }), /at least 32 characters/);
});

test("rejects an invalid AnythingLLM URL", () => {
  assert.throws(() => loadConfig({ ...validEnv, ANYTHINGLLM_BASE_URL: "not-a-url" }), /valid absolute URL/);
});

test("constructs the workspace chat endpoint and encodes slug", () => {
  const config = loadConfig({ ...validEnv, ANYTHINGLLM_WORKSPACE_SLUG: "legal workspace" });
  assert.equal(workspaceChatUrl(config), "http://anythingllm:3001/api/v1/workspace/legal%20workspace/chat");
});