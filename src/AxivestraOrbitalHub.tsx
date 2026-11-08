import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowUpRight, CalendarClock, ClipboardCheck, Coins, Command, Grid3X3, Link2, Layers3, Orbit, Pause, Play, Search, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import type { ReactNode } from "react";

export type AxivestraOrbitalItem = {
  name: string;
  group: string;
  count: number;
  color: string;
  icon: ReactNode;
};

type ModuleDetailRecord = {
  id: string;
  title: string;
  status: string;
  value: string;
  location: string;
  contact: string;
  nextAction: string;
  nextFollowUpDate: string;
  fieldValues: { label: string; value: string }[];
};
type ModuleDetail = {
  name: string;
  group: string;
  description: string;
  fields: { key: string; label: string }[];
  records: ModuleDetailRecord[];
  contacts: { id: string; name: string; role: string; phone: string }[];
  tasks: { id: string; title: string; date: string; done: boolean; type: string }[];
  financials: { id: string; type: string; amount: string; date: string; party: string }[];
  risks: { id: string; title: string; severity: string; status: string; dueDate: string }[];
  approvals: { id: string; title: string; status: string; priority: string }[];
};

type AxivestraOrbitalHubProps = {
  items: AxivestraOrbitalItem[];
  details: ModuleDetail[];
  totalRecords: number;
  portfolioValue: number;
  openActions: number;
  activeModules: number;
  onOpen: (name: string) => void;
};

const formatINR = (value: number) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
}).format(Number.isFinite(value) ? value : 0);

