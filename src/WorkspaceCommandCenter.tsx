import { useMemo, useState } from "react";
import { Bell, CheckCircle2, ChevronDown, CircleHelp, History, Plus, Search, X } from "lucide-react";

export type SearchKind = "property" | "contact" | "task" | "financial" | "document" | "risk" | "approval" | "group";
type SearchResult = { kind: SearchKind; id: string; title: string; detail: string; record: any };
type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  properties: any[];
  contacts: any[];
  tasks: any[];
  financials: any[];
  documents: any[];
  risks: any[];
  approvals: any[];
  groups: any[];
  onOpenResult: (kind: SearchKind, record: any) => void;
  onQuickCreate: (kind: "property" | "contact" | "task" | "financial") => void;
  onOpenHistory: () => void;
};

const valueOf = (value: unknown) => value == null ? "" : typeof value === "string" || typeof value === "number" ? String(value) : JSON.stringify(value);
const matches = (record: any, query: string) => Object.values(record || {}).map(valueOf).join(" ").toLocaleLowerCase().includes(query);

export default function WorkspaceCommandCenter(props: Props) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(() => {
    try { return localStorage.getItem("axivestra.onboarding.dismissed") !== "1"; } catch { return false; }
  });

  const results = useMemo(() => {
    const query = props.search.trim().toLocaleLowerCase();
    if (query.length < 2) return [];
    const sources: Array<[SearchKind, any[], (record: any) => string]> = [
      ["property", props.properties, r => [r.module, r.location, r.status].filter(Boolean).join(" · ")],
      ["contact", props.contacts, r => [r.role, r.phone, r.email].filter(Boolean).join(" · ")],
      ["task", props.tasks, r => [r.date, r.time, r.property, r.contactName].filter(Boolean).join(" · ")],
      ["financial", props.financials, r => [r.type, r.party, r.property, r.reference].filter(Boolean).join(" · ")],
      ["document", props.documents, r => [r.category, r.property, r.expiresOn].filter(Boolean).join(" · ")],
      ["risk", props.risks, r => [r.category, r.severity, r.status].filter(Boolean).join(" · ")],
      ["approval", props.approvals, r => [r.area, r.status, r.approver].filter(Boolean).join(" · ")],
      ["group", props.groups, r => [r.description, r.size ? r.size + " members" : ""].filter(Boolean).join(" · ")]
    ];
    return sources.flatMap(([kind, records, detail]) => records
      .filter(record => matches(record, query))
      .slice(0, 5)
      .map(record => ({ kind, id: String(record.id), title: String(record.title || record.name || record.property || record.party || record.type || "Untitled record"), detail: detail(record), record } as SearchResult)))
      .slice(0, 15);
  }, [props.search, props.properties, props.contacts, props.tasks, props.financials, props.documents, props.risks, props.approvals, props.groups]);

  const reminders = useMemo(() => {
    const today = new Date();
    const todayKey = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + 7);
    const horizonKey = new Date(horizon.getTime() - horizon.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const candidates: Array<{ id: string; title: string; date: string; time?: string; kind: SearchKind; record: any; category: string }> = [];
    props.tasks.filter(task => !task.done && task.date).forEach(task => candidates.push({ id: "task:" + task.id, title: task.title || "Untitled task", date: task.date, time: task.time, kind: "task", record: task, category: "Task" }));
    props.properties.forEach(property => {
      if (property.nextFollowUpDate) candidates.push({ id: "followup:" + property.id, title: property.title || "Property follow-up", date: property.nextFollowUpDate, kind: "property", record: property, category: "Follow-up" });
      if (property.targetDeadline) candidates.push({ id: "deadline:" + property.id, title: property.title || "Property deadline", date: property.targetDeadline, kind: "property", record: property, category: "Deadline" });
    });
    props.documents.filter(document => document.expiresOn).forEach(document => candidates.push({ id: "document:" + document.id, title: document.name || "Document expiry", date: document.expiresOn, kind: "document", record: document, category: "Document expiry" }));
    props.risks.filter(risk => risk.dueDate && risk.status !== "Closed").forEach(risk => candidates.push({ id: "risk:" + risk.id, title: risk.title || "Risk review", date: risk.dueDate, kind: "risk", record: risk, category: "Risk review" }));
    return candidates.filter(item => item.date <= horizonKey)
      .sort((a, b) => (a.date + "T" + (a.time || "00:00")).localeCompare(b.date + "T" + (b.time || "00:00")))
      .map(item => ({ ...item, overdue: item.date < todayKey, today: item.date === todayKey }));
  }, [props.tasks, props.properties, props.documents, props.risks]);
  const reminderCount = reminders.length;
  const dismissOnboarding = () => {
    setOnboardingOpen(false);
    try { localStorage.setItem("axivestra.onboarding.dismissed", "1"); } catch {}
  };
  const openResult = (result: SearchResult) => {
    props.onOpenResult(result.kind, result.record);
    setSearchOpen(false);
    setNotificationsOpen(false);
  };
  const quick = (kind: "property" | "contact" | "task" | "financial") => {
    props.onQuickCreate(kind);
    setQuickOpen(false);
  };

  return <div className="ax-command-center">
    <label className="search-box ax-universal-search">
      <Search size={17} />
      <input value={props.search} onFocus={() => setSearchOpen(true)} onChange={event => { props.onSearchChange(event.target.value); setSearchOpen(true); }} placeholder="Search everything…" aria-label="Search all AXIVESTRA records" />
      <kbd>Ctrl K</kbd>
    </label>
    {searchOpen && props.search.trim().length >= 2 && <div className="ax-command-dropdown ax-search-results" role="listbox" aria-label="Universal search results">
      <div className="ax-command-heading"><strong>Search results</strong><span>{results.length} found</span><button type="button" onClick={() => setSearchOpen(false)} aria-label="Close search results"><X size={14}/></button></div>
      {results.length ? results.map(result => <button type="button" className="ax-search-result" key={result.kind + result.id} onClick={() => openResult(result)}>
        <span className="ax-search-result__kind">{result.kind}</span><span className="ax-search-result__body"><strong>{result.title}</strong><small>{result.detail || result.kind}</small></span><span className="ax-search-result__arrow">↗</span>
      </button>) : <div className="ax-command-empty">No matching records. Check spelling or try a phone number, module name, location or reference.</div>}
    </div>}
    <div className="ax-command-actions">
      <div className="ax-command-anchor">
        <button type="button" className="ax-command-button ax-quick-create" onClick={() => { setQuickOpen(value => !value); setNotificationsOpen(false); }} aria-expanded={quickOpen}><Plus size={16}/> <span>Quick add</span><ChevronDown size={13}/></button>
        {quickOpen && <div className="ax-command-dropdown ax-quick-menu">
          <strong>New record</strong>
          <button type="button" onClick={() => quick("property")}>Property / deal</button>
          <button type="button" onClick={() => quick("contact")}>Contact</button>
          <button type="button" onClick={() => quick("task")}>Task / reminder</button>
          <button type="button" onClick={() => quick("financial")}>Financial transaction</button>
        </div>}
      </div>
      <div className="ax-command-anchor">
        <button type="button" className="icon-button ax-notification-button" aria-label={`Notifications: ${reminderCount} upcoming or overdue tasks`} onClick={() => { setNotificationsOpen(value => !value); setQuickOpen(false); }} aria-expanded={notificationsOpen}><Bell size={19}/>{reminderCount > 0 && <i className="ax-notification-count">{reminderCount > 99 ? "99+" : reminderCount}</i>}</button>
        {notificationsOpen && <div className="ax-command-dropdown ax-reminder-menu">
          <div className="ax-command-heading"><div><strong>Reminders</strong><small>Overdue and next 7 days</small></div><button type="button" onClick={() => setNotificationsOpen(false)} aria-label="Close reminders"><X size={14}/></button></div>
          {reminders.length ? reminders.map(({task, overdue, today}) => <button type="button" className="ax-reminder-item" key={task.id} onClick={() => { props.onOpenResult(task.kind, task.record); setNotificationsOpen(false); }}>
            <span className={`ax-reminder-dot ${overdue ? "is-overdue" : today ? "is-today" : ""}`}/><span><strong>{task.title}</strong><small>{task.category} · {overdue ? "Overdue" : today ? "Due today" : "Upcoming"} · {task.date}{task.time ? " · " + task.time : ""}</small></span>
          </button>) : <div className="ax-command-empty">No overdue or upcoming reminders in the next seven days.</div>}
          <button type="button" className="ax-command-footer" onClick={() => { setNotificationsOpen(false); props.onOpenHistory(); }}>Open activity history <History size={14}/></button>
        </div>}
      </div>
      <button type="button" className="icon-button ax-help-button" aria-label="Help and onboarding" onClick={() => setHelpOpen(value => !value)} aria-expanded={helpOpen}><CircleHelp size={19}/></button>
      {helpOpen && <div className="ax-command-dropdown ax-help-menu">
        <div className="ax-command-heading"><strong>AXIVESTRA help</strong><button type="button" onClick={() => setHelpOpen(false)} aria-label="Close help"><X size={14}/></button></div>
        <p><b>Universal search</b> finds properties, contacts, tasks, transactions, documents, risks, approvals and WhatsApp groups. Use <kbd>Ctrl K</kbd>.</p>
        <p><b>Quick add</b> opens the most-used entry forms from anywhere in the workspace.</p>
        <p><b>Reminders</b> groups overdue and upcoming tasks. Keep the app open for in-app updates.</p>
        <p><b>Activity history</b> records changes and provides a safe undo for recent local changes.</p>
        <button type="button" className="ax-command-footer" onClick={() => { setHelpOpen(false); props.onOpenHistory(); }}>View activity history <History size={14}/></button>
      </div>}
    </div>
    {searchOpen && props.search.trim().length >= 2 && <button type="button" className="ax-command-dismiss" aria-label="Close search results" onClick={() => setSearchOpen(false)}/>}
    {onboardingOpen && <div className="ax-onboarding-card">
      <div className="ax-onboarding-card__icon"><CheckCircle2 size={18}/></div>
      <div><strong>Welcome to AXIVESTRA</strong><p>Start with a property or deal, connect contacts, add follow-up tasks, then track documents, money, risks and approvals from the same workspace.</p><span>Tip: use Ctrl+K for universal search and Quick add to enter records faster.</span></div>
      <button type="button" onClick={dismissOnboarding} aria-label="Dismiss onboarding"><X size={15}/></button>
    </div>}
  </div>;
}
