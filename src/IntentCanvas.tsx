import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Activity, ArrowUpRight, Bookmark, CalendarClock, ChevronRight, CircleAlert, Command, Focus, ListTodo, Pin, ShieldCheck, Sparkles, TrendingUp, Users, Wallet } from "lucide-react";
import type { FollowUpEntry } from "./lib/follow-ups";

type Property = {
  id:string; title:string; module:string; value:string; status:string; location?:string;
  contact?:string; primaryContactId?:string; nextFollowUpDate?:string; nextAction?:string;
};
type Contact = { id:string; name:string; phone?:string; role?:string };
type Task = { id:string; title:string; date:string; time:string; type:string; property:string; propertyId?:string; contactId?:string; done:boolean; notes?:string };
type Financial = { id:string; type:string; amount:string; date:string; property?:string; party?:string };
type Risk = { id:string; title:string; severity:string; status:string; owner?:string; dueDate?:string; entity?:string };
type Approval = { id:string; title:string; priority:string; status:string; area:string; entity?:string; approver?:string };
type Module = { name:string; count:number };
type FollowUp = {
  entry:FollowUpEntry;
  record:{id:string;title:string;module:string}|null;
  module:string;
  recordTitle:string;
  amount:string;
};

type Panel = "portfolio"|"followups"|"finance"|"people"|"workflow"|"decisions"|"timeline";
const PANEL_IDS:Panel[]=["portfolio","followups","finance","people","workflow","decisions","timeline"];
const PANEL_LABELS:Record<Panel,string>={portfolio:"Portfolio",followups:"Follow-ups",finance:"Finance",people:"People & relationships",workflow:"Mission workflow",decisions:"Decisions & risk",timeline:"Temporal workspace"};
const IN_KEY=new Set(["Sale","Advance","Loan Disbursal","Receipt"]);
const OUT_KEY=new Set(["Purchase","Loan Repayment","Interest","Instalment","Brokerage","Expense","Settlement"]);
const INR=new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0});
const amount=(raw:string)=>{const n=Number(String(raw??"").trim());return raw && Number.isFinite(n) ? INR.format(n) : raw ? "₹"+raw : "—";};
const dateLabel=(raw:string)=>raw?new Date(raw+"T00:00:00").toLocaleDateString("en-IN",{day:"2-digit",month:"short"}):"Unscheduled";

type Props={
  properties:Property[]; contacts:Contact[]; tasks:Task[]; financials:Financial[];
  risks:Risk[]; approvals:Approval[]; modules:Module[]; followUps:FollowUp[]; today:string;
  onOpenModule:(name:string)=>void; onOpenFollowUps:(view:"Today"|"Overdue"|"Upcoming"|"Completed"|"All")=>void;
  onOpenApprovals:()=>void; onOpenRisks:()=>void; onOpenContacts:(search?:string)=>void; onOpenFinancials:()=>void; onOpenSchedule:()=>void;
};

