import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, backendConfigured } from "./lib/supabase";
import { MessageCircle, CalendarClock, CheckCircle2, ExternalLink, Download, ArrowUpRight, X, RefreshCw } from "lucide-react";

type Props = { session: Session | null; onNotice: (message: string) => void };
type QueueRow = {
  id: string; contactName: string; phone: string; message: string; templateName: string;
  templateLanguage: string; templateParameters: string[]; scheduledAt: string; consentConfirmed: boolean;
  stopOnReply: boolean; status: string; attemptCount: number; lastError: string;
  recipientType: "individual" | "group"; batchId: string; audienceLabel: string; targetLabel: string;
};
type Connection = {
  configured: boolean; connected: boolean; senderNumber: string; verifiedName: string;
  qualityRating: string; groupsEnabled: boolean; error?: string;
};
const columns = "id,contact_name,phone,message,template_name,template_language,template_parameters,scheduled_at,consent_confirmed,stop_on_reply,status,attempt_count,last_error,recipient_type,batch_id,audience_label,target_label";
const localDate = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const newId = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + "-" + Math.random().toString(16).slice(2);
function normalizePhone(raw: string, countryCode = "91"): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = countryCode.replace(/\D/g, "") + digits;
  return digits;
}
function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field.length === 0) { quoted = true; continue; }
    if (ch === ",") { row.push(field); field = ""; continue; }
    if (ch.charCodeAt(0) === 10) { row.push(field); if (row.some(v => v.trim())) rows.push(row); row = []; field = ""; continue; }
    if (ch.charCodeAt(0) !== 13) field += ch;
  }
  row.push(field); if (row.some(v => v.trim())) rows.push(row);
  if (quoted) throw new Error("CSV has an unclosed quoted field.");
  return rows;
}
function fromDb(row: any): QueueRow {
  return {
    id: String(row.id), contactName: String(row.contact_name ?? ""), phone: String(row.phone ?? ""),
    message: String(row.message ?? ""), templateName: String(row.template_name ?? ""),
    templateLanguage: String(row.template_language ?? "en_US"),
    templateParameters: Array.isArray(row.template_parameters) ? row.template_parameters.map(String) : [],
    scheduledAt: String(row.scheduled_at ?? ""), consentConfirmed: Boolean(row.consent_confirmed),
    stopOnReply: Boolean(row.stop_on_reply), status: String(row.status ?? "scheduled"),
    attemptCount: Number(row.attempt_count ?? 0), lastError: String(row.last_error ?? ""),
    recipientType: row.recipient_type === "group" ? "group" : "individual",
    batchId: String(row.batch_id ?? ""), audienceLabel: String(row.audience_label ?? ""),
    targetLabel: String(row.target_label ?? "")
  };
}

