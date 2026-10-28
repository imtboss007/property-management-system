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
  if (data?.isGroup === true || data?.is_group === true) return { ignore: true, reason: "group-message" };
  const remote = String(data?.from || data?.sender || data?.chatId || data?.remoteJidAlt || data?.remoteJid || key.remoteJid || "");
  if (!remote || remote.includes("@g.us") || remote === "status@broadcast") {
    return { ignore: true, reason: "not-one-to-one-contact" };
  }
  const phone = remote.split("@")[0].split(":")[0].replace(/\D/g, "");
  if (phone.length < 8 || phone.length > 15) return { ignore: true, reason: "invalid-contact-number" };
  const messageId = String(key.id || data?.id || data?.messageId || "");
  return { ignore: false, phone, messageId };
}
