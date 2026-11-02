import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, CalendarClock, FileText, History, Target, UserRound, Wallet, X } from "lucide-react";
import { formatINR, parseDealNumber } from "./lib/deal-structure";

type FocusTask = {
  id: string; title: string; date: string; time: string; type: string; property: string;
  propertyId?: string; contactId?: string; contactName?: string; notes: string; done: boolean;
};
type FocusFollowUp = {
  id: string; description: string; amount: string; promisedDate: string; promisedTime: string;
  status: string; notes: string; linkedRecordId: string;
};
type FocusRecord = {
  id: string; title: string; module: string; location: string; value: string; status: string; contact: string;
  primaryContactId?: string; followUpContactId?: string; targetDeadline?: string; targetDeadlineTime?: string;
  nextFollowUpDate?: string; nextFollowUpTime?: string; nextAction?: string;
  followUpEntries?: Array<{id:string;followPersonName:string;followDate:string;followTime:string;remarks:string;nextFollowUpDate:string;nextFollowUpTime:string}>;
  moduleData: Record<string,string>;
};
type FocusContact = {
  id: string; name: string; phone: string; role: string; roles?: string[];
  followUps?: FocusFollowUp[];
};
type FocusFinancial = {
  id: string; propertyId?: string; contactId?: string; property: string; type: string;
  amount: string; date: string; party: string; reference: string; notes: string;
};
type Props = {
  properties: FocusRecord[]; contacts: FocusContact[]; tasks: FocusTask[]; financials: FocusFinancial[];
  today: string; workspaceScope: string; workspacePreferences:Record<string,unknown>;workspacePreferencesReady:boolean;onSaveWorkspacePreference:(key:string,value:unknown)=>void;
  onClose: () => void; onOpenRecord: (id:string) => void; onOpenContact: (id:string) => void;
  onOpenTask: (id:string) => void; onOpenFinancials: () => void; onOpenTasks: () => void;
};

const dateLabel = (value: string) => value
  ? new Date(value + "T00:00:00").toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})
  : "No date saved";

