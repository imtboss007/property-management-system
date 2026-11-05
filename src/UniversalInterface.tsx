import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Bell, CheckCircle2, ChevronRight, Clock3, Command, Plus, Search, Star, X } from "lucide-react";

export type UniversalEntity = {
  id: string;
  kind: string;
  title: string;
  section: string;
  subtitle?: string;
  details?: Array<{ label: string; value: string }>;
};

export type UniversalNotice = {
  id: string;
  title: string;
  description: string;
  count: number;
  section: string;
};

export type QuickAddAction = "property" | "contact" | "followup" | "task" | "transaction" | "risk" | "approval";

type Props = {
  activeSection: string;
  sections: string[];
  entities: UniversalEntity[];
  notifications: UniversalNotice[];
  onNavigate: (section: string, query?: string) => void;
  onQuickAdd: (action: QuickAddAction) => void;
};

const quickActions: Array<{ id: QuickAddAction; label: string; description: string }> = [
  { id: "property", label: "New property / deal", description: "Create an asset or opportunity" },
  { id: "contact", label: "New contact", description: "Add a person or organisation" },
  { id: "followup", label: "Add follow-up", description: "Create a dated follow-up action" },
  { id: "task", label: "Schedule task", description: "Add a reminder or work item" },
  { id: "transaction", label: "Add transaction", description: "Record a financial movement" },
  { id: "risk", label: "Log risk", description: "Record an asset or deal risk" },
  { id: "approval", label: "Request approval", description: "Submit a decision for review" }
];

