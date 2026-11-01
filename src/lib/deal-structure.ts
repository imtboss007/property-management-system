export const dealTransactionTypes = [
  "Not decided", "Sale", "Loan", "Sharing", "Settlement", "Gift", "Purchase", "Lease", "Investment", "Other"
] as const;

export const loanDirections = [
  "Loan I am giving / interest receivable",
  "Loan I am taking / interest payable",
  "Loan I am arranging for another party"
] as const;

export const loanInterestMethods = [
  "Percentage per month",
  "Percentage per year",
  "Fixed amount per month",
  "Interest-free"
] as const;

export const loanRepaymentMethods = [
  "Interest-only monthly",
  "Reducing-balance EMI",
  "Equal principal + interest",
  "Bullet repayment",
  "Flexible / negotiated"
] as const;

export const sharingModels = [
  "50:50",
  "60:40",
  "70:30",
  "40:60",
  "10% gift + 90% balance sharing",
  "Custom percentage split",
  "Area / asset allocation",
  "Revenue sharing",
  "Profit sharing",
  "Fixed allocation"
] as const;

export const settlementModels = [
  "Full and final settlement",
  "Partial settlement",
  "Installment settlement",
  "One-time lump sum",
  "Loan closure / foreclosure",
  "SR rate-based settlement",
  "Negotiated settlement",
  "Other"
] as const;

export function parseDealNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value ?? "").trim().replace(/[₹,\s]/g, "");
  if (!raw) return 0;
  const match = raw.match(/^(-?\d+(?:\.\d+)?)(cr|crores?|l|lacs?|lakhs?|thousands?|k)?$/i);
  if (match) {
    const amount = Number(match[1]);
    const unit = (match[2] || "").toLowerCase();
    const multiplier = unit.startsWith("cr") ? 10000000 : unit === "l" || unit.startsWith("lac") || unit.startsWith("lakh") ? 100000 : unit.startsWith("thousand") || unit === "k" ? 1000 : 1;
    return Number.isFinite(amount) ? amount * multiplier : 0;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateMonthlyInterest(data: Record<string, string> | undefined, fallbackPrincipal = 0): number {
  const fields = data || {};
  const principal = parseDealNumber(fields.__loanPrincipal || fallbackPrincipal);
  const rate = parseDealNumber(fields.__loanInterestRate);
  const method = fields.__loanInterestMethod || "Percentage per month";
  if (principal <= 0) return 0;
  if (method === "Interest-free") return 0;
  if (method === "Fixed amount per month") return Math.max(0, rate);
  if (method === "Percentage per year") return Math.max(0, principal * rate / 1200);
  return Math.max(0, principal * rate / 100);
}

export function calculateGiftAmount(data: Record<string, string> | undefined, basisAmount = 0): number {
  const fields = data || {};
  const basis = parseDealNumber(basisAmount);
  const mode = fields.__giftAmountMode || "Percentage";
  if (mode === "Fixed amount") return Math.max(0, parseDealNumber(fields.__giftFixedAmount));
  return Math.max(0, basis * parseDealNumber(fields.__giftPercentage || "10") / 100);
}

export function calculateSettlementBalance(data: Record<string, string> | undefined): number {
  const fields = data || {};
  return Math.max(0, parseDealNumber(fields.__settlementAgreedAmount) - parseDealNumber(fields.__settlementPaidAmount));
}

export function calculateSaleBalance(data: Record<string, string> | undefined): number {
  const fields = data || {};
  return Math.max(0, parseDealNumber(fields.__saleFinalAmount) - parseDealNumber(fields.__saleAdvancePaid));
}

export function resolveSharingPreset(preset: string): { first: string; second: string; gift: string } {
  if (preset === "50:50") return { first: "50", second: "50", gift: "0" };
  if (preset === "60:40") return { first: "60", second: "40", gift: "0" };
  if (preset === "70:30") return { first: "70", second: "30", gift: "0" };
  if (preset === "40:60") return { first: "40", second: "60", gift: "0" };
  if (preset === "10% gift + 90% balance sharing") return { first: "45", second: "45", gift: "10" };
  return { first: "", second: "", gift: "0" };
}

export function formatINR(value: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);
}
