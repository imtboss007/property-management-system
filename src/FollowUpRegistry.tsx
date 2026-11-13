import { useMemo, useState } from "react";
import { formatIndianCompactAmount, parseIndianAmount } from "./lib/indian-amount.mjs";
import { downloadIntelligencePdf, downloadIntelligencePptx } from "./lib/report-export.mjs";
import { CalendarClock, CheckCircle2, Clock3, Download, FileDown, Filter, ListTodo, MessageCircle, Pencil, Plus, Search, Users } from "lucide-react";
import { isFollowUpClosed, legacyRecordFollowUp, parseFollowUps, type FollowUpEntry, type FollowUpPriority, type FollowUpRecordLike } from "./lib/follow-ups";

type Contact = { id: string; name: string; phone?: string; role?: string };
type Group = { id:string; jid:string; name:string };
type RegistryField = {key:string;label:string};
type Task = {
  id: string; title: string; date: string; time: string; type: string; property: string;
  propertyId?: string; contactId?: string; contactName?: string; notes: string; done: boolean;
  followUpContactIds?: string[]; priority?: FollowUpPriority; nextAction?: string; createdAt?: string;
};
type Item = {
  key: string;
  source: "record" | "legacy" | "task";
  record: FollowUpRecordLike | null;
  entry: FollowUpEntry;
  task: Task | null;
  module: string;
  recordTitle: string;
};

type Props = {
  initialTab?: "All"|"Today"|"Overdue"|"Upcoming"|"Completed";
  properties: FollowUpRecordLike[];
  contacts: Contact[];
  groups: Group[];
  moduleFields: Record<string,RegistryField[]>;
  tasks: Task[];
  today: string;
  onAdd: () => void;
  onEditEntry: (record: FollowUpRecordLike, entry: FollowUpEntry) => void;
  onUpdateEntry: (record: FollowUpRecordLike, entry: FollowUpEntry) => void;
  onDeleteEntry: (record: FollowUpRecordLike, entryId: string) => void;
  onEditRecord: (record: FollowUpRecordLike) => void;
  onEditTask: (task: Task) => void;
  onToggleTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenModule: (module: string) => void;
  onWhatsApp: (contactId?: string, propertyId?: string, taskId?: string, taskTitle?: string) => void;
};