export default function UniversalInterface({ activeSection, sections, entities, notifications, onNavigate, onQuickAdd }: Props) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<UniversalEntity | null>(null);
  const [pinned, setPinned] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("axivestra.pinned-workspaces.v1") || "[]") as string[]; }
    catch { return []; }
  });

  useEffect(() => {
    try { localStorage.setItem("axivestra.pinned-workspaces.v1", JSON.stringify(pinned)); } catch { /* private mode */ }
  }, [pinned]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
        setActionOpen(false);
        setNotificationOpen(false);
        setSelected(null);
        setQuery("");
      }
      if (event.key === "Escape") {
        setPaletteOpen(false);
        setActionOpen(false);
        setNotificationOpen(false);
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const term = query.trim().toLocaleLowerCase();
  const results = useMemo(() => entities.filter(entity => !term || [entity.title, entity.kind, entity.subtitle, ...(entity.details || []).map(detail => detail.value)].filter(Boolean).join(" ").toLocaleLowerCase().includes(term)).slice(0, 12), [entities, term]);
  const matchingSections = useMemo(() => sections.filter(section => !term || section.toLocaleLowerCase().includes(term)).slice(0, 8), [sections, term]);
  const activeNotices = notifications.filter(item => item.count > 0);
  const totalAlerts = activeNotices.reduce((sum, item) => sum + item.count, 0);
  const isPinned = pinned.includes(activeSection);

  const closePalette = () => { setPaletteOpen(false); setSelected(null); setQuery(""); };
  const chooseEntity = (entity: UniversalEntity) => setSelected(entity);
  const navigate = (section: string, search?: string) => {
    onNavigate(section, search);
    closePalette();
    setActionOpen(false);
    setNotificationOpen(false);
  };
  const runAction = (id: QuickAddAction) => {
    onQuickAdd(id);
    setActionOpen(false);
    setNotificationOpen(false);
    closePalette();
  };
  const togglePin = () => setPinned(current => isPinned ? current.filter(item => item !== activeSection) : [...current, activeSection].slice(-8));

  return <div className="ax-universal-controls">
    <button type="button" className="ax-universal-command" onClick={() => { setPaletteOpen(true); setQuery(""); setSelected(null); }} aria-label="Open universal search and command palette">
      <Command size={15}/><span>Command</span><kbd>Ctrl K</kbd>
    </button>
    {pinned.length > 0 && <div className="ax-universal-pinned" aria-label="Pinned workspaces">
      {pinned.map(section => <button type="button" key={section} onClick={() => navigate(section)} title={"Open pinned workspace: "+section}>{section}</button>)}
    </div>}
    <div className="ax-universal-popover-anchor">
      <button type="button" className="ax-universal-plus" onClick={() => { setActionOpen(open => !open); setNotificationOpen(false); }} aria-label="Create new item"><Plus size={18}/><span>New</span></button>
      {actionOpen && <div className="ax-universal-popover ax-universal-action-menu">
        <div className="ax-universal-popover-title">CREATE ANYWHERE</div>
        {quickActions.map(action => <button type="button" key={action.id} onClick={() => runAction(action.id)}><span className="ax-universal-action-icon"><Plus size={15}/></span><span><strong>{action.label}</strong><small>{action.description}</small></span><ChevronRight size={14}/></button>)}
      </div>}
    </div>
    <div className="ax-universal-popover-anchor">
      <button type="button" className={"ax-universal-bell"+(totalAlerts ? " has-alerts" : "")} onClick={() => { setNotificationOpen(open => !open); setActionOpen(false); }} aria-label={totalAlerts ? totalAlerts+" pending notifications" : "Notifications"}><Bell size={18}/>{totalAlerts > 0 && <i>{totalAlerts > 99 ? "99+" : totalAlerts}</i>}</button>
      {notificationOpen && <div className="ax-universal-popover ax-universal-notifications">
        <div className="ax-universal-popover-title">ACTION CENTRE <span>{totalAlerts} pending</span></div>
        {activeNotices.length ? activeNotices.map(item => <button type="button" key={item.id} onClick={() => navigate(item.section)}><span className="ax-universal-notice-count">{item.count}</span><span><strong>{item.title}</strong><small>{item.description}</small></span><ChevronRight size={14}/></button>) : <p className="ax-universal-empty"><CheckCircle2 size={16}/> No pending alerts in this workspace.</p>}
        <button type="button" className="ax-universal-open-registry" onClick={() => navigate("Follow-up Registry")}>Open action registry <ArrowUpRight size={14}/></button>
      </div>}
    </div>

    {paletteOpen && <div className="ax-universal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) closePalette(); }}>
      <section className="ax-universal-palette" role="dialog" aria-modal="true" aria-label="Universal search and command palette">
        <div className="ax-universal-searchline"><Search size={19}/><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Search properties, people, tasks, documents or commands…" /><kbd>ESC</kbd><button type="button" onClick={closePalette} aria-label="Close search"><X size={18}/></button></div>
        {selected ? <div className="ax-universal-detail">
          <div className="ax-universal-detail-kicker">{selected.kind.toUpperCase()} · RECORD PREVIEW</div>
          <h2>{selected.title}</h2><p>{selected.subtitle || "No additional summary captured."}</p>
          <div className="ax-universal-detail-grid">{(selected.details || []).filter(detail => detail.value).map(detail => <div key={detail.label}><span>{detail.label}</span><strong>{detail.value}</strong></div>)}</div>
          <div className="ax-universal-detail-actions"><button type="button" className="ax-universal-back" onClick={() => setSelected(null)}>Back to results</button><button type="button" className="ax-universal-open" onClick={() => navigate(selected.section, selected.title)}>Open in workspace <ArrowUpRight size={15}/></button></div>
        </div> : <div className="ax-universal-palette-body">
          {!term && <div className="ax-universal-results-group"><div className="ax-universal-group-label">QUICK ACTIONS</div><div className="ax-universal-shortcuts">{quickActions.slice(0,4).map(action => <button type="button" key={action.id} onClick={() => runAction(action.id)}><Plus size={14}/>{action.label}</button>)}</div></div>}
          {matchingSections.length > 0 && <div className="ax-universal-results-group"><div className="ax-universal-group-label">WORKSPACES</div>{matchingSections.map(section => <button type="button" className="ax-universal-result" key={section} onClick={() => navigate(section)}><span className="ax-universal-result-icon"><Command size={15}/></span><span><strong>{section}</strong><small>Open workspace</small></span><ArrowUpRight size={14}/></button>)}</div>}
          {results.length > 0 && <div className="ax-universal-results-group"><div className="ax-universal-group-label">RECORDS <span>{results.length} shown</span></div>{results.map(entity => <button type="button" className="ax-universal-result" key={entity.kind+":"+entity.id} onClick={() => chooseEntity(entity)}><span className="ax-universal-result-icon"><Search size={15}/></span><span><strong>{entity.title}</strong><small>{entity.kind}{entity.subtitle ? " · "+entity.subtitle : ""}</small></span><ChevronRight size={14}/></button>)}</div>}
          {term && !results.length && !matchingSections.length && <div className="ax-universal-empty-state">No matching records or workspaces. Try another name, phone number, location or keyword.</div>}
        </div>}
        <footer className="ax-universal-palette-footer"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate by touch or keyboard</span><span><kbd>ENTER</kbd> Select</span><span>Universal workspace search</span></footer>
      </section>
    </div>}

    <button type="button" className={"ax-universal-pin"+(isPinned?" active":"")} onClick={togglePin} aria-label={isPinned ? "Unpin current workspace" : "Pin current workspace"} title={isPinned ? "Unpin this workspace" : "Pin this workspace"}><Star size={17} fill={isPinned ? "currentColor" : "none"}/></button>
  </div>;
}