export default function IntentCanvas(props:Props) {
  const {properties,contacts,tasks,financials,risks,approvals,modules,followUps,today}=props;
  const [command,setCommand]=useState("");
  const [commandResult,setCommandResult]=useState("");
  const [focus,setFocus]=useState<Panel|null>(null);
  const [visible,setVisible]=useState<Panel[]>(PANEL_IDS);
  const [saved,setSaved]=useState(false);

  useEffect(()=>{
    try {
      const stored=JSON.parse(localStorage.getItem("axivestra.intentCanvas.panels")||"null");
      if(Array.isArray(stored)) {
        const valid=stored.filter((value):value is Panel=>PANEL_IDS.includes(value as Panel));
        if(valid.length) setVisible(valid);
      }
    } catch { /* saved layouts are optional; use the complete default canvas */ }
  },[]);

  const moduleValues=useMemo(()=>modules.map(module=>{
    const rows=properties.filter(item=>item.module===module.name);
    return {...module,count:rows.length,value:rows.reduce((sum,item)=>sum+(Number(item.value)||0),0)};
  }).sort((a,b)=>b.value-a.value),[modules,properties]);
  const totalValue=properties.reduce((sum,item)=>sum+(Number(item.value)||0),0);
  const activeRecords=properties.filter(item=>!["completed","closed","settled"].includes(String(item.status||"").toLowerCase()));
  const openFollowUps=followUps.filter(item=>!["Completed","Cancelled"].includes(item.entry.status));
  const dueToday= openFollowUps.filter(item=>item.entry.date===today);
  const overdue= openFollowUps.filter(item=>item.entry.date && item.entry.date<today);
  const upcoming= openFollowUps.filter(item=>item.entry.date && item.entry.date>today);
  const pending=approvals.filter(item=>String(item.status).toLowerCase()==="pending");
  const highRisks=risks.filter(item=>!["closed","resolved"].includes(String(item.status).toLowerCase()) && ["high","critical"].includes(String(item.severity).toLowerCase()));
  const inflows=financials.filter(item=>IN_KEY.has(item.type)).reduce((sum,item)=>sum+(Number(item.amount)||0),0);
  const outflows=financials.filter(item=>OUT_KEY.has(item.type)).reduce((sum,item)=>sum+(Number(item.amount)||0),0);
  const linkedCount=(person:Contact)=>properties.filter(item=>item.primaryContactId===person.id || item.contact?.trim().toLowerCase()===person.name.trim().toLowerCase()).length;
  const peopleWithMultipleRecords=contacts.map(person=>({person,count:linkedCount(person)})).filter(item=>item.count>1).sort((a,b)=>b.count-a.count);
  const tasksOpen=tasks.filter(item=>!item.done);
  const statusGroups=useMemo(()=>{
    const counts=new Map<string,number>();
    for(const item of activeRecords) counts.set(item.status||"Unspecified",(counts.get(item.status||"Unspecified")||0)+1);
    return Array.from(counts.entries()).sort((a,b)=>b[1]-a[1]).slice(0,6);
  },[activeRecords]);
  const timelineItems=useMemo(()=>[
    ...openFollowUps.map(item=>({id:"fu:"+item.entry.id,title:item.entry.description,date:item.entry.date,time:item.entry.time,kind:"Follow-up",module:item.module,record:item.recordTitle,priority:item.entry.priority})),
    ...tasksOpen.map(item=>({id:"task:"+item.id,title:item.title,date:item.date,time:item.time,kind:"Task",module:item.type,record:item.property,priority:"Normal"}))
  ].filter(item=>item.date).sort((a,b)=>(a.date+"T"+a.time).localeCompare(b.date+"T"+b.time)).slice(0,10),[openFollowUps,tasksOpen]);

  const searchResults=useMemo(()=>{
    const term=command.trim().toLowerCase();
    if(!term) return [];
    const people=contacts.filter(person=>person.name.toLowerCase().includes(term)).slice(0,4).map(person=>({kind:"Person",title:person.name,detail:person.role||person.phone||"Contact",action:()=>props.onOpenContacts(person.name)}));
    const records=properties.filter(record=>[record.title,record.module,record.location,record.contact,record.status].join(" ").toLowerCase().includes(term)).slice(0,6).map(record=>({kind:record.module,title:record.title,detail:[record.location,record.status,record.value?amount(record.value):""].filter(Boolean).join(" · "),action:()=>props.onOpenModule(record.module)}));
    return [...people,...records].slice(0,8);
  },[command,contacts,properties,props]);

  const executeCommand=()=>{
    const q=command.trim().toLowerCase();
    if(!q) return;
    if((q.includes("follow")||q.includes("commitment")) && (q.includes("today")||q.includes("due today"))) {props.onOpenFollowUps("Today");setCommandResult("Opened today’s follow-up assignments.");return;}
    if(q.includes("overdue")) {props.onOpenFollowUps("Overdue");setCommandResult("Opened overdue actions and commitments.");return;}
    if(q.includes("upcoming")||q.includes("next follow")) {props.onOpenFollowUps("Upcoming");setCommandResult("Opened upcoming follow-up assignments.");return;}
    if(q.includes("completed follow")) {props.onOpenFollowUps("Completed");setCommandResult("Opened completed follow-ups.");return;}
    if(q.includes("follow")) {props.onOpenFollowUps("All");setCommandResult("Opened the consolidated follow-up register.");return;}
    if(q.includes("approval")||q.includes("decision")) {props.onOpenApprovals();setCommandResult("Opened the approval and decision queue.");return;}
    if(q.includes("risk")) {props.onOpenRisks();setCommandResult("Opened the risk register.");return;}
    if(q.includes("cash flow")||q.includes("cashflow")||q.includes("financial")||q.includes("interest collection")) {props.onOpenFinancials();setCommandResult("Opened recorded financial activity.");return;}
    if(q.includes("all records")||q.includes("portfolio")) {props.onOpenModule("All Properties");setCommandResult("Opened all saved operating records.");return;}
    const module=modules.find(item=>q.includes(item.name.toLowerCase()));
    if(module) {props.onOpenModule(module.name);setCommandResult("Opened "+module.name+".");return;}
    const person=contacts.find(item=>q.includes(item.name.toLowerCase()));
    if(person) {props.onOpenContacts(person.name);setCommandResult("Opened contacts filtered for "+person.name+".");return;}
    setCommandResult(searchResults.length ? "Matching records are listed below. Select one to open its module." : "No matching saved record or supported command was found.");
  };

  const saveCanvas=()=>{
    try {
      localStorage.setItem("axivestra.intentCanvas.panels",JSON.stringify(visible));
      setSaved(true);
    } catch { setSaved(false); }
  };
  const restoreCanvas=()=>{
    setVisible(PANEL_IDS);
    setFocus(null);
    try { localStorage.removeItem("axivestra.intentCanvas.panels"); } catch { /* workspace restore remains available in memory */ }
    setSaved(false);
  };
  const togglePanel=(panel:Panel)=>setVisible(previous=>previous.includes(panel)?previous.filter(item=>item!==panel):[...previous,panel]);
  const panelHeader=(id:Panel,title:string,description:string,icon:ReactNode,action?:()=>void,actionLabel?:string)=>(
    <div className="ax-intent-panel-heading">
      <div className="ax-intent-panel-title"><span>{icon}</span><div><h3>{title}</h3><small>{description}</small></div></div>
      <div className="ax-intent-panel-controls">
        {action&&<button type="button" onClick={action}>{actionLabel||"Open"}<ArrowUpRight size={13}/></button>}
        <button type="button" onClick={()=>setFocus(focus===id?null:id)} title={focus===id?"Exit focus":"Focus panel"}><Focus size={14}/></button>
      </div>
    </div>
  );

  return <section className="ax-intent-canvas">
    <div className="ax-intent-command">
      <div className="ax-intent-command__title"><span className="section-kicker"><span className="live-dot"/> VESTRA SHIFT · INTENT CANVAS</span><h2>Start with the outcome. Assemble the workspace.</h2><p>Run supported commands against saved AXIVESTRA records, or assemble the live panels you need.</p></div>
      <div className="ax-intent-composer">
        <Command size={18}/>
        <input value={command} onChange={event=>{setCommand(event.target.value);setCommandResult("");}} onKeyDown={event=>{if(event.key==="Enter")executeCommand();}} placeholder="Try: Show today's follow-ups, overdue payments, pending approvals, Property Loans…"/>
        <button type="button" onClick={executeCommand}><Sparkles size={15}/> Run command</button>
      </div>
      <div className="ax-intent-examples">
        {["Today's follow-ups","Overdue follow-ups","Pending approvals","High risks","Property Loans","All records"].map(example=><button type="button" key={example} onClick={()=>{setCommand(example);setCommandResult("");}}>{example}</button>)}
      </div>
      {commandResult&&<p className="ax-intent-command-result" role="status">{commandResult}</p>}
      {command.trim()&&searchResults.length>0&&<div className="ax-intent-search-results">{searchResults.map((result,index)=><button type="button" key={result.kind+":"+result.title+":"+index} onClick={result.action}><span>{result.kind}</span><strong>{result.title}</strong><small>{result.detail}</small><ArrowUpRight size={13}/></button>)}</div>}
      <div className="ax-intent-workspace-toolbar">
        <div><span><Pin size={14}/> Canvas panels</span>{visible.length} active</div>
        <div className="ax-intent-toolbar-actions">
          <div className="ax-intent-panel-picker">
            {PANEL_IDS.map(panel=><button type="button" key={panel} className={visible.includes(panel)?"selected":""} onClick={()=>togglePanel(panel)}>{visible.includes(panel)?"✓":"+"} {PANEL_LABELS[panel]}</button>)}
          </div>
          <button type="button" onClick={saveCanvas}><Bookmark size={14}/>{saved?"Layout saved":"Save layout"}</button>
          <button type="button" onClick={restoreCanvas}>Restore</button>
        </div>
      </div>
    </div>

    {focus&&visible.includes(focus)&&<div className="ax-intent-focus-notice"><Focus size={15}/> Focus mode · {PANEL_LABELS[focus]}<button type="button" onClick={()=>setFocus(null)}>Return to canvas</button></div>}
    <div className={"ax-intent-panels"+(focus?" is-focused":"")}>
      {visible.filter(panel=>!focus||panel===focus).map(panel=>{
        if(panel==="portfolio") return <section className="ax-intent-panel" key={panel}>
          {panelHeader(panel,"Portfolio intelligence","Entered record values and live status",<TrendingUp size={16}/>,()=>props.onOpenModule("All Properties"),"Open portfolio")}
          <div className="ax-intent-big-number">{INR.format(totalValue)}<small>Recorded portfolio value · {properties.length} records</small></div>
          <div className="ax-intent-stat-row"><span>Active records <strong>{activeRecords.length}</strong></span><span>Operating modules <strong>{modules.length}</strong></span><span>Tasks open <strong>{tasksOpen.length}</strong></span></div>
          <div className="ax-intent-module-bars">{moduleValues.slice(0,5).map(item=><button type="button" key={item.name} onClick={()=>props.onOpenModule(item.name)}><span>{item.name}</span><i><b style={{width:(totalValue>0?Math.max(2,item.value/totalValue*100):0)+"%"}}/></i><strong>{item.count}</strong></button>)}</div>
        </section>;

        if(panel==="followups") return <section className="ax-intent-panel" key={panel}>
          {panelHeader(panel,"Follow-up command queue","Person assignments across every module",<ListTodo size={16}/>,()=>props.onOpenFollowUps("All"),"Open registry")}
          <div className="ax-intent-four-stats"><button onClick={()=>props.onOpenFollowUps("Overdue")}><strong>{overdue.length}</strong><span>Overdue</span></button><button onClick={()=>props.onOpenFollowUps("Today")}><strong>{dueToday.length}</strong><span>Today</span></button><button onClick={()=>props.onOpenFollowUps("Upcoming")}><strong>{upcoming.length}</strong><span>Upcoming</span></button><button onClick={()=>props.onOpenFollowUps("Completed")}><strong>{followUps.filter(item=>item.entry.status==="Completed").length}</strong><span>Completed</span></button></div>
          <div className="ax-intent-rows">{[...overdue,...dueToday,...upcoming].slice(0,5).map(item=><button type="button" key={item.entry.id} onClick={()=>props.onOpenFollowUps(item.entry.date<today?"Overdue":item.entry.date===today?"Today":"Upcoming")}><span className={"ax-followup-priority priority-"+item.entry.priority.toLowerCase()}>{item.entry.priority}</span><strong>{item.entry.description}</strong><small>{item.module} · {item.recordTitle} · {dateLabel(item.entry.date)}</small><ArrowUpRight size={12}/></button>)}</div>
        </section>;

        if(panel==="finance") return <section className="ax-intent-panel" key={panel}>
          {panelHeader(panel,"Financial movement","Recorded transactions only",<Wallet size={16}/>,props.onOpenFinancials,"Open financials")}
          <div className="ax-intent-finance-columns"><div><span>Recorded inflows</span><strong>{INR.format(inflows)}</strong><small>{financials.filter(item=>IN_KEY.has(item.type)).length} entries</small></div><div><span>Recorded outflows</span><strong>{INR.format(outflows)}</strong><small>{financials.filter(item=>OUT_KEY.has(item.type)).length} entries</small></div></div>
          <p className="ax-intent-footnote">Net recorded movement: <strong>{INR.format(inflows-outflows)}</strong>. This is not a bank balance or a forecast.</p>
        </section>;

        if(panel==="people") return <section className="ax-intent-panel" key={panel}>
          {panelHeader(panel,"People & relationship signals","Connected records resolved from saved contact links",<Users size={16}/>,()=>props.onOpenContacts(),"Open contacts")}
          <div className="ax-intent-big-number">{contacts.length}<small>Saved contacts · {peopleWithMultipleRecords.length} linked to multiple records</small></div>
          <div className="ax-intent-rows">{peopleWithMultipleRecords.slice(0,5).map(item=><button type="button" key={item.person.id} onClick={()=>props.onOpenContacts(item.person.name)}><strong>{item.person.name}</strong><small>{item.count} linked records · {item.person.role||"Contact"}</small><ArrowUpRight size={12}/></button>)}</div>
        </section>;

        if(panel==="workflow") return <section className="ax-intent-panel" key={panel}>
          {panelHeader(panel,"Mission workflow","Active record stages and task dependencies",<Activity size={16}/>,()=>props.onOpenModule("All Properties"),"Open workstreams")}
          <div className="ax-intent-workflow-stages">{statusGroups.map(([status,count])=><button type="button" key={status} onClick={()=>props.onOpenModule("All Properties")}><span>{status}</span><strong>{count}</strong><i><b style={{width:(activeRecords.length?count/activeRecords.length*100:0)+"%"}}/></i></button>)}</div>
          <div className="ax-intent-stat-row"><span>Open tasks <strong>{tasksOpen.length}</strong></span><span>Overdue tasks <strong>{tasksOpen.filter(item=>item.date && item.date<today).length}</strong></span></div>
        </section>;

        if(panel==="decisions") return <section className="ax-intent-panel" key={panel}>
          {panelHeader(panel,"Decisions & risk signals","Open approvals and high-severity risks",<ShieldCheck size={16}/>,props.onOpenApprovals,"Review decisions")}
          <div className="ax-intent-four-stats"><button onClick={props.onOpenApprovals}><strong>{pending.length}</strong><span>Pending</span></button><button onClick={props.onOpenRisks}><strong>{highRisks.length}</strong><span>High risks</span></button><button onClick={props.onOpenApprovals}><strong>{approvals.length}</strong><span>Total requests</span></button><button onClick={props.onOpenRisks}><strong>{risks.length}</strong><span>Total risks</span></button></div>
          <div className="ax-intent-rows">{pending.slice(0,3).map(item=><button type="button" key={item.id} onClick={props.onOpenApprovals}><span className={"ax-followup-priority priority-"+String(item.priority||"normal").toLowerCase()}>{item.priority}</span><strong>{item.title}</strong><small>{item.area} · {item.entity||"No linked entity"}</small><ArrowUpRight size={12}/></button>)}{highRisks.slice(0,2).map(item=><button type="button" key={item.id} onClick={props.onOpenRisks}><span className={"ax-followup-priority priority-"+String(item.severity).toLowerCase()}>{item.severity}</span><strong>{item.title}</strong><small>{item.status} · {item.owner||"Unassigned"}</small><ArrowUpRight size={12}/></button>)}</div>
        </section>;

        return <section className="ax-intent-panel" key={panel}>
          {panelHeader(panel,"Temporal workspace","Next dated commitments and work activity",<CalendarClock size={16}/>,()=>props.onOpenFollowUps("All"),"Open timeline")}
          <div className="ax-intent-timeline">{timelineItems.map(item=><button type="button" key={item.id} onClick={()=>item.kind==="Follow-up"?props.onOpenFollowUps(item.date<today?"Overdue":item.date===today?"Today":"Upcoming"):props.onOpenSchedule()}><span className="ax-intent-timeline-date">{dateLabel(item.date)}{item.time?" · "+item.time:""}</span><strong>{item.title}</strong><small>{item.kind} · {item.module} · {item.record}</small><ChevronRight size={13}/></button>)}</div>
        </section>;
      })}
    </div>
    <div className="ax-intent-integrity-note"><CircleAlert size={14}/> Figures above are derived from saved AXIVESTRA records. No sample records, inferred payments or predicted balances are inserted. Supported commands navigate to existing application workflows; unrecognized instructions remain a search, not an executed action.</div>
  </section>;
}
