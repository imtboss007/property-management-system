"use strict";

const assert = require("node:assert/strict");
const {
  resolveWhatsAppWebVersion,
  reconnectDelayForAttempt,
  isTerminalHandshakeFailure
} = require("../electron/whatsapp-service.cjs");

async function run() {
  let legacyCalls = 0;
  const resolved = await resolveWhatsAppWebVersion({
    fetchLatestWaWebVersion: async options => {
      assert.equal(options.timeout, 10000);
      return { version: [2, 3000, 1044015310], isLatest: true };
    },
    fetchLatestBaileysVersion: async () => {
      legacyCalls += 1;
      return { version: [2, 3000, 1035194821], isLatest: true };
    }
  });
  assert.deepEqual(resolved, { version: [2, 3000, 1044015310], source: "live-whatsapp-web" });
  assert.equal(legacyCalls, 0, "the stale Baileys metadata endpoint is not preferred");

  const fallback = await resolveWhatsAppWebVersion({
    fetchLatestWaWebVersion: async () => { throw new Error("WhatsApp Web version endpoint unavailable"); },
    fetchLatestBaileysVersion: async () => ({ version: [2, 3000, 1040000000] })
  });
  assert.deepEqual(fallback, { version: [2, 3000, 1040000000], source: "baileys-metadata-fallback" });

  const bundled = await resolveWhatsAppWebVersion({
    fetchLatestWaWebVersion: async () => ({ version: [2, 3000] }),
    fetchLatestBaileysVersion: async () => { throw new Error("network unavailable"); }
  });
  assert.deepEqual(bundled, { version: null, source: "bundled-fallback" });

  assert.deepEqual([1,2,3,4,5,6].map(reconnectDelayForAttempt), [5000,10000,20000,40000,60000,60000]);
  assert.equal(isTerminalHandshakeFailure(401), true);
  assert.equal(isTerminalHandshakeFailure(403), true);
  assert.equal(isTerminalHandshakeFailure(405), true);
  assert.equal(isTerminalHandshakeFailure(408), false);
  assert.equal(isTerminalHandshakeFailure(undefined), false);

  process.stdout.write("WhatsApp live protocol version and reconnect safety tests passed.\\n");
}

run().catch(error => {
  process.stderr.write(String(error.stack || error) + "\\n");
  process.exitCode = 1;
});
