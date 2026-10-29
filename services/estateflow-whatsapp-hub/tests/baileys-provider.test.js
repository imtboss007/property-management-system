import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createBaileysProvider } from "../src/baileys-provider.js";

test("hosted sender reports unpaired state without exposing QR/session secrets", async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "axivestra-baileys-"));
  try {
    const provider = createBaileysProvider({ dataDir });
    const status = await provider.status();
    assert.equal(provider.name, "baileys");
    assert.equal(status.platform, "cloud-baileys");
    assert.equal(status.connected, false);
    assert.equal(status.connecting, false);
    assert.equal(status.qrDataUrl, "");
    assert.equal(status.senderNumber, "");
    const serialized = JSON.stringify(status);
    assert.equal(serialized.includes("ESTATEFLOW_BRIDGE_TOKEN"), false);
    assert.equal(serialized.includes("baileys-auth"), false);
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});
