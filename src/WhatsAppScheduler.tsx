import { useEffect, useMemo, useState } from "react";
import {
  MessageCircle, CalendarClock, CheckCircle2, QrCode, RefreshCw, Smartphone,
  Ban, RotateCcw, Send, Unplug, ShieldCheck, Info, Users
} from "lucide-react";

type ContactOption = { id: string; name: string; phone: string; role?: string; whatsappName?: string; whatsappJid?: string };
type PropertyOption = { id: string; title: string };
type WhatsAppGroupOption = { id: string; jid: string; name: string; description?: string; size?: number; lastSyncedAt?: string };
type SyncedWhatsAppContact = { id: string; jid: string; phone: string; name: string; whatsappName?: string; notify?: string; verifiedName?: string; source?: string; lastSyncedAt?: string };
type WhatsAppAddressBook = { contacts: SyncedWhatsAppContact[]; groups: WhatsAppGroupOption[]; lastSyncedAt: string; connected: boolean; counts?: { contacts: number; groups: number }; warnings?: string[]; note?: string };
type ScheduleRow = {
  id: string; seriesId?: string; sequence?: number; repeatCount?: number;
  destinationType?: "contact" | "group"; groupJid?: string; groupName?: string;
  phone: string; contactId?: string; contactName: string; message: string; scheduledAt: string;
  propertyId?: string; propertyTitle?: string; taskId?: string; taskTitle?: string;
  status: "scheduled" | "sending" | "sent" | "failed" | "cancelled" | string;
  consentConfirmed: boolean; stopOnReply: boolean; createdAt: string;
  sentAt?: string; lastError?: string; deliveryStatus?: string;
};
type DirectStatus = {
  supported: boolean; platform: string; connected: boolean; connecting: boolean;
  senderNumber: string; displayName: string; qrDataUrl: string; pairingCode: string;
  error: string; lastConnectedAt: string;
  webhook?: { configured: boolean; reason?: string; error?: string; provider?: string };
};
type BridgeUpdate = { reason?: string; status?: DirectStatus; queue?: ScheduleRow[] };
type BridgeInfo = { port: number; urls: string[]; token: string };
type CompanionResponse = { ok?: boolean; error?: string; status?: DirectStatus; queue?: ScheduleRow[]; rows?: ScheduleRow[]; code?: string; message?: string; addressBook?: WhatsAppAddressBook; contacts?: SyncedWhatsAppContact[]; groups?: WhatsAppGroupOption[]; lastSyncedAt?: string; connected?: boolean; counts?: { contacts: number; groups: number }; warnings?: string[]; note?: string };
type WhatsAppApi = {
  getStatus: () => Promise<DirectStatus>;
  getBridgeInfo?: () => Promise<BridgeInfo>;
  getQueue: () => Promise<ScheduleRow[]>;
  getAddressBook: () => Promise<WhatsAppAddressBook>;
  syncAddressBook: () => Promise<WhatsAppAddressBook>;
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

function readSaved(key: string) {
  try { return localStorage.getItem(key) || ""; } catch { return ""; }
}

function createRemoteApi(host: string, token: string): WhatsAppApi {
  const base = host.trim().replace(/\/+$/, "");
  const request = async (path: string, method: "GET" | "POST" = "GET", body?: Record<string, unknown>): Promise<CompanionResponse> => {
    if (!/^https?:\/\//i.test(base)) throw new Error("Enter an http:// local address or an https:// secured address.");
    const response = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", "X-EstateFlow-Token": token },
      body: method === "POST" ? JSON.stringify(body || {}) : undefined
    });
    let data: CompanionResponse;
    try { data = await response.json() as CompanionResponse; }
    catch { throw new Error("The Windows PC returned an unreadable response."); }
    if (!response.ok || data.ok === false) throw new Error(data.error || ("Windows PC request failed (" + response.status + ")."));
    return data;
  };
  const fallbackStatus = (): DirectStatus => ({ supported: true, platform: "windows-desktop", connected: false, connecting: false, senderNumber: "", displayName: "", qrDataUrl: "", pairingCode: "", error: "", lastConnectedAt: "" });
  return {
    getStatus: async () => (await request("/api/status")).status || fallbackStatus(),
    getQueue: async () => (await request("/api/queue")).queue || [],
    getAddressBook: async () => {
      const data = await request("/api/address-book");
      return data.addressBook || { contacts: data.contacts || [], groups: data.groups || [], lastSyncedAt: data.lastSyncedAt || "", connected: Boolean(data.connected), counts: data.counts };
    },
    syncAddressBook: async () => {
      const data = await request("/api/sync-address-book", "POST");
      return data.addressBook || { contacts: data.contacts || [], groups: data.groups || [], lastSyncedAt: data.lastSyncedAt || "", connected: Boolean(data.connected), counts: data.counts, warnings: data.warnings, note: data.note };
    },
    connect: async () => { const data = await request("/api/connect", "POST"); return { ok: Boolean(data.ok) }; },
    requestPairingCode: async phone => { const data = await request("/api/pairing-code", "POST", { phone }); return { ok: Boolean(data.ok), code: String(data.code || "") }; },
    disconnect: async () => { const data = await request("/api/disconnect", "POST"); return { ok: Boolean(data.ok) }; },
    schedule: async payload => { const data = await request("/api/schedule", "POST", payload); return { ok: Boolean(data.ok), rows: data.rows || [] }; },
    sendNow: async payload => { const data = await request("/api/send-now", "POST", payload); return { ok: Boolean(data.ok), rows: data.rows || [] }; },
    cancel: async id => { const data = await request("/api/cancel", "POST", { id }); return { ok: Boolean(data.ok), message: data.message }; },
    retry: async id => { const data = await request("/api/retry", "POST", { id }); return { ok: Boolean(data.ok), message: data.message }; },
    onUpdate: () => () => {}
  };
}

