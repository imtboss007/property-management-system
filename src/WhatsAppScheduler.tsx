import { useEffect, useMemo, useState } from "react";
import {
  MessageCircle, CalendarClock, CheckCircle2, QrCode, RefreshCw, Smartphone,
  Ban, RotateCcw, Send, Unplug, ShieldCheck, Info
} from "lucide-react";

type ContactOption = { id: string; name: string; phone: string; role?: string };
type ScheduleRow = {
  id: string; seriesId?: string; sequence?: number; repeatCount?: number;
  phone: string; contactName: string; message: string; scheduledAt: string;
  status: "scheduled" | "sending" | "sent" | "failed" | "cancelled" | string;
  consentConfirmed: boolean; stopOnReply: boolean; createdAt: string;
  sentAt?: string; lastError?: string;
};
type DirectStatus = {
  supported: boolean; platform: string; connected: boolean; connecting: boolean;
  senderNumber: string; displayName: string; qrDataUrl: string; pairingCode: string;
  error: string; lastConnectedAt: string;
};
type BridgeUpdate = { reason?: string; status?: DirectStatus; queue?: ScheduleRow[] };
type WhatsAppApi = {
  getStatus: () => Promise<DirectStatus>;
  getQueue: () => Promise<ScheduleRow[]>;
  connect: () => Promise<{ ok: boolean }>;
  requestPairingCode: (phone: string) => Promise<{ ok: boolean; code: string }>;
  disconnect: () => Promise<{ ok: boolean }>;
  schedule: (payload: Record<string, unknown>) => Promise<{ ok: boolean; rows: ScheduleRow[] }>;
  sendNow: (payload: Record<string, unknown>) => Promise<{ ok: boolean; rows: ScheduleRow[] }>;
  cancel: (id: string) => Promise<{ ok: boolean; message?: string }>;
  retry: (id: string) => Promise<{ ok: boolean; message?: string }>;
  onUpdate: (callback: (payload: BridgeUpdate) => void) => () => void;
};
declare global {
  interface Window { estateflowWhatsApp?: WhatsAppApi }
}

