import crypto from "node:crypto";

export function parseIncoming(body) {
  const event = String(body?.event || body?.type || body?.name || "").toLowerCase();
  if (event && !["message.received", "message_received", "message.upsert", "messages.upsert", "message"].includes(event)) {
    return { ignore: true, reason: "not-inbound-message-event" };
  }
  const data = body?.data && typeof body.data === "object" ? body.data : body;
  const key = data?.key || data?.message?.key || {};
  if (key.fromMe === true || data?.fromMe === true || data?.from_me === true) {
    return { ignore: true, reason: "outbound-message" };
  }
  const remoteCandidates = [
    data?.chatId, data?.remoteJid, key.remoteJid, data?.remoteJidAlt,
    data?.groupJid, data?.group_id, data?.from, data?.sender
  ].map(value => String(value || "")).filter(Boolean);
  const groupRemote = remoteCandidates.find(value => value.endsWith("@g.us")) || "";
  const remote = String(data?.from || data?.sender || data?.chatId || data?.remoteJidAlt || data?.remoteJid || key.remoteJid || "");
  if (remote === "status@broadcast" || remoteCandidates.includes("status@broadcast")) {
    return { ignore: true, reason: "status-broadcast" };
  }
  if (groupRemote || data?.isGroup === true || data?.is_group === true) {
    const groupJid = groupRemote || String(data?.groupJid || data?.group_id || "");
    if (!groupJid.endsWith("@g.us")) return { ignore: true, reason: "group-message-without-group-id" };
    return { ignore: false, groupJid, isGroup: true, messageId: String(key.id || data?.id || data?.messageId || "") };
  }
  if (!remote) return { ignore: true, reason: "not-one-to-one-contact" };
  const phone = remote.split("@")[0].split(":")[0].replace(/\D/g, "");
  if (phone.length < 8 || phone.length > 15) return { ignore: true, reason: "invalid-contact-number" };
  const messageId = String(key.id || data?.id || data?.messageId || "");
  return { ignore: false, phone, messageId };
}

export function verifyWebhookSignature(rawBody, signature, secret) {
  if (typeof signature !== "string" || !signature.startsWith("sha256=") || !secret) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const suppliedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
}