export default function AxivestraOrbitalHub({
  items,
  details,
  totalRecords,
  portfolioValue,
  openActions,
  activeModules,
  onOpen,
}: AxivestraOrbitalHubProps) {
  const [focused, setFocused] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [rotationPaused, setRotationPaused] = useState(false);
  const [viewMode, setViewMode] = useState<"orbit" | "grid">("orbit");
  const [selectedGroup, setSelectedGroup] = useState("All");
  const [moduleSearch, setModuleSearch] = useState("");
  const [inspectedModule, setInspectedModule] = useState<string | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (openTimer.current) clearTimeout(openTimer.current); }, []);
  const openWorkspace = (name: string) => {
    setFocused(name);
    setZoomed(true);
    if (openTimer.current) clearTimeout(openTimer.current);
    openTimer.current = setTimeout(() => {
      setZoomed(false);
      onOpen(name);
    }, 620);
  };

  const visibleOrbitItems = useMemo(() => {
    const query = moduleSearch.trim().toLocaleLowerCase();
    const filtered = items
      .map((item, sourceIndex) => ({ ...item, sourceIndex }))
      .filter(item => selectedGroup === "All" || item.group === selectedGroup)
      .filter(item => !query || `${item.name} ${item.group}`.toLocaleLowerCase().includes(query));

    const outerCount = Math.ceil(filtered.length / 2);
    return filtered.map((item, index) => {
      const ring = index < outerCount ? 0 : 1;
      const position = ring === 0 ? index : index - outerCount;
      const countInRing = ring === 0 ? outerCount : filtered.length - outerCount;
      const angle = (-Math.PI / 2) + (Math.PI * 2 * position / Math.max(1, countInRing)) + (ring ? Math.PI / Math.max(1, countInRing) : 0);
      const radiusX = ring === 0 ? 43 : 30;
      const radiusY = ring === 0 ? 38 : 26;
      const xPercent = 50 + Math.cos(angle) * radiusX;
      const yPercent = 50 + Math.sin(angle) * radiusY;
      return {
        ...item,
        ringName: ring === 0 ? "outer" : "inner",
        xPercent,
        yPercent,
        style: {
          left: `calc(${xPercent}%)`,
          top: `calc(${yPercent}%)`,
        },
        number: String(item.sourceIndex + 1).padStart(2, "0"),
      };
    });
  }, [items, moduleSearch, selectedGroup]);

  const routePaths = useMemo(() => {
    const buildPath = (ring: "outer" | "inner") => {
      const points = visibleOrbitItems.filter(item => item.ringName === ring);
      if (points.length < 2) return "";
      return points
        .map((item, index) => `${index === 0 ? "M" : "L"} ${(item.xPercent * 10).toFixed(2)} ${(item.yPercent * 10).toFixed(2)}`)
        .join(" ") + " Z";
    };
    return { outer: buildPath("outer"), inner: buildPath("inner") };
  }, [visibleOrbitItems]);

  const groupSummaries = useMemo(() => {
    const summary = new Map<string, { modules: number; records: number }>();
    for (const item of items) {
      const current = summary.get(item.group) || { modules: 0, records: 0 };
      current.modules += 1;
      current.records += Math.max(0, Number.isFinite(item.count) ? item.count : 0);
      summary.set(item.group, current);
    }
    return Array.from(summary, ([name, value]) => ({ name, ...value }))
      .sort((a, b) => b.records - a.records || a.name.localeCompare(b.name));
  }, [items]);

  const selectedItem = visibleOrbitItems.find(item => item.name === focused);\n  const inspectedDetail = details.find(item => item.name === inspectedModule) || null;
  const safeCount = items.length;

  return (
    <section className={`ax-orbit-hub${rotationPaused ? " is-rotation-paused" : ""}${viewMode === "grid" ? " is-grid-view" : " is-orbit-view"}`} aria-label="AXIVESTRA orbital workspace navigation">
      <div className="ax-orbit-hub__heading">
        <div>
          <span className="ax-orbit-kicker"><span className="ax-orbit-live" /> AXIVESTRA · RELATIONSHIP INTELLIGENCE GRID</span>
          <h2>Command your connected workspaces.</h2>
          <p>Choose an orbit to open the live workspace. Each node is linked to your existing AXIVESTRA records.</p>
        </div>
        <div className="ax-orbit-shortcuts">
          <button type="button" className="ax-orbit-shortcut ax-orbit-motion-toggle" aria-pressed={rotationPaused} onClick={() => setRotationPaused(value => !value)}>
            {rotationPaused ? <Play size={14} /> : <Pause size={14} />}
            {rotationPaused ? "Resume rotation" : "Pause rotation"}
          </button>
          <button type="button" className="ax-orbit-shortcut" onClick={() => onOpen("Intelligence Hub")}><Sparkles size={14}/> Intelligence Hub</button>
          <button type="button" className="ax-orbit-shortcut" onClick={() => onOpen("AXIVESTRA Shift")}><Activity size={14}/> AXIVESTRA Shift</button>
          <button type="button" className="ax-orbit-all" onClick={() => onOpen("All Properties")}>Open all records <ArrowUpRight size={15}/></button>
        </div>
      </div>

      <div className="ax-orbit-controls">
        <div className="ax-orbit-view-switch" role="group" aria-label="Workspace view">
          <button type="button" className={viewMode === "orbit" ? "is-active" : ""} aria-pressed={viewMode === "orbit"} onClick={() => setViewMode("orbit")}>
            <Orbit size={14} /> Orbit
          </button>
          <button type="button" className={viewMode === "grid" ? "is-active" : ""} aria-pressed={viewMode === "grid"} onClick={() => setViewMode("grid")}>
            <Grid3X3 size={14} /> Grid
          </button>
        </div>
        <label className="ax-orbit-search">
          <Search size={14} aria-hidden="true" />
          <input type="search" value={moduleSearch} onChange={event => setModuleSearch(event.target.value)} placeholder="Search workspaces or groups…" aria-label="Search workspaces or groups" />
          {moduleSearch && <button type="button" onClick={() => setModuleSearch("")} aria-label="Clear workspace search"><X size={13} /></button>}
          <span>{visibleOrbitItems.length}/{safeCount}</span>
        </label>
      </div>

      <div className="ax-orbit-group-filters" role="group" aria-label="Filter workspaces by group">
        <button type="button" className={selectedGroup === "All" ? "is-active" : ""} aria-pressed={selectedGroup === "All"} onClick={() => setSelectedGroup("All")}>All groups</button>
        {groupSummaries.map(group => (
          <button type="button" key={group.name} className={selectedGroup === group.name ? "is-active" : ""} aria-pressed={selectedGroup === group.name} onClick={() => setSelectedGroup(group.name)}>
            {group.name} <span>{group.modules}</span>
          </button>
        ))}
      </div>

      <div className="ax-orbit-stage">
        <div className="ax-orbit-halo ax-orbit-halo--one" aria-hidden="true" />
        <div className="ax-orbit-halo ax-orbit-halo--two" aria-hidden="true" />
        <div className="ax-orbit-track ax-orbit-track--outer" aria-hidden="true" />
        <div className="ax-orbit-track ax-orbit-track--middle" aria-hidden="true" />
        <div className="ax-orbit-track ax-orbit-track--inner" aria-hidden="true" />
        <div className="ax-orbit-axis ax-orbit-axis--horizontal" aria-hidden="true" />
        <div className="ax-orbit-axis ax-orbit-axis--vertical" aria-hidden="true" />

        <svg className="ax-orbit-routes" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <marker id="ax-orbit-route-arrow-outer" viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="5" markerHeight="5" orient="auto" markerUnits="strokeWidth">
              <path d="M 0 0 L 8 4 L 0 8 z" />
            </marker>
            <marker id="ax-orbit-route-arrow-inner" viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="5" markerHeight="5" orient="auto" markerUnits="strokeWidth">
              <path d="M 0 0 L 8 4 L 0 8 z" />
            </marker>
          </defs>
          {(["outer", "inner"] as const).map(ring => (
            <g className={`ax-orbit-route-ring ax-orbit-route-ring--${ring}`} key={ring}>
              <path className="ax-orbit-route-path" d={routePaths[ring]} markerMid={`url(#ax-orbit-route-arrow-${ring})`} markerEnd={`url(#ax-orbit-route-arrow-${ring})`} />
              {visibleOrbitItems.filter(item => item.ringName === ring).map(item => (
                <path
                  className="ax-orbit-spoke"
                  key={item.name}
                  d={`M 500 500 L ${(item.xPercent * 10).toFixed(2)} ${(item.yPercent * 10).toFixed(2)}`}
                  markerEnd={`url(#ax-orbit-route-arrow-${ring})`}
                />
              ))}
            </g>
          ))}
        </svg>

        <div
          className={"ax-orbit-core" + (zoomed ? " is-zoomed" : "")}
          role="button"
          tabIndex={0}
          aria-label="Zoom the AXIVESTRA intelligence sphere"
          aria-pressed={zoomed}
          onClick={() => setZoomed(value => !value)}
          onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setZoomed(value => !value); } }}
        >
          <div className="ax-orbit-core__aura" />
          <div className="ax-orbit-core__sphere">
            <div className="ax-orbit-core__latitude ax-orbit-core__latitude--one" />
            <div className="ax-orbit-core__latitude ax-orbit-core__latitude--two" />
            <div className="ax-orbit-core__longitude" />
            <div className="ax-orbit-core__continent" />
            <div className="ax-orbit-core__shine" />
            <div className="ax-orbit-core__mark"><Command size={22} strokeWidth={1.6} /></div>
          </div>
          <div className="ax-orbit-core__caption">ASSET INTELLIGENCE</div>
          <div className="ax-orbit-core__status"><span /> SYSTEM LINKED</div>
          <div className="ax-orbit-core__focus" aria-live="polite">
            {selectedItem ? selectedItem.name : "ONE CONNECTED SYSTEM"}
          </div>
        </div>

        <div className="ax-orbit-nodes" aria-label="Selectable workspace orbits">
          {(["outer", "inner"] as const).map(ring => (
            <div className={`ax-orbit-ring ax-orbit-ring--${ring}`} key={ring}>
              {visibleOrbitItems.filter(item => item.ringName === ring).map(item => (
                <div className="ax-orbit-node-slot" style={item.style} key={item.name}>
                  <div className={`ax-orbit-node-counter ax-orbit-node-counter--${ring}`}>
                    <button
                      type="button"
                      className={`ax-orbit-node ax-orbit-node--${item.color}${focused === item.name ? " is-focused" : ""}`}
                      onMouseEnter={() => setFocused(item.name)}
                      onFocus={() => setFocused(item.name)}
                      onBlur={() => setFocused(null)}
                      onClick={() => { setFocused(item.name); setInspectedModule(item.name); }}
                      aria-label={`Open ${item.name}, ${item.count} records`}
                    >
                      <span className="ax-orbit-node__icon">{item.icon}</span>
                      <span className="ax-orbit-node__copy">
                        <small>{item.number} · {item.group}</small>
                        <strong>{item.name}</strong>
                        <em>{item.count} {item.count === 1 ? "record" : "records"}</em>
                      </span>
                      <ArrowUpRight className="ax-orbit-node__arrow" size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
          {visibleOrbitItems.length === 0 && (
            <div className="ax-orbit-empty-state" role="status">
              <Search size={18} />
              <strong>No workspaces match this filter.</strong>
              <span>Change the group or clear your search.</span>
            </div>
          )}
        </div>
      </div>

      {inspectedDetail && (
        <section className="ax-orbit-detail" aria-label={inspectedDetail.name + " module details"}>
          <div className="ax-orbit-detail__header">
            <div>
              <span className="ax-orbit-detail__eyebrow">{inspectedDetail.group} · MODULE INTELLIGENCE</span>
              <h3>{inspectedDetail.name}</h3>
              <p>{inspectedDetail.description}</p>
            </div>
            <button type="button" className="ax-orbit-detail__close" onClick={() => setInspectedModule(null)} aria-label="Close module details"><X size={16}/></button>
          </div>

          <div className="ax-orbit-detail__metrics">
            <article><span>SAVED RECORDS</span><strong>{inspectedDetail.records.length}</strong></article>
            <article><span>OPEN WORKSTREAMS</span><strong>{inspectedDetail.records.filter(record => !["completed","closed","settled","rejected","cancelled"].includes(record.status.toLowerCase())).length}</strong></article>
            <article><span>FOLLOW-UPS SET</span><strong>{inspectedDetail.records.filter(record => record.nextFollowUpDate).length}</strong></article>
            <article><span>CONNECTED CONTACTS</span><strong>{inspectedDetail.contacts.length}</strong></article>
            <article><span>RECORDED VALUE</span><strong>{formatINR(inspectedDetail.records.reduce((sum, record) => sum + (Number(String(record.value).replace(/[^0-9.-]/g, "")) || 0), 0))}</strong></article>
          </div>

          <div className="ax-orbit-detail__body">
            <div className="ax-orbit-detail__main">
              <div className="ax-orbit-detail__section-head"><div><span>LIVE REGISTER</span><h4>Saved records</h4></div><small>{inspectedDetail.records.length} total</small></div>
              {inspectedDetail.records.length ? (
                <div className="ax-orbit-detail__records">
                  {inspectedDetail.records.slice(0, 4).map(record => (
                    <article className="ax-orbit-detail-record" key={record.id}>
                      <div className="ax-orbit-detail-record__top">
                        <div><strong>{record.title}</strong><small>{record.location || "Location not recorded"}</small></div>
                        <span className="ax-orbit-detail-record__status">{record.status || "Unspecified"}</span>
                      </div>
                      <div className="ax-orbit-detail-record__meta">
                        {record.value && <span><Coins size={12}/>{record.value}</span>}
                        {record.contact && <span><Users size={12}/>{record.contact}</span>}
                        {record.nextFollowUpDate && <span><CalendarClock size={12}/>{record.nextFollowUpDate}</span>}
                      </div>
                      {record.nextAction && <p className="ax-orbit-detail-record__action"><b>Next:</b> {record.nextAction}</p>}
                      {record.fieldValues.length > 0 && (
                        <div className="ax-orbit-detail-record__fields">
                          {record.fieldValues.slice(0, 4).map(field => <span key={field.label}><small>{field.label}</small><strong>{field.value}</strong></span>)}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              ) : <p className="ax-orbit-detail__empty">No saved records in this module yet. The configured fields are ready when you create its first record.</p>}

              <div className="ax-orbit-detail__section-head ax-orbit-detail__section-head--sub"><div><span>CONFIGURED DATA MODEL</span><h4>Subcategories & fields</h4></div><small>{inspectedDetail.fields.length} fields</small></div>
              <div className="ax-orbit-detail__field-list">
                {inspectedDetail.fields.length ? inspectedDetail.fields.map(field => <span key={field.key}>{field.label}</span>) : <span>Core record fields</span>}
              </div>
            </div>

            <aside className="ax-orbit-detail__side">
              <section className="ax-orbit-detail__related">
                <div className="ax-orbit-detail__section-head"><div><span>RELATIONSHIP GRAPH</span><h4>Linked contacts</h4></div><small>{inspectedDetail.contacts.length}</small></div>
                {inspectedDetail.contacts.length ? inspectedDetail.contacts.slice(0, 5).map(contact => (
                  <div className="ax-orbit-detail-contact" key={contact.id}>
                    <span className="ax-orbit-detail-contact__avatar">{contact.name.slice(0,1).toUpperCase()}</span>
                    <div><strong>{contact.name}</strong><small>{contact.role || "Contact"}{contact.phone ? " · " + contact.phone : ""}</small></div>
                  </div>
                )) : <p className="ax-orbit-detail__empty">No linked contacts in saved module records.</p>}
                <button type="button" className="ax-orbit-detail__text-action" onClick={() => onOpen("Contacts")}>Open contact directory <ArrowUpRight size={13}/></button>
              </section>

              <section className="ax-orbit-detail__related">
                <div className="ax-orbit-detail__section-head"><div><span>CONNECTED WORKFLOWS</span><h4>Operational links</h4></div></div>
                {[
                  {label:"Scheduled tasks",count:inspectedDetail.tasks.filter(task=>!task.done).length,icon:<CalendarClock size={14}/>,target:"Schedule & Tasks"},
                  {label:"Financial entries",count:inspectedDetail.financials.length,icon:<Coins size={14}/>,target:"Financials"},
                  {label:"Risk items",count:inspectedDetail.risks.length,icon:<ShieldCheck size={14}/>,target:"Risk & Compliance"},
                  {label:"Approvals",count:inspectedDetail.approvals.length,icon:<ClipboardCheck size={14}/>,target:"Approvals"}
                ].map(workflow => (
                  <button type="button" className="ax-orbit-detail-workflow" key={workflow.target} onClick={() => onOpen(workflow.target)}>
                    <span>{workflow.icon}<b>{workflow.label}</b></span><strong>{workflow.count}</strong><ArrowUpRight size={12}/>
                  </button>
                ))}
              </section>

              <section className="ax-orbit-detail__related">
                <div className="ax-orbit-detail__section-head"><div><span>LIVE LINKED ITEMS</span><h4>Recent workflow activity</h4></div></div>
                {inspectedDetail.tasks.slice(0, 2).map(task => (
                  <div className="ax-orbit-detail-activity" key={"task-" + task.id}>
                    <span className="ax-orbit-detail-activity__kind">TASK</span>
                    <div><strong>{task.title}</strong><small>{task.date || "No date"} · {task.done ? "Completed" : "Open"}</small></div>
                  </div>
                ))}
                {inspectedDetail.financials.slice(0, 2).map(entry => (
                  <div className="ax-orbit-detail-activity" key={"financial-" + entry.id}>
                    <span className="ax-orbit-detail-activity__kind">FINANCE</span>
                    <div><strong>{entry.type} · {entry.amount}</strong><small>{entry.date || "No date"}{entry.party ? " · " + entry.party : ""}</small></div>
                  </div>
                ))}
                {inspectedDetail.risks.slice(0, 2).map(risk => (
                  <div className="ax-orbit-detail-activity" key={"risk-" + risk.id}>
                    <span className="ax-orbit-detail-activity__kind">RISK</span>
                    <div><strong>{risk.title}</strong><small>{risk.severity} · {risk.status}{risk.dueDate ? " · Due " + risk.dueDate : ""}</small></div>
                  </div>
                ))}
                {inspectedDetail.approvals.slice(0, 2).map(approval => (
                  <div className="ax-orbit-detail-activity" key={"approval-" + approval.id}>
                    <span className="ax-orbit-detail-activity__kind">APPROVAL</span>
                    <div><strong>{approval.title}</strong><small>{approval.priority} · {approval.status}</small></div>
                  </div>
                ))}
                {!inspectedDetail.tasks.length && !inspectedDetail.financials.length && !inspectedDetail.risks.length && !inspectedDetail.approvals.length && (
                  <p className="ax-orbit-detail__empty">No linked task, financial, risk or approval entries are saved for this module yet.</p>
                )}
              </section>
            </aside>
          </div>

          <div className="ax-orbit-detail__footer">
            <span><Link2 size={13}/> Detail view uses records already saved in AXIVESTRA.</span>
            <button type="button" onClick={() => openWorkspace(inspectedDetail.name)}>Open full workspace <ArrowUpRight size={14}/></button>
          </div>
        </section>
      )}

      <div className="ax-orbit-metrics">
        <div className="ax-orbit-metric">
          <span className="ax-orbit-metric__icon"><Layers3 size={16} /></span>
          <span><small>LIVE RECORDS</small><strong>{totalRecords.toLocaleString("en-IN")}</strong></span>
        </div>
        <div className="ax-orbit-metric">
          <span className="ax-orbit-metric__icon"><Activity size={16} /></span>
          <span><small>ACTIVE WORKSPACES</small><strong>{activeModules} / {safeCount}</strong></span>
        </div>
        <div className="ax-orbit-metric">
          <span className="ax-orbit-metric__icon"><Sparkles size={16} /></span>
          <span><small>OPEN ACTIONS</small><strong>{openActions.toLocaleString("en-IN")}</strong></span>
        </div>
        <div className="ax-orbit-metric ax-orbit-metric--value">
          <span><small>RECORDED VALUE / EXPOSURE</small><strong>{formatINR(portfolioValue)}</strong></span>
        </div>
      </div>
      <section className="ax-orbit-distribution" aria-label="Live workspace distribution">
        <div className="ax-orbit-distribution__heading">
          <div>
            <span>LIVE WORKSPACE BREAKDOWN</span>
            <h3>Records across intelligence groups</h3>
          </div>
          <small>{groupSummaries.length} groups · {safeCount} workspaces</small>
        </div>
        {groupSummaries.length > 0 ? (
          <div className="ax-orbit-distribution__grid">
            {groupSummaries.map(group => {
              const share = totalRecords > 0 ? Math.min(100, (group.records / totalRecords) * 100) : 0;
              return (
                <article className="ax-orbit-distribution-card" key={group.name}>
                  <div className="ax-orbit-distribution-card__top">
                    <strong>{group.name}</strong>
                    <span>{group.modules} {group.modules === 1 ? "workspace" : "workspaces"}</span>
                  </div>
                  <div className="ax-orbit-distribution-card__value">{group.records.toLocaleString("en-IN")} <small>records</small></div>
                  <div className="ax-orbit-distribution-card__bar" role="progressbar" aria-label={`${group.name} share of records`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share)}>
                    <span style={{ width: `${share}%` }} />
                  </div>
                  <small className="ax-orbit-distribution-card__share">{share.toFixed(1)}% of saved records</small>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="ax-orbit-distribution__empty">Workspace group totals will appear when modules are available.</p>
        )}
      </section>
      <p className="ax-orbit-footnote">Live totals are calculated from records currently saved in this workspace. No sample data or estimated valuations are added.</p>
    </section>
  );
}
