import { useDeferredValue, useMemo, useState } from "react";
import { ArrowUpRight, Filter, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { formatINR, parseDealNumber } from "./lib/deal-structure";
import { getPropertyPriceForRangeSearch } from "./lib/property-range-search";

type FinderRecord = {
  id: string; title: string; module: string; location: string; value: string; status: string;
  contact: string; primaryContactId?: string; followUpContactId?: string; followUpEntries?: Array<{followPersonId:string}>; moduleData?: Record<string, string>;
};
type FinderContact = { id: string; name: string; phone?: string; role?: string; roles?: string[]; customRoles?: string; email?: string; whatsappName?: string; verifiedName?: string; notify?: string; whatsappJid?: string; associatedCompany?: string; };
type FinderModule = { name: string; group?: string };
type Props = { records: FinderRecord[]; contacts: FinderContact[]; modules: FinderModule[]; onOpenModule: (module: string) => void; onOpenRecord: (record: FinderRecord) => void };

const presets = [
  { label: "Any amount", value: "" }, { label: "Up to ₹1 Cr", value: "10000000" },
  { label: "Up to ₹10 Cr", value: "100000000" }, { label: "Up to ₹50 Cr", value: "500000000" },
  { label: "Up to ₹100 Cr", value: "1000000000" }, { label: "Custom up to", value: "custom" }
];
const normalize = (value: unknown) => String(value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/[\s\u00a0]+/g, " ").trim();
const amountFromData = (data: Record<string, string> | undefined, kind: "market" | "settlement") => {
  const entries = Object.entries(data || {});
  const exact = kind === "market"
    ? ["marketValue", "marketAmount", "marketPrice", "currentMarketValue", "__marketValue"]
    : ["settlementAmount", "finalSettlementAmount", "settlementValue", "agreedSettlementAmount", "__settlementAmount"];
  for (const key of exact) { const value = data?.[key]; if (value && parseDealNumber(value) > 0) return parseDealNumber(value); }
  const pattern = kind === "market" ? /market.*(value|amount|price)|(value|amount|price).*market/i : /settle.*(amount|value)|(amount|value).*settle/i;
  const found = entries.find(([key, value]) => pattern.test(key) && parseDealNumber(value) > 0);
  return found ? parseDealNumber(found[1]) : 0;
};
const selectedMax = (preset: string, custom: string) => preset === "custom" ? parseDealNumber(custom) : preset ? Number(preset) : 0;
const amountLabel = (value: number) => value > 0 ? formatINR(value) : "Not recorded";
const locationTextFromData = (data: Record<string,string> | undefined) => Object.entries(data || {})
  .filter(([key,value]) => /location|address|city|area|locality|village|district|taluk|tehsil|pincode|postal|landmark|zone|state/i.test(key) && String(value || "").trim())
  .map(([,value]) => String(value)).join(" ");
const phoneDigits = (value: unknown) => String(value || "").replace(/\D/g, "");
const phoneQueryMatches = (numbers: string, query: string) => {
  const q = phoneDigits(query);
  if (q.length < 4) return false;
  return numbers.split(" ").some(raw => {
    const n = phoneDigits(raw);
    const localN = n.length > 10 && n.startsWith("91") ? n.slice(2) : n;
    const localQ = q.length > 10 && q.startsWith("91") ? q.slice(2) : q;
    return n.includes(q) || localN.includes(localQ) || n.endsWith(q) || localN.endsWith(localQ);
  });
};

function AmountFilter({ label, value, custom, onValue, onCustom }: { label: string; value: string; custom: string; onValue: (value: string) => void; onCustom: (value: string) => void }) {
  return <label className="ax-deal-finder__amount-filter">
    <span>{label}</span>
    <select value={value} onChange={event => onValue(event.target.value)}>{presets.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
    {value === "custom" && <input value={custom} onChange={event => onCustom(event.target.value)} placeholder="e.g. 75cr or 250000000" aria-label={label + " custom maximum"}/>}
  </label>;
}

export default function DealFinder({ records, contacts, modules, onOpenModule, onOpenRecord }: Props) {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("All categories");
  const [module, setModule] = useState("All modules");
  const [amountPreset, setAmountPreset] = useState("");
  const [marketPreset, setMarketPreset] = useState("");
  const [settlementPreset, setSettlementPreset] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [customMarket, setCustomMarket] = useState("");
  const [customSettlement, setCustomSettlement] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(true);
  const deferredQuery = useDeferredValue(query);
  const deferredLocation = useDeferredValue(location);
  const contactById = useMemo(() => new Map(contacts.map(contact => [contact.id, contact])), [contacts]);
  const categoryByModule = useMemo(() => new Map(modules.map(item => [item.name, item.group || "Other"])), [modules]);
  const categories = useMemo(() => Array.from(new Set(modules.map(item => item.group || "Other"))).sort(), [modules]);
  const moduleNames = useMemo(() => Array.from(new Set(records.map(record => record.module).filter(Boolean))).sort(), [records]);
  const limits = useMemo(() => ({
    amount: selectedMax(amountPreset, customAmount), market: selectedMax(marketPreset, customMarket),
    settlement: selectedMax(settlementPreset, customSettlement)
  }), [amountPreset, marketPreset, settlementPreset, customAmount, customMarket, customSettlement]);

  const indexed = useMemo(() => records.map(record => {
    const data = record.moduleData || {};
    const hasFollowUpIds = Object.prototype.hasOwnProperty.call(data,"__followUpContactIds");
    const ids = Array.from(new Set([
      record.primaryContactId || "", record.followUpContactId || "",
      ...(hasFollowUpIds ? (data.__followUpContactIds || "").split(",") : []),
      ...(record.followUpEntries || []).map(entry => entry.followPersonId || ""),
      ...(data.__linkedContactIds || "").split(","),
      ...Object.entries(data).filter(([key, value]) => key.startsWith("__contact_") && Boolean(value)).map(([, value]) => String(value))
    ].filter(Boolean)));
    const linked = ids.map(id => contactById.get(id)).filter((contact): contact is FinderContact => Boolean(contact));
    const amount = getPropertyPriceForRangeSearch(record) ?? parseDealNumber(record.value);
    const market = amountFromData(data, "market");
    const settlement = amountFromData(data, "settlement");
    const locationText = [record.location, locationTextFromData(data)].filter(Boolean).join(" ");
    const linkedPhones = linked.map(contact => contact.phone || "").filter(Boolean).join(" ");
    const text = normalize([
      record.title, record.module, categoryByModule.get(record.module), locationText, record.status, record.contact, record.value,
      ...Object.entries(data).flatMap(([key, value]) => [key, value]),
      ...linked.flatMap(contact => [contact.name, contact.phone, phoneDigits(contact.phone), contact.role, ...(contact.roles || []), contact.customRoles, contact.email, contact.whatsappName, contact.verifiedName, contact.notify, contact.whatsappJid, contact.associatedCompany])
    ].filter(Boolean).join(" "));
    return { record, linked, amount, market, settlement, text, locationText:normalize(locationText), linkedPhones, category: categoryByModule.get(record.module) || "Other" };
  }), [records, contactById, categoryByModule]);

  const filtered = useMemo(() => {
    const terms = normalize(deferredQuery).split(/\s+/).filter(Boolean);
    const locationTerms = normalize(deferredLocation).split(/\s+/).filter(Boolean);
    return indexed.filter(item =>
      (category === "All categories" || item.category === category) &&
      (module === "All modules" || item.record.module === module) &&
      locationTerms.every(term => item.locationText.includes(term)) &&
      (terms.every(term => item.text.includes(term)) || phoneQueryMatches(item.linkedPhones, deferredQuery)) &&
      (!limits.amount || (item.amount > 0 && item.amount <= limits.amount)) &&
      (!limits.market || (item.market > 0 && item.market <= limits.market)) &&
      (!limits.settlement || (item.settlement > 0 && item.settlement <= limits.settlement))
    );
  }, [indexed, deferredQuery, deferredLocation, category, module, limits]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    filtered.forEach(item => map.set(item.record.module, [...(map.get(item.record.module) || []), item]));
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);
  const clear = () => {
    setQuery(""); setLocation(""); setCategory("All categories"); setModule("All modules");
    setAmountPreset(""); setMarketPreset(""); setSettlementPreset("");
    setCustomAmount(""); setCustomMarket(""); setCustomSettlement("");
  };

  return <section className="data-panel ax-deal-finder">
    <header className="section-heading">
      <div><span className="section-kicker">CROSS-MODULE INTELLIGENCE</span><h2>Deal Finder</h2><p>Search all modules together by category, location, deal amount, market value and settlement value. Results stay linked to their original records.</p></div>
      <button type="button" className="secondary-button" onClick={clear}><X size={14}/> Clear filters</button>
    </header>
    <div className="ax-deal-finder__summary">
      <div><span>All records</span><strong>{records.length}</strong></div><div><span>Matching records</span><strong>{filtered.length}</strong></div>
      <div><span>Categories</span><strong>{categories.length}</strong></div><div><span>Modules represented</span><strong>{grouped.length}</strong></div>
    </div>
    <div className="ax-deal-finder__primary">
      <label><span><Search size={13}/> Search all modules</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Property, client, contact number, market, settlement…"/></label>
      <label><span><MapPin size={13}/> Location / area</span><input value={location} onChange={event => setLocation(event.target.value)} placeholder="e.g. Srirampuram, Bangalore"/></label>
    </div>
    <div className="ax-deal-finder__filter-head"><strong><SlidersHorizontal size={15}/> Cross-module filters</strong><button type="button" className="secondary-button" onClick={() => setShowAdvanced(value => !value)}>{showAdvanced ? "Hide filters" : "Show filters"}</button></div>
    {showAdvanced && <div className="ax-deal-finder__filters">
      <label><span>Category</span><select value={category} onChange={event => {setCategory(event.target.value);setModule("All modules");}}><option>All categories</option>{categories.map(item => <option key={item}>{item}</option>)}</select></label>
      <label><span>Module</span><select value={module} onChange={event => setModule(event.target.value)}><option>All modules</option>{moduleNames.map(item => <option key={item}>{item}</option>)}</select></label>
      <AmountFilter label="Deal / record amount" value={amountPreset} custom={customAmount} onValue={setAmountPreset} onCustom={setCustomAmount}/>
      <AmountFilter label="Market value" value={marketPreset} custom={customMarket} onValue={setMarketPreset} onCustom={setCustomMarket}/>
      <AmountFilter label="Settlement amount" value={settlementPreset} custom={customSettlement} onValue={setSettlementPreset} onCustom={setCustomSettlement}/>
    </div>}
    <div className="ax-deal-finder__results">
      <div className="ax-deal-finder__result-heading"><strong><Filter size={15}/> Matching records</strong><span>{filtered.length} results</span></div>
      {!filtered.length && <div className="ax-command-empty">No records match these filters. Try another location, category or amount range.</div>}
      {grouped.map(([moduleName, items]) => <section className="ax-deal-finder__module" key={moduleName}>
        <header><div><span className="section-kicker">{items[0]?.category || "OTHER"}</span><h3>{moduleName}</h3></div><span>{items.length} record{items.length === 1 ? "" : "s"}</span><button type="button" className="secondary-button" onClick={() => onOpenModule(moduleName)}>Open module <ArrowUpRight size={13}/></button></header>
        <div className="ax-deal-finder__cards">{items.map(item => <article className="ax-deal-finder__card" key={item.record.id}>
          <div><strong>{item.record.title}</strong><small><MapPin size={12}/> {item.record.location || "Location not entered"} · {item.record.status}</small></div>
          <div className="ax-deal-finder__values">
            <span><small>Deal amount</small><strong>{amountLabel(item.amount)}</strong></span>
            <span><small>Market value</small><strong>{amountLabel(item.market)}</strong></span>
            <span><small>Settlement</small><strong>{amountLabel(item.settlement)}</strong></span>
          </div>
          {item.linked.length > 0 && <small className="ax-deal-finder__contacts">Contacts: {item.linked.map(contact => contact.name + (contact.phone ? " · " + contact.phone : "")).join(" | ")}</small>}
          <button type="button" className="secondary-button" onClick={() => onOpenRecord(item.record)}>Open linked record <ArrowUpRight size={13}/></button>
        </article>)}</div>
      </section>)}
    </div>
  </section>;
}
