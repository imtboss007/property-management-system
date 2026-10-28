import { useMemo, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, CalendarClock, CheckCircle2, ClipboardList, Eye, LayoutGrid, ListFilter, MessageCircle, Pencil, Plus, Search, ShieldCheck, Sparkles, Table2, Users } from "lucide-react";

type ModuleRecord = {
  id: string; title: string; module: string; location: string; value: string; status: string;
  contact: string; primaryContactId?: string; targetDeadline?: string; nextFollowUpDate?: string;
  nextAction?: string; notes: string; createdAt: string; surveyNumber: string; ownershipDetails: string;
  areaValue: string; areaUnit: string; dimensions: string; ratePerUnit: string; moduleData: Record<string, string>;
};
type ModuleField = { key: string; label: string; placeholder: string; type?: "text" | "number" | "date" };
type Contact = { id: string; name: string; phone: string; role: string; notes: string };
type Props = {
  moduleName: string;
  description: string;
  records: ModuleRecord[];
  fields: ModuleField[];
  contacts: Contact[];
  onAdd: () => void;
  onEdit: (record: ModuleRecord) => void;
  onSchedule: (record: ModuleRecord, contact?: Contact) => void;
  onWhatsApp: (contactId?: string, propertyId?: string) => void;
};

const CLOSED = new Set(["completed", "closed", "settled", "rejected", "cancelled"]);
const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const currency = (value: number) => value ? INR.format(value) : "—";
const dateLabel = (value?: string) => value ? new Date(value + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Not scheduled";
const contactIds = (record: ModuleRecord) => [
  record.primaryContactId || "",
  ...(record.moduleData?.__linkedContactIds || "").split(","),
  ...Object.entries(record.moduleData || {}).filter(([key]) => key.startsWith("__contact_")).map(([,value]) => String(value || ""))
].filter(Boolean);

export default function ModuleWorkbench({ moduleName, description, records, fields, contacts, onAdd, onEdit, onSchedule, onWhatsApp }: Props) {
  const [view, setView] = useState<"overview" | "table" | "pipeline" | "data">("overview");
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [showAllFields, setShowAllFields] = useState(false);

  const filtered = useMemo(() => records.filter(record => {
    const text = [record.title, record.location, record.status, record.contact, record.nextAction, record.notes, ...Object.values(record.moduleData || {})].join(" ").toLowerCase();
    return (filter === "All" || record.status === filter) && text.includes(query.toLowerCase());
  }), [records, filter, query]);
  const totalValue = records.reduce((sum, row) => sum + (Number(row.value) || 0), 0);
  const active = records.filter(row => !CLOSED.has(String(row.status).toLowerCase())).length;
  const followups = records.filter(row => row.nextFollowUpDate).length;
  const missingData = records.filter(row => !row.location || !row.value || (fields.length > 0 && fields.some(field => !String(row.moduleData?.[field.key] || "").trim()))).length;
  const statuses = Array.from(new Set(records.map(row => row.status || "Unspecified")));
  const stageCounts = statuses.map(status => ({ status, count: records.filter(row => row.status === status).length })).sort((a,b) => b.count-a.count);
  const dataFields = fields.length ? fields : [
    { key: "location", label: "Location", placeholder: "" },
    { key: "value", label: "Value / exposure", placeholder: "" },
    { key: "targetDeadline", label: "Target deadline", placeholder: "" },
    { key: "nextFollowUpDate", label: "Next follow-up", placeholder: "" },
    { key: "nextAction", label: "Next action", placeholder: "" },
    { key: "ownershipDetails", label: "Ownership / parties", placeholder: "" },
    { key: "notes", label: "Notes / evidence", placeholder: "" }
  ];
  const getFieldValue = (record: ModuleRecord, key: string) => key === "location" || key === "value" || key === "targetDeadline" || key === "nextFollowUpDate" || key === "nextAction" || key === "ownershipDetails" || key === "notes"
    ? String(record[key as keyof ModuleRecord] || "")
    : String(record.moduleData?.[key] || "");
  const labelOf = (key: string) => dataFields.find(field => field.key === key)?.label || key;
  const presentFields = (record: ModuleRecord) => dataFields.filter(field => getFieldValue(record, field.key).trim()).length;
  const expandedHas = (id: string) => expanded.includes(id);
  const toggleExpanded = (id: string) => setExpanded(previous => previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id]);
  const linkedContacts = (record: ModuleRecord) => {
    const ids = contactIds(record);
    const linked = ids.map(id => contacts.find(contact => contact.id === id)).filter((item): item is Contact => Boolean(item));
    if (!linked.length && record.contact) {
      const legacy = contacts.find(contact => contact.name.trim().toLowerCase() === record.contact.trim().toLowerCase());
      if (legacy) linked.push(legacy);
    }
    return linked.filter((contact,index) => linked.findIndex(other=>other.id===contact.id)===index);
  };

  return <section className="ax-module-workbench">
    <div className="ax-module-hero">
      <div className="ax-module-hero-grid"/>
      <div className="ax-module-hero-copy">
        <span className="ax-kicker"><Sparkles size={13}/> MODULE INTELLIGENCE · {String(records.length).padStart(2,"0")} RECORDS</span>
        <h2>{moduleName}</h2><p>{description}</p>
        <div className="ax-module-hero-actions">
          <button className="ax-action-primary" onClick={onAdd}><Plus size={15}/> Create record</button>
          <button className="ax-action-ghost" onClick={()=>setView("data")}><ClipboardList size={15}/> Data completeness</button>
        </div>
      </div>
      <div className="ax-module-hero-mark" aria-hidden="true"><Activity size={76}/><span>AX//{String(records.length).padStart(2,"0")}</span></div>
    </div>
    <div className="ax-module-kpis">
      <div className="ax-module-kpi"><span>OPEN WORKSTREAMS</span><strong>{active}</strong><small><i className="ax-kpi-dot cyan"/> {records.length ? Math.round(active / records.length * 100) : 0}% of saved records</small></div>
      <div className="ax-module-kpi"><span>RECORDED VALUE / EXPOSURE</span><strong>{currency(totalValue)}</strong><small>Sum of values entered for this module</small></div>
      <div className="ax-module-kpi"><span>FOLLOW-UP COVERAGE</span><strong>{records.length ? Math.round(followups / records.length * 100) : 0}%</strong><small>{followups} records have a follow-up date</small></div>
      <div className={"ax-module-kpi " + (missingData ? "attention" : "healthy")}><span>DATA QUALITY QUEUE</span><strong>{missingData}</strong><small>{missingData ? "Records need review" : "No obvious missing fields"}</small></div>
    </div>
    <div className="ax-module-controlbar">
      <div className="ax-module-view-switch" role="tablist" aria-label="Module view">
        <button className={view==="overview"?"active":""} onClick={()=>setView("overview")} role="tab" aria-selected={view==="overview"}><LayoutGrid size={15}/> Cards</button>
        <button className={view==="table"?"active":""} onClick={()=>setView("table")} role="tab" aria-selected={view==="table"}><Table2 size={15}/> Table</button>
        <button className={view==="pipeline"?"active":""} onClick={()=>setView("pipeline")} role="tab" aria-selected={view==="pipeline"}><Activity size={15}/> Pipeline</button>
        <button className={view==="data"?"active":""} onClick={()=>setView("data")} role="tab" aria-selected={view==="data"}><ShieldCheck size={15}/> Data health</button>
      </div>
      <label className="ax-module-search"><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={"Search " + moduleName.toLowerCase() + " records"} /></label>
      <div className="ax-module-filter"><ListFilter size={14}/><select aria-label="Filter by status" value={filter} onChange={event=>setFilter(event.target.value)}><option>All</option>{statuses.map(status=><option key={status}>{status}</option>)}</select></div>
    </div>
    {records.length > 0 && <div className="ax-stage-strip">
      <button className={filter==="All"?"selected":""} onClick={()=>setFilter("All")}><span>All records</span><strong>{records.length}</strong></button>
      {stageCounts.slice(0,6).map((item,index)=><button key={item.status} className={filter===item.status?"selected":""} onClick={()=>setFilter(filter===item.status?"All":item.status)}><i className={"ax-stage-dot ax-stage-"+(index+1)}/><span>{item.status}</span><strong>{item.count}</strong></button>)}
    </div>}
    {filtered.length===0 ? <div className="ax-module-empty"><div className="ax-empty-orbit"><ClipboardList size={26}/></div><h3>{records.length ? "No records match these filters" : "This workspace is ready for its first record"}</h3><p>{records.length ? "Clear the search or change the status filter to see other records." : "Start with one record. AXIVESTRA will surface the fields, stakeholders and follow-ups that need attention."}</p><div><button className="ax-action-primary" onClick={records.length ? ()=>{setFilter("All");setQuery("");} : onAdd}>{records.length ? "Clear filters" : "Create first record"}</button></div></div>
    : view==="table" ? <div className="ax-record-table-wrap"><table className="ax-record-table"><thead><tr><th>Record / opportunity</th><th>Status</th><th>Location / collateral</th><th>Value / exposure</th><th>Next action</th><th>Completeness</th><th>Actions</th></tr></thead><tbody>{filtered.map(record=><tr key={record.id}><td><strong>{record.title}</strong><small>{record.module}</small></td><td><span className={"ax-status-chip " + (CLOSED.has(String(record.status).toLowerCase())?"closed":"open")}>{record.status}</span></td><td>{record.location || "Not entered"}</td><td>{currency(Number(record.value)||0)}</td><td>{record.nextAction || (record.nextFollowUpDate ? "Follow-up due " + dateLabel(record.nextFollowUpDate) : "Not scheduled")}</td><td><span className="ax-completeness">{presentFields(record)}/{dataFields.length}</span></td><td><div className="ax-row-actions"><button onClick={()=>toggleExpanded(record.id)} title="Inspect record" aria-label="Inspect record"><Eye size={14}/></button><button onClick={()=>onEdit(record)} title="Edit record" aria-label="Edit record"><Pencil size={14}/></button></div></td></tr>)}</tbody></table></div>
    : view==="pipeline" ? <div className="ax-kanban">
      {stageCounts.filter(stage=>filter==="All"||stage.status===filter).map(stage=><div className="ax-kanban-column" key={stage.status}><header><span>{stage.status}</span><strong>{filtered.filter(record=>record.status===stage.status).length}</strong></header>{filtered.filter(record=>record.status===stage.status).map(record=><article className="ax-kanban-card" key={record.id}><small>{record.location || "Location to be captured"}</small><h3>{record.title}</h3><strong>{currency(Number(record.value)||0)}</strong><p>{record.nextAction || "No next action recorded"}</p><div><button onClick={()=>onEdit(record)}><Pencil size={13}/> Edit</button><button onClick={()=>toggleExpanded(record.id)}><Eye size={13}/> Details</button></div>{expandedHas(record.id)&&<section className="ax-kanban-details">{dataFields.filter(field=>getFieldValue(record,field.key).trim()).map(field=><p key={field.key}><span>{field.label}</span><strong>{getFieldValue(record,field.key)}</strong></p>)}</section>}</article>)}</div>)}
    </div>
    : view==="data" ? <div className="ax-data-health">
      <div className="ax-data-health-head"><div><span className="ax-kicker"><ShieldCheck size={13}/> RECORD COMPLETENESS AUDIT</span><h3>Fields that keep deals moving</h3><p>Use this review to spot gaps before follow-up, negotiation, disbursal or registration.</p></div><label className="ax-inline-check"><input type="checkbox" checked={showAllFields} onChange={event=>setShowAllFields(event.target.checked)}/> Show empty fields too</label></div>
      {filtered.map(record=>{const completeness=presentFields(record);return <article className="ax-health-record" key={record.id}><div className="ax-health-record-head"><div><h4>{record.title}</h4><small>{record.status} · {completeness} of {dataFields.length} field groups populated</small></div><div className="ax-health-progress"><i style={{width:(dataFields.length?completeness/dataFields.length*100:0)+"%"}}/></div><button className="ax-row-action-text" onClick={()=>onEdit(record)}><Pencil size={13}/> Edit</button></div><div className="ax-field-audit-grid">{dataFields.filter(field=>showAllFields||getFieldValue(record,field.key).trim()).map(field=><div className={getFieldValue(record,field.key).trim()?"present":"missing"} key={field.key}><span>{field.label}</span><strong>{getFieldValue(record,field.key).trim()||"Not captured yet"}</strong>{!getFieldValue(record,field.key).trim()&&<small><ArrowDownRight size={12}/> Needs attention</small>}</div>)}</div></article>})}
    </div>
    : <div className="ax-module-record-grid">{filtered.map(record=>{
      const linked=linkedContacts(record);
      const expandedRow=expandedHas(record.id);
      const fieldsShown=dataFields.filter(field=>getFieldValue(record,field.key).trim());
      return <article className="ax-module-record-card" key={record.id}>
        <div className="ax-record-topline"><span className="ax-record-type">{moduleName}</span><span className={"ax-status-chip "+(CLOSED.has(String(record.status).toLowerCase())?"closed":"open")}>{record.status}</span></div>
        <h3>{record.title}</h3><p className="ax-record-location">{record.location || "Location / collateral not entered"}</p>
        <strong className="ax-record-value">{currency(Number(record.value)||0)}</strong>
        <div className="ax-record-progress"><i style={{width:(dataFields.length?presentFields(record)/dataFields.length*100:0)+"%"}}/><span>{presentFields(record)}/{dataFields.length} field groups</span></div>
        <div className="ax-record-next"><CalendarClock size={14}/><span>{record.nextAction || (record.nextFollowUpDate ? "Next follow-up " + dateLabel(record.nextFollowUpDate) : "No next action captured")}</span></div>
        {expandedRow&&<div className="ax-record-expanded">{fieldsShown.map(field=><p key={field.key}><span>{field.label}</span><strong>{getFieldValue(record,field.key)}</strong></p>)}{record.notes&&<p><span>Notes / evidence</span><strong>{record.notes}</strong></p>}<div className="ax-linked-people">{linked.length ? linked.map(contact=><span key={contact.id}><Users size={12}/>{contact.name} · {contact.role}</span>) : <span>No named stakeholder linked</span>}</div></div>}
        <div className="ax-record-actions"><button onClick={()=>toggleExpanded(record.id)}><Eye size={14}/>{expandedRow?"Hide details":"Inspect details"}</button><button onClick={()=>onEdit(record)}><Pencil size={14}/>Edit</button></div>
        <div className="ax-record-quick-actions"><button onClick={()=>onSchedule(record,linked[0])}><CalendarClock size={13}/>Follow-up</button>{linked.length ? linked.map(contact=><button key={contact.id} onClick={()=>onWhatsApp(contact.id,record.id)}><MessageCircle size={13}/>Message {contact.name.split(" ")[0]}</button>) : <button onClick={()=>onWhatsApp(undefined,record.id)}><MessageCircle size={13}/>WhatsApp</button>}<button onClick={()=>toggleExpanded(record.id)}><ArrowUpRight size={13}/> {expandedRow?"Collapse":"Open record"}</button></div>
      </article>;
    })}</div>}
    <div className="ax-module-footer"><span><CheckCircle2 size={14}/> Live module view · {filtered.length} shown of {records.length} saved records</span><button onClick={onAdd}><Plus size={15}/> Add another {moduleName.toLowerCase()} record</button></div>
  </section>;
}
