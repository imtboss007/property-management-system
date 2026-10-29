export type PropertyRangeQuery = {
  kind: "price" | "area";
  min: number;
  max: number;
};

type PropertySearchRecord = {
  value?: unknown;
  areaValue?: unknown;
  areaUnit?: unknown;
  moduleData?: Record<string, unknown>;
};

const RANGE_PATTERN = /([\d,]+(?:\.\d+)?)\s*(cr(?:ore)?s?|lakh(?:s)?|lac(?:s)?|sq\.?\s*ft\.?|sqft|square\s*feet|square\s*foot|sq\.?\s*yd\.?|sqyd|square\s*yards?|sq\.?\s*m(?:eter|etre|tr)?s?|sqm|mtr|meters?|metres?|acres?|acer|guntas?|guntez|cents?|hectares?|ha)?\s*(?:to|through|until|[-–—])\s*([\d,]+(?:\.\d+)?)\s*(cr(?:ore)?s?|lakh(?:s)?|lac(?:s)?|sq\.?\s*ft\.?|sqft|square\s*feet|square\s*foot|sq\.?\s*yd\.?|sqyd|square\s*yards?|sq\.?\s*m(?:eter|etre|tr)?s?|sqm|mtr|meters?|metres?|acres?|acer|guntas?|guntez|cents?|hectares?|ha)?/i;

function cleanUnit(unit: string): string {
  return unit.toLocaleLowerCase().replace(/\./g, "").replace(/\s+/g, "").trim();
}

function unitKind(rawUnit: string): PropertyRangeQuery["kind"] | null {
  const unit = cleanUnit(rawUnit);
  if (!unit) return null;
  if (/^(cr(?:ore)?s?|lakh(?:s)?|lac(?:s)?)$/.test(unit)) return "price";
  if (/^(sqft|squarefeet|squarefoot|sqyd|squareyards?|sqm|sqmeter|sqmeters|sqmetre|sqmetres|sqmtr|mtr|meter|meters|metre|metres|acre|acres|acer|gunta|guntas|guntez|cent|cents|hectare|hectares|ha|ft²|yd²|m²)$/.test(unit)) return "area";
  return null;
}

function priceMultiplier(rawUnit: string): number {
  const unit = cleanUnit(rawUnit);
  if (/^(cr|crore)/.test(unit)) return 10_000_000;
  if (/^(lakh|lac)/.test(unit)) return 100_000;
  return 1;
}

function areaMultiplierToSqFt(rawUnit: string): number | null {
  const unit = cleanUnit(rawUnit);
  if (/^(sqft|squarefeet|squarefoot|ft²)$/.test(unit)) return 1;
  if (/^(sqyd|squareyards?|yd²)$/.test(unit)) return 9;
  if (/^(sqm|sqmeter|sqmeters|sqmetre|sqmetres|sqmtr|mtr|meter|meters|metre|metres|m²)$/.test(unit)) return 10.7639104167;
  if (/^(acre|acres|acer)$/.test(unit)) return 43_560;
  if (/^(gunta|guntas|guntez)$/.test(unit)) return 1_089;
  if (/^(cent|cents)$/.test(unit)) return 435.6;
  if (/^(hectare|hectares|ha)$/.test(unit)) return 107_639.104167;
  return null;
}

function parseStoredMoney(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const text = String(value).trim().replace(/,/g, "").replace(/^(?:₹|rs\.?\s*|inr\s*)/i, "");
  const match = text.match(/^(\d+(?:\.\d+)?)\s*(cr(?:ore)?s?|lakh(?:s)?|lac(?:s)?)?$/i);
  if (match) {
    const amount = Number(match[1]) * priceMultiplier(match[2] || "");
    return Number.isFinite(amount) && amount >= 0 ? amount : null;
  }
  const amount = Number(text);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function parseRangeMatch(match: RegExpExecArray, fullQuery: string): PropertyRangeQuery | null {
  const firstAmount = Number(match[1].replace(/,/g, ""));
  const secondAmount = Number(match[3].replace(/,/g, ""));
  const firstUnit = match[2] || "";
  const secondUnit = match[4] || "";
  const firstKind = unitKind(firstUnit);
  const secondKind = unitKind(secondUnit);
  const hasCurrencyMarker = /₹|\b(?:rs\.?|inr|rupees?)\b/i.test(fullQuery);

  const kind = firstKind || secondKind || (hasCurrencyMarker ? "price" : null);
  if (!kind || (firstKind && secondKind && firstKind !== secondKind)) return null;
  if (!firstUnit && !secondUnit && !hasCurrencyMarker) return null;

  let first: number;
  let second: number;
  if (kind === "price") {
    if (firstKind === "area" || secondKind === "area") return null;
    first = firstAmount * priceMultiplier(firstUnit || secondUnit);
    second = secondAmount * priceMultiplier(secondUnit || firstUnit);
  } else {
    if (firstKind === "price" || secondKind === "price") return null;
    const firstMultiplier = areaMultiplierToSqFt(firstUnit || secondUnit);
    const secondMultiplier = areaMultiplierToSqFt(secondUnit || firstUnit);
    if (firstMultiplier === null || secondMultiplier === null) return null;
    first = firstAmount * firstMultiplier;
    second = secondAmount * secondMultiplier;
  }

  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  return { kind, min: Math.min(first, second), max: Math.max(first, second) };
}

export function parsePropertyRangeQueries(query: string): PropertyRangeQuery[] {
  const ranges: PropertyRangeQuery[] = [];
  for (const match of query.matchAll(new RegExp(RANGE_PATTERN.source, "gi"))) {
    const parsed = parseRangeMatch(match, query);
    if (!parsed) continue;
    if (!ranges.some(range => range.kind === parsed.kind && range.min === parsed.min && range.max === parsed.max)) {
      ranges.push(parsed);
    }
  }
  return ranges;
}

// Retained for callers that only need the first numeric range in a query.
export function parsePropertyRangeQuery(query: string): PropertyRangeQuery | null {
  return parsePropertyRangeQueries(query)[0] ?? null;
}

export function getPropertyPriceForRangeSearch(record: PropertySearchRecord): number | null {
  const headline = parseStoredMoney(record.value);
  if (headline !== null && headline > 0) return headline;

  const candidates = Object.entries(record.moduleData || {})
    .filter(([key]) =>
      /(price|value|amount|principal|valuation|capital|exposure|commitment|facility|purchase|cost|advance|deployed|nav|funding|sought|paidin)/i.test(key)
      && !/(rate|percent|percentage|perunit|pershare|interest|emi)/i.test(key)
    )
    .map(([, value]) => parseStoredMoney(value))
    .filter((value): value is number => value !== null && value > 0);
  return candidates[0] ?? null;
}

export function getPropertyAreaInSquareFeet(record: PropertySearchRecord): number | null {
  const area = Number(String(record.areaValue ?? "").replace(/,/g, ""));
  const multiplier = areaMultiplierToSqFt(String(record.areaUnit ?? ""));
  if (!Number.isFinite(area) || area <= 0 || multiplier === null) return null;
  return area * multiplier;
}

export function propertyMatchesRange(record: PropertySearchRecord, range: PropertyRangeQuery): boolean {
  if (range.kind === "price") {
    const value = getPropertyPriceForRangeSearch(record);
    return value !== null && value >= range.min && value <= range.max;
  }
  const area = getPropertyAreaInSquareFeet(record);
  return area !== null && area >= range.min && area <= range.max;
}
