import { useMemo, useState } from "react";
import { CalendarClock, Download, FileDown, Filter, MapPin, X } from "lucide-react";
import { formatIndianCompactAmount, parseIndianAmount } from "./lib/indian-amount.mjs";
import { parseFollowUps, type FollowUpEntry, type FollowUpRecordLike } from "./lib/follow-ups";
import { downloadIntelligencePdf, downloadIntelligencePptx } from "./lib/report-export.mjs";

type HubRecord = FollowUpRecordLike & {
  location?: string; areaValue?: string; areaUnit?: string; ratePerUnit?: string;
  moduleData?: Record<string,string>; contact?: string; primaryContactId?: string;
  status?: string; nextFollowUpDate?: string; nextAction?: string; notes?: string;
};
type HubContact = {id:string;name:string;phone?:string;role?:string;roles?:string[];customRoles?:string};
type HubGroup = {id:string;jid:string;name:string;subject?:string};
type HubField = {key:string;label:string;type?:string};
type HubModule = {name:string;group?:string};
type Props = {
  properties:HubRecord[]; contacts:HubContact[]; modules:HubModule[];
  moduleFields:Record<string,HubField[]>; groups:HubGroup[];
  onOpenModule:(name:string)=>void;
  onEditRecord:(record:HubRecord)=>void;
  onEditFollowUp:(record:HubRecord,entry:FollowUpEntry)=>void;
};
const money = (value:string|number) => formatIndianCompactAmount(value) || "—";
const parseRange = (value:string) => value.trim() ? parseIndianAmount(value) : null;
const AREA_FACTORS:Record<string,number> = { "sq ft":1, "sq yd":9, acre:43560, gunta:1089, "sq m":10.7639104167, hectare:107639.104167, cent:435.6 };
const AREA_UNITS = Object.keys(AREA_FACTORS);
const keysOf = (record:HubRecord, kind:"primary"|"follow") => {
  const data=record.moduleData||{};
  const wanted=kind==="primary"?/primary.*group|group.*primary|main.*group/i:/follow.*group|group.*follow/i;
  const found=Object.entries(data).filter(([key])=>wanted.test(key));
  return found.flatMap(([,raw])=>{
    const text=String(raw||"").trim();if(!text)return [];
    try { const parsed=JSON.parse(text); if(Array.isArray(parsed))return parsed.map(String); } catch {}
    return text.split(/[,;\n]/).map(value=>value.trim()).filter(Boolean);
  });
};
const resolveGroupLabels=(ids:string[],groups:HubGroup[]) => ids.map(id=>{
  const match=groups.find(group=>group.id===id||group.jid===id||group.name.toLowerCase()===id.toLowerCase());
  return match?.name||id;
});
function findMoney(record:HubRecord,fields:HubField[],kind:"sr"|"market"|"settlement") {
  const data=record.moduleData||{};
  const explicit=kind==="sr"?["srRate","guidanceRate","settlementRate","srGuidanceRate"]:
    kind==="market"?["marketRate","marketRatePerUnit","marketValue","marketAmount"]:
    ["settlementAmount","settlementValue","agreedSettlementAmount"];
  for(const key of explicit){if(String(data[key]||"").trim())return String(data[key]);}
  const rx=kind==="sr"?/(sr|guidance).*(rate|value)|(rate|guidance).*(sr)/i:
    kind==="market"?/market.*(rate|value|amount)|(rate|value|amount).*market/i:
    /settlement.*(amount|value)|(amount|value).*settlement/i;
  const field=fields.find(item=>rx.test(item.label)&&String(data[item.key]||"").trim());
  if(field)return String(data[field.key]);
  const entry=Object.entries(data).find(([key,value])=>rx.test(key)&&String(value||"").trim());
  return entry?String(entry[1]):"";
}
function recordFollowIds(record:HubRecord) {
  const ids=String(record.moduleData?.__followUpContactIds||"").split(",").map(id=>id.trim()).filter(Boolean);
  return Array.from(new Set([...ids,...parseFollowUps(record.moduleData).flatMap(entry=>entry.contactIds)]));
}
function recordPrimaryIds(record:HubRecord,contacts:HubContact[]) {
  const primary=String(record.primaryContactId||"").trim();
  if(primary)return [primary];
  if(record.contact){const match=contacts.find(person=>person.name.trim().toLowerCase()===record.contact!.trim().toLowerCase());if(match)return [match.id];}
  return [];
}
function CheckList({title,items,selected,onChange,searchable=true}:{title:string;items:{id:string;label:string}[];selected:string[];onChange:(value:string[])=>void;searchable?:boolean}) {
  const [query,setQuery]=useState("");
  const filtered=items.filter(item=>!query||item.label.toLowerCase().includes(query.toLowerCase()));
  const toggle=(id:string,checked:boolean)=>onChange(checked?Array.from(new Set([...selected,id])):selected.filter(value=>value!==id));
  return <div className="ax-hub-checklist">
    <div className="ax-hub-checklist__head"><strong>{title}</strong><span>{selected.length} selected</span></div>
    {searchable&&<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder={"Search "+title.toLowerCase()+"…"} aria-label={"Search "+title}/>}
    <div className="ax-hub-checklist__actions"><button type="button" onClick={()=>onChange(items.map(item=>item.id))}>Select all</button><button type="button" onClick={()=>onChange([])}>Clear</button></div>
    <div className="ax-hub-checklist__items">{filtered.map(item=><label key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={event=>toggle(item.id,event.target.checked)}/><span>{item.label}</span></label>)}{filtered.length===0&&<small>No matching options.</small>}</div>
  </div>;
}
export default function IntelligenceHubExplorer({properties,contacts,modules,moduleFields,groups,onOpenModule,onEditRecord,onEditFollowUp}:Props) {
  const [moduleIds,setModuleIds]=useState<string[]>([]);
  const [location,setLocation]=useState("");
  const [areaMin,setAreaMin]=useState("");const [areaMax,setAreaMax]=useState("");const [areaUnit,setAreaUnit]=useState("sq ft");
  const [srMin,setSrMin]=useState("");const [srMax,setSrMax]=useState("");
  const [valueMin,setValueMin]=useState("");const [valueMax,setValueMax]=useState("");
  const [marketMin,setMarketMin]=useState("");const [marketMax,setMarketMax]=useState("");
  const [primaryIds,setPrimaryIds]=useState<string[]>([]);const [followIds,setFollowIds]=useState<string[]>([]);
  const [primaryGroups,setPrimaryGroups]=useState<string[]>([]);const [followGroups,setFollowGroups]=useState<string[]>([]);
  const [showFilters,setShowFilters]=useState(true);
  const [selectedRecord,setSelectedRecord]=useState<HubRecord|null>(null);
  const [reportGroup,setReportGroup]=useState("all");
  const [includePrimary,setIncludePrimary]=useState(true);const [includeFollow,setIncludeFollow]=useState(true);
  const [includePrimaryGroup,setIncludePrimaryGroup]=useState(true);const [includeFollowGroup,setIncludeFollowGroup]=useState(true);
  const [reportBusy,setReportBusy]=useState(false);

  const groupOptions=useMemo(()=>{
    const values=new Map<string,string>();
    groups.forEach(group=>values.set(group.id,group.name));
    properties.forEach(record=>{
      [...keysOf(record,"primary"),...keysOf(record,"follow")].forEach(token=>{
        const group=groups.find(item=>item.id===token||item.jid===token||item.name.toLowerCase()===token.toLowerCase());
        if(group)values.set(group.id,group.name);
      });
    });
    return Array.from(values.entries()).map(([id,label])=>({id,label})).sort((a,b)=>a.label.localeCompare(b.label));
  },[groups,properties]);
  const moduleOptions=modules.map(item=>({id:item.name,label:item.name+" · "+(item.group||"Workspace")}));
  const contactOptions=contacts.map(person=>({id:person.id,label:person.name+(person.role?" · "+person.role:"")+(person.phone?" · "+person.phone:"")})).sort((a,b)=>a.label.localeCompare(b.label));
  const filtered=useMemo(()=>properties.filter(record=>{
    if(moduleIds.length&& !moduleIds.includes(record.module))return false;
    if(location.trim()&&!String(record.location||"").toLowerCase().includes(location.trim().toLowerCase()))return false;
    const factor=AREA_FACTORS[areaUnit]||1, area=Number(record.areaValue||0)*(AREA_FACTORS[record.areaUnit||"sq ft"]||1)/factor;
    const loArea=parseRange(areaMin),hiArea=parseRange(areaMax);
    if(loArea!==null&&loArea!==undefined&&(Number.isNaN(loArea)||!record.areaValue||area<loArea))return false;
    if(hiArea!==null&&hiArea!==undefined&&(Number.isNaN(hiArea)||!record.areaValue||area>hiArea))return false;
    const fields=moduleFields[record.module]||[];
    const sr=Number(record.ratePerUnit||findMoney(record,fields,"sr")||0);
    const value=Number(record.value||0),market=Number(findMoney(record,fields,"market")||0);
    const srLo=parseRange(srMin),srHi=parseRange(srMax),valueLo=parseRange(valueMin),valueHi=parseRange(valueMax),marketLo=parseRange(marketMin),marketHi=parseRange(marketMax);
    if(srLo!==null&&srLo!==undefined&&(Number.isNaN(srLo)||!sr||sr<srLo))return false;
    if(srHi!==null&&srHi!==undefined&&(Number.isNaN(srHi)||!sr||sr>srHi))return false;
    if(valueLo!==null&&valueLo!==undefined&&(Number.isNaN(valueLo)||!record.value||value<valueLo))return false;
    if(valueHi!==null&&valueHi!==undefined&&(Number.isNaN(valueHi)||!record.value||value>valueHi))return false;
    if(marketLo!==null&&marketLo!==undefined&&(Number.isNaN(marketLo)||!market||market<marketLo))return false;
    if(marketHi!==null&&marketHi!==undefined&&(Number.isNaN(marketHi)||!market||market>marketHi))return false;
    const prim=recordPrimaryIds(record,contacts),follow=recordFollowIds(record);
    if(primaryIds.length&&!primaryIds.some(id=>prim.includes(id)))return false;
    if(followIds.length&&!followIds.some(id=>follow.includes(id)))return false;
    const pg=keysOf(record,"primary"),fg=keysOf(record,"follow");
    if(primaryGroups.length&&!primaryGroups.some(id=>pg.includes(id)))return false;
    if(followGroups.length&&!followGroups.some(id=>fg.includes(id)))return false;
    return true;
  }),[properties,moduleIds,location,areaMin,areaMax,areaUnit,srMin,srMax,valueMin,valueMax,marketMin,marketMax,primaryIds,followIds,primaryGroups,followGroups,contacts,moduleFields]);
  const totals=useMemo(()=>filtered.reduce((acc,record)=>({value:acc.value+(Number(record.value)||0),count:acc.count+1}),{value:0,count:0}),[filtered]);
  const clearFilters=()=>{setModuleIds([]);setLocation("");setAreaMin("");setAreaMax("");setAreaUnit("sq ft");setSrMin("");setSrMax("");setValueMin("");setValueMax("");setMarketMin("");setMarketMax("");setPrimaryIds([]);setFollowIds([]);setPrimaryGroups([]);setFollowGroups([]);};
  const labelNames=(ids:string[])=>ids.map(id=>contacts.find(person=>person.id===id)?.name).filter(Boolean).join(", ");
  const reportRows=()=>{
    const data=filtered.map(record=>{
      const prim=labelNames(recordPrimaryIds(record,contacts));
      const follow=labelNames(recordFollowIds(record));
      const primGroup=includePrimaryGroup?resolveGroupLabels(keysOf(record,"primary"),groups).join(", "):"";
      const followGroup=includeFollowGroup?resolveGroupLabels(keysOf(record,"follow"),groups).join(", "):"";
      const next=record.nextFollowUpDate||parseFollowUps(record.moduleData).map(entry=>entry.date+(entry.time?" "+entry.time:"")).filter(Boolean).join("; ");
      return {record,title:record.title,module:record.module,location:record.location||"",value:money(record.value||""),srRate:money(record.ratePerUnit||findMoney(record,moduleFields[record.module]||[],"sr")),marketRate:money(findMoney(record,moduleFields[record.module]||[],"market")),settlementValue:money(findMoney(record,moduleFields[record.module]||[],"settlement")),area:record.areaValue?String(record.areaValue)+" "+(record.areaUnit||"sq ft"):"",contactSummary:[includePrimary?("Primary: "+prim):"",primGroup?("Primary group: "+primGroup):""].filter(Boolean).join(" | "),followUpSummary:[includeFollow?("Follow-up: "+follow):"",followGroup?("Follow-up group: "+followGroup):"",next?"Date/time: "+next:""].filter(Boolean).join(" | ")};
    });
    if(reportGroup==="primary")data.sort((a,b)=>a.contactSummary.localeCompare(b.contactSummary)||a.title.localeCompare(b.title));
    else if(reportGroup==="follow")data.sort((a,b)=>a.followUpSummary.localeCompare(b.followUpSummary)||a.title.localeCompare(b.title));
    else if(reportGroup==="date")data.sort((a,b)=>a.followUpSummary.localeCompare(b.followUpSummary)||a.title.localeCompare(b.title));
    return data;
  };
  const exportReport=(kind:"pdf"|"pptx")=>{
    setReportBusy(true);
    try{const data=reportRows();const subtitle="Intelligence Hub · "+filtered.length+" filtered records · Recorded value / exposure "+money(totals.value)+(reportGroup==="primary"?" · Primary-contact-wise":reportGroup==="follow"?" · Follow-up-contact-wise":reportGroup==="date"?" · Follow-up date/time-wise":" · All filtered records");if(kind==="pdf")downloadIntelligencePdf("Intelligence Hub",subtitle,data);else downloadIntelligencePptx("Intelligence Hub",subtitle,data);}
    finally{window.setTimeout(()=>setReportBusy(false),700);}
  };
  const selectedFollowUps=selectedRecord?parseFollowUps(selectedRecord.moduleData):[];
  return <section className="ax-hub-explorer data-panel">
    <div className="ax-hub-explorer__head"><div><span className="section-kicker">CROSS-MODULE RECORD SEARCH</span><h2>Filter, inspect and export saved records</h2><p>Filters operate on stored module records. Missing amounts and areas are not treated as zero-valued matches.</p></div><div className="ax-hub-explorer__head-actions"><button type="button" className="secondary-button" onClick={()=>setShowFilters(value=>!value)}><Filter size={15}/>{showFilters?"Hide filters":"Show filters"}</button><button type="button" className="secondary-button" onClick={clearFilters}>Clear all filters</button></div></div>
    {showFilters&&<div className="ax-hub-filter-grid">
      <CheckList title="Module type" items={moduleOptions} selected={moduleIds} onChange={setModuleIds}/>
      <div className="ax-hub-filter-field"><label><MapPin size={14}/> Location search</label><input value={location} onChange={event=>setLocation(event.target.value)} placeholder="Search location / collateral"/></div>
      <div className="ax-hub-filter-field"><label>Area / size range</label><div className="ax-hub-range"><input value={areaMin} onChange={event=>setAreaMin(event.target.value)} placeholder="From" inputMode="decimal"/><input value={areaMax} onChange={event=>setAreaMax(event.target.value)} placeholder="To" inputMode="decimal"/><select value={areaUnit} onChange={event=>setAreaUnit(event.target.value)}>{AREA_UNITS.map(unit=><option key={unit}>{unit}</option>)}</select></div></div>
      <div className="ax-hub-filter-field"><label>SR / guidance rate (₹)</label><div className="ax-hub-range"><input value={srMin} onChange={event=>setSrMin(event.target.value)} placeholder="From (e.g. 2 Cr)"/><input value={srMax} onChange={event=>setSrMax(event.target.value)} placeholder="To (e.g. 5 Cr)"/></div></div>
      <div className="ax-hub-filter-field"><label>Value / exposure (₹)</label><div className="ax-hub-range"><input value={valueMin} onChange={event=>setValueMin(event.target.value)} placeholder="From"/><input value={valueMax} onChange={event=>setValueMax(event.target.value)} placeholder="To"/></div></div>
      <div className="ax-hub-filter-field"><label>Market value / rate (₹)</label><div className="ax-hub-range"><input value={marketMin} onChange={event=>setMarketMin(event.target.value)} placeholder="From"/><input value={marketMax} onChange={event=>setMarketMax(event.target.value)} placeholder="To"/></div></div>
      <CheckList title="Primary contact" items={contactOptions} selected={primaryIds} onChange={setPrimaryIds}/>
      <CheckList title="Follow-up contact" items={contactOptions} selected={followIds} onChange={setFollowIds}/>
      <CheckList title="Primary WhatsApp group" items={groupOptions} selected={primaryGroups} onChange={setPrimaryGroups}/>
      <CheckList title="Follow-up WhatsApp group" items={groupOptions} selected={followGroups} onChange={setFollowGroups}/>
    </div>}
    <div className="ax-hub-export-panel">
      <div className="ax-hub-export-summary"><strong>{filtered.length.toLocaleString("en-IN")} matching records</strong><span>Recorded value / exposure: {money(totals.value)}</span></div>
      <div className="ax-hub-export-options">
        <label>Report scope<select value={reportGroup} onChange={event=>setReportGroup(event.target.value)}><option value="all">All filtered records</option><option value="primary">Primary-contact-wise</option><option value="follow">Follow-up-contact-wise</option><option value="date">Follow-up date/time-wise</option></select></label>
        <label><input type="checkbox" checked={includePrimary} onChange={event=>setIncludePrimary(event.target.checked)}/> Include primary names</label>
        <label><input type="checkbox" checked={includeFollow} onChange={event=>setIncludeFollow(event.target.checked)}/> Include follow-up names</label>
        <label><input type="checkbox" checked={includePrimaryGroup} onChange={event=>setIncludePrimaryGroup(event.target.checked)}/> Include primary groups</label>
        <label><input type="checkbox" checked={includeFollowGroup} onChange={event=>setIncludeFollowGroup(event.target.checked)}/> Include follow-up groups</label>
      </div>
      <div className="ax-hub-export-buttons"><button type="button" className="secondary-button" disabled={reportBusy} onClick={()=>exportReport("pdf")}><FileDown size={15}/> Download PDF</button><button type="button" className="primary-button" disabled={reportBusy} onClick={()=>exportReport("pptx")}><Download size={15}/> Download PPT</button></div>
    </div>
    <div className="ax-hub-results-wrap"><table className="ax-hub-results"><thead><tr><th>Record / module</th><th>Location</th><th>Value / exposure</th><th>SR rate</th><th>Market rate</th><th>Settlement value</th><th>Area</th><th>Primary / follow-up</th><th>Follow-up date / time</th></tr></thead><tbody>
      {filtered.map(record=>{
        const primary=labelNames(recordPrimaryIds(record,contacts)),follow=labelNames(recordFollowIds(record)),entries=parseFollowUps(record.moduleData),next=entries[0]||null;
        const sr=record.ratePerUnit||findMoney(record,moduleFields[record.module]||[],"sr");
        return <tr key={record.id}><td><button type="button" className="ax-hub-record-link" onClick={()=>setSelectedRecord(record)}><strong>{record.title}</strong><small>{record.module} · {record.status||"Unspecified"}</small></button></td><td>{record.location||"—"}</td><td>{money(record.value||"")}</td><td>{money(sr)}</td><td>{money(findMoney(record,moduleFields[record.module]||[],"market"))}</td><td>{money(findMoney(record,moduleFields[record.module]||[],"settlement"))}</td><td>{record.areaValue?record.areaValue+" "+(record.areaUnit||"sq ft"):"—"}</td><td><button type="button" className="ax-hub-text-link" onClick={()=>setSelectedRecord(record)}>{primary?"P: "+primary:"Primary: —"}<br/>{follow?"F: "+follow:"Follow-up: —"}</button></td><td><button type="button" className="ax-hub-text-link" onClick={()=>setSelectedRecord(record)}>{next?next.date+(next.time?" · "+next.time:""):(record.nextFollowUpDate||"No follow-up date")}</button></td></tr>;
      })}
      {filtered.length===0&&<tr><td colSpan={9}>No saved records match the selected filters.</td></tr>}
    </tbody></table></div>
    {selectedRecord&&<div className="ax-hub-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setSelectedRecord(null);}}><section className="ax-hub-record-modal" role="dialog" aria-modal="true" aria-label={"Record details: "+selectedRecord.title}>
      <div className="ax-hub-record-modal__head"><div><span className="section-kicker">{selectedRecord.module}</span><h2>{selectedRecord.title}</h2><p>{selectedRecord.location||"Location not entered"} · {selectedRecord.status||"Unspecified"}</p></div><button type="button" aria-label="Close record details" onClick={()=>setSelectedRecord(null)}><X size={18}/></button></div>
      <div className="ax-hub-record-modal__grid">
        {[["Value / exposure",money(selectedRecord.value||"")],["SR / guidance rate",money(selectedRecord.ratePerUnit||findMoney(selectedRecord,moduleFields[selectedRecord.module]||[],"sr"))],["Market rate",money(findMoney(selectedRecord,moduleFields[selectedRecord.module]||[],"market"))],["Settlement value",money(findMoney(selectedRecord,moduleFields[selectedRecord.module]||[],"settlement"))],["Area",selectedRecord.areaValue?selectedRecord.areaValue+" "+(selectedRecord.areaUnit||"sq ft"):"—"],["Primary contact",labelNames(recordPrimaryIds(selectedRecord,contacts))||selectedRecord.contact||"—"],["Follow-up contacts",labelNames(recordFollowIds(selectedRecord))||"—"],["Next action",selectedRecord.nextAction||"—"],["Notes / evidence",selectedRecord.notes||"—"]].map(([label,value])=><article key={label}><span>{label}</span><strong>{value}</strong></article>)}
      </div>
      <div className="ax-hub-modal-followups"><h3><CalendarClock size={16}/> Follow-up entries</h3>{selectedFollowUps.length?selectedFollowUps.map(entry=><article key={entry.id}><div><strong>{entry.description}</strong><small>{entry.date}{entry.time?" · "+entry.time:" · Time not set"} · {entry.status} · {entry.priority}</small><small>{labelNames(entry.contactIds)}</small></div><button type="button" className="secondary-button" onClick={()=>onEditFollowUp(selectedRecord,entry)}>Edit date / time and follow-up</button></article>):<p>No structured follow-up entries are saved on this record.</p>}</div>
      <div className="ax-hub-modal-actions"><button type="button" className="secondary-button" onClick={()=>onOpenModule(selectedRecord.module)}>Open this module</button><button type="button" className="primary-button" onClick={()=>onEditRecord(selectedRecord)}>Edit record</button></div>
    </section></div>}
    <p className="ax-hub-footnote">Filters only match fields present on saved records. Group filters resolve saved group IDs, JIDs or names; no contact or WhatsApp-group association is invented.</p>
  </section>;
}