const money = (value: string | number) => formatIndianCompactAmount(value) || "—";
const dateLabel = (value: string) => value ? new Date(value + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Not dated";
const statusOf = (item: Item) => item.source === "task" ? (item.task?.done ? "Completed" : "Open") : item.entry.status;

function RegistryCheckList({title,items,selected,onChange}:{title:string;items:{id:string;label:string}[];selected:string[];onChange:(value:string[])=>void}) {
  const [query,setQuery]=useState("");
  const filtered=items.filter(item=>!query||item.label.toLowerCase().includes(query.toLowerCase()));
  const toggle=(id:string,checked:boolean)=>onChange(checked?Array.from(new Set([...selected,id])):selected.filter(value=>value!==id));
  return <div className="ax-followup-multi-filter"><strong>{title}</strong><small>{selected.length} selected</small><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder={"Search "+title.toLowerCase()+"…"} aria-label={"Search "+title}/><div className="ax-followup-multi-filter__actions"><button type="button" onClick={()=>onChange(items.map(item=>item.id))}>Select all</button><button type="button" onClick={()=>onChange([])}>Clear</button></div><div className="ax-followup-multi-filter__items">{filtered.map(item=><label key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={event=>toggle(item.id,event.target.checked)}/><span>{item.label}</span></label>)}{filtered.length===0&&<small>No matching options.</small>}</div></div>;
}
const AREA_FACTORS:Record<string,number>={"sq ft":1,"sq yd":9,"sq m":10.7639104167,acre:43560,gunta:1089,hectare:107639.104167,cent:435.6};

export default function FollowUpRegistry({
  initialTab="All", properties, contacts, groups, moduleFields, tasks, today, onAdd, onEditEntry, onUpdateEntry,
  onDeleteEntry, onEditRecord, onEditTask, onToggleTask, onDeleteTask, onOpenModule, onWhatsApp
}: Props) {
  const [tab, setTab] = useState<"All"|"Today"|"Overdue"|"Upcoming"|"Completed">(initialTab);
  const [query, setQuery] = useState("");
  const [personFilters,setPersonFilters]=useState<string[]>([]);
  const [primaryPersonFilters,setPrimaryPersonFilters]=useState<string[]>([]);
  const [primaryGroupFilters,setPrimaryGroupFilters]=useState<string[]>([]);
  const [followGroupFilters,setFollowGroupFilters]=useState<string[]>([]);
  const [moduleFilters,setModuleFilters]=useState<string[]>([]);
  const [areaMin,setAreaMin]=useState("");const [areaMax,setAreaMax]=useState("");const [areaUnit,setAreaUnit]=useState("sq ft");
  const [srMin,setSrMin]=useState("");const [srMax,setSrMax]=useState("");
  const [valueMin,setValueMin]=useState("");const [valueMax,setValueMax]=useState("");
  const [marketMin,setMarketMin]=useState("");const [marketMax,setMarketMax]=useState("");
  const [minimumAmount,setMinimumAmount]=useState("");
  const [maximumAmount,setMaximumAmount]=useState("");
  const [locationFilter,setLocationFilter]=useState("");
  const [reportGroupBy,setReportGroupBy]=useState("all");
  const [includePrimaryName,setIncludePrimaryName]=useState(true);
  const [includeFollowName,setIncludeFollowName]=useState(true);
  const [includePrimaryGroup,setIncludePrimaryGroup]=useState(true);
  const [includeFollowGroup,setIncludeFollowGroup]=useState(true);
  const [priorityFilter, setPriorityFilter] = useState("");
  const [amountSort, setAmountSort] = useState<"none"|"high"|"low">("none");
  const [month, setMonth] = useState(today.slice(0,7));
  const [view, setView] = useState<"people"|"timeline"|"calendar">("people");
  const contactById = useMemo(() => new Map<string, Contact>(contacts.map(contact => [contact.id, contact] as const)), [contacts]);
  const readGroupIds=(record:FollowUpRecordLike|null,kind:"primary"|"follow")=>{
    if(!record?.moduleData)return [];
    const key=kind==="primary"?"__primaryGroupIds":"__followUpGroupIds";
    return String(record.moduleData[key]||"").split(",").map(id=>id.trim()).filter(Boolean);
  };
  const groupLabels=(record:FollowUpRecordLike|null,kind:"primary"|"follow")=>readGroupIds(record,kind).map(id=>groups.find(group=>group.id===id||group.jid===id)?.name||id);


  const items = useMemo<Item[]>(() => {
    const result: Item[] = [];
    const knownRecordDates = new Set<string>();
    for (const record of properties) {
      const explicit = parseFollowUps(record.moduleData);
      for (const entry of explicit) {
        result.push({ key: record.id + ":" + entry.id, source: "record", record, entry, task: null, module: record.module, recordTitle: record.title });
        knownRecordDates.add(record.id + ":" + entry.date);
      }
      const legacy = legacyRecordFollowUp(record);
      if (legacy && !knownRecordDates.has(record.id + ":" + legacy.date)) {
        result.push({ key: record.id + ":" + legacy.id, source: "legacy", record, entry: legacy, task: null, module: record.module, recordTitle: record.title });
      }
    }
    for (const task of tasks) {
      if (!String(task.type || "").toLowerCase().includes("follow")) continue;
      // Keep each scheduled task as its own follow-up item; matching dates do not make two commitments duplicates.
      const record = task.propertyId ? properties.find(item => item.id === task.propertyId) || null : null;
      const contactIds = Array.from(new Set([...(task.followUpContactIds || []), task.contactId || ""].filter(Boolean)));
      const entry: FollowUpEntry = {
        id: "task:" + task.id, contactIds, description: task.title, amount: record?.value || "",
        date: task.date, time: task.time, priority: task.priority || "Normal",
        status: task.done ? "Completed" : "Open", notes: task.notes || "",
        nextAction: task.nextAction || "", assignedAt: task.createdAt || ""
      };
      result.push({ key: "task:" + task.id, source: "task", record, entry, task, module: record?.module || task.type, recordTitle: task.property || record?.title || "No linked record" });
    }
    return result;
  }, [properties, tasks]);

  const counts = useMemo(() => ({
    all: items.length,
    today: items.filter(item => !isFollowUpClosed(statusOf(item)) && item.entry.date === today).length,
    overdue: items.filter(item => !isFollowUpClosed(statusOf(item)) && item.entry.date && item.entry.date < today).length,
    upcoming: items.filter(item => !isFollowUpClosed(statusOf(item)) && item.entry.date > today).length,
    completed: items.filter(item => statusOf(item) === "Completed").length,
    multiple: items.filter(item => item.entry.contactIds.length > 1).length
  }), [items, today]);

  const modules = useMemo(() => Array.from(new Set(items.map(item => item.module).filter(Boolean))).sort(), [items]);
  const followPersonOptions=contacts.filter(person=>items.some(item=>item.entry.contactIds.includes(person.id))).map(person=>({id:person.id,label:person.name+(person.role?" · "+person.role:"")})).sort((a,b)=>a.label.localeCompare(b.label));
  const primaryPersonOptions=contacts.filter(person=>properties.some(record=>record.primaryContactId===person.id||(!record.primaryContactId&&record.contact?.trim().toLowerCase()===person.name.trim().toLowerCase()))).map(person=>({id:person.id,label:person.name+(person.role?" · "+person.role:"")})).sort((a,b)=>a.label.localeCompare(b.label));
  const primaryGroupOptions=groups.filter(group=>properties.some(record=>readGroupIds(record,"primary").some(id=>id===group.id||id===group.jid||id===group.name))).map(group=>({id:group.id,label:group.name})).sort((a,b)=>a.label.localeCompare(b.label));
  const followGroupOptions=groups.filter(group=>properties.some(record=>readGroupIds(record,"follow").some(id=>id===group.id||id===group.jid||id===group.name))).map(group=>({id:group.id,label:group.name})).sort((a,b)=>a.label.localeCompare(b.label));
  const moneyField=(record:FollowUpRecordLike|null,kind:"sr"|"market"|"settlement")=>{
    if(!record)return 0;
    const recordRate=(record as FollowUpRecordLike & {ratePerUnit?:string}).ratePerUnit;
    if(kind==="sr" && String(recordRate||"").trim())return parseIndianAmount(recordRate)||0;
    if(!record.moduleData)return 0;
    const exact=kind==="sr"?["srRate","guidanceRate","settlementRate","srGuidanceRate"]:kind==="market"?["marketRate","marketRatePerUnit","marketValue","marketAmount"]:["settlementAmount","settlementValue","agreedSettlementAmount"];
    for(const key of exact){const value=record.moduleData[key];if(String(value||"").trim())return parseIndianAmount(value)||0;}
    const pattern=kind==="sr"?/(sr|guidance).*(rate|value)|(rate|guidance).*(sr)/i:kind==="market"?/market.*(rate|value|amount)|(rate|value|amount).*market/i:/settlement.*(amount|value)|(amount|value).*settlement/i;
    const entry=Object.entries(record.moduleData).find(([key,value])=>pattern.test(key)&&String(value||"").trim());
    return entry?parseIndianAmount(entry[1])||0:0;
  };
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    let result = items.filter(item => {
      const status = statusOf(item);
      if (tab === "Today" && (isFollowUpClosed(status) || item.entry.date !== today)) return false;
      if (tab === "Overdue" && (isFollowUpClosed(status) || !item.entry.date || item.entry.date >= today)) return false;
      if (tab === "Upcoming" && (isFollowUpClosed(status) || !item.entry.date || item.entry.date <= today)) return false;
      if (tab === "Completed" && status !== "Completed") return false;
      if (personFilters.length && !personFilters.some(id=>item.entry.contactIds.includes(id))) return false;
      const primaryId=item.record?.primaryContactId || contacts.find(person=>person.name.trim().toLowerCase()===(item.record?.contact||"").trim().toLowerCase())?.id || "";
      if (primaryPersonFilters.length && !primaryPersonFilters.includes(primaryId)) return false;
      if (primaryGroupFilters.length && !primaryGroupFilters.some(id=>readGroupIds(item.record,"primary").some(value=>value===id||groups.find(group=>group.id===id)?.jid===value||groups.find(group=>group.id===id)?.name===value))) return false;
      if (followGroupFilters.length && !followGroupFilters.some(id=>readGroupIds(item.record,"follow").some(value=>value===id||groups.find(group=>group.id===id)?.jid===value||groups.find(group=>group.id===id)?.name===value))) return false;
      if (locationFilter.trim() && !String(item.record?.location||"").toLowerCase().includes(locationFilter.trim().toLowerCase())) return false;
      const amount=parseIndianAmount(item.entry.amount||"")||parseIndianAmount(item.record?.value||"")||0;
      const min=parseIndianAmount(minimumAmount),max=parseIndianAmount(maximumAmount);
      if (minimumAmount.trim() && (min===null || amount<min)) return false;
      if (maximumAmount.trim() && (max===null || amount>max)) return false;
      if (moduleFilters.length && !moduleFilters.includes(item.module)) return false;
      const factor=AREA_FACTORS[areaUnit]||1, area=(Number(item.record?.areaValue||0)*(AREA_FACTORS[item.record?.areaUnit||"sq ft"]||1))/factor;
      const areaLo=parseIndianAmount(areaMin),areaHi=parseIndianAmount(areaMax);
      if(areaMin.trim()&&(areaLo===null||!item.record?.areaValue||area<areaLo))return false;
      if(areaMax.trim()&&(areaHi===null||!item.record?.areaValue||area>areaHi))return false;
      const sr=moneyField(item.record,"sr"),recordValue=parseIndianAmount(item.record?.value||"")||0,market=moneyField(item.record,"market");
      const srLo=parseIndianAmount(srMin),srHi=parseIndianAmount(srMax),valueLo=parseIndianAmount(valueMin),valueHi=parseIndianAmount(valueMax),marketLo=parseIndianAmount(marketMin),marketHi=parseIndianAmount(marketMax);
      if(srMin.trim()&&(srLo===null||!sr||sr<srLo))return false;if(srMax.trim()&&(srHi===null||!sr||sr>srHi))return false;
      if(valueMin.trim()&&(valueLo===null||!item.record?.value||recordValue<valueLo))return false;if(valueMax.trim()&&(valueHi===null||!item.record?.value||recordValue>valueHi))return false;
      if(marketMin.trim()&&(marketLo===null||!market||market<marketLo))return false;if(marketMax.trim()&&(marketHi===null||!market||market>marketHi))return false;
      if (priorityFilter && item.entry.priority !== priorityFilter) return false;
      if (term) {
        const people = item.entry.contactIds.map(id => contactById.get(id)?.name || "").join(" ");
        const text = [item.entry.description,item.entry.notes,item.entry.nextAction,item.recordTitle,item.module,people,item.entry.amount].join(" ").toLowerCase();
        if (!text.includes(term)) return false;
      }
      return true;
    });
    if (amountSort !== "none") result = [...result].sort((a,b) => {
      const av = parseIndianAmount(a.entry.amount||"") || parseIndianAmount(a.record?.value||"") || 0;
      const bv = parseIndianAmount(b.entry.amount||"") || parseIndianAmount(b.record?.value||"") || 0;
      return amountSort === "high" ? bv-av : av-bv;
    });
    else result = [...result].sort((a,b) => {
      const date = (a.entry.date || "9999-12-31").localeCompare(b.entry.date || "9999-12-31");
      return date || (a.entry.time || "").localeCompare(b.entry.time || "");
    });
    return result;
  }, [items, tab, today, personFilters, primaryPersonFilters, primaryGroupFilters, followGroupFilters, moduleFilters, minimumAmount, maximumAmount, locationFilter, priorityFilter, query, amountSort, contactById, groups, contacts, areaMin, areaMax, areaUnit, srMin, srMax, valueMin, valueMax, marketMin, marketMax]);

  const peopleGroups = useMemo(() => {
    const groups = new Map<string,{id:string;name:string;items:Item[]}>();
    for (const item of visible) {
      const ids = item.entry.contactIds.length ? item.entry.contactIds : [""];
      for (const id of ids) {
        const person = id ? contactById.get(id) : undefined;
        const key = id || "unassigned";
        if (!groups.has(key)) groups.set(key,{id:key,name:person?.name || "Unassigned follow-ups",items:[]});
        groups.get(key)!.items.push(item);
      }
    }
    return Array.from(groups.values()).sort((a,b) => {
      if (a.id === "unassigned") return 1;
      if (b.id === "unassigned") return -1;
      return a.name.localeCompare(b.name);
    });
  }, [visible, contactById]);

  const calendarItems = visible.filter(item => item.entry.date && item.entry.date.slice(0,7) === month);
  const groupedByDate = useMemo(() => {
    const groups = new Map<string,Item[]>();
    for (const item of visible) {
      const key = item.entry.date || "Unscheduled";
      groups.set(key,[...(groups.get(key)||[]),item]);
    }
    return Array.from(groups.entries()).sort((a,b) => a[0].localeCompare(b[0]));
  }, [visible]);

  const completeItem = (item: Item) => {
    if (item.source === "record" && item.record) onUpdateEntry(item.record,{...item.entry,status:"Completed"});
    else if (item.source === "task" && item.task) onToggleTask(item.task.id);
  };
  const reopenItem = (item: Item) => {
    if (item.source === "record" && item.record) onUpdateEntry(item.record,{...item.entry,status:"Open"});
    else if (item.source === "task" && item.task) onToggleTask(item.task.id);
  };
  const editItem = (item: Item) => {
    if (item.source === "record" && item.record) onEditEntry(item.record,item.entry);
    else if (item.source === "legacy" && item.record) onEditRecord(item.record);
    else if (item.task) onEditTask(item.task);
  };
  const removeItem = (item: Item) => {
    if (item.source === "record" && item.record) onDeleteEntry(item.record,item.entry.id);
    else if (item.task) onDeleteTask(item.task.id);
  };
  const exportVisible = (kind:"pdf"|"pptx") => {
    const rows=visible.map(item=>{
      const primary=item.record?.primaryContactId ? contactById.get(item.record.primaryContactId)?.name || "" : (item.record?.contact||"");
      const follow=item.entry.contactIds.map(id=>contactById.get(id)?.name||"").filter(Boolean).join(", ");
      const primaryGroup=includePrimaryGroup?groupLabels(item.record,"primary").join(", "):"";
      const followUpGroup=includeFollowGroup?groupLabels(item.record,"follow").join(", "):"";
      return {
        title:item.entry.description||item.recordTitle,module:item.module,location:String(item.record?.location||""),
        value:money(item.record?.value||item.entry.amount||""),srRate:money(moneyField(item.record,"sr")),marketRate:money(moneyField(item.record,"market")),settlementValue:money(moneyField(item.record,"settlement")),
        area:item.record?.areaValue?String(item.record.areaValue)+" "+(item.record.areaUnit||"sq ft"):"",
        primaryContact:includePrimaryName?primary:"",
        followUpContact:includeFollowName?follow:"",
        primaryGroup,followUpGroup,
        contactSummary:[includePrimaryName&&primary?"Primary: "+primary:"",primaryGroup?"Primary group: "+primaryGroup:""].filter(Boolean).join(" | "),
        followUpSummary:"Date/time: "+(item.entry.date||"Unscheduled")+(item.entry.time?" "+item.entry.time:""),
        detailsSummary:[
          "Follow-up: "+(item.entry.description||"—"),
          "Follow-up amount: "+(item.entry.amount?money(item.entry.amount):"—"),
          "Status: "+statusOf(item)+" · Priority: "+item.entry.priority,
          item.entry.nextAction?"Next action: "+item.entry.nextAction:"",
          item.record?.status?"Record status: "+item.record.status:"",
          ...(item.record?(moduleFields[item.record.module]||[]).filter(field=>String(item.record?.moduleData?.[field.key]||"").trim()).map(field=>field.label+": "+(field.label.includes("₹")?money(item.record?.moduleData?.[field.key]||""):String(item.record?.moduleData?.[field.key]))):[]),
          item.entry.notes?"Notes: "+item.entry.notes:""
        ].filter(Boolean).join("\n")
      };
    });
    if(reportGroupBy==="primary")rows.sort((a,b)=>a.contactSummary.localeCompare(b.contactSummary));
    if(reportGroupBy==="follow")rows.sort((a,b)=>a.followUpContact.localeCompare(b.followUpContact)||a.title.localeCompare(b.title));
    if(reportGroupBy==="date")rows.sort((a,b)=>a.followUpSummary.localeCompare(b.followUpSummary));
    const subtitle="Follow-up Registry · "+rows.length+" filtered entries · "+(reportGroupBy==="all"?"All visible":reportGroupBy==="primary"?"Primary-contact-wise":reportGroupBy==="follow"?"Follow-up-contact-wise":"Follow-up date/time-wise");
    if(kind==="pdf")downloadIntelligencePdf("Follow-up Registry",subtitle,rows);
    else downloadIntelligencePptx("Follow-up Registry",subtitle,rows);
  };

  const renderItem = (item: Item) => {
    const people = item.entry.contactIds.map(id => contactById.get(id)).filter((person): person is Contact => Boolean(person));
    const status = statusOf(item);
    const recordId = item.record?.id || item.task?.propertyId || "";
    const primaryName=item.record?.primaryContactId ? contactById.get(item.record.primaryContactId)?.name : (item.record?.contact||"");
    const primaryGroupText=groupLabels(item.record,"primary").join(", ");
    const followGroupText=groupLabels(item.record,"follow").join(", ");
    return <article className={"ax-followup-card"+(status==="Completed"?" is-complete":"")} key={item.key}>
      <div className="ax-followup-card__top"><span className="ax-followup-module">{item.module || "General"}</span><span className={"ax-followup-priority priority-"+item.entry.priority.toLowerCase()}>{item.entry.priority}</span></div>
      <h3>{item.entry.description || item.recordTitle}</h3>
      <p className="ax-followup-related">{item.recordTitle}{item.entry.amount ? " · "+money(item.entry.amount) : ""}</p>
      <div className="ax-followup-meta"><span><CalendarClock size={13}/>{dateLabel(item.entry.date)}</span><span><Clock3 size={13}/>{item.entry.time || "Time not set"}</span>{item.entry.assignedAt && <span>Assigned {dateLabel(item.entry.assignedAt.slice(0,10))}</span>}</div>
      <div className="ax-followup-assignees"><Users size={13}/>{people.length ? people.map(person=>person.name).join(" · ") : "No follow-up person assigned"}</div>
      {primaryName && <p className="ax-followup-next"><strong>Primary contact:</strong> {primaryName}</p>}{primaryGroupText && <p className="ax-followup-next"><strong>Primary group:</strong> {primaryGroupText}</p>}{followGroupText && <p className="ax-followup-next"><strong>Follow-up group:</strong> {followGroupText}</p>}{item.entry.nextAction && <p className="ax-followup-next"><strong>Next:</strong> {item.entry.nextAction}</p>}
      {item.entry.notes && <p className="ax-followup-notes">{item.entry.notes}</p>}
      <div className="ax-followup-card__bottom"><span className={"ax-followup-status status-"+status.toLowerCase().replace(/\s/g,"-")}>{status}</span><div className="ax-followup-actions">
        {recordId && <button type="button" onClick={()=>item.record?onOpenModule(item.record.module):onOpenModule(item.module)} className="text-button">Open record</button>}
        {item.source==="legacy" ? <button type="button" className="edit-button" onClick={()=>editItem(item)} aria-label="Edit original module record"><Pencil size={15}/></button> : <>
          <button type="button" className="edit-button" onClick={()=>editItem(item)} aria-label="Edit follow-up"><Pencil size={15}/></button>
          {status!=="Completed" ? <button type="button" className="ax-followup-done" onClick={()=>completeItem(item)}><CheckCircle2 size={14}/>Done</button> : <button type="button" className="ax-followup-reopen" onClick={()=>reopenItem(item)}>Reopen</button>}
          {people[0]?.phone && item.record && <button type="button" className="edit-button" onClick={()=>onWhatsApp(people[0].id,item.record!.id,item.task?.id,item.entry.description)} aria-label="Open WhatsApp"><MessageCircle size={15}/></button>}
          <button type="button" className="delete-button" onClick={()=>removeItem(item)} aria-label="Delete follow-up">×</button>
        </>}
      </div></div>
    </article>;
  };

  return <section className="ax-followup-registry">
    <div className="institutional-banner ax-followup-banner">
      <div className="institutional-copy">
        <span className="institutional-label"><span className="live-dot"/> AXIVESTRA · FOLLOW-UP REGISTRY</span>
        <h2>Every commitment. Every person. One register.</h2>
        <p>Consolidated follow-ups from all operating modules, linked to the original records and assigned people.</p>
        <div className="banner-actions"><button className="hero-button" onClick={onAdd}><Plus size={15}/> Add follow-up</button><button className="banner-ghost" onClick={()=>setView("calendar")}>Open calendar</button></div>
      </div>
      <div className="banner-aside"><span>FOLLOW-UP ASSIGNMENTS</span><strong>{counts.all.toLocaleString("en-IN")}</strong><small>{counts.multiple} entries assigned to more than one person</small></div>
    </div>

    <div className="ax-followup-kpis">
      <button className={tab==="Overdue"?"active":""} onClick={()=>setTab("Overdue")}><span>OVERDUE</span><strong>{counts.overdue}</strong><small>Open past-due items</small></button>
      <button className={tab==="Today"?"active":""} onClick={()=>setTab("Today")}><span>DUE TODAY</span><strong>{counts.today}</strong><small>Today's assignments</small></button>
      <button className={tab==="Upcoming"?"active":""} onClick={()=>setTab("Upcoming")}><span>UPCOMING</span><strong>{counts.upcoming}</strong><small>Future scheduled actions</small></button>
      <button className={tab==="Completed"?"active":""} onClick={()=>setTab("Completed")}><span>COMPLETED</span><strong>{counts.completed}</strong><small>Closed follow-ups</small></button>
    </div>

    <section className="data-panel ax-followup-controls">
      <div className="section-heading"><div><h2>Follow-up search and filters</h2><p>Search by person, record, module, description or next action.</p></div><button type="button" className="primary-button" onClick={onAdd}><Plus size={16}/> Add follow-up</button></div>
      <div className="ax-followup-filter-grid">
        <label className="ax-followup-search"><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search follow-ups, people, records…"/></label>
        <RegistryCheckList title="Follow-up contact" items={followPersonOptions} selected={personFilters} onChange={setPersonFilters}/>
        <RegistryCheckList title="Primary contact" items={primaryPersonOptions} selected={primaryPersonFilters} onChange={setPrimaryPersonFilters}/>
        <RegistryCheckList title="Primary group" items={primaryGroupOptions} selected={primaryGroupFilters} onChange={setPrimaryGroupFilters}/>
        <RegistryCheckList title="Follow-up group" items={followGroupOptions} selected={followGroupFilters} onChange={setFollowGroupFilters}/>
        <RegistryCheckList title="Module" items={modules.map(module=>({id:module,label:module}))} selected={moduleFilters} onChange={setModuleFilters}/>
        <label>Location<input value={locationFilter} onChange={event=>setLocationFilter(event.target.value)} placeholder="Search location"/></label>
        <label>Follow-up amount from (₹)<input value={minimumAmount} onChange={event=>setMinimumAmount(event.target.value)} placeholder="e.g. 2 Cr"/></label>
        <label>Follow-up amount to (₹)<input value={maximumAmount} onChange={event=>setMaximumAmount(event.target.value)} placeholder="e.g. 10 Cr"/></label>
        <label>Area / size from<input value={areaMin} onChange={event=>setAreaMin(event.target.value)} placeholder="e.g. 1200" inputMode="decimal"/></label>
        <label>Area / size to<input value={areaMax} onChange={event=>setAreaMax(event.target.value)} placeholder="e.g. 2" inputMode="decimal"/></label>
        <label>Area unit<select value={areaUnit} onChange={event=>setAreaUnit(event.target.value)}>{Object.keys(AREA_FACTORS).map(unit=><option key={unit}>{unit}</option>)}</select></label>
        <label>SR rate from (₹)<input value={srMin} onChange={event=>setSrMin(event.target.value)} placeholder="e.g. 2 Cr"/></label>
        <label>SR rate to (₹)<input value={srMax} onChange={event=>setSrMax(event.target.value)} placeholder="e.g. 5 Cr"/></label>
        <label>Value / exposure from (₹)<input value={valueMin} onChange={event=>setValueMin(event.target.value)} placeholder="e.g. 2 Cr"/></label>
        <label>Value / exposure to (₹)<input value={valueMax} onChange={event=>setValueMax(event.target.value)} placeholder="e.g. 10 Cr"/></label>
        <label>Market value / rate from (₹)<input value={marketMin} onChange={event=>setMarketMin(event.target.value)} placeholder="e.g. 3 Cr"/></label>
        <label>Market value / rate to (₹)<input value={marketMax} onChange={event=>setMarketMax(event.target.value)} placeholder="e.g. 12 Cr"/></label>
        <label>Priority<select value={priorityFilter} onChange={event=>setPriorityFilter(event.target.value)}><option value="">All priorities</option>{["Urgent","High","Normal","Low"].map(priority=><option key={priority}>{priority}</option>)}</select></label>
        <label>Amount order<select value={amountSort} onChange={event=>setAmountSort(event.target.value as typeof amountSort)}><option value="none">Date order</option><option value="high">Highest amount first</option><option value="low">Lowest amount first</option></select></label><button type="button" className="secondary-button" onClick={()=>{setQuery("");setPersonFilters([]);setPrimaryPersonFilters([]);setPrimaryGroupFilters([]);setFollowGroupFilters([]);setModuleFilters([]);setLocationFilter("");setMinimumAmount("");setMaximumAmount("");setAreaMin("");setAreaMax("");setAreaUnit("sq ft");setSrMin("");setSrMax("");setValueMin("");setValueMax("");setMarketMin("");setMarketMax("");setPriorityFilter("");setAmountSort("none");setTab("All");}}>Clear all filters</button>
      </div>
      <div className="ax-followup-tabs">{(["All","Today","Overdue","Upcoming","Completed"] as const).map(value=><button key={value} type="button" className={tab===value?"active":""} onClick={()=>setTab(value)}>{value}{value==="All"?" ("+counts.all+")":value==="Today"?" ("+counts.today+")":value==="Overdue"?" ("+counts.overdue+")":value==="Upcoming"?" ("+counts.upcoming+")":" ("+counts.completed+")"}</button>)}</div>
      <div className="ax-followup-export">
        <div className="ax-followup-export__head"><strong>Export visible follow-ups</strong><span>{visible.length} entries · filtered view</span></div>
        <div className="ax-followup-export__options">
          <label>Report grouping<select value={reportGroupBy} onChange={event=>setReportGroupBy(event.target.value)}><option value="all">All visible entries</option><option value="primary">Primary-contact-wise</option><option value="follow">Follow-up-contact-wise</option><option value="date">Follow-up date/time-wise</option></select></label>
          <label><input type="checkbox" checked={includePrimaryName} onChange={event=>setIncludePrimaryName(event.target.checked)}/> Primary names</label>
          <label><input type="checkbox" checked={includeFollowName} onChange={event=>setIncludeFollowName(event.target.checked)}/> Follow-up names</label>
          <label><input type="checkbox" checked={includePrimaryGroup} onChange={event=>setIncludePrimaryGroup(event.target.checked)}/> Primary groups</label>
          <label><input type="checkbox" checked={includeFollowGroup} onChange={event=>setIncludeFollowGroup(event.target.checked)}/> Follow-up groups</label>
        </div>
        <div className="ax-followup-export__buttons"><button type="button" className="secondary-button" onClick={()=>exportVisible("pdf")}><FileDown size={14}/> Download PDF</button><button type="button" className="primary-button" onClick={()=>exportVisible("pptx")}><Download size={14}/> Download PPT</button></div>
      </div>

      <div className="ax-followup-view-switch"><span><Filter size={14}/> View grouped by</span><button className={view==="people"?"active":""} onClick={()=>setView("people")}>Person</button><button className={view==="timeline"?"active":""} onClick={()=>setView("timeline")}>Timeline</button><button className={view==="calendar"?"active":""} onClick={()=>setView("calendar")}>Calendar</button></div>
    </section>

    {view==="people" && <div className="ax-followup-groups">
      {peopleGroups.length ? peopleGroups.map(group=><section className="ax-followup-person-group" key={group.id}>
        <div className="ax-followup-person-heading"><div><Users size={16}/><h3>{group.name}</h3></div><span>{group.items.length} assignment{group.items.length===1?"":"s"}</span></div>
        <div className="ax-followup-cards">{group.items.map(renderItem)}</div>
      </section>) : <div className="data-panel"><div className="ax-followup-empty"><ListTodo size={28}/><strong>No follow-ups match these filters</strong><span>Try another date, person, module or search term.</span><button className="primary-button" onClick={onAdd}><Plus size={15}/> Add follow-up</button></div></div>}
    </div>}

    {view==="timeline" && <section className="data-panel ax-followup-timeline">
      <div className="section-heading"><div><h2>Follow-up timeline</h2><p>Due dates in chronological order. Undated assignments appear last.</p></div><span>{visible.length} visible</span></div>
      {groupedByDate.length ? groupedByDate.map(([date,rows])=><div className="ax-followup-timeline-day" key={date}><div className="ax-followup-timeline-date"><span/>{date==="Unscheduled"?"Unscheduled":dateLabel(date)}<small>{rows.length}</small></div><div className="ax-followup-cards">{rows.map(renderItem)}</div></div>) : <p className="ax-followup-empty">No timeline items match the current filters.</p>}
    </section>}

    {view==="calendar" && <section className="data-panel ax-followup-calendar">
      <div className="section-heading"><div><h2>Follow-up calendar</h2><p>Scheduled assignments for the selected month.</p></div><label>Month<input type="month" value={month} onChange={event=>setMonth(event.target.value)}/></label></div>
      {calendarItems.length ? <div className="ax-followup-cards">{calendarItems.map(renderItem)}</div> : <p className="ax-followup-empty">No follow-ups are scheduled for {month} under the current filters.</p>}
    </section>}
  </section>;
}
