const UNIT_MULTIPLIERS = Object.freeze({
  crore: 10000000,
  crores: 10000000,
  cr: 10000000,
  lakh: 100000,
  lakhs: 100000,
  lac: 100000,
  lacs: 100000,
  thousand: 1000,
  thousands: 1000,
  k: 1000
});

const TOKEN = /(\d+(?:\.\d+)?)\s*(crores?|cr|lakhs?|lacs?|thousands?|k)?/g;

/**
 * Parse an INR amount entered as a plain number or Indian shorthand.
 * Examples: "25000", "25 thousand", "5 lakh", "2 crore",
 * "1 crore 25 lakh", "₹1,23,456".
 *
 * Returns a rounded INR number, or null for empty/invalid/negative input.
 */
export function parseIndianAmount(input) {
  if (typeof input !== "string" && typeof input !== "number") return null;
  let value = String(input).trim().toLowerCase();
  if (!value) return null;

  value = value
    .replace(/₹/g, "")
    .replace(/\b(?:inr|rs\.?)(?=\s|$)/g, "")
    .replace(/,/g, "")
    .replace(/\band\b/g, " ")
    .replace(/\+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!value) return null;

  const plain = /^\d+(?:\.\d{1,2})?$/.exec(value);
  if (plain) {
    const amount = Number(value);
    return Number.isFinite(amount) && amount <= Number.MAX_SAFE_INTEGER
      ? Math.round((amount + Number.EPSILON) * 100) / 100
      : null;
  }

  TOKEN.lastIndex = 0;
  let match;
  let cursor = 0;
  let total = 0;
  let found = false;

  while ((match = TOKEN.exec(value)) !== null) {
    // Text between numeric terms may only be whitespace.
    if (value.slice(cursor, match.index).trim()) return null;
    const quantity = Number(match[1]);
    if (!Number.isFinite(quantity) || quantity < 0) return null;
    const unit = match[2] || "";
    total += quantity * (UNIT_MULTIPLIERS[unit] || 1);
    if (!Number.isFinite(total) || total > Number.MAX_SAFE_INTEGER) return null;
    cursor = TOKEN.lastIndex;
    found = true;
  }

  if (!found || value.slice(cursor).trim()) return null;
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

export function normalizeIndianAmount(input) {
  const value = String(input ?? "").trim();
  if (!value) return "";
  const parsed = parseIndianAmount(value);
  return parsed === null ? null : String(parsed);
}

export function formatIndianAmount(input) {
  const parsed = typeof input === "number" ? input : parseIndianAmount(String(input ?? ""));
  if (parsed === null || !Number.isFinite(parsed)) return "";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(parsed);
}