export default function VestraFocusMode({
  properties, contacts, tasks, financials, today, workspaceScope,
  onClose, onOpenRecord, onOpenContact, onOpenTask, onOpenFinancials, onOpenTasks,workspacePreferences,workspacePreferencesReady,onSaveWorkspacePreference
}: Props) {
  const storageKey = "axivestra.vestraFocus." + workspaceScope;
  const [mode, setMode] = useState<"task"|"record">("task");
  const [taskId, setTaskId] = useState("");
  const [recordId, setRecordId] = useState("");

  const hydratedPreferenceRef=useRef(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
      if (saved?.mode === "task" || saved?.mode === "record") setMode(saved.mode);
      if (typeof saved?.taskId === "string") setTaskId(saved.taskId);
      if (typeof saved?.recordId === "string") setRecordId(saved.recordId);
    } catch { /* Focus preferences are optional and never affect business data. */ }
  }, [storageKey]);

  useEffect(()=>{
    if(!workspacePreferencesReady)return;
    const saved=workspacePreferences["vestraFocus.selection"];
    if(saved&&typeof saved==="object"&&!Array.isArray(saved)){
      hydratedPreferenceRef.current=true;
      const value=saved as {mode?:unknown;taskId?:unknown;recordId?:unknown};
      if(value.mode==="task"||value.mode==="record")setMode(value.mode);
      if(typeof value.taskId==="string")setTaskId(value.taskId);
      if(typeof value.recordId==="string")setRecordId(value.recordId);
    }
  },[workspacePreferencesReady,workspacePreferences["vestraFocus.selection"]]);

  useEffect(() => {
    const value={mode,taskId,recordId};
    try { window.localStorage.setItem(storageKey, JSON.stringify(value)); }
    catch { /* Focus preferences are optional and never affect business data. */ }
    if(workspacePreferencesReady){
      if(hydratedPreferenceRef.current){hydratedPreferenceRef.current=false;return;}
      onSaveWorkspacePreference("vestraFocus.selection",value);
    }
  }, [storageKey,mode,taskId,recordId,workspacePreferencesReady,onSaveWorkspacePreference]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const orderedTasks = useMemo(() => [...tasks].sort((a,b) =>
    (a.done === b.done ? 0 : a.done ? 1 : -1) ||
    (a.date || "9999-12-31").localeCompare(b.date || "9999-12-31") ||
    (a.time || "").localeCompare(b.time || "")
  ), [tasks]);
  const selectedTask = orderedTasks.find(item => item.id === taskId) || orderedTasks[0];
  const selectedRecord = properties.find(item => item.id === recordId) || properties[0];
  const taskRecord = selectedTask
    ? properties.find(item => item.id === selectedTask.propertyId) ||
      properties.find(item => item.title && item.title === selectedTask.property)
    : undefined;
  const focusedRecord = mode === "task" ? taskRecord : selectedRecord;
  const relatedContact = contacts.find(item =>
    item.id === (mode === "task" ? selectedTask?.contactId : focusedRecord?.followUpContactId || focusedRecord?.primaryContactId)
  ) || contacts.find(item => {
    const name = mode === "task" ? selectedTask?.contactName : focusedRecord?.contact;
    return Boolean(name && item.name.trim().toLowerCase() === name.trim().toLowerCase());
  });

  const linkedFinancials = useMemo(() => financials
    .filter(item => Boolean(
      (focusedRecord?.id && item.propertyId === focusedRecord.id) ||
      (relatedContact?.id && item.contactId === relatedContact.id)
    ))
    .sort((a,b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0,5), [financials,focusedRecord?.id,relatedContact?.id]);

  const activity = useMemo(() => {
    const rows: Array<{id:string;date:string;time:string;title:string;detail:string;amount?:string;kind:string}> = [];
    (focusedRecord?.followUpEntries || []).forEach(item => {
      if (item.followDate) rows.push({
        id:"record-follow-"+item.id,date:item.followDate,time:item.followTime||"",
        title:"Record follow-up",detail:[item.followPersonName,item.remarks].filter(Boolean).join(" · "),kind:"Follow-up"
      });
      if (item.nextFollowUpDate) rows.push({
        id:"record-next-"+item.id,date:item.nextFollowUpDate,time:item.nextFollowUpTime||"",
        title:"Next record follow-up",detail:[item.followPersonName,item.remarks].filter(Boolean).join(" · "),kind:"Follow-up"
      });
    });
    (relatedContact?.followUps || []).forEach(item => {
      if (item.promisedDate) rows.push({
        id:"contact-follow-"+item.id,date:item.promisedDate,time:item.promisedTime||"",
        title:item.description||"Contact commitment",detail:item.status||"Status not set",
        amount:item.amount,kind:"Commitment"
      });
    });
    linkedFinancials.forEach(item => rows.push({
      id:"financial-"+item.id,date:item.date,time:"",title:item.type+" · "+(item.party||item.property||"Transaction"),
      detail:[item.reference,item.notes].filter(Boolean).join(" · "),amount:item.amount,kind:"Financial"
    }));
    return rows.sort((a,b)=>(b.date+" "+b.time).localeCompare(a.date+" "+a.time)).slice(0,8);
  }, [focusedRecord?.followUpEntries,relatedContact?.followUps,linkedFinancials]);

  const noFocusSource = mode === "task" ? !selectedTask : !selectedRecord;
  const focusTitle = mode === "task" ? selectedTask?.title : selectedRecord?.title || selectedRecord?.module;
  const focusStatus = mode === "task"
    ? selectedTask?.done ? "Completed" : selectedTask?.date && selectedTask.date < today ? "Overdue" : "Open"
    : selectedRecord?.status || "Status not set";

  return <div className="vs-focus-backdrop" data-theme={undefined} role="presentation">
    <section className="vs-focus-panel" role="dialog" aria-modal="true" aria-labelledby="vs-focus-title">
      <header className="vs-focus-header">
        <div className="vs-focus-brand"><span className="vs-focus-mark"><Target size={18}/></span><div>
          <span className="vs-eyebrow">VESTRA · FOCUS ENVIRONMENT</span>
          <h3 id="vs-focus-title">One task. One context. Clear next action.</h3>
          <p>Work on one saved item without losing its connected person, record or recent history.</p>
        </div></div>
        <button type="button" className="vs-focus-close" onClick={onClose}><X size={16}/> Return to workspace</button>
      </header>

      <div className="vs-focus-mode-switch" role="group" aria-label="Focus source">
        <button type="button" className={mode==="task"?"active":""} aria-pressed={mode==="task"} onClick={()=>setMode("task")}>Focus a task <CalendarClock size={14}/></button>
        <button type="button" className={mode==="record"?"active":""} aria-pressed={mode==="record"} onClick={()=>setMode("record")}>Focus a record <FileText size={14}/></button>
      </div>

      <div className="vs-focus-source-picker">
        {mode==="task"
          ? <label>Selected task
              <select aria-label="Selected focus task" value={selectedTask?.id||""} onChange={event=>setTaskId(event.target.value)}>
                {orderedTasks.map(item=><option key={item.id} value={item.id}>{item.title} · {item.date||"No date"}</option>)}
              </select>
            </label>
          : <label>Selected record
              <select aria-label="Selected focus record" value={selectedRecord?.id||""} onChange={event=>setRecordId(event.target.value)}>
                {properties.map(item=><option key={item.id} value={item.id}>{item.module} · {item.title||"Untitled record"}</option>)}
              </select>
            </label>}
      </div>

      {noFocusSource ? <div className="vs-focus-empty">
        <Target size={24}/><strong>{mode==="task"?"No saved tasks are available to focus on.":"No saved records are available to focus on."}</strong>
        <p>Add a real item in the existing workspace. Focus mode does not create sample tasks or records.</p>
        <button type="button" onClick={mode==="task"?onOpenTasks:()=>onClose()}>{mode==="task"?"Open Schedule & Tasks":"Return to records"} <ArrowUpRight size={14}/></button>
      </div> : <>
        <div className="vs-focus-main">
          <div className="vs-focus-primary">
            <span className="vs-eyebrow">{mode==="task"?"SELECTED TASK":"SELECTED RECORD"} · {focusStatus}</span>
            <h4>{focusTitle}</h4>
            {mode==="task" && selectedTask && <>
              <p>{[selectedTask.type,selectedTask.property,selectedTask.contactName].filter(Boolean).join(" · ")||"No additional context saved."}</p>
              <div className="vs-focus-facts">
                <span><small>Due date</small><strong>{dateLabel(selectedTask.date)}</strong></span>
                <span><small>Time</small><strong>{selectedTask.time||"Not set"}</strong></span>
                <span><small>Status</small><strong>{focusStatus}</strong></span>
              </div>
              {selectedTask.notes&&<blockquote>{selectedTask.notes}</blockquote>}
            </>}
            {mode==="record" && selectedRecord && <>
              <p>{[selectedRecord.module,selectedRecord.location,selectedRecord.status].filter(Boolean).join(" · ")}</p>
              <div className="vs-focus-facts">
                <span><small>Record value</small><strong>{selectedRecord.value?formatINR(parseDealNumber(selectedRecord.value)):"Not entered"}</strong></span>
                <span><small>Next deadline</small><strong>{dateLabel(selectedRecord.targetDeadline||selectedRecord.nextFollowUpDate||"")}</strong></span>
                <span><small>Next action</small><strong>{selectedRecord.nextAction||"Not recorded"}</strong></span>
              </div>
            </>}
          </div>
          <aside className="vs-focus-context">
            <span className="vs-eyebrow">CONNECTED CONTEXT</span>
            {relatedContact ? <button type="button" className="vs-focus-person" onClick={()=>onOpenContact(relatedContact.id)}>
              <span><UserRound size={16}/></span><div><strong>{relatedContact.name}</strong><small>{relatedContact.role||relatedContact.roles?.join(", ")||"Contact"} · {relatedContact.phone||"No phone saved"}</small></div><ArrowUpRight size={14}/>
            </button> : <p className="vs-focus-muted">No linked person is saved for this item.</p>}
            {focusedRecord ? <button type="button" className="vs-focus-record-link" onClick={()=>onOpenRecord(focusedRecord.id)}>
              <FileText size={15}/><span><strong>{focusedRecord.title||focusedRecord.module}</strong><small>{focusedRecord.module} · {focusedRecord.status||"Status not set"}</small></span><ArrowUpRight size={14}/>
            </button> : mode==="task" ? <p className="vs-focus-muted">This task has no linked saved record.</p> : null}
            {mode==="task"&&selectedTask&&<button type="button" className="vs-focus-open-task" onClick={()=>onOpenTask(selectedTask.id)}>Open original task <ArrowUpRight size={13}/></button>}
          </aside>
        </div>

        <div className="vs-focus-lower">
          <section className="vs-focus-history">
            <header><span><History size={14}/> RELEVANT HISTORY</span><small>{activity.length} saved item(s)</small></header>
            {activity.length ? activity.map(item=><article key={item.id}>
              <span className="vs-focus-history-dot"/><div><strong>{item.title}</strong><small>{dateLabel(item.date)}{item.time?" · "+item.time:""} · {item.kind}</small><p>{item.detail||"No additional details saved."}</p></div>
              {item.amount&&<b>{formatINR(parseDealNumber(item.amount))}</b>}
            </article>) : <p className="vs-focus-muted">No linked follow-up or financial history is recorded for this selection.</p>}
          </section>
          <section className="vs-focus-actions">
            <span className="vs-eyebrow">IMMEDIATE ACTIONS</span>
            {mode==="task"&&selectedTask&&<button type="button" onClick={()=>onOpenTask(selectedTask.id)}><CalendarClock size={15}/> Open task details <ArrowUpRight size={13}/></button>}
            {focusedRecord&&<button type="button" onClick={()=>onOpenRecord(focusedRecord.id)}><FileText size={15}/> Open source record <ArrowUpRight size={13}/></button>}
            {relatedContact&&<button type="button" onClick={()=>onOpenContact(relatedContact.id)}><UserRound size={15}/> Open Contact 360 <ArrowUpRight size={13}/></button>}
            {linkedFinancials.length>0&&<button type="button" onClick={onOpenFinancials}><Wallet size={15}/> Open linked financial activity <ArrowUpRight size={13}/></button>}
            {!focusedRecord&&!relatedContact&&!linkedFinancials.length&&<small>Actions appear when this item has linked source records.</small>}
          </section>
        </div>
      </>}

      <footer className="vs-focus-footer">Focus mode is read-only. All displayed details come from saved AXIVESTRA records; selections are stored as workspace preferences only.</footer>
    </section>
  </div>;
}