export default function WhatsAppScheduler({ session, onNotice }: Props) {
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [recipientType, setRecipientType] = useState<"individual" | "group">("individual");
  const [target, setTarget] = useState("");
  const [contactName, setContactName] = useState("");
  const [countryCode, setCountryCode] = useState("91");
  const [campaign, setCampaign] = useState("");
  const [notes, setNotes] = useState("Hello, following up on our property discussion. Please let me know when you are available.");
  const [templateName, setTemplateName] = useState("");
  const [language, setLanguage] = useState("en_US");
  const [parameters, setParameters] = useState("");
  const [date, setDate] = useState(localDate());
  const [time, setTime] = useState("10:00");
  const [consent, setConsent] = useState(false);
  const [csv, setCsv] = useState("");
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);

  const refreshQueue = async () => {
    if (!supabase || !session) { onNotice("Sign in to refresh the server-side queue."); return; }
    setBusy(true);
    try {
      const all: QueueRow[] = [];
      for (let offset = 0; offset < 20000; offset += 1000) {
        const result = await supabase.from("whatsapp_followups").select(columns)
          .order("scheduled_at", { ascending: false }).range(offset, offset + 999);
        if (result.error) throw result.error;
        const page = (result.data ?? []).map(fromDb);
        all.push(...page);
        if (page.length < 1000) break;
      }
      setQueue(all);
      onNotice("WhatsApp queue refreshed: " + all.length + " records loaded.");
    } catch (e) {
      onNotice("Could not refresh queue: " + (e instanceof Error ? e.message : String(e)) + ". Apply the bulk-scheduling migration if new columns are missing.");
    } finally { setBusy(false); }
  };

  const checkConnection = async () => {
    if (!backendConfigured || !supabase || !session) {
      setConnection({ configured: false, connected: false, senderNumber: "", verifiedName: "", qualityRating: "", groupsEnabled: false, error: "Configure Supabase and sign in first." });
      onNotice("Connect the shared EstateFlow backend and sign in first.");
      return;
    }
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-status", { method: "POST" });
      if (error) throw error;
      const status: Connection = {
        configured: Boolean(data?.configured), connected: Boolean(data?.connected),
        senderNumber: String(data?.senderNumber ?? ""), verifiedName: String(data?.verifiedName ?? ""),
        qualityRating: String(data?.qualityRating ?? ""), groupsEnabled: Boolean(data?.groupsEnabled),
        error: data?.error ? String(data.error) : undefined
      };
      setConnection(status);
      onNotice(status.connected ? "WhatsApp sender verified: " + (status.senderNumber || status.verifiedName || "Meta account") + "." : String(data?.message || data?.error || "Sender is not connected yet."));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setConnection({ configured: false, connected: false, senderNumber: "", verifiedName: "", qualityRating: "", groupsEnabled: false, error: msg });
      onNotice("Connection check failed: " + msg + ". Deploy whatsapp-status and configure server secrets.");
    } finally { setChecking(false); }
  };

  useEffect(() => {
    if (session && backendConfigured) {
      void refreshQueue();
      void checkConnection();
    } else {
      setQueue([]);
      setConnection(null);
    }
  }, [session?.user.id]);

  const scheduleOne = async () => {
    if (!backendConfigured || !supabase || !session) { onNotice("Scheduling requires configured Supabase and a signed-in user."); return; }
    const destination = recipientType === "group" ? target.trim() : normalizePhone(target, countryCode);
    const name = templateName.trim().toLowerCase();
    const scheduledAt = new Date(date + "T" + time + ":00");
    if (recipientType === "individual" && (destination.length < 8 || destination.length > 15)) {
      onNotice("Enter a valid recipient number. Ten-digit Indian numbers are prefixed with 91."); return;
    }
    if (recipientType === "group" && !connection?.groupsEnabled) { onNotice("Official group sends require eligible Meta Groups API access and an official group ID."); return; }
    if (!destination || !/^[a-z0-9_]{1,512}$/.test(name) || !consent || !Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
      onNotice("Check recipient, approved template, opt-in confirmation and future date/time."); return;
    }
    setBusy(true);
    try {
      const batchId = newId();
      const { data, error } = await supabase.from("whatsapp_followups").insert({
        user_id: session.user.id, phone: destination, contact_name: contactName.trim(), message: notes.trim(),
        template_name: name, template_language: language.trim() || "en_US",
        template_parameters: parameters.trim() ? parameters.split("|").map(v => v.trim()) : [],
        consent_confirmed: true, scheduled_at: scheduledAt.toISOString(), stop_on_reply: true, status: "scheduled",
        recipient_type: recipientType, batch_id: batchId, audience_label: campaign.trim(),
        target_label: contactName.trim() || (recipientType === "group" ? "WhatsApp group" : "")
      }).select(columns).single();
      if (error) throw error;
      setQueue(prev => [fromDb(data), ...prev]);
      onNotice("Follow-up queued. The deployed worker and scheduled trigger must be running for automatic delivery.");
    } catch (e) {
      onNotice("Could not schedule follow-up: " + (e instanceof Error ? e.message : String(e)));
    } finally { setBusy(false); }
  };

  const scheduleBulk = async () => {
    if (!backendConfigured || !supabase || !session) { onNotice("Bulk scheduling requires configured Supabase and a signed-in user."); return; }
    let rows: string[][];
    try { rows = parseCsv(csv.trim()); } catch (e) { onNotice(e instanceof Error ? e.message : "Could not parse CSV."); return; }
    if (rows.length < 2) { onNotice("Paste or upload a CSV with headers and at least one recipient."); return; }
    if (rows.length - 1 > 5000) { onNotice("Import limit is 5,000 rows per batch. Split larger files."); return; }
    const headers = rows[0].map(v => v.trim().replace(/^\uFEFF/, "").toLowerCase());
    const col = (name: string) => headers.indexOf(name);
    const missing = ["recipient_type", "target", "template_name", "template_language", "opt_in_confirmed"].filter(h => col(h) < 0);
    if (missing.length) { onNotice("CSV missing required columns: " + missing.join(", ") + ". Download the sample."); return; }
    const defaultDue = new Date(date + "T" + time + ":00");
    if (!Number.isFinite(defaultDue.getTime())) { onNotice("Choose valid default date and time."); return; }

    const batchId = newId();
    const payload: Record<string, unknown>[] = [];
    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];
      const read = (name: string) => col(name) < 0 ? "" : String(values[col(name)] ?? "").trim();
      const kind = read("recipient_type").toLowerCase();
      const raw = read("target");
      const destination = kind === "group" ? raw : normalizePhone(raw, countryCode);
      const optedIn = ["true", "yes", "1", "confirmed"].includes(read("opt_in_confirmed").toLowerCase());
      const template = read("template_name").toLowerCase();
      const due = read("scheduled_at") ? new Date(read("scheduled_at")) : defaultDue;
      const rowNo = i + 1;
      if (!["individual", "group"].includes(kind)) { onNotice("CSV row " + rowNo + ": recipient_type must be individual or group."); return; }
      if (!destination || (kind === "individual" && (destination.length < 8 || destination.length > 15))) { onNotice("CSV row " + rowNo + ": invalid phone number or group ID."); return; }
      if (kind === "group" && !connection?.groupsEnabled) { onNotice("CSV row " + rowNo + ": Groups API is not enabled for this sender account."); return; }
      if (!/^[a-z0-9_]{1,512}$/.test(template)) { onNotice("CSV row " + rowNo + ": invalid approved template name."); return; }
      if (!optedIn) { onNotice("CSV row " + rowNo + ": opt_in_confirmed must be true, yes or 1."); return; }
      if (!Number.isFinite(due.getTime()) || due.getTime() <= Date.now()) { onNotice("CSV row " + rowNo + ": scheduled_at must be in the future, or blank to use the default schedule."); return; }
      const name = read("contact_name");
      payload.push({
        user_id: session.user.id, phone: destination, contact_name: name,
        message: read("message_notes") || "Scheduled via EstateFlow bulk queue",
        template_name: template, template_language: read("template_language") || "en_US",
        template_parameters: read("template_parameters") ? read("template_parameters").split("|").map(v => v.trim()) : [],
        consent_confirmed: true, scheduled_at: due.toISOString(), stop_on_reply: true, status: "scheduled",
        recipient_type: kind, batch_id: batchId,
        audience_label: read("audience_label") || campaign.trim(),
        target_label: read("target_label") || name || (kind === "group" ? "WhatsApp group" : "")
      });
    }
    if (!payload.length) { onNotice("No valid rows to import."); return; }
    setBulkBusy(true);
    let inserted = 0;
    try {
      for (let offset = 0; offset < payload.length; offset += 100) {
        const { data, error } = await supabase.from("whatsapp_followups").insert(payload.slice(offset, offset + 100)).select(columns);
        if (error) throw error;
        const mapped = (data ?? []).map(fromDb);
        setQueue(prev => [...mapped, ...prev]);
        inserted += mapped.length;
      }
      setCsv("");
      onNotice("Queued " + inserted + " messages in batch " + batchId.slice(0, 8) + ". Delivery needs the worker and scheduled trigger.");
    } catch (e) {
      onNotice("Bulk import stopped after " + inserted + " of " + payload.length + " rows: " + (e instanceof Error ? e.message : String(e)) + ". Refresh queue before retrying.");
    } finally { setBulkBusy(false); }
  };

  const downloadTemplate = () => {
    const sample = [
      "recipient_type,target,target_label,contact_name,template_name,template_language,template_parameters,scheduled_at,opt_in_confirmed,audience_label,message_notes",
      'individual,919876543210,Example contact,Example contact,estateflow_follow_up,en_US,"Name|Property reference|Next step",,true,Property follow-ups,Internal notes',
      'group,OFFICIAL_GROUP_ID,Project partners,Project partners,estateflow_group_update,en_US,"Project|Next action",,true,Project partners,Approved Groups API template required'
    ].join("\\n");
    const url = URL.createObjectURL(new Blob([sample], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "estateflow-whatsapp-bulk-template.csv"; anchor.click();
    URL.revokeObjectURL(url);
  };

  const cancel = async (record: QueueRow) => {
    if (!supabase || !session) return;
    const { error } = await supabase.from("whatsapp_followups").update({ status: "cancelled" })
      .eq("id", record.id).eq("user_id", session.user.id).eq("status", "scheduled");
    if (error) { onNotice("Could not cancel follow-up: " + error.message); return; }
    setQueue(prev => prev.map(row => row.id === record.id ? { ...row, status: "cancelled" } : row));
    onNotice("Scheduled follow-up cancelled.");
  };

  const scheduled = queue.filter(row => row.status === "scheduled").length;
  const sent = queue.filter(row => row.status === "sent").length;
  const failed = queue.filter(row => row.status === "failed").length;
  const replied = queue.filter(row => row.status === "replied").length;

  return <section className="data-panel whatsapp-workspace">
    <div className="section-heading"><div><span className="section-kicker">MESSAGE OPERATIONS</span><h2>WhatsApp scheduling centre</h2><p>Schedule individual messages, import 700+ recipients and track outcomes.</p></div><MessageCircle size={22}/></div>
    <section className={"wa-connection-card " + (connection?.connected ? "wa-connected" : "wa-disconnected")}>
      <div className="wa-connection-icon"><MessageCircle size={23}/></div>
      <div className="wa-connection-copy"><strong>{connection?.connected ? (connection.verifiedName || "WhatsApp Business connected") : "Sender account not verified"}</strong>
        <p>{connection?.connected ? "Sender number: " + (connection.senderNumber || "Verified with Meta") + (connection.qualityRating ? " · Quality: " + connection.qualityRating : "") : "Connect a Meta WhatsApp Business Platform number in the backend. The recipient field below is not your sender number."}</p>
        <small>{connection?.groupsEnabled ? "Official Groups API enabled." : "Individual Cloud API messaging is supported. Group delivery requires eligible Groups API access."}</small>
        {connection?.error && <small className="wa-connection-error">{connection.error}</small>}
      </div>
      <button className="secondary-button" disabled={checking} onClick={() => void checkConnection()}><CheckCircle2 size={15}/>{checking ? "Checking…" : "Check connection"}</button>
    </section>
    <div className="wa-account-actions">
      <button className="secondary-button" onClick={() => window.open("https://developers.facebook.com/apps/", "_blank", "noopener,noreferrer")}><ExternalLink size={15}/> Open Meta Dashboard</button>
      <a className="text-button" href="https://github.com/imtboss007/property-management-system/blob/main/supabase/SETUP.md" target="_blank" rel="noreferrer">Connection setup guide <ArrowUpRight size={14}/></a>
    </div>
    <div className="notice notice-warn"><strong>Important:</strong> This uses Meta’s official Business API, not a personal WhatsApp Web QR session. Keep access tokens in Supabase secrets. Proactive sends need a template approved by Meta and recipient opt-in. Message notes are internal; only template parameters are sent.</div>
    <div className="wa-mode-switch" role="tablist" aria-label="Schedule mode">
      <button className={mode === "single" ? "wa-mode-active" : ""} onClick={() => setMode("single")} role="tab" aria-selected={mode === "single"}>One scheduled message</button>
      <button className={mode === "bulk" ? "wa-mode-active" : ""} onClick={() => setMode("bulk")} role="tab" aria-selected={mode === "bulk"}>Bulk schedule · CSV</button>
    </div>
    {mode === "single" && <div className="form-card wa-form">
      <div className="form-two"><label>Destination type<select value={recipientType} onChange={event => { setRecipientType(event.target.value as "individual" | "group"); setTarget(""); }}><option value="individual">Individual WhatsApp number</option><option value="group" disabled={!connection?.groupsEnabled}>Official Groups API group</option></select></label>
        {recipientType === "individual" ? <label>Default country code<input inputMode="numeric" value={countryCode} onChange={event => setCountryCode(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="91"/></label> : <label>Group API readiness<input value={connection?.groupsEnabled ? "Enabled" : "Not enabled"} readOnly/></label>}
      </div>
      <label>{recipientType === "group" ? "Official WhatsApp group ID" : "Recipient phone number"}<span>{recipientType === "group" ? "Only official Meta Groups API group IDs work here; regular personal-app groups cannot be targeted." : "Ten-digit Indian numbers are prefixed with your country code; full international numbers also work."}</span><input value={target} onChange={event => setTarget(recipientType === "individual" ? event.target.value.replace(/[^\d+]/g, "") : event.target.value)} placeholder={recipientType === "group" ? "Official Groups API group ID" : "9876543210 or 919876543210"}/></label>
      <div className="form-two"><label>{recipientType === "group" ? "Group label" : "Contact name"}<input value={contactName} onChange={event => setContactName(event.target.value)} placeholder="Optional queue label"/></label><label>Batch / campaign label<input value={campaign} onChange={event => setCampaign(event.target.value)} placeholder="e.g. Property follow-up Oct"/></label></div>
      <label>Message notes (not sent as template body)<textarea rows={3} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Internal context for this reminder"/></label>
      <div className="form-two"><label>Approved template name<input value={templateName} onChange={event => setTemplateName(event.target.value)} placeholder="estateflow_follow_up"/></label><label>Template language code<input value={language} onChange={event => setLanguage(event.target.value)} placeholder="en_US"/></label></div>
      <label>Template body parameters<span>Pipe-separated values in the template order, for example: Name|Property reference|Next step.</span><input value={parameters} onChange={event => setParameters(event.target.value)} placeholder="Name|Property reference|Next step"/></label>
      <div className="form-two"><label>Send date<input type="date" min={localDate()} value={date} onChange={event => setDate(event.target.value)}/></label><label>Send time<input type="time" value={time} onChange={event => setTime(event.target.value)}/></label></div>
      <label className="consent-check"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)}/> I confirm the recipient opted in, or all group participants joined through the approved invite flow.</label>
      <button className="primary-button" disabled={busy || !target.trim() || !templateName.trim() || !consent || (recipientType === "group" && !connection?.groupsEnabled)} onClick={() => void scheduleOne()}><CalendarClock size={16}/>{busy ? "Scheduling…" : "Schedule one-time follow-up"}</button>
      {recipientType === "individual" && <div className="form-actions"><button className="secondary-button" disabled={!target || !notes.trim()} onClick={() => window.open("https://wa.me/" + normalizePhone(target, countryCode) + "?text=" + encodeURIComponent(notes), "_blank", "noopener,noreferrer")}><ExternalLink size={16}/> Open WhatsApp manually</button></div>}
    </div>}
    {mode === "bulk" && <div className="form-card wa-form wa-bulk-form">
      <div className="bulk-header"><div><h3>Bulk schedule 700+ recipients</h3><p>One CSV row creates one independently scheduled send. Up to 5,000 rows per import.</p></div><button className="secondary-button" onClick={downloadTemplate}><Download size={15}/> Download sample CSV</button></div>
      <label>Default batch / campaign label<input value={campaign} onChange={event => setCampaign(event.target.value)} placeholder="e.g. October follow-ups"/></label>
      <label>Import CSV file<input type="file" accept=".csv,text/csv" onChange={async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) { try { setCsv(await file.text()); onNotice("Loaded " + file.name + "; review the rows and opt-in confirmation before importing."); } catch (e) { onNotice(e instanceof Error ? e.message : "Could not read CSV."); } } event.target.value = ""; }}/><span>Required: recipient_type, target, template_name, template_language, opt_in_confirmed. Template parameters use |. Blank scheduled_at uses the default date/time.</span></label>
      <label>Paste or review CSV<textarea rows={10} value={csv} onChange={event => setCsv(event.target.value)} placeholder={"recipient_type,target,target_label,contact_name,template_name,template_language,template_parameters,scheduled_at,opt_in_confirmed,audience_label,message_notes\\nindividual,919876543210,Buyer,Buyer,estateflow_follow_up,en_US,Name|Property,2026-10-28T10:30:00+05:30,true,Property follow-ups,Internal note"}/></label>
      <div className="form-two"><label>Default send date<input type="date" min={localDate()} value={date} onChange={event => setDate(event.target.value)}/></label><label>Default send time<input type="time" value={time} onChange={event => setTime(event.target.value)}/></label></div>
      <div className="bulk-rules"><strong>Before import</strong><span>Every row must explicitly set opt_in_confirmed to true, yes or 1. Ten-digit Indian numbers are prefixed with 91. Group rows require an official Groups API ID and enabled access.</span><span>Due rows are processed in batches of up to 100 per worker run. A 700-message backlog may require multiple runs, so delivery at the same second is not guaranteed.</span></div>
      <button className="primary-button" disabled={bulkBusy || !csv.trim()} onClick={() => void scheduleBulk()}><CalendarClock size={16}/>{bulkBusy ? "Importing scheduled messages…" : "Validate and queue CSV"}</button>
    </div>}
    <div className="section-heading wa-queue-heading"><div><h2>Queue & delivery history</h2><p>{queue.length} rows · {scheduled} scheduled · {sent} accepted by Meta · {failed} failed · {replied} stopped on reply</p></div><button className="secondary-button" disabled={busy} onClick={() => void refreshQueue()}><RefreshCw size={15}/>{busy ? "Refreshing…" : "Refresh queue"}</button></div>
    {queue.length ? <div className="record-list">{queue.map(record => <article className="record-card" key={record.id}><div className="record-symbol"><MessageCircle size={20}/></div><div className="record-main"><h3>{record.targetLabel || record.contactName || record.phone}</h3><p>{record.recipientType === "group" ? "Official group" : "Individual"} <span>•</span> {record.templateName || "No template"} <span>•</span> {record.scheduledAt ? new Date(record.scheduledAt).toLocaleString() : "No send time"}</p>{record.audienceLabel && <small>Batch: {record.audienceLabel}</small>}<small>Destination: {record.phone}</small><small>Status: {record.status}{record.stopOnReply ? " · Stop on reply enabled" : ""}{record.attemptCount ? " · Attempts: " + record.attemptCount : ""}</small>{record.lastError && <small className="wa-connection-error">{record.lastError}</small>}</div><div className="record-side"><span className={"status-pill status-" + record.status}>{record.status}</span>{record.status === "scheduled" && <button className="delete-button" onClick={() => void cancel(record)} aria-label="Cancel follow-up"><X size={15}/></button>}</div></article>)}</div> : <div className="wa-empty"><MessageCircle size={23}/><strong>No follow-ups queued</strong><p>Schedule one message or import CSV. Automatic sends require Meta connection, deployed Edge Functions and a scheduled worker.</p></div>}
  </section>;
}
