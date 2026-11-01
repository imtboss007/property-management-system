import { parseIndianAmount } from "./indian-amount.mjs";

const pad = value => String(value).padStart(2, "0");
const isoLocalDate = date => date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());

function dateFromMessage(message, today) {
  const text = String(message || "").toLowerCase();
  const base = new Date(String(today || isoLocalDate(new Date())) + "T00:00:00");
  if (!Number.isFinite(base.getTime())) return "";
  if (/\btoday\b/.test(text)) return isoLocalDate(base);
  if (/\btomorrow\b/.test(text)) { base.setDate(base.getDate() + 1); return isoLocalDate(base); }

  const iso = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return iso[1] + "-" + pad(iso[2]) + "-" + pad(iso[3]);

  const numeric = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (numeric) {
    let year = numeric[3] ? Number(numeric[3]) : base.getFullYear();
    if (year < 100) year += 2000;
    const month = Number(numeric[2]), day = Number(numeric[1]);
    const candidate = new Date(year, month - 1, day);
    if (candidate.getFullYear() === year && candidate.getMonth() === month - 1 && candidate.getDate() === day) return isoLocalDate(candidate);
  }

  const weekdayMatch = text.match(/\b(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (weekdayMatch) {
    const days = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
    const target = days.indexOf(weekdayMatch[1]);
    const delta = (target - base.getDay() + 7) % 7 || 7;
    base.setDate(base.getDate() + delta);
    return isoLocalDate(base);
  }
  return "";
}

function timeFromMessage(message) {
  const match = String(message || "").match(/\b(?:at\s*)?(1[0-2]|0?\d)(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\b/i);
  if (!match) return "";
  let hour = Number(match[1]) % 12;
  if (match[3].toLowerCase().startsWith("p")) hour += 12;
  return pad(hour) + ":" + (match[2] || "00");
}

function amountFromMessage(message) {
  const text = String(message || "");
  const candidates = [
    /(?:₹|\bINR\b|\bRs\.?\s*)\s*([\d,]+(?:\.\d+)?\s*(?:crores?|cr|lakhs?|lacs?|lac|l|thousands?|k)?)/i,
    /\b([\d,]+(?:\.\d+)?\s*(?:crores?|cr|lakhs?|lacs?|lac|l|thousands?|k))\b/i
  ];
  for (const pattern of candidates) {
    const match = text.match(pattern);
    if (!match) continue;
    const normalized = match[1].replace(/(\d)\s*l\b/i, "$1 lakh");
    const amount = parseIndianAmount(normalized);
    if (amount !== null) return String(amount);
  }
  return "";
}

export function extractWhatsAppCommitment(message, today) {
  const source = String(message || "").trim();
  return {
    description: source,
    amount: amountFromMessage(source),
    promisedDate: dateFromMessage(source, today),
    promisedTime: timeFromMessage(source),
    responseType: "WhatsApp"
  };
}