type Props = { contacts?: ContactOption[]; onNotice: (message: string) => void };
const localDate = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};
const localTime = () => {
  const date = new Date(Date.now() + 5 * 60000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(11, 16);
};
const prettyDate = (value: string) => {
  const time = new Date(value);
  return Number.isFinite(time.getTime()) ? time.toLocaleString() : value;
};

export default function WhatsAppScheduler({ contacts = [], onNotice }: Props) {
  const api = window.estateflowWhatsApp;
  const supported = Boolean(api);
  const [status, setStatus] = useState<DirectStatus>({
    supported, platform: supported ? "windows-desktop" : "android-or-browser",
    connected: false, connecting: false, senderNumber: "", displayName: "",
    qrDataUrl: "", pairingCode: "", error: "", lastConnectedAt: ""
  });
  const [queue, setQueue] = useState<ScheduleRow[]>([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [target, setTarget] = useState("");
  const [contactName, setContactName] = useState("");
  const [message, setMessage] = useState("Hello, I am following up on our property discussion. Please let me know a convenient time to talk.");
  const [date, setDate] = useState(localDate());
  const [time, setTime] = useState(localTime());
  const [sendMode, setSendMode] = useState<"once" | "repeat">("once");
  const [repeatCount, setRepeatCount] = useState("3");
  const [intervalDays, setIntervalDays] = useState("3");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [stopOnReply, setStopOnReply] = useState(true);
  const [pairPhone, setPairPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [localNotice, setLocalNotice] = useState("");

  const selectedContact = useMemo(
    () => contacts.find(contact => contact.id === selectedContactId),
    [contacts, selectedContactId]
  );

  useEffect(() => {
    if (!api) return;
    let active = true;
    const refresh = async () => {
      try {
        const [nextStatus, nextQueue] = await Promise.all([api.getStatus(), api.getQueue()]);
        if (!active) return;
        setStatus(nextStatus);
        setQueue(nextQueue);
      } catch (error) {
        if (active) setLocalNotice(error instanceof Error ? error.message : String(error));
      }
    };
    void refresh();
    const unsubscribe = api.onUpdate(payload => {
      if (!active) return;
      if (payload.status) setStatus(payload.status);
      if (payload.queue) setQueue(payload.queue);
      if (payload.reason === "sent") setLocalNotice("WhatsApp message sent.");
      if (payload.reason === "reply-detected") setLocalNotice("A reply was detected. Pending follow-ups to that contact were cancelled.");
      if (payload.reason === "connection-lost") setLocalNotice("WhatsApp disconnected. Pending messages remain saved; reconnect before they are due.");
    });
    return () => { active = false; unsubscribe(); };
  }, [api]);

  useEffect(() => {
    if (!selectedContact) return;
    setContactName(selectedContact.name);
    setTarget(selectedContact.phone);
  }, [selectedContact]);

  const inform = (text: string) => {
    setLocalNotice(text);
    onNotice(text);
  };

  const connectQr = async () => {
    if (!api) return;
    setBusy(true);
    try {
      await api.connect();
      inform("WhatsApp is starting. Scan the QR code below using WhatsApp → Linked devices → Link a device.");
      const latest = await api.getStatus();
      setStatus(latest);
    } catch (error) {
      inform("Could not start WhatsApp linking: " + (error instanceof Error ? error.message : String(error)));
    } finally { setBusy(false); }
  };

  const pairWithCode = async () => {
    if (!api) return;
    if (!pairPhone.trim()) { inform("Enter your WhatsApp phone number with country code, for example +91 9876543210."); return; }
    setBusy(true);
    try {
      const result = await api.requestPairingCode(pairPhone);
      const latest = await api.getStatus();
      setStatus(latest);
      inform("Pairing code generated. On your phone, open WhatsApp → Linked devices → Link a device → Link with phone number, then enter the code.");
      if (result.code) setStatus(previous => ({ ...previous, pairingCode: result.code, qrDataUrl: "" }));
    } catch (error) {
      inform("Could not generate a pairing code: " + (error instanceof Error ? error.message : String(error)));
    } finally { setBusy(false); }
  };

  const disconnect = async () => {
    if (!api) return;
    if (!window.confirm("Disconnect this WhatsApp linked device from EstateFlow? Saved scheduled messages will remain in the queue.")) return;
    setBusy(true);
    try {
      await api.disconnect();
      setStatus(await api.getStatus());
      inform("WhatsApp device disconnected. Your saved schedule remains on this PC.");
    } catch (error) {
      inform("Could not disconnect WhatsApp: " + (error instanceof Error ? error.message : String(error)));
    } finally { setBusy(false); }
  };

  const makePayload = () => {
    const due = new Date(date + "T" + time + ":00");
    if (!target.trim()) throw new Error("Select a saved contact or enter the recipient's phone number.");
    if (!message.trim()) throw new Error("Write the message to send.");
    if (!Number.isFinite(due.getTime())) throw new Error("Choose a valid date and time.");
    if (!consentConfirmed) throw new Error("Confirm that the client expects and has agreed to receive these messages.");
    return {
      phone: target, contactName: contactName.trim(), message: message.trim(),
      scheduledAt: due.toISOString(),
      repeatCount: sendMode === "repeat" ? Number(repeatCount) : 1,
      intervalDays: Number(intervalDays),
      consentConfirmed, stopOnReply
    };
  };

  const scheduleMessage = async (immediate: boolean) => {
    if (!api) {
      inform("Direct WhatsApp scheduling runs in the Windows desktop app. The Android APK cannot host the linked-device socket by itself; connect through the Windows host to send scheduled messages.");
      return;
    }
    setBusy(true);
    try {
      const payload = makePayload();
      if (!immediate && new Date(String(payload.scheduledAt)).getTime() <= Date.now()) {
        throw new Error("Choose a future send time.");
      }
      const result = immediate ? await api.sendNow(payload) : await api.schedule(payload);
      setQueue(await api.getQueue());
      setConsentConfirmed(false);
      inform(immediate
        ? "Message added to the send queue and will be sent shortly if WhatsApp is connected."
        : "Scheduled " + result.rows.length + " message" + (result.rows.length === 1 ? "" : "s") + " on this PC. Keep EstateFlow running in the Windows system tray.");
    } catch (error) {
      inform("Could not schedule message: " + (error instanceof Error ? error.message : String(error)));
    } finally { setBusy(false); }
  };

  const cancelRow = async (row: ScheduleRow) => {
    if (!api) return;
    try {
      const result = await api.cancel(row.id);
      if (!result.ok) throw new Error(result.message || "This message can no longer be cancelled.");
      setQueue(await api.getQueue());
      inform("Scheduled message cancelled.");
    } catch (error) {
      inform("Could not cancel message: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const retryRow = async (row: ScheduleRow) => {
    if (!api) return;
    try {
      const result = await api.retry(row.id);
      if (!result.ok) throw new Error(result.message || "This message cannot be retried.");
      setQueue(await api.getQueue());
      inform("Failed message requeued for delivery in one minute.");
    } catch (error) {
      inform("Could not requeue message: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const counts = useMemo(() => ({
    scheduled: queue.filter(row => row.status === "scheduled" || row.status === "sending").length,
    sent: queue.filter(row => row.status === "sent").length,
    failed: queue.filter(row => row.status === "failed").length,
    cancelled: queue.filter(row => row.status === "cancelled").length
  }), [queue]);

  return <section className="data-panel whatsapp-workspace">
    <div className="section-heading">
      <div><span className="section-kicker">DIRECT LINKED DEVICE</span><h2>WhatsApp automation</h2>
        <p>Link your own WhatsApp account, select a contact, and schedule one message or a follow-up sequence.</p>
      </div>
      <MessageCircle size={22}/>
    </div>

    <section className={"wa-connection-card " + (status.connected ? "wa-connected" : "wa-disconnected")}>
      <div className="wa-connection-icon"><MessageCircle size={23}/></div>
      <div className="wa-connection-copy">
        <strong>{status.connected ? "WhatsApp linked and connected" : status.connecting ? "Connecting to WhatsApp…" : supported ? "WhatsApp device not connected" : "Windows linked-device service required"}</strong>
        <p>{status.connected
          ? "Connected account: " + (status.senderNumber ? "+" + status.senderNumber : status.displayName || "Linked WhatsApp account")
          : supported ? "Choose QR scan or phone-number pairing code to link your WhatsApp account."
          : "This Android/browser build is a companion interface. The Windows EstateFlow app runs the direct linked-device connection and scheduled sender; it must be running on the same computer/network to deliver messages."}</p>
        <small>{status.connected ? "Session saved locally on this Windows user profile." : "WhatsApp linking does not use Supabase. The linked session stays on the Windows PC."}</small>
        {status.error && <small className="wa-connection-error">{status.error}</small>}
      </div>
      {supported && (status.connected
        ? <button className="secondary-button" disabled={busy} onClick={() => void disconnect()}><Unplug size={15}/>Disconnect</button>
        : <button className="secondary-button" disabled={busy || status.connecting} onClick={() => void connectQr()}><QrCode size={15}/>{busy ? "Starting…" : "Connect with QR"}</button>)}
    </section>

    {supported && !status.connected && <div className="wa-link-options">
      <div className="wa-qr-panel">
        <div className="wa-qr-heading"><QrCode size={17}/><strong>Option 1 · Scan QR code</strong></div>
        {status.qrDataUrl
          ? <img className="wa-qr-image" src={status.qrDataUrl} alt="WhatsApp linked-device QR code"/>
          : <div className="wa-qr-placeholder"><Smartphone size={26}/><span>Tap “Connect with QR”, then scan this code from WhatsApp on your phone.</span></div>}
        <p>WhatsApp on your phone → <strong>Linked devices</strong> → <strong>Link a device</strong>.</p>
      </div>
      <div className="wa-pair-panel">
        <div className="wa-qr-heading"><Smartphone size={17}/><strong>Option 2 · Pairing code</strong></div>
        <label>WhatsApp phone number with country code<input value={pairPhone} onChange={event => setPairPhone(event.target.value)} placeholder="+91 9876543210" inputMode="tel"/></label>
        <button className="secondary-button" disabled={busy || status.connected} onClick={() => void pairWithCode()}><RefreshCw size={15}/>{busy ? "Generating…" : "Generate pairing code"}</button>
        {status.pairingCode && <div className="wa-pair-code">{status.pairingCode}</div>}
        <p>On WhatsApp, choose <strong>Linked devices → Link a device → Link with phone number</strong> and enter the code. This is a WhatsApp pairing code, not your WhatsApp PIN or password.</p>
      </div>
    </div>}

    {!supported && <div className="notice notice-warn wa-platform-note">
      <Info size={18}/><div><strong>Android delivery note</strong><p>The APK currently cannot run Baileys' Node.js linked-device engine by itself. Link the WhatsApp number in the Windows desktop app, which keeps the scheduled queue running in the tray. Standalone Android sending would require a native engine or a separately hosted service.</p></div>
    </div>}

    <div className="notice notice-warn">
      <ShieldCheck size={18}/><div><strong>Account and consent notice</strong>
        <p>This connection uses an unofficial WhatsApp Web-compatible library, not Meta’s official Business Platform. WhatsApp may disconnect or restrict accounts using unofficial clients. Use it only for expected, consent-based client follow-ups; do not send unsolicited bulk messages. Session data is stored locally on this PC, not in Supabase.</p>
      </div>
    </div>

    <div className="wa-mode-switch" role="tablist" aria-label="Schedule mode">
      <button className={sendMode === "once" ? "wa-mode-active" : ""} onClick={() => setSendMode("once")} role="tab" aria-selected={sendMode === "once"}>Send once</button>
      <button className={sendMode === "repeat" ? "wa-mode-active" : ""} onClick={() => setSendMode("repeat")} role="tab" aria-selected={sendMode === "repeat"}>Repeat follow-up</button>
    </div>

    <div className="form-card wa-form">
      <label>Select saved contact
        <span>Contacts come from your EstateFlow Contacts section. You can also type a number below.</span>
        <select value={selectedContactId} onChange={event => setSelectedContactId(event.target.value)}>
          <option value="">Choose a contact (optional)</option>
          {contacts.filter(contact => contact.phone.trim()).map(contact =>
            <option key={contact.id} value={contact.id}>{contact.name} · {contact.phone}{contact.role ? " · " + contact.role : ""}</option>
          )}
        </select>
      </label>
      <div className="form-two">
        <label>Client / contact name<input value={contactName} onChange={event => setContactName(event.target.value)} placeholder="Client name"/></label>
        <label>WhatsApp number<input value={target} onChange={event => { setTarget(event.target.value); setSelectedContactId(""); }} placeholder="+91 9876543210" inputMode="tel"/></label>
      </div>
      <label>Message to send<textarea rows={4} maxLength={4000} value={message} onChange={event => setMessage(event.target.value)} placeholder="Write a client follow-up message…"/></label>
      <div className="form-two">
        <label>First send date<input type="date" min={localDate()} value={date} onChange={event => setDate(event.target.value)}/></label>
        <label>First send time<input type="time" value={time} onChange={event => setTime(event.target.value)}/></label>
      </div>
      {sendMode === "repeat" && <div className="form-two wa-repeat-fields">
        <label>Total sends, including first<input type="number" min="2" max="20" value={repeatCount} onChange={event => setRepeatCount(event.target.value)}/><span>Maximum 20 scheduled sends in one sequence.</span></label>
        <label>Repeat every (days)<input type="number" min="1" max="365" value={intervalDays} onChange={event => setIntervalDays(event.target.value)}/><span>For example, 3 sends every 3 days.</span></label>
      </div>}
      <label className="consent-check"><input type="checkbox" checked={consentConfirmed} onChange={event => setConsentConfirmed(event.target.checked)}/> I confirm this recipient expects and has agreed to receive these follow-up messages.</label>
      <label className="consent-check"><input type="checkbox" checked={stopOnReply} onChange={event => setStopOnReply(event.target.checked)}/> Stop all pending follow-ups automatically when this contact replies.</label>
      <div className="form-actions wa-schedule-actions">
        <button className="secondary-button" disabled={busy || !supported} onClick={() => void scheduleMessage(true)}><Send size={16}/>Send now</button>
        <button className="primary-button" disabled={busy || !supported || !consentConfirmed || !target.trim() || !message.trim()} onClick={() => void scheduleMessage(false)}><CalendarClock size={16}/>{busy ? "Saving…" : sendMode === "once" ? "Schedule one message" : "Schedule follow-up sequence"}</button>
      </div>
      <p className="wa-local-storage-note"><CheckCircle2 size={14}/> Messages are saved to local storage on this Windows PC. Keep EstateFlow running in the tray, and leave the PC connected to the internet, for delivery at the scheduled time.</p>
    </div>

    {localNotice && <div className="notice"><Info size={16}/>{localNotice}</div>}

    <div className="wa-stats-grid">
      <div><span>Pending</span><strong>{counts.scheduled}</strong></div>
      <div><span>Sent</span><strong>{counts.sent}</strong></div>
      <div><span>Failed</span><strong>{counts.failed}</strong></div>
      <div><span>Cancelled</span><strong>{counts.cancelled}</strong></div>
    </div>

    <div className="section-heading wa-queue-heading">
      <div><span className="section-kicker">LOCAL SCHEDULE</span><h2>Scheduled messages</h2><p>Delivery state and follow-up history for this Windows profile.</p></div>
      {supported && <button className="secondary-button" onClick={() => void api.getQueue().then(setQueue)}><RefreshCw size={15}/>Refresh</button>}
    </div>
    {queue.length === 0 ? <div className="empty-state"><CalendarClock size={24}/><strong>No scheduled messages yet</strong><p>Choose a contact and schedule your first follow-up above.</p></div> :
      <div className="record-list wa-queue-list">
        {queue.map(row => <article className="record-card wa-queue-row" key={row.id}>
          <div className="record-symbol"><MessageCircle size={19}/></div>
          <div className="record-main">
            <h3>{row.contactName || row.phone}{row.sequence && row.repeatCount && row.repeatCount > 1 ? " · " + row.sequence + "/" + row.repeatCount : ""}</h3>
            <p>{row.phone} · {prettyDate(row.scheduledAt)}</p>
            <small>{row.message}</small>
            <span className={"wa-status wa-status-" + row.status}>{row.status}</span>
            {row.lastError && <small className="wa-queue-error">{row.lastError}</small>}
          </div>
          <div className="record-side">
            {row.status === "scheduled" && supported && <button className="delete-button" onClick={() => void cancelRow(row)} aria-label="Cancel scheduled message"><Ban size={15}/></button>}
            {row.status === "failed" && supported && <button className="edit-button" onClick={() => void retryRow(row)} aria-label="Retry failed message"><RotateCcw size={15}/></button>}
          </div>
        </article>)}
      </div>}
  </section>;
}
