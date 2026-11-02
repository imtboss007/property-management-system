import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Bookmark, ChevronRight, Pin, PinOff, Search, Users, X } from "lucide-react";
import IntelligenceHub from "./IntelligenceHub";

type FollowUp={id:string;description:string;amount:string;promisedDate:string;status:string;linkedRecordId:string};
type RecordRow={id:string;title:string;module:string;location:string;value:string;status:string;contact:string;followUpContactId?:string;primaryContactId?:string;nextFollowUpDate?:string;nextAction?:string;targetDeadline?:string;moduleData:Record<string,string>};
type ContactRow={id:string;name:string;phone:string;role:string;followUps?:FollowUp[]};
type TaskRow={id:string;title:string;date:string;time:string;type:string;property:string;propertyId?:string;contactId?:string;contactName?:string;notes:string;done:boolean};
type FinancialRow={id:string;propertyId?:string;contactId?:string;property:string;type:string;amount:string;date:string;party:string;reference:string;notes:string};
type FollowDraft={contactId:string;linkedRecordId:string;description:string;amount:string;promisedDate:string;promisedTime:string;responseType:string;notes:string;status:string};
type SavedCanvas={id:string;label:string;search:string;moduleFilter:string;recordIds:string[];contactIds:string[];pinnedIds:string[];createdAt:string};
type Props={properties:RecordRow[];contacts:ContactRow[];tasks:TaskRow[];financials:FinancialRow[];today:string;readOnly?:boolean;
 moduleNames:string[];workspaceScope:string;onOpenModule:(name:string)=>void;onOpenContacts:()=>void;onOpenTasks:()=>void;
 onOpenRecord:(id:string)=>void;onOpenContact:(id:string)=>void;onOpenFinancials:()=>void;onCreateFollowUp:(draft:FollowDraft)=>void;};
