import { useMemo, useState } from "react";
import { ArrowUpRight, CalendarClock, Download, FileText, MessageCircle, Pencil, Plus, RefreshCw, Users, X } from "lucide-react";
import { axivestraRepeatableGroups, buildModuleSummary } from "./lib/axivestra-module-upgrades";

type Contact = { id: string; name: string; phone: string; email?: string; role: string; roles?: string[]; notes?: string };
type RecordRow = {
  id: string; title: string; module: string; location: string; value: string; status: string;
  contact: string; primaryContactId?: string; targetDeadline?: string; targetDeadlineTime?: string;
  nextFollowUpDate?: string; nextFollowUpTime?: string; nextAction?: string;
  nextResponseDate?: string; nextResponseTime?: string; nextResponseType?: string;
  nextResponseDescription?: string; notes: string; createdAt: string;
  surveyNumber?: string; ownershipDetails?: string; areaValue?: string; areaUnit?: string;
  dimensions?: string; ratePerUnit?: string; moduleData: Record<string,string>;
};
type Task = { id: string; title: string; date: string; time: string; type: string; property: string; propertyId?: string; contactId?: string; contactName?: string; notes: string; done: boolean };
type Field = { key: string; label: string; placeholder?: string; type?: string; options?: string[] };
type SchedulePatch = Pick<RecordRow,"nextResponseDate"|"nextResponseTime"|"nextResponseType"|"nextResponseDescription"|"nextFollowUpDate"|"nextFollowUpTime"|"nextAction">;
type Draft = SchedulePatch;
type Props = {
  contact: Contact;
  properties: RecordRow[];
  tasks: Task[];
  fieldsByModule: Record<string,Field[]>;
  onClose: () => void;
  onAddRecord: () => void;
  onEditContact: () => void;
  onEditRecord: (record: RecordRow) => void;
  onScheduleTask: (record?: RecordRow) => void;
  onWhatsApp: (contactId: string, propertyId?: string) => void;
  onDownloadRecord: (record: RecordRow) => void;
  onUpdateSchedule: (recordId: string, patch: SchedulePatch) => void;
};

const pretty = (key: string) => key.replace(/^__/,"").replace(/([A-Z])/g," $1").replace(/[_-]+/g," ").replace(/^./,value=>value.toUpperCase());
const asText = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "Not entered";
  if (typeof value === "string") {
    try { const parsed = JSON.parse(value); return typeof parsed === "object" ? JSON.stringify(parsed,null,2) : value; } catch { return value; }
  }
  return typeof value === "object" ? JSON.stringify(value,null,2) : String(value);
};
const dateTimeLabel = (date?: string,time?: string) => {
  if (!date) return "Not scheduled";
  const parsed = new Date(date + "T" + (time || "00:00"));
  return Number.isNaN(parsed.getTime()) ? [date,time].filter(Boolean).join(" · ") : parsed.toLocaleString("en-IN",{dateStyle:"medium",timeStyle:time?"short":undefined});
};
const relatedTo = (record: RecordRow,contact: Contact) => {
  const data=record.moduleData||{};
  const ids=[record.primaryContactId||"",...(data.__linkedContactIds||"").split(","),...Object.entries(data).filter(([key,value])=>key.startsWith("__contact_")&&Boolean(value)).map(([,value])=>String(value))].filter(Boolean);
  return ids.includes(contact.id)||(record.contact||"").trim().toLocaleLowerCase()===contact.name.trim().toLocaleLowerCase();
};

