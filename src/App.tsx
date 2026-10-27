import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { backendConfigured, supabase } from "./lib/supabase";
import {
  Building2, LayoutDashboard, LandPlot, HandCoins, Handshake, Calculator,
  Wheat, Store, CalendarClock, MessageCircle, Users, FileText, Settings,
  Search, Bell, Plus, ArrowUpRight, Clock3, CheckCircle2, Menu, X,
  Trash2, Phone, MapPin, CalendarDays, CircleCheck, ExternalLink
} from "lucide-react";

type PropertyRecord = {
  id: string; title: string; module: string; location: string; value: string;
  status: string; contact: string; notes: string; createdAt: string;
};
type ContactRecord = { id: string; name: string; phone: string; role: string; notes: string };
type TaskRecord = { id: string; title: string; date: string; time: string; type: string; property: string; notes: string; done: boolean };
type Section = "Overview" | "All Properties" | "Contacts" | "Documents" | "Schedule & Tasks" | "WhatsApp Automation" | "Settings" | string;

const modules = [
  { name: "Property Sale", icon: Building2, color: "mint" },
  { name: "Property Loans", icon: HandCoins, color: "blue" },
  { name: "JV / JDA / JD", icon: Handshake, color: "violet" },
  { name: "SR Rate Settlement", icon: Calculator, color: "amber" },
  { name: "Agricultural Land", icon: Wheat, color: "green" },
  { name: "Commercial Land", icon: Store, color: "rose" }
];
const navigation = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "All Properties", icon: LandPlot },
  { name: "Contacts", icon: Users },
  { name: "Documents", icon: FileText },
  { name: "Schedule & Tasks", icon: CalendarClock },
  { name: "WhatsApp Automation", icon: MessageCircle }
];
const uid = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, character => {
    const random = Math.random() * 16 | 0;
    return (character === "x" ? random : (random & 0x3 | 0x8)).toString(16);
  });
};
const load = <T,>(key: string, fallback: T): T => {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; }
  catch { return fallback; }
};

