import { useMemo, useState } from "react";
import { formatIndianCompactAmount, parseIndianAmount } from "./lib/indian-amount.mjs";
import { downloadIntelligencePdf, downloadIntelligencePptx } from "./lib/report-export.mjs";
import { CalendarClock, CheckCircle2, Clock3, Filter, ListTodo, MessageCircle, Pencil, Plus, Search, Users } from "lucide-react";
import { isFollowUpClosed, legacyRecordFollowUp, parseFollowUps, type FollowUpEntry, type FollowUpPriority, type FollowUpRecordLike } from "./lib/follow-ups";

type Contact = { id: string; name: string; phone?: string; role?: string };
type Group = { id:string; jid:string; name:string };
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

const money = (value: string) => formatIndianCompactAmount(value) || "—";
const dateLabel = (value: string) => value ? new Date(value + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Not dated";
const statusOf = (item: Item) => item.source === "task" ? (item.task?.done ? "Completed" : "Open") : item.entry.status;

export default function FollowUpRegistry({
  initialTab="All", properties, contacts, groups, tasks, today, onAdd, onEditEntry, onUpdateEntry,
  onDeleteEntry, onEditRecord, onEditTask, onToggleTask, onDeleteTask, onOpenModule, onWhatsApp
}: Props) {
  const [tab, setTab] = useState<"All"|"Today"|"Overdue"|"Upcoming"|"Completed">(initialTab);
  const [query, setQuery] = useState("");
  const [personFilter, setPersonFilter] = useState("");
  const [primaryPersonFilter,setPrimaryPersonFilter]=useState("");
  const [primaryGroupFilter,setPrimaryGroupFilter]=useState("");
  const [followGroupFilter,setFollowGroupFilter]=useState("");
  const [minimumAmount,setMinimumAmount]=useState("");
  const [maximumAmount,setMaximumAmount]=useState("");
  const [locationFilter,setLocationFilter]=useState("");
  const [moduleFilter, setModuleFilter] = useState("");
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
  const groupById=(id:string)=>groups.find(group=>group.id===id||group.jid===id)?.name||id;


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
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    let result = items.filter(item => {
      const status = statusOf(item);
      if (tab === "Today" && (isFollowUpClosed(status) || item.entry.date !== today)) return false;
      if (tab === "Overdue" && (isFollowUpClosed(status) || !item.entry.date || item.entry.date >= today)) return false;
      if (tab === "Upcoming" && (isFollowUpClosed(status) || !item.entry.date || item.entry.date <= today)) return false;
      if (tab === "Completed" && status !== "Completed") return false;
      if (personFilter && !item.entry.contactIds.includes(personFilter)) return false;
      if (primaryPersonFilter && item.record?.primaryContactId !== primaryPersonFilter) return false;
      if (primaryGroupFilter && !readGroupIds(item.record,"primary").includes(primaryGroupFilter)) return false;
      if (followGroupFilter && !readGroupIds(item.record,"follow").includes(followGroupFilter)) return false;
      if (locationFilter.trim() && !String(item.record?.location||"").toLowerCase().includes(locationFilter.trim().toLowerCase())) return false;
      const amount=Number(item.entry.amount)||Number(item.record?.value)||0;
      const min=parseIndianAmount(minimumAmount),max=parseIndianAmount(maximumAmount);
      if (minimumAmount.trim() && (min===null || amount<min)) return false;
      if (maximumAmount.trim() && (max===null || amount>max)) return false;
      if (moduleFilter && item.module !== moduleFilter) return false;
      if (priorityFilter && item.entry.priority !== priorityFilter) return false;
      if (term) {
        const people = item.entry.contactIds.map(id => contactById.get(id)?.name || "").join(" ");
        const text = [item.entry.description,item.entry.notes,item.entry.nextAction,item.recordTitle,item.module,people,item.entry.amount].join(" ").toLowerCase();
        if (!text.includes(term)) return false;
      }
      return true;
    });
    if (amountSort !== "none") result = [...result].sort((a,b) => {
      const av = Number(a.entry.amount) || Number(a.record?.value) || 0;
      const bv = Number(b.entry.amount) || Number(b.record?.value) || 0;
      return amountSort === "high" ? bv-av : av-bv;
    });
    else result = [...result].sort((a,b) => {
      const date = (a.entry.date || "9999-12-31").localeCompare(b.entry.date || "9999-12-31");
      return date || (a.entry.time || "").localeCompare(b.entry.time || "");
    });
    return result;
  }, [items, tab, today, personFilter, primaryPersonFilter, primaryGroupFilter, followGroupFilter, minimumAmount, maximumAmount, locationFilter, moduleFilter, priorityFilter, query, amountSort, contactById]);

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
        <label>Follow-up contact<select value={personFilter} onChange={event=>setPersonFilter(event.target.value)}><option value="">All follow-up contacts</option>{contacts.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
        <label>Primary contact<select value={primaryPersonFilter} onChange={event=>setPrimaryPersonFilter(event.target.value)}><option value="">All primary contacts</option>{contacts.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
        <label>Primary group<select value={primaryGroupFilter} onChange={event=>setPrimaryGroupFilter(event.target.value)}><option value="">All primary groups</option>{groups.map(group=><option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
        <label>Follow-up group<select value={followGroupFilter} onChange={event=>setFollowGroupFilter(event.target.value)}><option value="">All follow-up groups</option>{groups.map(group=><option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
        <label>Location<input value={locationFilter} onChange={event=>setLocationFilter(event.target.value)} placeholder="Search location"/></label>
        <label>Amount from (₹)<input value={minimumAmount} onChange={event=>setMinimumAmount(event.target.value)} placeholder="e.g. 2 Cr"/></label>
        <label>Amount to (₹)<input value={maximumAmount} onChange={event=>setMaximumAmount(event.target.value)} placeholder="e.g. 10 Cr"/></label>
        <label>Module<select value={moduleFilter} onChange={event=>setModuleFilter(event.target.value)}><option value="">All modules</option>{modules.map(module=><option key={module}>{module}</option>)}</select></label>
        <label>Priority<select value={priorityFilter} onChange={event=>setPriorityFilter(event.target.value)}><option value="">All priorities</option>{["Urgent","High","Normal","Low"].map(priority=><option key={priority}>{priority}</option>)}</select></label>
        <label>Amount order<select value={amountSort} onChange={event=>setAmountSort(event.target.value as typeof amountSort)}><option value="none">Date order</option><option value="high">Highest amount first</option><option value="low">Lowest amount first</option></select></label><button type="button" className="secondary-button" onClick={()=>{setQuery("");setPersonFilter("");setPrimaryPersonFilter("");setPrimaryGroupFilter("");setFollowGroupFilter("");setLocationFilter("");setMinimumAmount("");setMaximumAmount("");setModuleFilter("");setPriorityFilter("");setAmountSort("none");setTab("All");}}>Clear all filters</button>
      </div>
      <div className="ax-followup-tabs">{(["All","Today","Overdue","Upcoming","Completed"] as const).map(value=><button key={value} type="button" className={tab===value?"active":""} onClick={()=>setTab(value)}>{value}{value==="All"?" ("+counts.all+")":value==="Today"?" ("+counts.today+")":value==="Overdue"?" ("+counts.overdue+")":value==="Upcoming"?" ("+counts.upcoming+")":" ("+counts.completed+")"}</button>)}</div>
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