const LOANS=new Set(["Property Loans","Unsecured Company Loan","Personal Loan","Housing Loan"]);
const safeIds=(value:unknown)=>Array.isArray(value)?value.filter((item):item is string=>typeof item==="string"):[];
export default function VestraIntentCanvas(props:Props){
 const {properties,contacts,tasks,financials,today,readOnly,moduleNames,workspaceScope,onOpenModule,onOpenContacts,onOpenTasks,onOpenRecord,onOpenContact,onOpenFinancials,onCreateFollowUp}=props;
 const storageKey="axivestra.vestraShift.canvas."+workspaceScope;
 const [search,setSearch]=useState("");
 const [moduleFilter,setModuleFilter]=useState("All modules");
 const [selectedRecordIds,setSelectedRecordIds]=useState<string[]>([]);
 const [selectedContactIds,setSelectedContactIds]=useState<string[]>([]);
 const [pinnedIds,setPinnedIds]=useState<string[]>([]);
 const [dragRecordId,setDragRecordId]=useState("");
 const [savedCanvases,setSavedCanvases]=useState<SavedCanvas[]>(()=>{
  try{const value=JSON.parse(window.localStorage.getItem(storageKey)||"[]");return Array.isArray(value)?value:[];}catch{return [];}
 });
 useEffect(()=>{try{window.localStorage.setItem(storageKey,JSON.stringify(savedCanvases));}catch{/* local canvas preferences are optional */}},[storageKey,savedCanvases]);
 const query=search.trim().toLocaleLowerCase();
 const recordMatches=useMemo(()=>properties.filter(record=>{
  const moduleOkay=moduleFilter==="All modules"||record.module===moduleFilter;
  const text=[record.title,record.module,record.location,record.status,record.contact,...Object.values(record.moduleData||{})].join(" ").toLocaleLowerCase();
  return moduleOkay&&(!query||text.includes(query));
 }).slice(0,30),[properties,moduleFilter,query]);
 const contactMatches=useMemo(()=>contacts.filter(contact=>!query||[contact.name,contact.phone,contact.role].join(" ").toLocaleLowerCase().includes(query)).slice(0,12),[contacts,query]);
 const taskMatches=useMemo(()=>tasks.filter(task=>!query||[task.title,task.type,task.property,task.contactName,task.notes].join(" ").toLocaleLowerCase().includes(query)).slice(0,10),[tasks,query]);
 const selectedRecords=selectedRecordIds.map(id=>properties.find(row=>row.id===id)).filter((row):row is RecordRow=>Boolean(row));
 const selectedContacts=selectedContactIds.map(id=>contacts.find(row=>row.id===id)).filter((row):row is ContactRow=>Boolean(row));
 const urgentTasks=tasks.filter(task=>!task.done&&task.date&&task.date<today);
 const overdueFollowUps=contacts.flatMap(contact=>(contact.followUps||[]).filter(item=>item.promisedDate&&item.promisedDate<today&&!["completed","closed","settled","rejected","cancelled"].includes(String(item.status||"").toLowerCase())).map(item=>({contact,item})));
 const toggle=(id:string,values:string[],setter:(value:string[])=>void)=>setter(values.includes(id)?values.filter(value=>value!==id):[...values,id]);
 const moveRecord=(targetId:string)=>{
  if(!dragRecordId||dragRecordId===targetId)return;
  setSelectedRecordIds(current=>{const next=[...current];const from=next.indexOf(dragRecordId),to=next.indexOf(targetId);if(from<0||to<0)return current;next.splice(from,1);next.splice(to,0,dragRecordId);return next;});
  setDragRecordId("");
 };
 const saveCanvas=()=>{
  const item:SavedCanvas={id:"canvas-"+Date.now(),label:search.trim()||"My working canvas",search,moduleFilter,recordIds:selectedRecordIds,contactIds:selectedContactIds,pinnedIds,createdAt:new Date().toISOString()};
  setSavedCanvases(current=>[item,...current].slice(0,12));
 };
 const restoreCanvas=(item:SavedCanvas)=>{
  setSearch(item.search||"");setModuleFilter(item.moduleFilter||"All modules");
  setSelectedRecordIds(safeIds(item.recordIds));setSelectedContactIds(safeIds(item.contactIds));setPinnedIds(safeIds(item.pinnedIds));
 };
 const first=selectedRecords[0];
 const adaptiveKind=first?(LOANS.has(first.module)||first.moduleData?.__transactionType==="Loan"?"loan":first.module==="Litigation"?"legal":first.module.includes("Land")||first.module==="Property Sale"||first.module==="House Purchase"?"asset":"record"):"overview";
 const adaptiveCaption=adaptiveKind==="loan"?"Loan context · principal, monthly interest, assigned people and deadlines":adaptiveKind==="legal"?"Legal context · case status, counsel, obligations and deadlines":adaptiveKind==="asset"?"Asset context · location, value, counterparties and closing actions":"Record context · saved status, relationships and next action";
 const compareFields:Array<{label:string;getValue:(row:RecordRow)=>string}>=[{label:"Module",getValue:row=>row.module},{label:"Status",getValue:row=>row.status||"Not entered"},{label:"Value",getValue:row=>row.value||"Not entered"},{label:"Location",getValue:row=>row.location||"Not entered"},{label:"Counterparty",getValue:row=>row.contact||"Not entered"},{label:"Next action",getValue:row=>row.nextAction||"Not entered"},{label:"Next follow-up",getValue:row=>row.nextFollowUpDate||"Not scheduled"},{label:"Target deadline",getValue:row=>row.targetDeadline||"Not scheduled"}];
 return <div className="vs-intent-canvas">
  <section className="vs-intent-search-panel">
   <div className="vs-intent-search-heading"><div><span className="vs-eyebrow">INTENT CANVAS · BUILD A WORKING CONTEXT</span><h3>Bring the right records into one space.</h3><p>Search actual AXIVESTRA data, choose modules and people, then pin, compare and reopen this arrangement.</p></div><button type="button" onClick={saveCanvas}><Bookmark size={14}/> Save canvas</button></div>
   <div className="vs-intent-search-control"><Search size={17}/><input value={search} onChange={event=>setSearch(event.target.value)} onKeyDown={event=>{if(event.key==="Escape")setSearch("");}} placeholder="Search by person, record, module, location, status or loan field…"/>{search&&<button type="button" onClick={()=>setSearch("")} aria-label="Clear search"><X size={14}/></button>}</div>
   <div className="vs-module-filters"><button type="button" className={moduleFilter==="All modules"?"active":""} onClick={()=>setModuleFilter("All modules")}>All modules</button>{moduleNames.map(name=><button type="button" key={name} className={moduleFilter===name?"active":""} onClick={()=>setModuleFilter(name)}>{name}</button>)}</div>
   {savedCanvases.length>0&&<div className="vs-canvas-saved"><span>SAVED CANVASES</span>{savedCanvases.map(item=><button type="button" key={item.id} onClick={()=>restoreCanvas(item)}><Bookmark size={11}/>{item.label}</button>)}</div>}
   <div className="vs-intent-results">
    <section><header><strong>Records</strong><small>{recordMatches.length} results</small></header>{recordMatches.map(record=><div className="vs-intent-result" key={record.id}><span><small>{record.module} · {record.status||"Status not set"}</small><strong>{record.title||"Untitled record"}</strong><em>{record.location||"Location not entered"}</em></span><button type="button" className={selectedRecordIds.includes(record.id)?"selected":""} onClick={()=>toggle(record.id,selectedRecordIds,setSelectedRecordIds)}>{selectedRecordIds.includes(record.id)?"Added":"Add to canvas"}</button></div>)}{!recordMatches.length&&<small className="vs-intent-empty">No matching saved records.</small>}</section>
    <section><header><strong>People</strong><small>{contactMatches.length} results</small></header>{contactMatches.map(contact=><div className="vs-intent-result" key={contact.id}><span><strong>{contact.name}</strong><em>{[contact.role,contact.phone].filter(Boolean).join(" · ")}</em></span><button type="button" className={selectedContactIds.includes(contact.id)?"selected":""} onClick={()=>toggle(contact.id,selectedContactIds,setSelectedContactIds)}>{selectedContactIds.includes(contact.id)?"Added":"Add person"}</button></div>)}{!contactMatches.length&&<small className="vs-intent-empty">No matching saved contacts.</small>}</section>
    <section><header><strong>Tasks</strong><small>{taskMatches.length} results</small></header>{taskMatches.map(task=><button type="button" className="vs-intent-task" key={task.id} onClick={()=>onOpenTasks()}><span><strong>{task.title}</strong><small>{task.date} {task.time} · {task.contactName||task.property||task.type}</small></span><ChevronRight size={14}/></button>)}{!taskMatches.length&&<small className="vs-intent-empty">No matching saved tasks.</small>}</section>
   </div>
  </section>
  <div className="vs-intent-alerts">{urgentTasks.length>0&&<button type="button" onClick={onOpenTasks}><span>{urgentTasks.length}</span> overdue task(s) <ArrowUpRight size={13}/></button>}{overdueFollowUps.length>0&&<button type="button" onClick={()=>onOpenModule("Follow-up Register")}><span>{overdueFollowUps.length}</span> overdue commitment(s) <ArrowUpRight size={13}/></button>}{!urgentTasks.length&&!overdueFollowUps.length&&<span>Priority signal: no overdue task or contact commitment found in saved data.</span>}</div>
  <section className="vs-canvas-stage">
   <header><div><span className="vs-eyebrow">ADAPTIVE WORKSPACE</span><h3>{selectedRecords.length||selectedContacts.length?"Your assembled context":"Your canvas is ready"}</h3><p>{first?adaptiveCaption:"Add a record or person from search. The canvas will adapt to the selected context."}</p></div><div className="vs-canvas-counts"><span>{selectedRecords.length} records</span><span>{selectedContacts.length} people</span><span>{pinnedIds.length} pinned</span></div></header>
   <div className="vs-canvas-pins">{pinnedIds.map(id=>{const record=properties.find(item=>item.id===id);return record?<button type="button" key={id} onClick={()=>onOpenRecord(id)}><Pin size={12}/>{record.title||record.module}</button>:null;})}{!pinnedIds.length&&<small>Pin important record panels to keep them at the top of this canvas.</small>}</div>
   {selectedRecords.length>0&&<div className="vs-canvas-cards">{selectedRecords.map(record=><article key={record.id} draggable onDragStart={()=>setDragRecordId(record.id)} onDragOver={event=>event.preventDefault()} onDrop={()=>moveRecord(record.id)} onDragEnd={()=>setDragRecordId("")} className="vs-canvas-record-card">
     <div className="vs-canvas-card-top"><span>{record.module}</span><button type="button" onClick={()=>toggle(record.id,pinnedIds,setPinnedIds)} title={pinnedIds.includes(record.id)?"Unpin record":"Pin record"}>{pinnedIds.includes(record.id)?<PinOff size={14}/>:<Pin size={14}/>}</button></div>
     <h4>{record.title||"Untitled record"}</h4><strong>{record.value?record.value:"Value not entered"}</strong>
     <div className="vs-canvas-card-facts"><span>{record.status||"Status not set"}</span><span>{record.location||"Location not entered"}</span><span>{record.contact||"No counterparty label"}</span></div>
     <div className="vs-canvas-card-next">{record.nextAction||"No next action entered"}{record.nextFollowUpDate?" · "+record.nextFollowUpDate:""}{record.targetDeadline?" · Deadline "+record.targetDeadline:""}</div>
     <footer><button type="button" onClick={()=>onOpenRecord(record.id)}>Open source record <ArrowUpRight size={13}/></button><details><summary>Quick actions</summary><button type="button" onClick={()=>{setPinnedIds(current=>current.includes(record.id)?current.filter(id=>id!==record.id):[...current,record.id]);}}>Pin / unpin</button><button type="button" onClick={()=>onOpenModule(record.module)}>Open module</button></details></footer>
    </article>)}</div>}
   {selectedContacts.length>0&&<div className="vs-canvas-people">{selectedContacts.map(contact=>{const related=properties.filter(record=>record.primaryContactId===contact.id||record.followUpContactId===contact.id||(record.moduleData?.__linkedContactIds||"").split(",").includes(contact.id));const open=(contact.followUps||[]).filter(item=>!["completed","closed","settled","rejected","cancelled"].includes(String(item.status||"").toLowerCase()));return <article key={contact.id}><button type="button" onClick={()=>onOpenContact(contact.id)}><Users size={15}/><strong>{contact.name}</strong><ArrowUpRight size={13}/></button><span>{related.length} linked records · {open.length} open follow-ups</span>{open.slice(0,3).map(item=><small key={item.id}>{item.description} · {item.promisedDate||"No date"}</small>)}</article>;})}</div>}
   {selectedRecords.length>=2&&<section className="vs-compare-panel"><header><strong>Record comparison</strong><small>Values below are copied from the selected saved records, not recalculated.</small></header><div className="vs-compare-scroll"><table><thead><tr><th>Field</th>{selectedRecords.map(record=><th key={record.id}>{record.title||record.module}</th>)}</tr></thead><tbody>{compareFields.map(field=><tr key={field.label}><th>{field.label}</th>{selectedRecords.map(record=><td key={record.id}>{field.getValue(record)}</td>)}</tr>)}</tbody></table></div></section>}
   {!selectedRecords.length&&!selectedContacts.length&&<div className="vs-empty-state"><Bookmark size={22}/><strong>Nothing pinned to this canvas yet.</strong><small>Use search above to assemble records and people; you can compare two or more saved records side by side.</small></div>}
  </section>
  <section className="vs-local-assistant"><IntelligenceHub properties={properties} contacts={contacts} tasks={tasks} financials={financials} today={today} readOnly={readOnly} onOpenModule={onOpenModule} onOpenContacts={onOpenContacts} onOpenTasks={onOpenTasks} onOpenRecord={onOpenRecord} onOpenContact={onOpenContact} onOpenFinancials={onOpenFinancials} onCreateFollowUp={onCreateFollowUp}/></section>
 </div>;
}