export default function App() {
  const [active, setActive] = useState<Section>("Overview");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [properties, setProperties] = useState<PropertyRecord[]>(() => load("estateflow.properties", []));
  const [contacts, setContacts] = useState<ContactRecord[]>(() => load("estateflow.contacts", []));
  const [tasks, setTasks] = useState<TaskRecord[]>(() => load("estateflow.tasks", []));
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [notice, setNotice] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(backendConfigured);
  const [remoteReady, setRemoteReady] = useState(!backendConfigured);
  const [authMode, setAuthMode] = useState<"signIn" | "signUp">("signIn");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [waPhone, setWaPhone] = useState("");
  const [waMessage, setWaMessage] = useState("Hello, following up on our property discussion. Please let me know when you are available.");

  const storageKey = (name: string) =>
    backendConfigured && session ? `estateflow.${session.user.id}.${name}` : `estateflow.${name}`;

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      setRemoteReady(true);
      return;
    }
    let alive = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) setAuthNotice(error.message);
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!alive) return;
      setSession(nextSession);
      setRemoteReady(!nextSession);
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (backendConfigured && (!session || !remoteReady)) return;
    localStorage.setItem(storageKey("properties"), JSON.stringify(properties));
  }, [properties, session?.user.id, remoteReady]);

  useEffect(() => {
    if (backendConfigured && (!session || !remoteReady)) return;
    localStorage.setItem(storageKey("contacts"), JSON.stringify(contacts));
  }, [contacts, session?.user.id, remoteReady]);

  useEffect(() => {
    if (backendConfigured && (!session || !remoteReady)) return;
    localStorage.setItem(storageKey("tasks"), JSON.stringify(tasks));
  }, [tasks, session?.user.id, remoteReady]);

  const filteredModules = modules.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));
  const filteredProperties = useMemo(() => properties.filter(p =>
    `${p.title} ${p.module} ${p.location} ${p.contact} ${p.status}`.toLowerCase().includes(search.toLowerCase())
  ), [properties, search]);
  const upcomingTasks = tasks.filter(t => !t.done).sort((a,b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const today = new Date().toISOString().slice(0,10);

  const remoteUpsert = (table: "property_records" | "contacts" | "tasks", payload: Record<string, unknown>) => {
    if (!backendConfigured || !supabase || !session) return;
    void supabase.from(table).upsert({ ...payload, user_id: session.user.id }).then(({ error }) => {
      if (error) setNotice(`Cloud sync failed; your device copy remains saved. ${error.message}`);
    });
  };
  const remoteUpdateTask = (id: string, payload: Record<string, unknown>) => {
    if (!backendConfigured || !supabase || !session) return;
    void supabase.from("tasks").update(payload).eq("id", id).eq("user_id", session.user.id).then(({ error }) => {
      if (error) setNotice(`Cloud sync failed; your device copy remains saved. ${error.message}`);
    });
  };
  const remoteDelete = (table: "property_records" | "contacts" | "tasks", id: string) => {
    if (!backendConfigured || !supabase || !session) return;
    void supabase.from(table).delete().eq("id", id).eq("user_id", session.user.id).then(({ error }) => {
      if (error) setNotice(`Cloud deletion failed. ${error.message}`);
    });
  };

  useEffect(() => {
    if (!backendConfigured || !supabase || !session) {
      if (!backendConfigured) setRemoteReady(true);
      return;
    }
    let cancelled = false;
    const scope = session.user.id;
    setRemoteReady(false);
    setProperties(load(`estateflow.${scope}.properties`, []));
    setContacts(load(`estateflow.${scope}.contacts`, []));
    setTasks(load(`estateflow.${scope}.tasks`, []));
    (async () => {
      const [propertyResult, contactResult, taskResult] = await Promise.all([
        supabase.from("property_records").select("id,title,module,location,value,status,contact,notes,created_at").order("created_at", { ascending: false }),
        supabase.from("contacts").select("id,name,phone,role,notes").order("created_at", { ascending: false }),
        supabase.from("tasks").select("id,title,due_date,due_time,task_type,property_label,notes,is_done").order("due_date", { ascending: true }).order("due_time", { ascending: true })
      ]);
      const queryError = propertyResult.error ?? contactResult.error ?? taskResult.error;
      if (queryError) throw queryError;
      if (cancelled) return;
      setProperties((propertyResult.data ?? []).map(row => ({
        id: row.id,
        title: row.title,
        module: row.module,
        location: row.location ?? "",
        value: row.value === null || row.value === undefined ? "" : String(row.value),
        status: row.status ?? "Active",
        contact: row.contact ?? "",
        notes: row.notes ?? "",
        createdAt: row.created_at ?? new Date().toISOString()
      })));
      setContacts((contactResult.data ?? []).map(row => ({
        id: row.id,
        name: row.name,
        phone: row.phone ?? "",
        role: row.role ?? "Other",
        notes: row.notes ?? ""
      })));
      setTasks((taskResult.data ?? []).map(row => ({
        id: row.id,
        title: row.title,
        date: row.due_date,
        time: String(row.due_time ?? "10:00").slice(0, 5),
        type: row.task_type ?? "Follow-up",
        property: row.property_label ?? "",
        notes: row.notes ?? "",
        done: Boolean(row.is_done)
      })));
      setNotice("Connected to the shared EstateFlow database.");
      setRemoteReady(true);
    })().catch((error: unknown) => {
      if (cancelled) return;
      setNotice(`Cloud data could not be loaded; this account's device cache is shown. ${error instanceof Error ? error.message : String(error)}`);
      setRemoteReady(true);
    });
    return () => { cancelled = true; };
  }, [session?.user.id]);

  const go = (section: Section) => { setActive(section); setMobileMenu(false); setNotice(""); };
  const addProperty = (data: Omit<PropertyRecord, "id" | "createdAt">) => {
    const record: PropertyRecord = { ...data, id: uid(), createdAt: new Date().toISOString() };
    setProperties(prev => [record, ...prev]);
    remoteUpsert("property_records", {
      id: record.id, title: record.title, module: record.module, location: record.location,
      value: record.value.trim() ? Number(record.value) : null, status: record.status,
      contact: record.contact, notes: record.notes, created_at: record.createdAt
    });
    setShowPropertyForm(false);
    setNotice(backendConfigured && session ? "Property saved; syncing to your shared database." : "Property record saved on this device.");
  };
  const addContact = (data: Omit<ContactRecord, "id">) => {
    const record: ContactRecord = { ...data, id: uid() };
    setContacts(prev => [record, ...prev]);
    remoteUpsert("contacts", { id: record.id, name: record.name, phone: record.phone, role: record.role, notes: record.notes });
    setShowContactForm(false);
    setNotice(backendConfigured && session ? "Contact saved; syncing to your shared database." : "Contact saved on this device.");
  };
  const addTask = (data: Omit<TaskRecord, "id" | "done">) => {
    const record: TaskRecord = { ...data, id: uid(), done: false };
    setTasks(prev => [...prev, record].sort((a,b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)));
    remoteUpsert("tasks", {
      id: record.id, title: record.title, due_date: record.date, due_time: record.time,
      task_type: record.type, property_label: record.property, notes: record.notes, is_done: record.done
    });
    setShowTaskForm(false);
    setNotice(backendConfigured && session ? "Task saved; syncing to your shared database. Background notifications require a scheduler." : "One-time task saved on this device. Background notifications require a scheduler.");
  };
  const deleteProperty = (id: string) => { setProperties(prev => prev.filter(p => p.id !== id)); remoteDelete("property_records", id); };
  const deleteContact = (id: string) => { setContacts(prev => prev.filter(c => c.id !== id)); remoteDelete("contacts", id); };
  const deleteTask = (id: string) => { setTasks(prev => prev.filter(t => t.id !== id)); remoteDelete("tasks", id); };
  const toggleTask = (id: string) => {
    const task = tasks.find(item => item.id === id);
    if (!task) return;
    const isDone = !task.done;
    setTasks(prev => prev.map(item => item.id === id ? { ...item, done: isDone } : item));
    remoteUpdateTask(id, { is_done: isDone });
  };

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setAuthBusy(true);
    setAuthNotice("");
    try {
      if (authMode === "signIn") {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email: authEmail.trim(), password: authPassword });
        if (error) throw error;
        if (!data.session) setAuthNotice("Account created. Check your email to confirm it, then sign in.");
        else setAuthNotice("Account created and signed in.");
      }
    } catch (error) {
      setAuthNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setAuthBusy(false);
    }
  };

  if (backendConfigured && (authLoading || !session || !remoteReady)) {
    return <AuthScreen
      loading={authLoading || Boolean(session && !remoteReady)}
      mode={authMode}
      setMode={setAuthMode}
      email={authEmail}
      setEmail={setAuthEmail}
      password={authPassword}
      setPassword={setAuthPassword}
      busy={authBusy}
      notice={authNotice}
      onSubmit={handleAuthSubmit}
    />;
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand"><div className="brand-mark"><Building2 size={23} /></div><div><strong>EstateFlow</strong><span>PROPERTY WORKSPACE</span></div>
          <button className="mobile-close" onClick={() => setMobileMenu(false)} aria-label="Close menu"><X size={19} /></button></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="nav-list">{navigation.map(({ name, icon: Icon }) => <button key={name} className={`nav-item ${active === name ? "active" : ""}`} onClick={() => go(name)}><Icon size={18} strokeWidth={1.8} /><span>{name}</span>{name === "Schedule & Tasks" && upcomingTasks.length > 0 && <span className="nav-count">{upcomingTasks.length}</span>}</button>)}</nav>
        <div className="sidebar-bottom"><div className="help-card"><span className="help-icon"><Clock3 size={18} /></span><strong>Stay ahead</strong><p>Keep every deal and deadline in one place.</p></div>
          <button className={`nav-item ${active === "Settings" ? "active" : ""}`} onClick={() => go("Settings")}><Settings size={18} /> Settings</button>
          <div className="profile"><div className="avatar">EF</div><div className="profile-text"><strong>My Workspace</strong><span>Property Manager</span></div><span className="online-dot" /></div></div>
      </aside>
      {mobileMenu && <button className="scrim" onClick={() => setMobileMenu(false)} aria-label="Close menu" />}
      <section className="main-panel">
        <header className="topbar"><button className="menu-toggle" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu size={21} /></button>
          <div className="breadcrumb">Workspace <span>/</span> <strong>{active}</strong></div>
          <div className="top-actions"><label className="search-box"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search records..." /><kbd>⌘ K</kbd></label><button className="icon-button" aria-label="Notifications" onClick={() => go("Schedule & Tasks")}><Bell size={19} /><i /></button></div>
        </header>
        <div className="content">
          <div className="welcome-row"><div><div className="eyebrow"><span className="live-dot" /> YOUR PROPERTY COMMAND CENTRE</div><h1>{active === "Overview" ? "Good things are in motion." : active}</h1><p className="subtitle">{active === "Overview" ? "Your properties, deals and follow-ups — thoughtfully organised." : `Manage your ${active.toLowerCase()} in one connected workspace.`}</p></div>
            <button className="primary-button" onClick={() => active === "Contacts" ? setShowContactForm(true) : active === "Schedule & Tasks" ? setShowTaskForm(true) : setShowPropertyForm(true)}><Plus size={17} /> {active === "Contacts" ? "New contact" : active === "Schedule & Tasks" ? "New task" : "New record"}</button></div>
          {notice && <div className="notice"><CheckCircle2 size={17}/>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={15}/></button></div>}
          {active === "Overview" && <>
            <section className="hero-card"><div className="hero-copy"><span className="hero-label">A CLEARER WAY FORWARD</span><h2>Every deal has a next step.<br/>Never miss yours.</h2><p>Bring property records, important dates and conversations together in one calm, organised space.</p><button className="hero-button" onClick={() => go("Schedule & Tasks")}>View your schedule <ArrowUpRight size={16}/></button></div>
              <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="building-shape"><div className="building-roof"/><div className="building-body"><i/><i/><i/><i/><i/><i/></div></div><div className="floating-note"><CheckCircle2 size={16}/><span>One step at a time</span></div></div></section>
            <div className="stats-grid"><Stat label="Property records" value={properties.length} icon={<LandPlot size={18}/>} /><Stat label="Contacts" value={contacts.length} icon={<Users size={18}/>} /><Stat label="Open tasks" value={upcomingTasks.length} icon={<CalendarClock size={18}/>} /><Stat label="Due today" value={upcomingTasks.filter(t=>t.date===today).length} icon={<Clock3 size={18}/>} /></div>
            <div className="section-heading"><div><h2>Property modules</h2><p>Six dedicated workspaces, one connected system.</p></div><button className="text-button" onClick={() => go("All Properties")}>View all <ArrowUpRight size={15}/></button></div>
            <div className="module-grid">{filteredModules.map(({name,icon:Icon,color},index)=><button className="module-card" key={name} onClick={()=>go(name)}><div className={`module-icon ${color}`}><Icon size={21} strokeWidth={1.8}/></div><div className="module-number">0{index+1}</div><h3>{name}</h3><p>Manage records, contacts and next steps.</p><span className="module-link">Open workspace <ArrowUpRight size={15}/></span></button>)}</div>
            <div className="bottom-grid"><section className="panel-card"><div className="panel-heading"><div><h2>Upcoming schedule</h2><p>Your next important dates.</p></div><CalendarClock size={20}/></div>{upcomingTasks.length ? <TaskList tasks={upcomingTasks.slice(0,3)} toggle={toggleTask} remove={deleteTask}/> : <Empty icon={<CalendarClock size={22}/>} title="Your timeline starts here" text="Schedule a one-time reminder for a meeting, payment, registration or follow-up." action="Create schedule" onClick={()=>setShowTaskForm(true)}/>}</section>
              <section className="panel-card"><div className="panel-heading"><div><h2>WhatsApp follow-ups</h2><p>Conversations that need attention.</p></div><MessageCircle size={20}/></div><Empty icon={<MessageCircle size={22}/>} title="Keep every conversation moving" text="Create a WhatsApp message link or prepare a reminder. Automatic delivery and reply detection require a connected WhatsApp Business API." action="Open automation" onClick={()=>go("WhatsApp Automation")}/></section></div>
          </>}
          {active === "All Properties" || modules.some(m=>m.name===active) ? <section className="data-panel"><div className="section-heading"><div><h2>{active === "All Properties" ? "All property records" : active}</h2><p>{filteredProperties.filter(p=>active==="All Properties"||p.module===active).length} saved records</p></div><button className="primary-button" onClick={()=>setShowPropertyForm(true)}><Plus size={16}/> Add property</button></div>
            {filteredProperties.filter(p=>active==="All Properties"||p.module===active).length ? <div className="record-list">{filteredProperties.filter(p=>active==="All Properties"||p.module===active).map(p=><article className="record-card" key={p.id}><div className="record-symbol"><Building2 size={20}/></div><div className="record-main"><h3>{p.title}</h3><p><MapPin size={14}/>{p.location || "Location not entered"} <span>•</span> {p.module}</p>{p.contact&&<small>Contact: {p.contact}</small>}{p.notes&&<small>{p.notes}</small>}</div><div className="record-side"><strong>{p.value ? `₹ ${p.value}` : "Value not set"}</strong><span className="status-pill">{p.status}</span><button className="delete-button" onClick={()=>deleteProperty(p.id)} aria-label={`Delete ${p.title}`}><Trash2 size={15}/></button></div></article>)}</div>:<Empty icon={<LandPlot size={22}/>} title="No property records yet" text="Add your first record. It will be stored in this browser on this device." action="Add property" onClick={()=>setShowPropertyForm(true)}/>}</section> : null}
          {active === "Contacts" && <section className="data-panel"><div className="section-heading"><div><h2>Contacts</h2><p>{contacts.length} saved contacts</p></div><button className="primary-button" onClick={()=>setShowContactForm(true)}><Plus size={16}/> Add contact</button></div>
            {contacts.length ? <div className="record-list">{contacts.filter(c=>`${c.name} ${c.phone} ${c.role}`.toLowerCase().includes(search.toLowerCase())).map(c=><article className="record-card" key={c.id}><div className="record-symbol contact-symbol"><Users size={20}/></div><div className="record-main"><h3>{c.name}</h3><p><Phone size={14}/>{c.phone || "No phone entered"} <span>•</span> {c.role || "Contact"}</p>{c.notes&&<small>{c.notes}</small>}</div><div className="record-side"><button className="delete-button" onClick={()=>deleteContact(c.id)} aria-label={`Delete ${c.name}`}><Trash2 size={15}/></button></div></article>)}</div>:<Empty icon={<Users size={22}/>} title="Your contact book is ready" text="Keep buyers, sellers, lawyers, brokers, lenders and other stakeholders together." action="Add contact" onClick={()=>setShowContactForm(true)}/>}</section>}
          {active === "Schedule & Tasks" && <section className="data-panel"><div className="section-heading"><div><h2>One-time schedule</h2><p>Tasks and reminders saved on this device.</p></div><button className="primary-button" onClick={()=>setShowTaskForm(true)}><Plus size={16}/> Schedule task</button></div>
            <div className="notice notice-warn"><Clock3 size={17}/> These are stored reminders, not background alarms. For reliable notifications after closing the app, we must add a deployed server scheduler in the next stage.</div>
            {tasks.length ? <TaskList tasks={[...tasks].sort((a,b)=>`${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))} toggle={toggleTask} remove={deleteTask}/> : <Empty icon={<CalendarClock size={22}/>} title="Nothing scheduled yet" text="Add a dated task for a payment, meeting, registration or follow-up." action="Create schedule" onClick={()=>setShowTaskForm(true)}/>}</section>}
          {active === "Documents" && <section className="data-panel"><div className="section-heading"><div><h2>Documents</h2><p>Document management workspace</p></div></div><Empty icon={<FileText size={22}/>} title="Document vault is the next build stage" text="The starter currently has no secure cloud file storage. The next stage will connect private document uploads to a database/storage service." action="Back to overview" onClick={()=>go("Overview")}/></section>}
          {active === "WhatsApp Automation" && <section className="data-panel"><div className="section-heading"><div><h2>WhatsApp follow-up helper</h2><p>Prepare a message and open WhatsApp manually.</p></div><MessageCircle size={21}/></div>
            <div className="form-card wa-form"><label>Recipient phone number <span>Include country code, e.g. 919876543210</span><input value={waPhone} onChange={e=>setWaPhone(e.target.value.replace(/[^\d]/g,""))} placeholder="91XXXXXXXXXX"/></label><label>Message<textarea rows={5} value={waMessage} onChange={e=>setWaMessage(e.target.value)}/></label><button className="primary-button" disabled={!waPhone || !waMessage.trim()} onClick={()=>window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(waMessage)}`,"_blank","noopener,noreferrer")}><ExternalLink size={16}/> Open WhatsApp chat</button><div className="notice notice-warn">This opens a prefilled chat; it does not auto-send messages, detect replies or keep repeating. Automated follow-up requires WhatsApp Business Platform credentials, approved templates where required, and a webhook.</div></div></section>}
          {active === "Settings" && <section className="data-panel"><div className="section-heading"><div><h2>Settings</h2><p>Workspace data and local backup</p></div></div><div className="settings-card"><h3>Local data backup</h3><p>Records are currently stored in this browser's local storage. They are not synced across devices and may be lost if browser data is cleared.</p><button className="secondary-button" onClick={()=>{const blob=new Blob([JSON.stringify({properties,contacts,tasks,exportedAt:new Date().toISOString()},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`estateflow-backup-${today}.json`;a.click();URL.revokeObjectURL(url);}}>Export backup JSON</button><button className="secondary-button" onClick={()=>{const input=document.createElement("input");input.type="file";input.accept=".json,application/json";input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!Array.isArray(data.properties)||!Array.isArray(data.contacts)||!Array.isArray(data.tasks))throw new Error("Invalid backup");setProperties(data.properties);setContacts(data.contacts);setTasks(data.tasks);setNotice("Backup imported.");}catch{setNotice("Could not import this file. Please select a valid EstateFlow backup.");}};input.click();}}>Import backup JSON</button>{backendConfigured && session && <button className="secondary-button" onClick={async () => { await supabase?.auth.signOut(); }}>Sign out of shared workspace</button>}</div></section>}
          <footer className="footer"><span>EstateFlow © 2026</span><span>{backendConfigured && session ? "Shared database connected" : "Local-only mode · Device data is not synced"}</span></footer>
        </div>
      </section>
      {showPropertyForm && <Modal title="Add property record" onClose={()=>setShowPropertyForm(false)}><PropertyForm defaultModule={modules.some(m=>m.name===active)?active:modules[0].name} onSave={addProperty} onCancel={()=>setShowPropertyForm(false)}/></Modal>}
      {showContactForm && <Modal title="Add contact" onClose={()=>setShowContactForm(false)}><ContactForm onSave={addContact} onCancel={()=>setShowContactForm(false)}/></Modal>}
      {showTaskForm && <Modal title="Schedule a one-time task" onClose={()=>setShowTaskForm(false)}><TaskForm properties={properties} onSave={addTask} onCancel={()=>setShowTaskForm(false)}/></Modal>}
    </main>
  );
}

function Stat({label,value,icon}:{label:string;value:number;icon:ReactNode}) { return <div className="stat-card"><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></div>; }
function Empty({icon,title,text,action,onClick}:{icon:ReactNode;title:string;text:string;action:string;onClick:()=>void}) { return <div className="empty-state"><div className="empty-icon">{icon}</div><strong>{title}</strong><p>{text}</p><button className="secondary-button" onClick={onClick}><Plus size={15}/>{action}</button></div>; }
function TaskList({tasks,toggle,remove}:{tasks:TaskRecord[];toggle:(id:string)=>void;remove:(id:string)=>void}) { return <div className="task-list">{tasks.map(t=><article className={`task-row ${t.done?"task-done":""}`} key={t.id}><button className="task-check" onClick={()=>toggle(t.id)} aria-label={t.done?"Mark incomplete":"Mark complete"}><CircleCheck size={20}/></button><div className="task-details"><strong>{t.title}</strong><p><CalendarDays size={14}/>{t.date} <span>•</span> {t.time} <span>•</span> {t.type}</p>{t.property&&<small>{t.property}</small>}{t.notes&&<small>{t.notes}</small>}</div><button className="delete-button" onClick={()=>remove(t.id)} aria-label="Delete task"><Trash2 size={15}/></button></article>)}</div>; }
function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}) { return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><h2>{title}</h2><button onClick={onClose} aria-label="Close"><X size={19}/></button></div>{children}</section></div>; }
function PropertyForm({defaultModule,onSave,onCancel}:{defaultModule:string;onSave:(v:Omit<PropertyRecord,"id"|"createdAt">)=>void;onCancel:()=>void}) { const [form,setForm]=useState({title:"",module:defaultModule,location:"",value:"",status:"Active",contact:"",notes:""}); const update=(key:string,value:string)=>setForm(p=>({...p,[key]:value})); return <form className="form-card" onSubmit={e=>{e.preventDefault();if(form.title.trim())onSave(form);}}><label>Property / deal name *<input required value={form.title} onChange={e=>update("title",e.target.value)} placeholder="e.g. Site on Main Road"/></label><label>Module<select value={form.module} onChange={e=>update("module",e.target.value)}>{modules.map(m=><option key={m.name}>{m.name}</option>)}</select></label><div className="form-two"><label>Location<input value={form.location} onChange={e=>update("location",e.target.value)} placeholder="Area / village / city"/></label><label>Value (₹)<input inputMode="decimal" value={form.value} onChange={e=>update("value",e.target.value)} placeholder="e.g. 25000000"/></label></div><div className="form-two"><label>Status<select value={form.status} onChange={e=>update("status",e.target.value)}>{["Active","Under review","Negotiation","On hold","Completed","Closed"].map(s=><option key={s}>{s}</option>)}</select></label><label>Primary contact<input value={form.contact} onChange={e=>update("contact",e.target.value)} placeholder="Contact name"/></label></div><label>Notes<textarea rows={3} value={form.notes} onChange={e=>update("notes",e.target.value)} placeholder="Important details, next steps..."/></label><div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="submit" className="primary-button">Save record</button></div></form>; }
function ContactForm({onSave,onCancel}:{onSave:(v:Omit<ContactRecord,"id">)=>void;onCancel:()=>void}) { const [form,setForm]=useState({name:"",phone:"",role:"Buyer",notes:""});const update=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));return <form className="form-card" onSubmit={e=>{e.preventDefault();if(form.name.trim())onSave(form);}}><label>Full name *<input required value={form.name} onChange={e=>update("name",e.target.value)} placeholder="Contact name"/></label><div className="form-two"><label>Phone<input value={form.phone} onChange={e=>update("phone",e.target.value)} placeholder="+91..."/></label><label>Role<select value={form.role} onChange={e=>update("role",e.target.value)}>{["Buyer","Seller","Broker","Lawyer","Lender","Tenant","Developer","Government office","Other"].map(s=><option key={s}>{s}</option>)}</select></label></div><label>Notes<textarea rows={3} value={form.notes} onChange={e=>update("notes",e.target.value)}/></label><div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="submit" className="primary-button">Save contact</button></div></form>; }
function TaskForm({properties,onSave,onCancel}:{properties:PropertyRecord[];onSave:(v:Omit<TaskRecord,"id"|"done">)=>void;onCancel:()=>void}) { const [form,setForm]=useState({title:"",date:new Date().toISOString().slice(0,10),time:"10:00",type:"Follow-up",property:"",notes:""});const update=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));return <form className="form-card" onSubmit={e=>{e.preventDefault();if(form.title.trim())onSave(form);}}><label>Task / reminder *<input required value={form.title} onChange={e=>update("title",e.target.value)} placeholder="e.g. Call lawyer about document"/></label><div className="form-two"><label>Date *<input required type="date" value={form.date} onChange={e=>update("date",e.target.value)}/></label><label>Time *<input required type="time" value={form.time} onChange={e=>update("time",e.target.value)}/></label></div><div className="form-two"><label>Task type<select value={form.type} onChange={e=>update("type",e.target.value)}>{["Follow-up","Meeting","Payment","Registration","Document deadline","Site visit","Other"].map(s=><option key={s}>{s}</option>)}</select></label><label>Related property<select value={form.property} onChange={e=>update("property",e.target.value)}><option value="">None selected</option>{properties.map(p=><option key={p.id} value={p.title}>{p.title}</option>)}</select></label></div><label>Notes<textarea rows={3} value={form.notes} onChange={e=>update("notes",e.target.value)} placeholder="Details or preparation required"/></label><div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="submit" className="primary-button">Save task</button></div></form>; }