type Props = { contacts?: ContactOption[]; properties?: PropertyOption[]; savedGroups?: WhatsAppGroupOption[]; onImportContacts?: (contacts: SyncedWhatsAppContact[]) => void; onImportGroups?: (groups: WhatsAppGroupOption[]) => void; initialContactId?: string; initialPropertyId?: string; initialTaskId?: string; initialTaskTitle?: string; onNotice: (message: string) => void };
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

export default function WhatsAppScheduler({ contacts = [], properties = [], savedGroups = [], onImportContacts, onImportGroups, initialContactId, initialPropertyId, initialTaskId, initialTaskTitle, onNotice }: Props) {
  const localApi = window.estateflowWhatsApp;
  const [companionHost, setCompanionHost] = useState(() => readSaved("estateflow.whatsapp.host"));
  const [companionToken, setCompanionToken] = useState(() => readSaved("estateflow.whatsapp.token"));
  const [hostInput, setHostInput] = useState(() => readSaved("estateflow.whatsapp.host"));
  const [tokenInput, setTokenInput] = useState(() => readSaved("estateflow.whatsapp.token"));
  const [bridgeInfo, setBridgeInfo] = useState<BridgeInfo | null>(null);
  const api = useMemo<WhatsAppApi | undefined>(() => {
    // A saved hub is the selected transport; otherwise keep the built-in Windows fallback.
    // A single queue row is never sent through both transports.
    if (companionHost.trim() && companionToken.trim()) return createRemoteApi(companionHost, companionToken);
    if (localApi) return localApi;
    return undefined;
  }, [localApi, companionHost, companionToken]);
  const supported = Boolean(api);
  const [status, setStatus] = useState<DirectStatus>({
    supported, platform: supported ? "windows-desktop" : "android-or-browser",
    connected: false, connecting: false, senderNumber: "", displayName: "",
    qrDataUrl: "", pairingCode: "", error: "", lastConnectedAt: ""
  });
  const [queue, setQueue] = useState<ScheduleRow[]>([]);
  const [addressBook, setAddressBook] = useState<WhatsAppAddressBook>({ contacts: [], groups: [], lastSyncedAt: "", connected: false });
  const [syncBusy, setSyncBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [recipientMode, setRecipientMode] = useState<"contact" | "group">("contact");
  const [selectedGroupJid, setSelectedGroupJid] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedTaskTitle, setSelectedTaskTitle] = useState("");
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
  const groupOptions = useMemo(() => {
    const byJid = new Map<string, WhatsAppGroupOption>();
    for (const group of [...savedGroups, ...addressBook.groups]) {
      const jid = String(group.jid || group.id || "");
      if (!jid.endsWith("@g.us")) continue;
      byJid.set(jid, { ...byJid.get(jid), ...group, id: group.id || jid, jid, name: group.name || group.subject || byJid.get(jid)?.name || "WhatsApp group" });
    }
    return Array.from(byJid.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [savedGroups, addressBook.groups]);
  const selectedGroup = useMemo(() => groupOptions.find(group => group.jid === selectedGroupJid), [groupOptions, selectedGroupJid]);

  useEffect(() => {
    if (!api) return;
    let active = true;
    const refresh = async () => {
      try {
        const [nextStatus, nextQueue] = await Promise.all([api.getStatus(), api.getQueue()]);
        if (!active) return;
        setStatus(nextStatus);
        setQueue(nextQueue);
        try {
          const nextAddressBook = await api.getAddressBook();
          if (active) setAddressBook(nextAddressBook);
        } catch { /* Some remote senders do not expose address-book sync; keep the saved cache visible. */ }
      } catch (error) {
        if (active) setStatus(previous => ({ ...previous, error: error instanceof Error ? error.message : String(error) }));
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
    const poll = window.setInterval(() => { void refresh(); }, 8000);
    return () => { active = false; unsubscribe(); window.clearInterval(poll); };
  }, [api, localApi]);

  useEffect(() => {
    if (!localApi?.getBridgeInfo || (companionHost.trim() && companionToken.trim())) return;
    void localApi.getBridgeInfo().then(setBridgeInfo).catch(error => {
      setLocalNotice("Could not load phone companion details: " + (error instanceof Error ? error.message : String(error)));
    });
  }, [localApi, companionHost, companionToken]);

  useEffect(() => {
    if (initialContactId) setSelectedContactId(initialContactId);
    if (initialPropertyId) setSelectedPropertyId(initialPropertyId);
    if (initialTaskId) setSelectedTaskId(initialTaskId);
    if (initialTaskTitle) setSelectedTaskTitle(initialTaskTitle);
  }, [initialContactId, initialPropertyId, initialTaskId, initialTaskTitle]);

  useEffect(() => {
    if (!selectedContact) return;
    setContactName(selectedContact.name);
    setTarget(selectedContact.phone);
  }, [selectedContact]);

  const inform = (text: string) => {
    setLocalNotice(text);
    onNotice(text);
  };

  const saveCompanionSettings = () => {
    const host = hostInput.trim().replace(/\/+$/, "");
    let parsed: URL;
    try { parsed = new URL(host); }
    catch { inform("Enter a full hub address, such as http://192.168.1.10:47822 or an HTTPS address."); return; }
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.username || parsed.password) {
      inform("Enter only the hub address and port. Use HTTPS for remote access; HTTP is for a trusted local network.");
      return;
    }
    const hostname = parsed.hostname.toLowerCase();
    const localHost = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname)
      || hostname.endsWith(".local")
      || /^10\./.test(hostname)
      || /^192\.168\./.test(hostname)
      || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
    if (parsed.protocol === "http:" && !localHost) {
      inform("Use HTTPS for a hub outside your trusted local network.");
      return;
    }
    if (!tokenInput.trim()) { inform("Enter the EstateFlow hub token from the private hub configuration."); return; }
    try {
      localStorage.setItem("estateflow.whatsapp.host", host);
      localStorage.setItem("estateflow.whatsapp.token", tokenInput.trim());
    } catch {}
    setCompanionHost(host);
    setCompanionToken(tokenInput.trim());
    inform("EstateFlow hub connection saved. The connection status will show whether the gateway is reachable.");
  };

    const copyValue = async (value: string, label: string) => {
    try { await navigator.clipboard.writeText(value); inform(label + " copied."); }
    catch { inform("Select the " + label.toLowerCase() + " field and copy it manually."); }
  };

  const applyAddressBook = (book: WhatsAppAddressBook) => {
    setAddressBook(book);
    if (book.contacts.length) onImportContacts?.(book.contacts);
    if (book.groups.length) onImportGroups?.(book.groups);
  };

  const importSavedAddressBook = async () => {
    if (!api) {
      inform("Open EstateFlow on the Windows PC or connect to its companion address to import the saved WhatsApp cache.");
      return;
    }
    setImportBusy(true);
    try {
      const book = await api.getAddressBook();
      applyAddressBook(book);
      inform(`Saved cache loaded: ${book.contacts.length} WhatsApp contacts and ${book.groups.length} groups. EstateFlow keeps these records when WhatsApp is disconnected.`);
    } catch (error) {
      inform("Could not load the saved WhatsApp cache: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setImportBusy(false);
    }
  };

  const syncWhatsAppAddressBook = async () => {
    if (!api) {
      inform("Open the Windows EstateFlow app or connect to your Windows companion first.");
      return;
    }
    setSyncBusy(true);
    try {
      const book = await api.syncAddressBook();
      applyAddressBook(book);
      const warningText = (book.warnings || []).join(" ");
      inform(`WhatsApp sync finished: ${book.contacts.length} contacts and ${book.groups.length} groups saved in EstateFlow. ${book.note || ""} ${warningText}`.trim());
    } catch (error) {
      try {
        const cached = await api.getAddressBook();
        setAddressBook(cached);
      } catch {}
      inform("Live sync did not complete. Your previously saved contacts/groups have not been deleted. " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setSyncBusy(false);
    }
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
    if (recipientMode === "group" && !selectedGroup) throw new Error("Select a WhatsApp group from your saved group list.");
    if (recipientMode === "contact" && !target.trim()) throw new Error("Select a saved contact or enter the recipient's phone number.");
    if (!message.trim()) throw new Error("Write the message to send.");
    if (!Number.isFinite(due.getTime())) throw new Error("Choose a valid date and time.");
    if (!consentConfirmed) throw new Error("Confirm that this recipient or group expects and has agreed to receive these messages.");
    const linkedProperty = properties.find(property => property.id === selectedPropertyId);
    return {
      destinationType: recipientMode,
      groupJid: recipientMode === "group" ? selectedGroup?.jid || "" : "",
      groupName: recipientMode === "group" ? selectedGroup?.name || "WhatsApp group" : "",
      phone: recipientMode === "contact" ? target : "",
      contactId: recipientMode === "contact" ? selectedContactId || "" : "",
      contactName: recipientMode === "contact" ? contactName.trim() : "",
      message: message.trim(),
      propertyId: linkedProperty?.id || "", propertyTitle: linkedProperty?.title || "",
      taskId: selectedTaskId, taskTitle: selectedTaskTitle,
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
      <div><span className="section-kicker">WHATSAPP CONNECTION</span><h2>WhatsApp automation</h2>
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
        <small>{status.platform.startsWith("gateway-") ? "The linked WhatsApp session and message queue live on the hub server." : status.connected ? "Session saved locally on this Windows user profile." : "Link the account through the configured sender; the session stays with that sender."}</small>
        {status.error && <small className="wa-connection-error">{status.error}</small>}
        {status.webhook && !status.webhook.configured && <small className="wa-connection-error">Automatic stop-on-reply is not active: {status.webhook.error || status.webhook.reason || "Webhook not configured."}</small>}
        {status.webhook?.configured && <small>Automatic stop-on-reply webhook registered with {status.webhook.provider || "the WhatsApp gateway"}.</small>}
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

    <section className="data-panel wa-companion-setup">
      <div className="section-heading"><div><span className="section-kicker">UNIFIED WHATSAPP HUB</span><h2>Connect EstateFlow to the hub</h2><p>Use one hub that connects EstateFlow to the configured WhatsApp gateway. Leave these fields empty on Windows to use the built-in sender.</p></div><Smartphone size={22}/></div>
      <label>Hub address<input value={hostInput} onChange={event => setHostInput(event.target.value)} placeholder="http://192.168.1.10:47822 or https://your-domain" autoCapitalize="none" autoCorrect="off"/></label>
      <label>EstateFlow hub token<input value={tokenInput} onChange={event => setTokenInput(event.target.value)} placeholder="Private token from hub configuration" autoCapitalize="none" autoCorrect="off"/></label>
      <div className="form-actions"><button className="primary-button" onClick={saveCompanionSettings}><CheckCircle2 size={15}/>Save hub connection</button>{companionHost && <button className="secondary-button" onClick={() => { try { localStorage.removeItem("estateflow.whatsapp.host"); localStorage.removeItem("estateflow.whatsapp.token"); } catch {} setCompanionHost(""); setCompanionToken(""); setHostInput(""); setTokenInput(""); inform("Saved hub connection removed. EstateFlow will use its built-in Windows sender when available."); }}><Unplug size={15}/>Forget hub</button>}</div>
      <p className="wa-local-storage-note"><Info size={14}/>Use HTTP only on a trusted private LAN. For remote access use HTTPS. Keep the hub token private; the WhatsApp gateway API key stays on the hub server.</p>
    </section>

        {localApi && bridgeInfo && !(companionHost.trim() && companionToken.trim()) && <section className="data-panel wa-companion-setup">
      <div className="section-heading"><div><span className="section-kicker">CONNECT YOUR ANDROID APP</span><h2>Windows companion details</h2><p>Enter one of these PC addresses and the companion code in EstateFlow on your Android phone.</p></div><Smartphone size={22}/></div>
      <label>Windows PC address<input readOnly value={bridgeInfo.urls[0] || ("http://your-pc-ip:" + bridgeInfo.port)} onFocus={event => event.currentTarget.select()}/></label>
      {bridgeInfo.urls.length > 1 && <label>Other available PC addresses<input readOnly value={bridgeInfo.urls.join("    ")} onFocus={event => event.currentTarget.select()}/></label>}
      <label>EstateFlow companion code<input readOnly value={bridgeInfo.token} onFocus={event => event.currentTarget.select()}/></label>
      <div className="form-actions"><button className="secondary-button" onClick={() => void copyValue(bridgeInfo.urls[0] || "", "Windows PC address")}><CheckCircle2 size={15}/>Copy address</button><button className="secondary-button" onClick={() => void copyValue(bridgeInfo.token, "Companion code")}><CheckCircle2 size={15}/>Copy code</button></div>
      <p className="wa-local-storage-note"><Info size={14}/>Share this code only with your own EstateFlow phone on a trusted network. Do not forward it or set up router port forwarding.</p>
    </section>}

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
      <div className="wa-mode-switch" role="tablist" aria-label="Message destination">
        <button className={recipientMode === "contact" ? "wa-mode-active" : ""} onClick={() => { setRecipientMode("contact"); setSelectedGroupJid(""); }} role="tab" aria-selected={recipientMode === "contact"}>Individual contact</button>
        <button className={recipientMode === "group" ? "wa-mode-active" : ""} onClick={() => { setRecipientMode("group"); setSelectedContactId(""); setTarget(""); }} role="tab" aria-selected={recipientMode === "group"}>WhatsApp group</button>
      </div>
      {recipientMode === "contact" ? <>
        <label>Select saved contact
          <span>Imported WhatsApp names and numbers are now available in EstateFlow Contacts.</span>
          <select size={Math.min(Math.max(contacts.filter(contact => contact.phone.trim()).length, 4), 7)} value={selectedContactId} onChange={event => setSelectedContactId(event.target.value)}>
            <option value="">Choose a contact</option>
            {contacts.filter(contact => contact.phone.trim()).map(contact =>
              <option key={contact.id} value={contact.id}>{contact.name}{contact.whatsappName && contact.whatsappName !== contact.name ? " · WhatsApp: " + contact.whatsappName : ""} · {contact.phone}{contact.role ? " · " + contact.role : ""}</option>
            )}
          </select>
        </label>
        <div className="form-two">
          <label>Client / contact name<input value={contactName} onChange={event => setContactName(event.target.value)} placeholder="Client name"/></label>
          <label>WhatsApp number<input value={target} onChange={event => { setTarget(event.target.value); setSelectedContactId(""); }} placeholder="+91 9876543210" inputMode="tel"/></label>
        </div>
      </> : <div className="wa-group-target">
        <label>Select saved WhatsApp group
          <span>Groups are cached in EstateFlow and remain visible when WhatsApp is disconnected. Sending requires the linked account to be connected.</span>
          <select size={Math.min(Math.max(groupOptions.length, 3), 7)} value={selectedGroupJid} onChange={event => setSelectedGroupJid(event.target.value)}>
            <option value="">Choose a WhatsApp group</option>
            {groupOptions.map(group => <option key={group.jid} value={group.jid}>{group.name}{group.size ? " · " + group.size + " members" : ""}</option>)}
          </select>
        </label>
        {selectedGroup && <div className="notice"><Users size={16}/><div><strong>{selectedGroup.name}</strong><p>{selectedGroup.size ? selectedGroup.size + " members · " : ""}WhatsApp group will be used as the message destination.</p></div></div>}
        {groupOptions.length === 0 && <div className="notice notice-warn">No synced groups saved yet. Connect WhatsApp and use “Sync WhatsApp contacts & groups” above.</div>}
      </div>
      <label>Link to property (optional)
        <select value={selectedPropertyId} onChange={event => setSelectedPropertyId(event.target.value)}>
          <option value="">No property selected</option>
          {properties.map(property => <option key={property.id} value={property.id}>{property.title}</option>)}
        </select>
      </label>
      {selectedTaskId && <div className="notice"><CalendarClock size={16}/> Linked to task: {selectedTaskTitle || selectedTaskId}</div>}
      <label>Message to send<textarea rows={4} maxLength={4000} value={message} onChange={event => setMessage(event.target.value)} placeholder="Write a client follow-up message…"/></label>
      <div className="form-two">
        <label>First send date<input type="date" min={localDate()} value={date} onChange={event => setDate(event.target.value)}/></label>
        <label>First send time<input type="time" value={time} onChange={event => setTime(event.target.value)}/></label>
      </div>
      {sendMode === "repeat" && <div className="form-two wa-repeat-fields">
        <label>Total sends, including first<input type="number" min="2" max="20" value={repeatCount} onChange={event => setRepeatCount(event.target.value)}/><span>Maximum 20 scheduled sends in one sequence.</span></label>
        <label>Repeat every (days)<input type="number" min="1" max="365" value={intervalDays} onChange={event => setIntervalDays(event.target.value)}/><span>For example, 3 sends every 3 days.</span></label>
      </div>}
      <label className="consent-check"><input type="checkbox" checked={consentConfirmed} onChange={event => setConsentConfirmed(event.target.checked)}/> I confirm this {recipientMode === "group" ? "WhatsApp group" : "recipient"} expects and has agreed to receive these follow-up messages.</label>
      <label className="consent-check"><input type="checkbox" checked={stopOnReply} onChange={event => setStopOnReply(event.target.checked)}/> Stop pending follow-ups when {recipientMode === "group" ? "a new message appears in this WhatsApp group" : "this contact replies"}.</label>
      <div className="form-actions wa-schedule-actions">
        <button className="secondary-button" disabled={busy || !supported} onClick={() => void scheduleMessage(true)}><Send size={16}/>Send now</button>
        <button className="primary-button" disabled={busy || !supported || !consentConfirmed || (recipientMode === "contact" ? !target.trim() : !selectedGroupJid) || !message.trim()} onClick={() => void scheduleMessage(false)}><CalendarClock size={16}/>{busy ? "Saving…" : sendMode === "once" ? "Schedule one message" : "Schedule follow-up sequence"}</button>
      </div>
      <p className="wa-local-storage-note"><CheckCircle2 size={14}/> Delivery runs through the active sender: the built-in Windows sender or the configured EstateFlow hub. Keep that sender/server running, connected, and online at the scheduled time.</p>
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
      {supported && <button className="secondary-button" onClick={() => { if (api) void api.getQueue().then(setQueue); }}><RefreshCw size={15}/>Refresh</button>}
    </div>
    {queue.length === 0 ? <div className="empty-state"><CalendarClock size={24}/><strong>No scheduled messages yet</strong><p>Choose a contact and schedule your first follow-up above.</p></div> :
      <div className="record-list wa-queue-list">
        {queue.map(row => <article className="record-card wa-queue-row" key={row.id}>
          <div className="record-symbol"><MessageCircle size={19}/></div>
          <div className="record-main">
            <h3>{row.destinationType === "group" ? row.groupName || "WhatsApp group" : row.contactName || row.phone}{row.sequence && row.repeatCount && row.repeatCount > 1 ? " · " + row.sequence + "/" + row.repeatCount : ""}</h3>
            <p>{row.destinationType === "group" ? row.groupJid : row.phone} · {prettyDate(row.scheduledAt)}</p>
            {row.propertyTitle && <small>Property: {row.propertyTitle}</small>}
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
