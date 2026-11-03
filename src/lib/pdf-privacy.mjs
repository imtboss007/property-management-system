const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[char] || char));
const escapeRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function replaceIdentity(html, value) {
  const raw = String(value || "").trim();
  if (!raw) return html;
  const variants = Array.from(new Set([raw, escapeHtml(raw)]));
  let result = html;
  for (const variant of variants) {
    if (!variant) continue;
    result = result.replace(new RegExp(escapeRegExp(variant), "gi"), "");
  }
  return result;
}

export function applyPdfIdentityPrivacy(html, contacts = [], mode = "name-number") {
  if (mode === "name-number") return String(html ?? "");
  let result = String(html ?? "");
  for (const contact of contacts || []) {
    if (mode === "name-only" || mode === "blank") result = replaceIdentity(result, contact.phone);
    if (mode === "blank") result = replaceIdentity(result, contact.name);
  }
  return result;
}