function AuthScreen({
  loading, mode, setMode, email, setEmail, password, setPassword, busy, notice, onSubmit
}: {
  loading: boolean;
  mode: "signIn" | "signUp";
  setMode: (mode: "signIn" | "signUp") => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  busy: boolean;
  notice: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return <main className="auth-shell">
    <section className="auth-card">
      <div className="brand-mark auth-brand"><Building2 size={24}/></div>
      <div className="auth-eyebrow">ESTATEFLOW · SECURE WORKSPACE</div>
      <h1>{loading ? "Connecting your workspace" : mode === "signIn" ? "Welcome back." : "Create your workspace."}</h1>
      <p>{loading ? "Loading your private records from the shared database." : "Sign in to keep your property deals, contacts and tasks synced across devices."}</p>
      {!loading && <form className="form-card" onSubmit={onSubmit}>
        <label>Email address<input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com"/></label>
        <label>Password<input type="password" required minLength={8} autoComplete={mode === "signIn" ? "current-password" : "new-password"} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters"/></label>
        <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "signIn" ? "Sign in" : "Create account"}</button>
      </form>}
      {notice && <div className="notice auth-notice">{notice}</div>}
      {!loading && <button type="button" className="auth-switch" onClick={() => { setMode(mode === "signIn" ? "signUp" : "signIn"); }}>{mode === "signIn" ? "New to EstateFlow? Create an account" : "Already registered? Sign in"}</button>}
      <small>Personal records are protected by database row-level security. Never share your password or backend secrets.</small>
    </section>
  </main>;
}
