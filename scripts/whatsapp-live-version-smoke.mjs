import { fetchLatestWaWebVersion } from "@whiskeysockets/baileys";

const result = await fetchLatestWaWebVersion({ timeout: 12000 });
const version = result?.version;
const valid = Array.isArray(version) && version.length === 3 &&
  version.every(part => Number.isInteger(Number(part)) && Number(part) >= 0);

if (!result?.isLatest || !valid) {
  throw new Error(
    "Live WhatsApp Web revision could not be read. " +
    "The helper returned its fallback revision or an invalid response: " +
    JSON.stringify({ version: version || null, isLatest: Boolean(result?.isLatest), error: result?.error?.message || "" })
  );
}

process.stdout.write("Live WhatsApp Web revision smoke test passed: " + version.join(".") + "\n");
