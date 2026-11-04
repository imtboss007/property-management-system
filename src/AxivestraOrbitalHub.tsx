import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowUpRight, Command, Layers3, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

export type AxivestraOrbitalItem = {
  name: string;
  group: string;
  count: number;
  color: string;
  icon: ReactNode;
};

type AxivestraOrbitalHubProps = {
  items: AxivestraOrbitalItem[];
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
  totalRecords,
  portfolioValue,
  openActions,
  activeModules,
  onOpen,
}: AxivestraOrbitalHubProps) {
  const [focused, setFocused] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
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

  const orbitItems = useMemo(() => items.map((item, index) => {
    const ring = index < 8 ? 0 : 1;
    const position = index % 8;
    const angle = (-Math.PI / 2) + (Math.PI * 2 * position / 8) + (ring ? Math.PI / 8 : 0);
    const radiusX = ring === 0 ? 43 : 30;
    const radiusY = ring === 0 ? 38 : 26;
    return {
      ...item,
      style: {
        left: `calc(50% + ${Math.cos(angle) * radiusX}%)`,
        top: `calc(50% + ${Math.sin(angle) * radiusY}%)`,
      },
      number: String(index + 1).padStart(2, "0"),
    };
  }), [items]);

  const selectedItem = items.find(item => item.name === focused);
  const safeCount = items.length;

  return (
    <section className="ax-orbit-hub" aria-label="AXIVESTRA orbital workspace navigation">
      <div className="ax-orbit-hub__heading">
        <div>
          <span className="ax-orbit-kicker"><span className="ax-orbit-live" /> AXIVESTRA · RELATIONSHIP INTELLIGENCE GRID</span>
          <h2>Command your connected workspaces.</h2>
          <p>Choose an orbit to open the live workspace. Each node is linked to your existing AXIVESTRA records.</p>
        </div>
        <div className="ax-orbit-shortcuts">
          <button type="button" className="ax-orbit-shortcut" onClick={() => onOpen("Intelligence Hub")}><Sparkles size={14}/> Intelligence Hub</button>
          <button type="button" className="ax-orbit-shortcut" onClick={() => onOpen("AXIVESTRA Shift")}><Activity size={14}/> AXIVESTRA Shift</button>
          <button type="button" className="ax-orbit-all" onClick={() => onOpen("All Properties")}>Open all records <ArrowUpRight size={15}/></button>
        </div>
      </div>

      <div className="ax-orbit-stage">
        <div className="ax-orbit-halo ax-orbit-halo--one" aria-hidden="true" />
        <div className="ax-orbit-halo ax-orbit-halo--two" aria-hidden="true" />
        <div className="ax-orbit-track ax-orbit-track--outer" aria-hidden="true" />
        <div className="ax-orbit-track ax-orbit-track--middle" aria-hidden="true" />
        <div className="ax-orbit-track ax-orbit-track--inner" aria-hidden="true" />
        <div className="ax-orbit-axis ax-orbit-axis--horizontal" aria-hidden="true" />
        <div className="ax-orbit-axis ax-orbit-axis--vertical" aria-hidden="true" />

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

        <div className="ax-orbit-nodes">
          {orbitItems.map(item => (
            <button
              type="button"
              key={item.name}
              className={`ax-orbit-node ax-orbit-node--${item.color}${focused === item.name ? " is-focused" : ""}`}
              style={item.style}
              onMouseEnter={() => setFocused(item.name)}
              onFocus={() => setFocused(item.name)}
              onBlur={() => setFocused(null)}
              onClick={() => openWorkspace(item.name)}
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
          ))}
        </div>
      </div>

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
          <span><small>RECORDED PORTFOLIO VALUE</small><strong>{formatINR(portfolioValue)}</strong></span>
        </div>
      </div>
      <p className="ax-orbit-footnote">Live totals are calculated from records currently saved in this workspace. No sample data or estimated valuations are added.</p>
    </section>
  );
}
