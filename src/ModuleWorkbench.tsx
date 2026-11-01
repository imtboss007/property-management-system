import { useMemo, useState } from "react";
import { axivestraRepeatableGroups, buildModuleSummary } from "./lib/axivestra-module-upgrades";
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, CalendarClock, CheckCircle2, ClipboardList, Download, Eye, FileText, LayoutGrid, ListFilter, MessageCircle, Pencil, PieChart, Plus, Search, ShieldCheck, Sparkles, Table2, TrendingUp, Trash2, Users, X } from "lucide-react";

type ModuleRecord = {
  id: string; title: string; module: string; location: string; value: string; status: string;
  contact: string; primaryContactId?: string; targetDeadline?: string; targetDeadlineTime?: string;
  nextFollowUpDate?: string; nextFollowUpTime?: string; nextResponseDate?: string; nextResponseTime?: string;
  nextResponseType?: string; nextResponseDescription?: string; nextAction?: string; notes: string; createdAt: string; surveyNumber: string; ownershipDetails: string;
  areaValue: string; areaUnit: string; dimensions: string; ratePerUnit: string; moduleData: Record<string, string>;
};
type ModuleField = { key: string; label: string; placeholder: string; type?: "text" | "number" | "currency" | "percent" | "date" | "select" | "textarea" | "email" | "phone" | "url" | "checkbox"; options?: string[]; required?: boolean };
type Contact = { id: string; name: string; phone: string; role: string; notes: string };
type Props = {
  moduleName: string;
  description: string;
  records: ModuleRecord[];
  fields: ModuleField[];
  contacts: Contact[];
  onAdd: () => void;
  onEdit: (record: ModuleRecord) => void;
  onDelete: (id: string) => void;
  onSchedule: (record: ModuleRecord, contact?: Contact) => void;
  onWhatsApp: (contactId?: string, propertyId?: string) => void;
  onExportReport: (records: ModuleRecord[]) => void;
  onExportPdf: (records: ModuleRecord[]) => void;
  onPrintRecord: (record: ModuleRecord) => void;
  onDownloadRecordPdf: (record: ModuleRecord) => void;
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

function ModuleEmptyChartPreview({ type }: { type: "donut" | "bar" | "line" }) {
  if (type === "donut") return <svg className="ax-empty-chart-ring" viewBox="0 0 180 180" role="img" aria-label="Empty donut chart preview"><circle cx="90" cy="90" r="62" fill="none" stroke="#1a354a" strokeWidth="21" strokeDasharray="6 7"/><circle cx="90" cy="90" r="45" fill="#0b1d2d"/><text x="90" y="86" textAnchor="middle" fill="#69879c" fontSize="9" letterSpacing="1">NO DATA</text><text x="90" y="105" textAnchor="middle" fill="#89a7bb" fontSize="14" fontWeight="800">0</text></svg>;
  if (type === "bar") return <div className="ax-empty-chart-bars" aria-label="Empty bar chart preview">{[0,1,2,3].map(item=><span key={item}><i/><b/></span>)}</div>;
  return <svg className="ax-empty-chart-line" viewBox="0 0 220 150" role="img" aria-label="Empty trend chart preview">{[0,1,2,3].map(n=><line key={n} x1="24" x2="208" y1={18+n*32} y2={18+n*32} stroke="#1a354a" strokeDasharray="4 6"/>)}<polyline points="24,114 80,92 136,104 208,72" fill="none" stroke="#244b61" strokeWidth="2" strokeDasharray="5 7"/><text x="116" y="139" textAnchor="middle" fill="#6b8ca2" fontSize="9">EMPTY TREND PREVIEW</text></svg>;
}

function ModuleAnalyticsChart({ items, total, type, metric, onSelect }: {
  items: { name: string; value: number; color: string; records: number }[];
  total: number;
  type: "donut" | "bar" | "line";
  metric: "status" | "value" | "followup";
  onSelect: (name: string) => void;
}) {
  const max = Math.max(1,...items.map(item=>item.value));
  if(type==="donut"){
    const radius=70, circumference=2*Math.PI*radius;
    let offset=0;
    return <div className="ax-module-donut-chart"><svg viewBox="0 0 220 220" role="img" aria-label={metric==="value"?"Value allocation by status":"Record distribution by status"}>
      <circle cx="110" cy="110" r={radius} fill="none" stroke="#142c41" strokeWidth="23"/>
      {items.map(item=>{const length=total>0?circumference*item.value/total:0;const currentOffset=offset;offset+=length;return <circle key={item.name} cx="110" cy="110" r={radius} fill="none" stroke={item.color} strokeWidth="23" strokeDasharray={length+" "+Math.max(0,circumference-length)} strokeDashoffset={-currentOffset} transform="rotate(-90 110 110)" strokeLinecap="butt" onClick={()=>onSelect(item.name)} className="ax-donut-segment"><title>{item.name}: {metric==="value"?currency(item.value):item.value}</title></circle>})}
      <circle cx="110" cy="110" r="51" fill="#0b1d2d"/><text x="110" y="103" textAnchor="middle" fill="#80a5bf" fontSize="9" letterSpacing="1">TOTAL</text><text x="110" y="125" textAnchor="middle" fill="#f0faff" fontSize={metric==="value"?"14":"19"} fontWeight="800">{metric==="value"?currency(total):total}</text>
    </svg><div className="ax-module-chart-center-note"><strong>{items.length} data segments</strong><small>Tap any segment or legend to filter records.</small></div></div>;
  }
  if(type==="bar")return <div className="ax-module-chart-bars">{items.map(item=><button className="ax-module-chart-bar" key={item.name} onClick={()=>onSelect(item.name)}><span>{item.name}</span><i><b style={{width:(item.value/max*100)+"%",background:item.color}}/></i><strong>{metric==="value"?currency(item.value):item.value}</strong></button>)}</div>;
  const width=600,height=260,left=40,right=20,top=26,bottom=42;
  const points=items.map((item,index)=>({...item,x:left+(items.length<2?(width-left-right)/2:index*(width-left-right)/(items.length-1)),y:top+(1-item.value/max)*(height-top-bottom)}));
  return <div className="ax-module-chart-line"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Module records trend"><defs><linearGradient id="axModuleLineFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#20d9ef" stopOpacity=".22"/><stop offset="100%" stopColor="#20d9ef" stopOpacity="0"/></linearGradient></defs>{[0,1,2,3,4].map(n=><line key={n} x1={left} x2={width-right} y1={top+n*(height-top-bottom)/4} y2={top+n*(height-top-bottom)/4} stroke="#203e55" strokeDasharray="4 6"/>)}{points.length>1&&<polygon points={points.map(point=>point.x+","+point.y).join(" ")+" "+points[points.length-1].x+","+(height-bottom)+" "+points[0].x+","+(height-bottom)} fill="url(#axModuleLineFill)"/>}<polyline points={points.map(point=>point.x+","+point.y).join(" ")} fill="none" stroke="#20d9ef" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>{points.map(point=><g key={point.name} tabIndex={0} role="button" onClick={()=>onSelect(point.name)} className="ax-chart-point"><circle cx={point.x} cy={point.y} r="5" fill={point.color} stroke="#071827" strokeWidth="2"/><text x={point.x} y={point.y-13} textAnchor="middle" fill="#e7f8ff" fontSize="10">{metric==="value"?currency(point.value):point.value}</text><text x={point.x} y={height-15} textAnchor="middle" fill="#8aa9bf" fontSize="10">{point.name.length>12?point.name.slice(0,11)+"…":point.name}</text></g>)}</svg></div>;
}

export default function ModuleWorkbench({ moduleName, description, records, fields, contacts, onAdd, onEdit, onDelete, onSchedule, onWhatsApp, onExportReport, onExportPdf, onPrintRecord, onDownloadRecordPdf }: Props) {
  const [view, setView] = useState<"overview" | "table" | "pipeline" | "analytics" | "data">("overview");
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [showAllFields, setShowAllFields] = useState(false);
  const [moduleChartType, setModuleChartType] = useState<"donut" | "bar" | "line">("donut");
  const [moduleMetric, setModuleMetric] = useState<"status" | "value" | "followup">("status");
  const [detailRecordId, setDetailRecordId] = useState<string|null>(null);

  const filtered = useMemo(() => records.filter(record => {
    const text = [record.id, record.title, record.module, record.location, record.value, record.status, record.contact, record.surveyNumber, record.ownershipDetails, record.areaValue, record.areaUnit, record.dimensions, record.ratePerUnit, record.targetDeadline, record.targetDeadlineTime, record.nextFollowUpDate, record.nextFollowUpTime, record.nextResponseDate, record.nextResponseTime, record.nextResponseType, record.nextResponseDescription, record.nextAction, record.notes, ...Object.entries(record.moduleData || {}).flatMap(([key, value]) => [key, String(value ?? "")])].join(" ").normalize("NFKC").toLocaleLowerCase();
    const terms = query.trim().normalize("NFKC").toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return (filter === "All" || record.status === filter || (filter === "Follow-up set" && Boolean(record.nextFollowUpDate)) || (filter === "No follow-up" && !record.nextFollowUpDate)) && terms.every(term => text.includes(term));
  }), [records, filter, query]);
  const totalValue = records.reduce((sum, row) => sum + (Number(row.value) || 0), 0);
  const active = records.filter(row => !CLOSED.has(String(row.status).toLowerCase())).length;
  const followups = records.filter(row => row.nextFollowUpDate).length;
  const missingData = records.filter(row => !row.location || !row.value || (fields.length > 0 && fields.some(field => !String(row.moduleData?.[field.key] || "").trim()))).length;
  const statuses = Array.from(new Set(records.map(row => row.status || "Unspecified")));
  const stageCounts = statuses.map(status => ({ status, count: records.filter(row => row.status === status).length })).sort((a,b) => b.count-a.count);
  const coreDataFields: ModuleField[] = [
    { key: "location", label: "Location / collateral", placeholder: "" },
    { key: "value", label: "Value / exposure", placeholder: "" },
    { key: "targetDeadline", label: "Target deadline", placeholder: "" },
    { key: "targetDeadlineTime", label: "Deadline time", placeholder: "" },
    { key: "nextFollowUpDate", label: "Next follow-up", placeholder: "" },
    { key: "nextFollowUpTime", label: "Follow-up time", placeholder: "" },
    { key: "nextResponseDate", label: "Expected next response date", placeholder: "" },
    { key: "nextResponseTime", label: "Expected next response time", placeholder: "" },
    { key: "nextResponseType", label: "Response type", placeholder: "" },
    { key: "nextResponseDescription", label: "Response description", placeholder: "" },
    { key: "nextAction", label: "Next action", placeholder: "" },
    { key: "ownershipDetails", label: "Ownership / parties", placeholder: "" },
    { key: "notes", label: "Notes / evidence", placeholder: "" }
  ];
  const dataFields = [...coreDataFields, ...fields.filter(field => !coreDataFields.some(core => core.key === field.key))];
  const getFieldValue = (record: ModuleRecord, key: string) => key === "location" || key === "value" || key === "targetDeadline" || key === "targetDeadlineTime" || key === "nextFollowUpDate" || key === "nextFollowUpTime" || key === "nextResponseDate" || key === "nextResponseTime" || key === "nextResponseType" || key === "nextResponseDescription" || key === "nextAction" || key === "ownershipDetails" || key === "notes"
    ? String(record[key as keyof ModuleRecord] || "")
    : String(record.moduleData?.[key] || "");
  const presentFields = (record: ModuleRecord) => dataFields.filter(field => getFieldValue(record, field.key).trim()).length;
  const moduleChartData = (() => {
    const groups = new Map<string, { name: string; value: number; color: string; records: number }>();
    records.forEach(record => {
      const name = moduleMetric === "followup" ? (record.nextFollowUpDate ? "Follow-up set" : "No follow-up") : (record.status || "Unspecified");
      const existing = groups.get(name) || { name, value: 0, color: ["#20d9ef","#2877ff","#8171ff","#28c78a","#ffbf68","#fc7796"][groups.size%6], records: 0 };
      existing.records += 1;
      existing.value += moduleMetric === "value" ? (Number(record.value)||0) : 1;
      groups.set(name,existing);
    });
    return Array.from(groups.values()).sort((a,b)=>b.value-a.value);
  })();
  const moduleChartTotal = moduleChartData.reduce((sum,item)=>sum+item.value,0);
  const detailRecord = detailRecordId ? records.find(record=>record.id===detailRecordId) || null : null;
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
        <button className={view==="analytics"?"active":""} onClick={()=>setView("analytics")} role="tab" aria-selected={view==="analytics"}><TrendingUp size={15}/> Analytics</button>
        <button className={view==="data"?"active":""} onClick={()=>setView("data")} role="tab" aria-selected={view==="data"}><ShieldCheck size={15}/> Data health</button>
      </div>
      <label className="ax-module-search"><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={"Search all " + moduleName.toLowerCase() + " fields"} aria-label={"Search all fields in " + moduleName}/>{query&&<button type="button" className="ax-module-search-clear" onClick={()=>setQuery("")} aria-label="Clear module search">×</button>}</label>
      <div className="ax-module-filter"><ListFilter size={14}/><select aria-label="Filter by status" value={filter} onChange={event=>setFilter(event.target.value)}><option>All</option>{statuses.map(status=><option key={status}>{status}</option>)}</select></div>
    </div>
    {records.length > 0 && <div className="ax-stage-strip">
      <button className={filter==="All"?"selected":""} onClick={()=>setFilter("All")}><span>All records</span><strong>{records.length}</strong></button>
      {stageCounts.slice(0,6).map((item,index)=><button key={item.status} className={filter===item.status?"selected":""} onClick={()=>setFilter(filter===item.status?"All":item.status)}><i className={"ax-stage-dot ax-stage-"+(index+1)}/><span>{item.status}</span><strong>{item.count}</strong></button>)}
    </div>}
    {filtered.length===0 && view!=="analytics" ? <div className="ax-module-empty"><div className="ax-empty-orbit"><ClipboardList size={26}/></div><h3>{records.length ? "No records match these filters" : "This workspace is ready for its first record"}</h3><p>{records.length ? "Clear the search or change the status filter to see other records." : "Start with one record. AXIVESTRA will surface the fields, stakeholders and follow-ups that need attention."}</p><div><button className="ax-action-primary" onClick={records.length ? ()=>{setFilter("All");setQuery("");} : onAdd}>{records.length ? "Clear filters" : "Create first record"}</button></div></div>
    : view==="analytics" ? <div className="ax-module-analytics">
      <div className="ax-module-analytics-head"><div><span className="ax-kicker"><TrendingUp size={13}/> MODULE ANALYTICS</span><h3>{moduleMetric==="status"?"Record distribution":moduleMetric==="value"?"Value / exposure by status":"Follow-up coverage"}</h3><p>Derived only from saved {moduleName.toLowerCase()} records. Select a status in the chart to filter the workbench.</p></div>
        <div className="ax-module-chart-types" role="group" aria-label="Module chart type">
          <button className={moduleChartType==="donut"?"active":""} onClick={()=>setModuleChartType("donut")} aria-label="Donut chart" title="Donut chart"><PieChart size={15}/></button>
          <button className={moduleChartType==="bar"?"active":""} onClick={()=>setModuleChartType("bar")} aria-label="Bar chart" title="Bar chart"><BarChart3 size={15}/></button>
          <button className={moduleChartType==="line"?"active":""} onClick={()=>setModuleChartType("line")} aria-label="Trend chart" title="Trend chart"><TrendingUp size={15}/></button>
        </div>
      </div>
      <div className="ax-module-chart-focus">
        <div className="ax-module-metric-tabs"><button className={moduleMetric==="status"?"active":""} onClick={()=>{setModuleMetric("status");setFilter("All")}}>Record status</button><button className={moduleMetric==="value"?"active":""} onClick={()=>{setModuleMetric("value");setFilter("All")}}>Value / exposure</button><button className={moduleMetric==="followup"?"active":""} onClick={()=>{setModuleMetric("followup");setFilter("All")}}>Follow-ups</button></div>
        {records.length===0?<div className="ax-empty-module-analytics"><ModuleEmptyChartPreview type={moduleChartType}/><div><strong>No records to chart yet</strong><p>Add the first {moduleName.toLowerCase()} record to activate this module’s chart. The preview stays empty rather than inventing sample metrics.</p></div></div>:<ModuleAnalyticsChart items={moduleChartData} total={moduleChartTotal} type={moduleChartType} metric={moduleMetric} onSelect={name=>{setFilter(moduleMetric==="followup"?name:(statuses.includes(name)?name:"All"));setView("overview")}}/>}
      </div>
      <div className="ax-module-chart-legend">{moduleChartData.map(item=><button key={item.name} onClick={()=>{setFilter(moduleMetric==="followup"?item.name:(statuses.includes(item.name)?item.name:"All"));setView("overview")}}><i style={{background:item.color}}/><span>{item.name}</span><strong>{moduleMetric==="value"?currency(item.value):item.value}</strong><small>{item.records} record{item.records===1?"":"s"}</small></button>)}</div>
      <div className="ax-module-analytics-note"><CheckCircle2 size={14}/> Chart is linked to this module’s saved records. Changes in records update these views automatically.</div>
    </div>
    : view==="table" ? <div className="ax-record-table-wrap"><table className="ax-record-table"><thead><tr><th>Record / opportunity</th><th>Status</th><th>Location / collateral</th><th>Value / exposure</th><th>Next action</th><th>Completeness</th><th>Actions</th></tr></thead><tbody>{filtered.map(record=><tr key={record.id}><td><strong>{record.title}</strong><small>{record.module}</small></td><td><span className={"ax-status-chip " + (CLOSED.has(String(record.status).toLowerCase())?"closed":"open")}>{record.status}</span></td><td>{record.location || "Not entered"}</td><td>{currency(Number(record.value)||0)}</td><td>{record.nextAction || (record.nextFollowUpDate ? "Follow-up due " + dateLabel(record.nextFollowUpDate) : "Not scheduled")}</td><td><span className="ax-completeness">{presentFields(record)}/{dataFields.length}</span></td><td><div className="ax-row-actions"><button onClick={()=>setDetailRecordId(record.id)} title="Open full record" aria-label="Open full record"><Eye size={14}/></button><button onClick={()=>onEdit(record)} title="Edit record" aria-label="Edit record"><Pencil size={14}/></button><button onClick={()=>onPrintRecord(record)} title="Print record" aria-label={"Print "+record.title}><FileText size={14}/></button><button onClick={()=>onDownloadRecordPdf(record)} title="Download complete record PDF" aria-label={"Download PDF "+record.title}><Download size={14}/></button><button className="danger" onClick={()=>onDelete(record.id)} title="Delete record" aria-label={"Delete "+record.title}><Trash2 size={14}/></button></div></td></tr>)}</tbody></table></div>
    : view==="pipeline" ? <div className="ax-kanban">
      {stageCounts.filter(stage=>filter==="All"||stage.status===filter).map(stage=><div className="ax-kanban-column" key={stage.status}><header><span>{stage.status}</span><strong>{filtered.filter(record=>record.status===stage.status).length}</strong></header>{filtered.filter(record=>record.status===stage.status).map(record=><article className="ax-kanban-card" key={record.id}><small>{record.location || "Location to be captured"}</small><h3>{record.title}</h3><strong>{currency(Number(record.value)||0)}</strong><p>{record.nextAction || "No next action recorded"}</p><div><button onClick={()=>onEdit(record)}><Pencil size={13}/> Edit</button><button onClick={()=>onPrintRecord(record)}><FileText size={13}/> Print</button><button onClick={()=>onDownloadRecordPdf(record)}><Download size={13}/> Full PDF</button><button onClick={()=>setDetailRecordId(record.id)}><Eye size={13}/> Open full record</button></div>{expandedHas(record.id)&&<section className="ax-kanban-details">{dataFields.filter(field=>getFieldValue(record,field.key).trim()).map(field=><p key={field.key}><span>{field.label}</span><strong>{getFieldValue(record,field.key)}</strong></p>)}</section>}</article>)}</div>)}
    </div>
    : view==="data" ? <div className="ax-data-health">
      <div className="ax-data-health-head"><div><span className="ax-kicker"><ShieldCheck size={13}/> RECORD COMPLETENESS AUDIT</span><h3>Fields that keep deals moving</h3><p>Use this review to spot gaps before follow-up, negotiation, disbursal or registration.</p></div><label className="ax-inline-check"><input type="checkbox" checked={showAllFields} onChange={event=>setShowAllFields(event.target.checked)}/> Show empty fields too</label></div>
      {filtered.map(record=>{const completeness=presentFields(record);return <article className="ax-health-record" key={record.id}><div className="ax-health-record-head"><div><h4>{record.title}</h4><small>{record.status} · {completeness} of {dataFields.length} field groups populated</small></div><div className="ax-health-progress"><i style={{width:(dataFields.length?completeness/dataFields.length*100:0)+"%"}}/></div><div className="ax-health-actions"><button className="ax-row-action-text" onClick={()=>setDetailRecordId(record.id)}><Eye size={13}/> Full details</button><button className="ax-row-action-text" onClick={()=>onEdit(record)}><Pencil size={13}/> Edit</button><button className="ax-row-action-text" onClick={()=>onDownloadRecordPdf(record)}><Download size={13}/> Download PDF</button></div></div><div className="ax-field-audit-grid">{dataFields.filter(field=>showAllFields||getFieldValue(record,field.key).trim()).map(field=><div className={getFieldValue(record,field.key).trim()?"present":"missing"} key={field.key}><span>{field.label}</span><strong>{getFieldValue(record,field.key).trim()||"Not captured yet"}</strong>{!getFieldValue(record,field.key).trim()&&<small><ArrowDownRight size={12}/> Needs attention</small>}</div>)}</div></article>})}
    </div>
    : <div className="ax-module-record-grid">{filtered.map(record=>{
      const linked=linkedContacts(record);
      const expandedRow=expandedHas(record.id);
      const fieldsShown=dataFields.filter(field=>getFieldValue(record,field.key).trim());
      return <article className="ax-module-record-card" key={record.id}>
        <div className="ax-record-topline"><span className="ax-record-type">{moduleName}</span><span className={"ax-status-chip "+(CLOSED.has(String(record.status).toLowerCase())?"closed":"open")}>{record.status}</span></div>
        <h3>{record.title}</h3><p className="ax-record-location">{record.location || "Location / collateral not entered"}</p>
        <strong className="ax-record-value">{currency(Number(record.value)||0)}</strong>
        <div className="ax-record-progress"><span className="ax-progress-track"><i style={{width:(dataFields.length?presentFields(record)/dataFields.length*100:0)+"%"}}/></span><span>{presentFields(record)}/{dataFields.length} field groups</span></div>
        <div className="ax-record-next"><CalendarClock size={14}/><span>{record.nextResponseDescription || record.nextAction || (record.nextFollowUpDate ? "Next follow-up " + dateLabel(record.nextFollowUpDate) : "No next action captured")} {record.nextResponseDate ? " · Response "+dateLabel(record.nextResponseDate)+(record.nextResponseTime?" "+record.nextResponseTime:"") : record.nextFollowUpDate ? " · Follow-up "+dateLabel(record.nextFollowUpDate)+(record.nextFollowUpTime?" "+record.nextFollowUpTime:"") : ""}</span></div>
        {expandedRow&&<div className="ax-record-expanded">{fieldsShown.map(field=><p key={field.key}><span>{field.label}</span><strong>{getFieldValue(record,field.key)}</strong></p>)}{record.notes&&<p><span>Notes / evidence</span><strong>{record.notes}</strong></p>}<div className="ax-linked-people">{linked.length ? linked.map(contact=><span key={contact.id}><Users size={12}/>{contact.name} · {contact.role}</span>) : <span>No named stakeholder linked</span>}</div></div>}
        <div className="ax-record-actions"><button onClick={()=>setDetailRecordId(record.id)}><Eye size={14}/>Open full record</button><button onClick={()=>toggleExpanded(record.id)}><ArrowUpRight size={14}/>{expandedRow?"Hide preview":"Quick preview"}</button><button onClick={()=>onEdit(record)}><Pencil size={14}/>Edit</button><button onClick={()=>onDownloadRecordPdf(record)}><Download size={14}/>Download PDF</button><button className="danger" onClick={()=>onDelete(record.id)}><Trash2 size={14}/>Delete</button></div>
        <div className="ax-record-quick-actions"><button onClick={()=>onSchedule(record,linked[0])}><CalendarClock size={13}/>Follow-up</button>{linked.length ? linked.map(contact=><button key={contact.id} onClick={()=>onWhatsApp(contact.id,record.id)}><MessageCircle size={13}/>Message {contact.name.split(" ")[0]}</button>) : <button onClick={()=>onWhatsApp(undefined,record.id)}><MessageCircle size={13}/>WhatsApp</button>}<button onClick={()=>setDetailRecordId(record.id)}><ArrowUpRight size={13}/> Open full record</button></div>
      </article>;
    })}</div>}
    {detailRecord&&(()=>{
      const linked=linkedContacts(detailRecord);
      const recordFields=dataFields;
      const knownKeys=new Set(fields.map(field=>field.key));
      const repeatables=(axivestraRepeatableGroups[detailRecord.module]||[]);
      const repeatableKeys=new Set(repeatables.map(group=>group.key));
      const extras=Object.entries(detailRecord.moduleData||{}).filter(([key,value])=>!key.startsWith("__")&&!knownKeys.has(key)&&!key.endsWith("Time")&&!repeatableKeys.has(key)&&String(value??"").trim());
      const calculations=buildModuleSummary(detailRecord.module,detailRecord.moduleData||{});
      const formatExtra=(value:string)=>{try{const parsed=JSON.parse(value);return typeof parsed==="object"?JSON.stringify(parsed,null,2):value;}catch{return value;}};
      const showField=(field:ModuleField)=>{const value=getFieldValue(detailRecord,field.key);const time=detailRecord.moduleData?.[field.key+"Time"]||"";return field.type==="date"?[value,time].filter(Boolean).join(" · "):value;};
      return <div className="ax-record-detail-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setDetailRecordId(null);}}>
        <section className="ax-record-detail" role="dialog" aria-modal="true" aria-label={"Full record details: "+detailRecord.title}>
          <header className="ax-record-detail__header"><div><span className="ax-kicker">AXIVESTRA · COMPLETE RECORD</span><h2>{detailRecord.title}</h2><p>{detailRecord.module} · {detailRecord.status} · {detailRecord.id}</p></div><button type="button" className="ax-record-detail__close" onClick={()=>setDetailRecordId(null)} aria-label="Close full record"><X size={18}/></button></header>
          <div className="ax-record-detail__toolbar"><button className="secondary-button" onClick={()=>onEdit(detailRecord)}><Pencil size={14}/> Edit record</button><button className="secondary-button" onClick={()=>onSchedule(detailRecord,linked[0])}><CalendarClock size={14}/> Schedule follow-up</button><button className="secondary-button" onClick={()=>onPrintRecord(detailRecord)}><FileText size={14}/> Print</button><button className="primary-button" onClick={()=>onDownloadRecordPdf(detailRecord)}><Download size={14}/> Download complete PDF</button></div>
          <div className="ax-record-detail__summary"><div><span>Value / exposure</span><strong>{currency(Number(detailRecord.value)||0)}</strong></div><div><span>Location / collateral</span><strong>{detailRecord.location||"Not entered"}</strong></div><div><span>Next response</span><strong>{detailRecord.nextResponseDate?dateLabel(detailRecord.nextResponseDate)+(detailRecord.nextResponseTime?" · "+detailRecord.nextResponseTime:""):"Not scheduled"}</strong></div><div><span>Next follow-up</span><strong>{detailRecord.nextFollowUpDate?dateLabel(detailRecord.nextFollowUpDate)+(detailRecord.nextFollowUpTime?" · "+detailRecord.nextFollowUpTime:""):"Not scheduled"}</strong></div></div>
          <section className="ax-record-detail__section"><h3>Record information</h3><div className="ax-record-detail__grid">{recordFields.map(field=><div key={field.key}><span>{field.label}</span><strong>{showField(field)||"Not entered"}</strong></div>)}</div></section>
          <section className="ax-record-detail__section"><h3>Linked contacts and stakeholders</h3><div className="ax-record-detail__people">{linked.length?linked.map(contact=><span key={contact.id}><Users size={14}/><strong>{contact.name}</strong><small>{contact.role}{contact.phone?" · "+contact.phone:""}</small><button onClick={()=>onWhatsApp(contact.id,detailRecord.id)}><MessageCircle size={13}/> WhatsApp</button></span>):<p>No saved contact or stakeholder is linked to this record.</p>}</div></section>
          {fields.length>0&&<section className="ax-record-detail__section"><h3>{detailRecord.module} — module-specific fields</h3><div className="ax-record-detail__grid">{fields.map(field=><div key={field.key}><span>{field.label}</span><strong>{showField(field)||"Not entered"}</strong></div>)}</div></section>}
          {repeatables.map(group=>{let rows:Array<Record<string,string>>=[];try{const parsed=JSON.parse(detailRecord.moduleData?.[group.key]||"[]");if(Array.isArray(parsed))rows=parsed;}catch{}if(!rows.length)return null;return <section className="ax-record-detail__section" key={group.key}><h3>{group.title}</h3><div className="ax-record-detail__table"><table><thead><tr>{group.fields.map(field=><th key={field.key}>{field.label}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={index}>{group.fields.map(field=><td key={field.key}>{field.type==="date"?[row[field.key],row[field.key+"Time"]].filter(Boolean).join(" · ")||"—":row[field.key]||"—"}</td>)}</tr>)}</tbody></table></div></section>;})}
          {extras.length>0&&<section className="ax-record-detail__section"><h3>Additional saved data</h3><div className="ax-record-detail__extras">{extras.map(([key,value])=><div key={key}><span>{key.replace(/([A-Z])/g," $1").replace(/[_-]+/g," ")}</span><pre>{formatExtra(value)}</pre></div>)}</div></section>}
          {calculations.length>0&&<section className="ax-record-detail__section"><h3>Calculated summaries</h3><div className="ax-record-detail__grid">{calculations.map(item=><div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div></section>}
          {detailRecord.notes&&<section className="ax-record-detail__section"><h3>Notes / evidence</h3><p className="ax-record-detail__notes">{detailRecord.notes}</p></section>}
          <footer className="ax-record-detail__footer"><span>Created {detailRecord.createdAt?new Date(detailRecord.createdAt).toLocaleString("en-IN"):"Date not available"}</span><button className="primary-button" onClick={()=>onDownloadRecordPdf(detailRecord)}><Download size={14}/> Download full record PDF</button></footer>
        </section>
      </div>;
    })()}
    <div className="ax-module-footer"><span><CheckCircle2 size={14}/> Live module view · {filtered.length} shown of {records.length} saved records{query.trim()?" · Search active":""}</span><div className="ax-module-footer__actions"><button className="secondary-button" aria-label="Print / Save PDF filtered records" onClick={()=>onExportReport(filtered)}><FileText size={15}/> Print / PDF · Save PDF (filtered view)</button><button className="primary-button" onClick={()=>onExportPdf(records)}><Download size={15}/> Download complete module PDF</button><button onClick={onAdd}><Plus size={15}/> Add another {moduleName.toLowerCase()} record</button></div></div>
  </section>;
}
