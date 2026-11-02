const safePart = (value, fallback = "") => String(value ?? "")
  .normalize("NFKD")
  .replace(/[\\u0300-\\u036f]/g, "")
  .replace(/[^a-zA-Z0-9._-]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 72) || fallback;

/**
 * Build a stable, previewable filename base. The report label is always retained;
 * the selected mode controls only the optional user-provided name and number.
 */
export function buildPdfFilenameBase({ reportLabel, name = "", number = "", mode = "name-number" } = {}) {
  const parts = ["AXIVESTRA", safePart(reportLabel, "Report")];
  const cleanName = safePart(name);
  const cleanNumber = safePart(number);
  if ((mode === "name-only" || mode === "name-number") && cleanName) parts.push(cleanName);
  if ((mode === "number-only" || mode === "name-number") && cleanNumber) parts.push(cleanNumber);
  return parts.join("-").slice(0, 180);
}
