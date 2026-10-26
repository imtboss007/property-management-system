
import { useState } from "react";
import {
  Building2, LayoutDashboard, LandPlot, HandCoins, Handshake,
  Calculator, Wheat, Store, CalendarClock, MessageCircle,
  Users, FileText, Settings, Search, Bell, Plus, ArrowUpRight,
  Clock3, CheckCircle2, Menu, X
} from "lucide-react";

const modules = [
  { name: "Property Sale", icon: Building2, color: "mint" },
  { name: "Property Loans", icon: HandCoins, color: "blue" },
  { name: "JV / JDA / JD", icon: Handshake, color: "violet" },
  { name: "SR Rate Settlement", icon: Calculator, color: "amber" },
  { name: "Agricultural Land", icon: Wheat, color: "green" },
  { name: "Commercial Land", icon: Store, color: "rose" },
];

const navigation = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "All Properties", icon: LandPlot },
  { name: "Contacts", icon: Users },
  { name: "Documents", icon: FileText },
  { name: "Schedule & Tasks", icon: CalendarClock },
  { name: "WhatsApp Automation", icon: MessageCircle },
];

export default function App() {
  const [active, setActive] = useState("Overview");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [search, setSearch] = useState("");

  const filteredModules = modules.filter((module) =>
    module.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Building2 size={23} /></div>
          <div>
            <strong>EstateFlow</strong>
            <span>PROPERTY WORKSPACE</span>
          </div>
          <button className="mobile-close" onClick={() => setMobileMenu(false)}>
            <X size={19} />
          </button>
        </div>

        <div className="workspace-label">WORKSPACE</div>
        <nav className="nav-list">
          {navigation.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={`nav-item ${active === name ? "active" : ""}`}
              onClick={() => { setActive(name); setMobileMenu(false); }}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{name}</span>
              {name === "Schedule & Tasks" && <span className="nav-dot" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon"><Clock3 size={18} /></span>
            <strong>Stay ahead</strong>
            <p>Keep every deal and deadline in one place.</p>
          </div>
          <button className="nav-item" onClick={() => setActive("Settings")}>
            <Settings size={18} /> Settings
          </button>
          <div className="profile">
            <div className="avatar">EF</div>
            <div className="profile-text"><strong>My Workspace</strong><span>Property Manager</span></div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>

      {mobileMenu && <button className="scrim" onClick={() => setMobileMenu(false)} aria-label="Close menu" />}

      <section className="main-panel">
        <header className="topbar">
          <button className="menu-toggle" onClick={() => setMobileMenu(true)} aria-label="Open menu">
            <Menu size={21} />
          </button>
          <div className="breadcrumb">Workspace <span>/</span> <strong>{active}</strong></div>
          <div className="top-actions">
            <label className="search-box">
              <Search size={17} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search modules..." />
              <kbd>⌘ K</kbd>
            </label>
            <button className="icon-button" aria-label="Notifications"><Bell size={19} /><i /></button>
          </div>
        </header>

        <div className="content">
          <div className="welcome-row">
            <div>
              <div className="eyebrow"><span className="live-dot" /> YOUR PROPERTY COMMAND CENTRE</div>
              <h1>{active === "Overview" ? "Good things are in motion." : active}</h1>
              <p className="subtitle">
                {active === "Overview"
                  ? "Your properties, deals and follow-ups — thoughtfully organised."
                  : `Manage your ${active.toLowerCase()} in one connected workspace.`}
              </p>
            </div>
            <button className="primary-button" onClick={() => setActive("All Properties")}>
              <Plus size={17} /> New record
            </button>
          </div>

          <section className="hero-card">
            <div className="hero-copy">
              <span className="hero-label">A CLEARER WAY FORWARD</span>
              <h2>Every deal has a next step.<br />Never miss yours.</h2>
              <p>Bring property records, important dates and conversations together in one calm, organised space.</p>
              <button className="hero-button" onClick={() => setActive("Schedule & Tasks")}>
                View your schedule <ArrowUpRight size={16} />
              </button>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="building-shape">
                <div className="building-roof" />
                <div className="building-body">
                  <i /><i /><i /><i /><i /><i />
                </div>
              </div>
              <div className="floating-note"><CheckCircle2 size={16} /><span>One step at a time</span></div>
            </div>
          </section>

          <div className="section-heading">
            <div><h2>Property modules</h2><p>Six dedicated workspaces, one connected system.</p></div>
            <button className="text-button" onClick={() => setActive("All Properties")}>View all <ArrowUpRight size={15} /></button>
          </div>

          <div className="module-grid">
            {filteredModules.map(({ name, icon: Icon, color }, index) => (
              <button className="module-card" key={name} onClick={() => setActive(name)}>
                <div className={`module-icon ${color}`}><Icon size={21} strokeWidth={1.8} /></div>
                <div className="module-number">0{index + 1}</div>
                <h3>{name}</h3>
                <p>Manage records, contacts and next steps.</p>
                <span className="module-link">Open workspace <ArrowUpRight size={15} /></span>
              </button>
            ))}
          </div>

          <div className="bottom-grid">
            <section className="panel-card">
              <div className="panel-heading"><div><h2>Upcoming schedule</h2><p>Your next important dates.</p></div><CalendarClock size={20} /></div>
              <div className="empty-state">
                <div className="empty-icon"><CalendarClock size={22} /></div>
                <strong>Your timeline starts here</strong>
                <p>Schedule a one-time reminder for a meeting, payment, registration or follow-up.</p>
                <button className="secondary-button" onClick={() => setActive("Schedule & Tasks")}><Plus size={15} /> Create schedule</button>
              </div>
            </section>
            <section className="panel-card">
              <div className="panel-heading"><div><h2>WhatsApp follow-ups</h2><p>Conversations that need attention.</p></div><MessageCircle size={20} /></div>
              <div className="empty-state">
                <div className="empty-icon whatsapp"><MessageCircle size={22} /></div>
                <strong>Keep every conversation moving</strong>
                <p>Plan follow-ups and track replies once your WhatsApp integration is connected.</p>
                <button className="secondary-button" onClick={() => setActive("WhatsApp Automation")}><ArrowUpRight size={15} /> Open automation</button>
              </div>
            </section>
          </div>

          <footer className="footer"><span>EstateFlow © 2026</span><span>Designed for clarity. Built for action.</span></footer>
        </div>
      </section>
    </main>
  );
}