export default function ContactPortfolioPanel(props: Props) {
  const {contact,properties,tasks,fieldsByModule}=props;
  const [drafts,setDrafts]=useState<Record<string,Draft>>({});
  const [expanded,setExpanded]=useState<string[]>([]);
  const linked=useMemo(()=>properties.filter(record=>relatedTo(record,contact)).sort((a,b)=>(a.nextResponseDate||a.nextFollowUpDate||"9999-12-31").localeCompare(b.nextResponseDate||b.nextFollowUpDate||"9999-12-31")),[properties,contact]);
  const linkedIds=new Set(linked.map(record=>record.id));
  const openTasks=tasks.filter(task=>(task.contactId===contact.id||(task.propertyId&&linkedIds.has(task.propertyId)))&&!task.done).sort((a,b)=>(a.date+"T"+a.time).localeCompare(b.date+"T"+b.time));
  const moduleCounts=Array.from(new Set(linked.map(record=>record.module))).map(module=>({module,count:linked.filter(record=>record.module===module).length}));
  const today=new Date().toISOString().slice(0,10);
  const overdue=linked.filter(record=>record.nextResponseDate&&record.nextResponseDate<today).length;
  const getDraft=(record:RecordRow):Draft=>drafts[record.id]||({
    nextResponseDate:record.nextResponseDate||"",nextResponseTime:record.nextResponseTime||"",
    nextResponseType:record.nextResponseType||"Call",nextResponseDescription:record.nextResponseDescription||record.nextAction||"",
    nextFollowUpDate:record.nextFollowUpDate||"",nextFollowUpTime:record.nextFollowUpTime||"",nextAction:record.nextAction||""
  });
  const change=(record:RecordRow,key:keyof Draft,value:string)=>setDrafts(current=>({...current,[record.id]:{...getDraft(record),[key]:value}}));
  const save=(record:RecordRow)=>{props.onUpdateSchedule(record.id,getDraft(record));setDrafts(current=>{const next={...current};delete next[record.id];return next;});};
  const toggle=(id:string)=>setExpanded(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id]);

  return <section className="ax-contact-portfolio">
    <header className="ax-contact-portfolio__header">
      <div className="ax-contact-portfolio__identity"><span className="ax-contact-portfolio__avatar">{contact.name.split(/\\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase()}</span><div><span className="ax-kicker">CONTACT 360 · CONNECTED WORKSPACE</span><h2>{contact.name}</h2><p>{[...(contact.roles||[contact.role]),contact.phone,contact.email].filter(Boolean).join(" · ")}</p></div></div>
      <div className="ax-contact-portfolio__actions"><button className="secondary-button" onClick={props.onEditContact}><Pencil size={14}/> Edit contact</button><button className="primary-button" onClick={props.onAddRecord}><Plus size={15}/> Add linked module record</button><button className="ax-contact-portfolio__close" onClick={props.onClose} aria-label="Close contact workspace"><X size={16}/></button></div>
    </header>
    <div className="ax-contact-portfolio__metrics"><div><span>Linked workstreams</span><strong>{linked.length}</strong></div><div><span>Module types</span><strong>{moduleCounts.length}</strong></div><div><span>Overdue responses</span><strong>{overdue}</strong></div><div><span>Open scheduled actions</span><strong>{openTasks.length}</strong></div></div>
    <div className="ax-contact-portfolio__module-filters">{moduleCounts.map(item=><span key={item.module}>{item.module}<b>{item.count}</b></span>)}</div>
    <div className="ax-contact-portfolio__section-heading"><div><h3>All linked properties, deals and modules</h3><p>One contact can own or participate in multiple records across different business modules.</p></div><span>{linked.length} record(s)</span></div>
    {!linked.length&&<div className="ax-contact-portfolio__empty"><Users size={23}/><strong>No module records linked yet</strong><p>Create a property, loan, litigation or other module record and select this contact as its primary contact or stakeholder.</p><button className="primary-button" onClick={props.onAddRecord}><Plus size={15}/> Create first linked record</button></div>}
    <div className="ax-contact-portfolio__records">{linked.map(record=>{
      const draft=getDraft(record); const isOpen=expanded.includes(record.id); const fields=fieldsByModule[record.module]||[];
      const dataEntries=Object.entries(record.moduleData||{}).filter(([key,value])=>key!=="__linkedContactIds"&&!key.startsWith("__contact_")&&String(value??"").trim());
      const calculations=buildModuleSummary(record.module,record.moduleData||{});
      const groups=(axivestraRepeatableGroups[record.module]||[]).filter(group=>{try{return JSON.parse(record.moduleData?.[group.key]||"[]").length>0;}catch{return false;}});
      return <article className="ax-contact-workstream" key={record.id}>
        <div className="ax-contact-workstream__top"><span className="ax-contact-workstream__module"><FileText size={13}/>{record.module}</span><span className="ax-status-chip open">{record.status||"Status not set"}</span><strong>{record.value?"₹ "+Number(record.value).toLocaleString("en-IN",{maximumFractionDigits:2}):"Value not entered"}</strong></div>
        <div className="ax-contact-workstream__title"><div><h4>{record.title}</h4><p>{record.location||"Location not entered"}{record.surveyNumber?" · ID "+record.surveyNumber:""}</p></div><span>{record.id.slice(0,8)}</span></div>
        <div className="ax-contact-workstream__schedule">
          <label>Next response date<input type="date" value={draft.nextResponseDate||""} onChange={event=>change(record,"nextResponseDate",event.target.value)}/></label>
          <label>Response time<input type="time" value={draft.nextResponseTime||""} onChange={event=>change(record,"nextResponseTime",event.target.value)}/></label>
          <label>Response type<select value={draft.nextResponseType||"Call"} onChange={event=>change(record,"nextResponseType",event.target.value)}>{["Call","WhatsApp","Email","Meeting","Document","Payment update","Site visit","Other"].map(value=><option key={value}>{value}</option>)}</select></label>
          <label className="wide">Response / next-action description<input value={draft.nextResponseDescription||""} onChange={event=>change(record,"nextResponseDescription",event.target.value)} placeholder="What response or action is expected?"/></label>
          <label>Next follow-up date<input type="date" value={draft.nextFollowUpDate||""} onChange={event=>change(record,"nextFollowUpDate",event.target.value)}/></label>
          <label>Follow-up time<input type="time" value={draft.nextFollowUpTime||""} onChange={event=>change(record,"nextFollowUpTime",event.target.value)}/></label>
          <label className="wide">Follow-up action<input value={draft.nextAction||""} onChange={event=>change(record,"nextAction",event.target.value)} placeholder="Call client, collect document, check sanction…"/></label>
          <div className="ax-contact-workstream__schedule-actions"><span>Current response: <strong>{dateTimeLabel(record.nextResponseDate,record.nextResponseTime)}</strong></span><button className="primary-button" onClick={()=>save(record)}><RefreshCw size={13}/> Save schedule</button></div>
        </div>
        <div className="ax-contact-workstream__actions"><button className="secondary-button" onClick={()=>toggle(record.id)}><ArrowUpRight size={14}/>{isOpen?"Hide full details":"Open full details"}</button><button className="secondary-button" onClick={()=>props.onEditRecord(record)}><Pencil size={14}/> Edit record</button><button className="secondary-button" onClick={()=>props.onDownloadRecord(record)}><Download size={14}/> Download full PDF</button><button className="secondary-button" onClick={()=>props.onScheduleTask(record)}><CalendarClock size={14}/> Schedule task</button><button className="secondary-button" onClick={()=>props.onWhatsApp(contact.id,record.id)}><MessageCircle size={14}/> WhatsApp</button></div>
        {isOpen&&<div className="ax-contact-workstream__details">
          <div className="ax-contact-details-grid">{[["Record title",record.title],["Business module",record.module],["Status",record.status],["Location",record.location],["Value / exposure",record.value],["Target deadline",dateTimeLabel(record.targetDeadline,record.targetDeadlineTime)],["Next response",dateTimeLabel(record.nextResponseDate,record.nextResponseTime)],["Response type",record.nextResponseType],["Response description",record.nextResponseDescription||record.nextAction],["Next follow-up",dateTimeLabel(record.nextFollowUpDate,record.nextFollowUpTime)],["Survey / property ID",record.surveyNumber],["Ownership / parties",record.ownershipDetails],["Area",record.areaValue?(record.areaValue+" "+(record.areaUnit||"")):""]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value||"Not entered"}</strong></div>)}</div>
          {fields.length>0&&<><h5>Module-specific details</h5><div className="ax-contact-details-grid">{fields.map(field=><div key={field.key}><span>{field.label}</span><strong>{record.moduleData?.[field.key]?(field.type==="date"?[record.moduleData[field.key],record.moduleData[field.key+"Time"]].filter(Boolean).join(" · "):asText(record.moduleData[field.key])):"Not entered"}</strong></div>)}</div></>}
          {groups.map(group=>{let rows:any[]=[];try{rows=JSON.parse(record.moduleData?.[group.key]||"[]");}catch{}return <section className="ax-contact-repeatable" key={group.key}><h5>{group.title}</h5><div className="ax-contact-repeatable__table"><table><thead><tr>{group.fields.map(field=><th key={field.key}>{field.label}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={index}>{group.fields.map(field=><td key={field.key}>{row[field.key]||"—"}</td>)}</tr>)}</tbody></table></div></section>;})}
          {dataEntries.filter(([key])=>!fields.some(field=>field.key===key)&&!groups.some(group=>group.key===key)).map(([key,value])=><div className="ax-contact-extra" key={key}><span>{pretty(key)}</span><pre>{asText(value)}</pre></div>)}
          {calculations.length>0&&<><h5>Calculated summaries</h5><div className="ax-contact-details-grid">{calculations.map(item=><div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div></>}
          {record.notes&&<div className="ax-contact-notes"><span>Notes / evidence</span><p>{record.notes}</p></div>}
        </div>}
      </article>;
    })}</div>
    <div className="ax-contact-portfolio__section-heading"><div><h3>Scheduled activities</h3><p>Open tasks linked to this contact or to any of their module records.</p></div><span>{openTasks.length} open</span></div>
    <div className="ax-contact-portfolio__tasks">{openTasks.length?openTasks.map(task=><div key={task.id}><span><CalendarClock size={14}/></span><section><strong>{task.title}</strong><small>{task.type} · {dateTimeLabel(task.date,task.time)}{task.property?" · "+task.property:""}</small>{task.notes&&<p>{task.notes}</p>}</section></div>):<p>No open tasks are linked to this contact.</p>}</div>
  </section>;
}
