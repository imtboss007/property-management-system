import { useEffect, useMemo, useState } from "react";
import {
  MessageCircle, CalendarClock, CheckCircle2, QrCode, RefreshCw, Smartphone,
  Ban, RotateCcw, Send, Unplug, ShieldCheck, Info, Users, Search
} from "lucide-react";
import {
  cancelCloudWhatsAppMessage, getCloudWhatsAppStatus, listCloudWhatsAppMessages,
  retryCloudWhatsAppMessage, scheduleCloudWhatsAppMessages
} from "./lib/cloud-whatsapp";

type ContactOption = { id: string; name: string; phone: string; role?: string; whatsappName?: string; whatsappJid?: string };
type PropertyOption = { id: string; title: string };
type WhatsAppGroupOption = { id: string; jid: string; name: string; subject?: string; description?: string; size?: number; lastSyncedAt?: string };
type SyncedWhatsAppContact = { id: string; jid: string; phone: string; name: string; whatsappName?: string; notify?: string; verifiedName?: string; source?: string; lastSyncedAt?: string };
type WhatsAppAddressBook = { contacts: SyncedWhatsAppContact[]; groups: WhatsAppGroupOption[]; lastSyncedAt: string; connected: boolean; accountNumber?: string; activeGroupJids?: string[]; counts?: { contacts: number; groups: number }; warnings?: string[]; note?: string };
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
type BridgeInfo = { port: number; urls: string[]; pairCode: string; pairExpiresAt: number };
type CompanionResponse = { ok?: boolean; error?: string; status?: DirectStatus; queue?: ScheduleRow[]; rows?: ScheduleRow[]; code?: string; message?: string; addressBook?: WhatsAppAddressBook; contacts?: SyncedWhatsAppContact[]; groups?: WhatsAppGroupOption[]; lastSyncedAt?: string; connected?: boolean; accountNumber?: string; activeGroupJids?: string[]; counts?: { contacts: number; groups: number }; warnings?: string[]; note?: string };
type WhatsAppApi = {
  getStatus: () => Promise<DirectStatus>;
  getBridgeInfo?: () => Promise<BridgeInfo>;
  getLocalSyncConnection?: () => Promise<{ host: string; token: string }>;
  getDataSync?: () => Promise<{ ok: boolean; revision: number; updatedAt: string; snapshot: Partial<import("./lib/device-sync").DeviceSyncSnapshot> }>;
  saveDataSync?: (expectedRevision: number, snapshot: import("./lib/device-sync").DeviceSyncSnapshot) => Promise<{ ok: boolean; conflict?: boolean; revision: number; updatedAt: string; snapshot: Partial<import("./lib/device-sync").DeviceSyncSnapshot> }>;
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
      return data.addressBook || { contacts: data.contacts || [], groups: data.groups || [], lastSyncedAt: data.lastSyncedAt || "", connected: Boolean(data.connected), accountNumber: data.accountNumber || "", activeGroupJids: data.activeGroupJids || [], counts: data.counts };
    },
    syncAddressBook: async () => {
      const data = await request("/api/sync-address-book", "POST");
      return data.addressBook || { contacts: data.contacts || [], groups: data.groups || [], lastSyncedAt: data.lastSyncedAt || "", connected: Boolean(data.connected), accountNumber: data.accountNumber || "", activeGroupJids: data.activeGroupJids || [], counts: data.counts, warnings: data.warnings, note: data.note };
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

function createCloudApi(): WhatsAppApi {
  const fallbackStatus = (): DirectStatus => ({
    supported: true, platform: "cloud-whatsapp-business", connected: false, connecting: false,
    senderNumber: "", displayName: "", qrDataUrl: "", pairingCode: "", error: "", lastConnectedAt: ""
  });
  const status = async (): Promise<DirectStatus> => {
    const result = await getCloudWhatsAppStatus();
    return {
      ...fallbackStatus(),
      connected: Boolean(result.ready),
      senderNumber: result.senderNumber || "",
      displayName: result.displayName || "",
      error: result.ready ? "" : result.error || "Cloud WhatsApp is not ready."
    };
  };
  const queue = async () => await listCloudWhatsAppMessages() as ScheduleRow[];
  return {
    getStatus: status,
    getQueue: queue,
    getAddressBook: async () => ({
      contacts: [], groups: [], lastSyncedAt: "", connected: true,
      accountNumber: "", activeGroupJids: [], counts: { contacts: 0, groups: 0 },
      note: "The official cloud sender uses contacts saved in AXIVESTRA; it cannot read a personal WhatsApp address book."
    }),
    syncAddressBook: async () => {
      throw new Error("The official cloud sender cannot import a personal WhatsApp address book. Save contacts in AXIVESTRA; they sync with your company cloud.");
    },
    connect: async () => { throw new Error("Cloud WhatsApp connection is managed securely by the workspace administrator."); },
    requestPairingCode: async () => { throw new Error("The official cloud sender uses WhatsApp Business Platform onboarding, not a linked-device pairing code."); },
    disconnect: async () => { throw new Error("Manage the business sender connection in the workspace's Meta/WhatsApp settings."); },
    schedule: async payload => ({ ok: true, rows: await scheduleCloudWhatsAppMessages(payload as never, false) as ScheduleRow[] }),
    sendNow: async payload => ({ ok: true, rows: await scheduleCloudWhatsAppMessages(payload as never, true) as ScheduleRow[] }),
    cancel: async id => { await cancelCloudWhatsAppMessage(id); return { ok: true }; },
    retry: async id => { await retryCloudWhatsAppMessage(id); return { ok: true }; },
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

// Treat imported WhatsApp metadata as an additive cache: a transient empty/partial
// response must never erase contacts or group names already saved on this device.
// Verified group membership is deliberately NOT unioned across refreshes/accounts.
function mergeAddressBookCache(previous: WhatsAppAddressBook, incoming: WhatsAppAddressBook): WhatsAppAddressBook {
  const contacts: SyncedWhatsAppContact[] = [];
  for (const contact of [...previous.contacts, ...incoming.contacts]) {
    const digits = String(contact.phone || "").replace(/\D/g, "");
    const key = String(contact.jid || contact.id || "");
    const index = contacts.findIndex(saved => {
      const savedDigits = String(saved.phone || "").replace(/\D/g, "");
      const savedKey = String(saved.jid || saved.id || "");
      return Boolean((digits && savedDigits && digits === savedDigits) || (key && savedKey && key === savedKey));
    });
    if (index < 0) {
      contacts.push(contact);
    } else {
      const saved = contacts[index];
      contacts[index] = {
        ...saved,
        ...contact,
        id: contact.id || saved.id,
        jid: contact.jid || saved.jid,
        phone: contact.phone || saved.phone,
        name: contact.name || saved.name,
        whatsappName: contact.whatsappName || saved.whatsappName,
        notify: contact.notify || saved.notify,
        verifiedName: contact.verifiedName || saved.verifiedName,
        lastSyncedAt: contact.lastSyncedAt || saved.lastSyncedAt
      };
    }
  }

  const groups: WhatsAppGroupOption[] = [];
  for (const group of [...previous.groups, ...incoming.groups]) {
    const jid = String(group.jid || group.id || "");
    if (!jid.endsWith("@g.us")) continue;
    const index = groups.findIndex(saved => String(saved.jid || saved.id || "") === jid);
    if (index < 0) {
      groups.push({ ...group, jid });
    } else {
      const saved = groups[index];
      groups[index] = {
        ...saved,
        ...group,
        id: group.id || saved.id || jid,
        jid,
        name: group.name || group.subject || saved.name || saved.subject || "WhatsApp group",
        subject: group.subject || saved.subject || group.name || saved.name,
        description: group.description || saved.description,
        size: Number.isFinite(group.size) && Number(group.size) > 0 ? group.size : saved.size,
        lastSyncedAt: group.lastSyncedAt || saved.lastSyncedAt
      };
    }
  }
  contacts.sort((a, b) => String(a.whatsappName || a.name).localeCompare(String(b.whatsappName || b.name)));
  groups.sort((a, b) => a.name.localeCompare(b.name));

  const sameAccount = !previous.accountNumber || !incoming.accountNumber || previous.accountNumber === incoming.accountNumber;
  return {
    contacts,
    groups,
    lastSyncedAt: incoming.lastSyncedAt || previous.lastSyncedAt,
    connected: incoming.connected,
    accountNumber: incoming.accountNumber || previous.accountNumber || "",
    activeGroupJids: Array.isArray(incoming.activeGroupJids) ? incoming.activeGroupJids : (sameAccount ? previous.activeGroupJids || [] : []),
    counts: { contacts: contacts.length, groups: groups.length },
    warnings: incoming.warnings?.length ? incoming.warnings : previous.warnings,
    note: incoming.note || previous.note
  };
}

export default function WhatsAppScheduler({ contacts = [], properties = [], savedGroups = [], onImportContacts, onImportGroups, initialContactId, initialPropertyId, initialTaskId, initialTaskTitle, onNotice }: Props) {
  const localApi = window.estateflowWhatsApp;
  const [cloudMode, setCloudMode] = useState(false);
  const [companionHost] = useState(() => readSaved("estateflow.whatsapp.host"));
  const [companionToken] = useState(() => readSaved("estateflow.whatsapp.token"));
  const api = useMemo<WhatsAppApi | undefined>(() => {
    // Use the hosted sender when configured; otherwise retain the existing local/companion path.
    if (cloudMode) return createCloudApi();
    if (companionHost.trim() && companionToken.trim()) return createRemoteApi(companionHost, companionToken);
    if (localApi) return localApi;
    return undefined;
  }, [cloudMode, localApi, companionHost, companionToken]);
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
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientGroupSearch, setRecipientGroupSearch] = useState("");
  const [directoryContactSearch, setDirectoryContactSearch] = useState("");
  const [directoryGroupSearch, setDirectoryGroupSearch] = useState("");
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
  const [templateName, setTemplateName] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("en_US");
  const [templateBodyParameters, setTemplateBodyParameters] = useState("");
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
  const sendableGroupOptions = useMemo(() => status.connected
    ? groupOptions.filter(group => (addressBook.activeGroupJids || []).includes(group.jid) && (!addressBook.accountNumber || addressBook.accountNumber === status.senderNumber))
    : groupOptions, [groupOptions, status.connected, status.senderNumber, addressBook.activeGroupJids, addressBook.accountNumber]);
  const selectedGroup = useMemo(() => groupOptions.find(group => group.jid === selectedGroupJid), [groupOptions, selectedGroupJid]);
  const filteredRecipientContacts = useMemo(() => {
    const query = recipientSearch.trim().toLocaleLowerCase();
    return contacts
      .filter(contact => contact.phone.trim())
      .filter(contact => !query || `${contact.name} ${contact.whatsappName || ""} ${contact.phone} ${contact.role || ""}`.toLocaleLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [contacts, recipientSearch]);
  const filteredRecipientGroups = useMemo(() => {
    const query = recipientGroupSearch.trim().toLocaleLowerCase();
    return sendableGroupOptions.filter(group => !query || `${group.name} ${group.jid}`.toLocaleLowerCase().includes(query));
  }, [sendableGroupOptions, recipientGroupSearch]);
  const filteredDirectoryContacts = useMemo(() => {
    const query = directoryContactSearch.trim().toLocaleLowerCase();
    return addressBook.contacts.filter(contact => !query || `${contact.whatsappName || ""} ${contact.name} ${contact.phone}`.toLocaleLowerCase().includes(query));
  }, [addressBook.contacts, directoryContactSearch]);
  const filteredDirectoryGroups = useMemo(() => {
    const query = directoryGroupSearch.trim().toLocaleLowerCase();
    return groupOptions.filter(group => !query || `${group.name} ${group.jid}`.toLocaleLowerCase().includes(query));
  }, [groupOptions, directoryGroupSearch]);

  useEffect(() => {
    let active = true;
    void getCloudWhatsAppStatus().then(result => {
      if (active && result.configured) setCloudMode(true);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

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
          if (active) setAddressBook(previous => mergeAddressBookCache(previous, nextAddressBook));
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

  const applyAddressBook = (book: WhatsAppAddressBook) => {
    const merged = mergeAddressBookCache(addressBook, book);
    setAddressBook(merged);
    if (merged.contacts.length) onImportContacts?.(merged.contacts);
    if (merged.groups.length) onImportGroups?.(merged.groups);
  };

  const importSavedAddressBook = async () => {
    if (!api) {
      inform("Open AXIVESTRA on the Windows PC or connect to its companion address to import the saved WhatsApp cache.");
      return;
    }
    setImportBusy(true);
    try {
      const book = await api.getAddressBook();
      applyAddressBook(book);
      inform(`Saved cache loaded: ${book.contacts.length} WhatsApp contacts and ${book.groups.length} groups. AXIVESTRA keeps these records when WhatsApp is disconnected.`);
    } catch (error) {
      inform("Could not load the saved WhatsApp cache: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setImportBusy(false);
    }
  };

  const syncWhatsAppAddressBook = async () => {
    if (!api) {
      inform("Open the Windows AXIVESTRA app or connect to your Windows companion first.");
      return;
    }
    setSyncBusy(true);
    try {
      const book = await api.syncAddressBook();
      applyAddressBook(book);
      const warningText = (book.warnings || []).join(" ");
      inform(`WhatsApp sync finished: ${book.contacts.length} contacts and ${book.groups.length} groups saved in AXIVESTRA. ${book.note || ""} ${warningText}`.trim());
    } catch (error) {
      try {
        const cached = await api.getAddressBook();
        setAddressBook(previous => mergeAddressBookCache(previous, cached));
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
      try { setStatus(await api.getStatus()); } catch {}
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
      // Refresh status even on failure so the user sees the sender's actual error
      // and can use QR fallback rather than being left with a stale connecting screen.
      try { setStatus(await api.getStatus()); } catch {}
      inform("Could not generate a pairing code: " + (error instanceof Error ? error.message : String(error)) + " If the code is not shown, try Connect with QR.");
    } finally { setBusy(false); }
  };

  const disconnect = async () => {
    if (!api) return;
    if (!window.confirm("Disconnect this WhatsApp linked device from AXIVESTRA? Saved scheduled messages will remain in the queue.")) return;
    setBusy(true);
    try {
      await api.disconnect();
      setStatus(await api.getStatus());
      inform("WhatsApp device disconnected. Your saved schedule remains on this PC.");
    } catch (error) {
      inform("Could not disconnect WhatsApp: " + (error instanceof Error ? error.message : String(error)));
    } finally { setBusy(false); }
  };

  const resetPairingSession = async () => {
    if (!api) return;
    if (!window.confirm("Reset the saved WhatsApp link on the sender and start fresh? This removes only AXIVESTRA's local linked-device session, not your WhatsApp account or saved message queue. You will need to link the device again.")) return;
    setBusy(true);
    try {
      await api.disconnect();
      setStatus(await api.getStatus());
      inform("Saved AXIVESTRA pairing session reset. Now choose Connect with QR or generate a new pairing code.");
    } catch (error) {
      inform("Could not reset the pairing session: " + (error instanceof Error ? error.message : String(error)));
    } finally { setBusy(false); }
  };

  const makePayload = () => {
    const due = new Date(date + "T" + time + ":00");
    if (recipientMode === "group" && !selectedGroup) throw new Error("Select a WhatsApp group from your saved group list.");
    if (recipientMode === "group" && status.connected && !sendableGroupOptions.some(group => group.jid === selectedGroupJid)) throw new Error("This group is not verified for the currently linked WhatsApp account. Sync groups again before scheduling.");
    if (recipientMode === "contact" && !target.trim()) throw new Error("Select a saved contact or enter the recipient's phone number.");
    if (!message.trim() && !(cloudMode && templateName.trim())) throw new Error("Write a message or choose an approved WhatsApp template.");
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
      templateName: cloudMode ? templateName.trim() : "",
      templateLanguage: cloudMode ? templateLanguage.trim() : "en_US",
      templateParameters: cloudMode ? templateBodyParameters.split("\n").map(value => value.trim()).filter(Boolean) : [],
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
        ? cloudMode ? "Message saved to the cloud queue. A configured cloud worker can send it even when both devices are off." : "Message added to the send queue and will be sent shortly if WhatsApp is connected."
        : cloudMode ? "Scheduled " + result.rows.length + " cloud message" + (result.rows.length === 1 ? "" : "s") + ". Cloud delivery requires the scheduled worker to be deployed and active." : "Scheduled " + result.rows.length + " message" + (result.rows.length === 1 ? "" : "s") + " on this PC. The Windows sender starts hidden at login and continues from the system tray. Keep the PC awake, online and WhatsApp linked; do not choose Exit AXIVESTRA.");
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
      <div><span className="section-kicker">AXIVESTRA COMMUNICATIONS</span><h2>Message command centre</h2>
        <p>Link your account, import your directory, choose an individual or group, then automate consent-based conversations linked to your portfolio records.</p>
      </div>
      <MessageCircle size={22}/>
    </div>

    <section className={"wa-connection-card " + (status.connected ? "wa-connected" : "wa-disconnected")}>
      <div className="wa-connection-icon"><MessageCircle size={23}/></div>
      <div className="wa-connection-copy">
        <strong>{status.platform === "cloud-whatsapp-business" ? status.connected ? "Cloud WhatsApp sender connected" : "Cloud WhatsApp sender not ready" : status.connected ? "WhatsApp linked and connected" : status.connecting ? "Connecting to WhatsApp…" : supported ? "WhatsApp device not connected" : "Windows linked-device service required"}</strong>
        <p>{status.connected
          ? "Connected account: " + (status.senderNumber ? "+" + status.senderNumber : status.displayName || "Linked WhatsApp account")
          : cloudMode ? "Cloud sender is selected. Check its connection status and deployment settings below."
          : supported ? "Choose QR scan or phone-number pairing code to link your WhatsApp account."
          : "This Android/browser build is a companion interface. The Windows AXIVESTRA app runs the direct linked-device connection and scheduled sender; it must be running on the same computer/network to deliver messages."}</p>
        <small>{status.platform === "cloud-whatsapp-business" ? "Queue is stored in AXIVESTRA cloud; the official Meta sender is server-side." : status.platform.startsWith("gateway-") ? "The linked WhatsApp session and message queue live on the hub server." : status.connected ? "Session saved locally on this Windows user profile." : "Link the account through the configured sender; the session stays with that sender."}</small>
        {status.error && <small className="wa-connection-error">{status.error}</small>}
        {status.webhook && !status.webhook.configured && <small className="wa-connection-error">Automatic stop-on-reply is not active: {status.webhook.error || status.webhook.reason || "Webhook not configured."}</small>}
        {status.webhook?.configured && <small>Automatic stop-on-reply webhook registered with {status.webhook.provider || "the WhatsApp gateway"}.</small>}
      </div>
      {supported && !cloudMode && (status.connected
        ? <button className="secondary-button" disabled={busy} onClick={() => void disconnect()}><Unplug size={15}/>Disconnect</button>
        : <div className="form-actions">
            <button className="secondary-button" disabled={busy || status.connecting} onClick={() => void connectQr()}><QrCode size={15}/>{busy ? "Starting…" : "Connect with QR"}</button>
            {Boolean(status.error) && <button className="secondary-button" disabled={busy} onClick={() => void resetPairingSession()}><RotateCcw size={15}/>Reset saved link</button>}
          </div>)}
    </section>

    {supported && !cloudMode && !status.connected && <div className="wa-link-options">
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

    <section className="data-panel wa-address-book">
      <div className="section-heading">
        <div><span className="section-kicker">DIRECTORY INTELLIGENCE</span><h2>People & groups directory</h2>
          <p>Import the names and phone numbers exposed by your linked WhatsApp session. Saved records stay in AXIVESTRA when WhatsApp is disconnected or unlinked.</p>
        </div>
        <Users size={22}/>
      </div>
      <div className="wa-address-book-stats">
        <div><span>WhatsApp contacts cached</span><strong>{addressBook.contacts.length}</strong></div>
        <div><span>WhatsApp groups cached</span><strong>{groupOptions.length}</strong></div>
        <div><span>AXIVESTRA contacts</span><strong>{contacts.length}</strong></div>
      </div>
      <div className="form-actions wa-address-book-actions">
        <button className="primary-button" disabled={!supported || syncBusy || !status.connected} onClick={() => void syncWhatsAppAddressBook()}><RefreshCw size={15}/>{syncBusy ? "Syncing…" : "Sync WhatsApp now"}</button>
        <button className="secondary-button" disabled={!supported || importBusy} onClick={() => void importSavedAddressBook()}><Users size={15}/>{importBusy ? "Loading saved cache…" : "Import saved contacts & groups"}</button>
      </div>
      <p className="wa-local-storage-note"><Info size={14}/>{addressBook.lastSyncedAt ? "Last sync: " + prettyDate(addressBook.lastSyncedAt) + ". " : ""}{cloudMode ? "Cloud mode uses contacts and properties saved in AXIVESTRA. The personal WhatsApp address book is not available through the official cloud API." : "Your synced directory is cached on the Windows device and the group list is also saved in AXIVESTRA. A disconnected phone cannot deliver messages; connect again to send."}</p>
      {addressBook.note && <div className="notice"><Info size={16}/>{addressBook.note}</div>}
      {addressBook.warnings?.map((warning,index)=><div className="notice notice-warn" key={index}><Info size={16}/>{warning}</div>)}
      <div className="wa-address-book-columns">
        <section>
          <h3>Saved WhatsApp contacts</h3>
          <div className="wa-scroll-list">
            <div className="wa-search-field searchable-contact-picker__search"><Search size={16}/><input type="search" value={directoryContactSearch} onChange={event => setDirectoryContactSearch(event.target.value)} placeholder="Search synced contacts by name or number…" aria-label="Search synced WhatsApp directory"/>{directoryContactSearch && <button type="button" className="searchable-contact-picker__clear" onClick={() => setDirectoryContactSearch("")} aria-label="Clear directory contact search">×</button>}</div>
            {addressBook.contacts.length === 0
              ? <p className="wa-muted">No cached WhatsApp contacts yet. Connect the account and sync.</p>
              : filteredDirectoryContacts.length === 0
                ? <p className="wa-muted">No contacts match that search.</p>
                : filteredDirectoryContacts.slice(0,1000).map(contact=><div className="wa-address-row" key={contact.jid || contact.id}><div><strong>{contact.whatsappName || contact.name}</strong><small>{contact.phone}</small></div><button className="secondary-button" disabled={!contact.phone.trim()} title={!contact.phone.trim() ? "WhatsApp did not provide a phone number for this ID. No fake number will be saved." : "Save this WhatsApp contact to AXIVESTRA"} onClick={() => onImportContacts?.([contact])}>{contact.phone.trim() ? "Save contact" : "No phone number"}</button></div>)}
          </div>
        </section>
        <section>
          <h3>Saved WhatsApp groups</h3>
          <div className="wa-scroll-list">
            <div className="wa-search-field searchable-contact-picker__search"><Search size={16}/><input type="search" value={directoryGroupSearch} onChange={event => setDirectoryGroupSearch(event.target.value)} placeholder="Search synced groups by name…" aria-label="Search synced WhatsApp groups"/>{directoryGroupSearch && <button type="button" className="searchable-contact-picker__clear" onClick={() => setDirectoryGroupSearch("")} aria-label="Clear directory group search">×</button>}</div>
            {groupOptions.length === 0
              ? <p className="wa-muted">No cached WhatsApp groups yet. Sync while WhatsApp is connected.</p>
              : filteredDirectoryGroups.length === 0
                ? <p className="wa-muted">No groups match that search.</p>
                : filteredDirectoryGroups.slice(0,1000).map(group=><div className="wa-address-row" key={group.jid}><div><strong>{group.name}</strong><small>{group.size ? group.size + " members · " : ""}{group.jid}</small></div><button className="secondary-button" onClick={() => onImportGroups?.([group])}>Save group</button></div>)}
          </div>
        </section>
      </div>
      <p className="wa-local-storage-note">AXIVESTRA does not create or delete WhatsApp groups. Create or manage groups in WhatsApp, then sync them here. Previously synced group names remain saved even when the WhatsApp account is offline.</p>
    </section>

    <div className="notice notice-warn">
      <ShieldCheck size={18}/><div><strong>Account and consent notice</strong>
        <p>{cloudMode ? "Cloud sending uses Meta’s official WhatsApp Business Platform. After cloud deployment, queue setup and scheduler activation, messages can be processed with both devices switched off. Free-form text is generally allowed only inside the 24-hour customer-service window; otherwise use an approved template. A sent status means Meta accepted the request, not that it was read." : "This connection uses an unofficial WhatsApp Web-compatible library, not Meta’s official Business Platform. WhatsApp may disconnect or restrict accounts using unofficial clients. Use it only for expected, consent-based follow-ups. The first contact sync can take longer because WhatsApp may send a history-sync payload; AXIVESTRA caches contact and group metadata, not prior chat content. The linked-device session and its local cache remain on the Windows PC, while imported contacts and saved group details can also be synced to your configured AXIVESTRA database."}</p>
      </div>
    </div>

    <div className="wa-mode-switch" role="tablist" aria-label="Schedule mode">
      <button className={sendMode === "once" ? "wa-mode-active" : ""} onClick={() => setSendMode("once")} role="tab" aria-selected={sendMode === "once"}>Send once</button>
      <button className={sendMode === "repeat" ? "wa-mode-active" : ""} onClick={() => setSendMode("repeat")} role="tab" aria-selected={sendMode === "repeat"}>Repeat follow-up</button>
    </div>

    <div className="form-card wa-form">
      <div className="wa-mode-switch" role="tablist" aria-label="Message destination">
        <button className={recipientMode === "contact" ? "wa-mode-active" : ""} onClick={() => { setRecipientMode("contact"); setSelectedGroupJid(""); }} role="tab" aria-selected={recipientMode === "contact"}>Individual contact</button>
        <button className={recipientMode === "group" ? "wa-mode-active" : ""} disabled={cloudMode} title={cloudMode ? "The official cloud sender supports individual contacts only." : ""} onClick={() => { setRecipientMode("group"); setSelectedContactId(""); setTarget(""); }} role="tab" aria-selected={recipientMode === "group"}>WhatsApp group</button>
      </div>
      {recipientMode === "contact" ? <>
        <label className="searchable-contact-picker">Select saved contact
          <span>Search by contact name, WhatsApp name, phone number or role. Synced contacts remain saved when disconnected.</span>
          <div className="wa-search-field searchable-contact-picker__search"><Search size={16}/><input type="search" value={recipientSearch} onChange={event => setRecipientSearch(event.target.value)} placeholder="Type a contact name or number…" aria-label="Search saved WhatsApp contacts"/>{recipientSearch && <button type="button" className="searchable-contact-picker__clear" onClick={() => setRecipientSearch("")} aria-label="Clear contact search">×</button>}</div>
          <select className="searchable-contact-picker__select" size={Math.min(Math.max(filteredRecipientContacts.length, 3), 7)} value={selectedContactId} onChange={event => setSelectedContactId(event.target.value)}>
            <option value="">Choose a contact ({filteredRecipientContacts.length})</option>
            {filteredRecipientContacts.map(contact =>
              <option key={contact.id} value={contact.id}>{contact.name}{contact.whatsappName && contact.whatsappName !== contact.name ? " · WhatsApp: " + contact.whatsappName : ""} · {contact.phone}{contact.role ? " · " + contact.role : ""}</option>
            )}
          </select>
          {filteredRecipientContacts.length === 0 && <small className="wa-muted">No matching contacts. Try a shorter name or enter the WhatsApp number manually below.</small>}
        </label>
        <div className="form-two">
          <label>Client / contact name<input value={contactName} onChange={event => setContactName(event.target.value)} placeholder="Client name"/></label>
          <label>WhatsApp number<input value={target} onChange={event => { setTarget(event.target.value); setSelectedContactId(""); }} placeholder="+91 9876543210" inputMode="tel"/></label>
        </div>
      </> : <div className="wa-group-target">
        <label className="searchable-contact-picker">Select saved WhatsApp group
          <span>Search by group name. Saved groups remain cached even when WhatsApp is disconnected.</span>
          <div className="wa-search-field searchable-contact-picker__search"><Search size={16}/><input type="search" value={recipientGroupSearch} onChange={event => setRecipientGroupSearch(event.target.value)} placeholder="Type a group name…" aria-label="Search saved WhatsApp groups"/>{recipientGroupSearch && <button type="button" className="searchable-contact-picker__clear" onClick={() => setRecipientGroupSearch("")} aria-label="Clear group search">×</button>}</div>
          <select className="searchable-contact-picker__select" size={Math.min(Math.max(filteredRecipientGroups.length, 3), 7)} value={selectedGroupJid} onChange={event => setSelectedGroupJid(event.target.value)}>
            <option value="">Choose a WhatsApp group ({filteredRecipientGroups.length})</option>
            {filteredRecipientGroups.map(group => <option key={group.jid} value={group.jid}>{group.name}{group.size ? " · " + group.size + " members" : ""}</option>)}
          </select>
          {filteredRecipientGroups.length === 0 && <small className="wa-muted">No matching groups. Sync the group list while WhatsApp is connected.</small>}
        </label>
        {selectedGroup && <div className="notice"><Users size={16}/><div><strong>{selectedGroup.name}</strong><p>{selectedGroup.size ? selectedGroup.size + " members · " : ""}WhatsApp group will be used as the message destination.</p></div></div>}
        {(status.connected ? sendableGroupOptions.length === 0 : groupOptions.length === 0) && <div className="notice notice-warn">{status.connected ? "No groups are verified for this currently linked WhatsApp account. Sync contacts & groups above." : "No synced groups saved yet. Connect WhatsApp and use “Sync WhatsApp contacts & groups” above."}</div>}
      </div>}
      <label>Link to property (optional)
        <select value={selectedPropertyId} onChange={event => setSelectedPropertyId(event.target.value)}>
          <option value="">No property selected</option>
          {properties.map(property => <option key={property.id} value={property.id}>{property.title}</option>)}
        </select>
      </label>
      {selectedTaskId && <div className="notice"><CalendarClock size={16}/> Linked to task: {selectedTaskTitle || selectedTaskId}</div>}
      <label>Message to send<textarea rows={4} maxLength={4000} value={message} onChange={event => setMessage(event.target.value)} placeholder="Write a client follow-up message…"/></label>
      {cloudMode && <div className="wa-template-fields">
        <div className="form-two">
          <label>Approved WhatsApp template name (optional)<input value={templateName} onChange={event => setTemplateName(event.target.value)} placeholder="e.g. property_follow_up"/><span>Required outside the 24-hour customer-service window.</span></label>
          <label>Template language code<input value={templateLanguage} onChange={event => setTemplateLanguage(event.target.value)} placeholder="en_US"/></label>
        </div>
        {templateName.trim() && <label>Template body variables, one value per line<textarea rows={3} value={templateBodyParameters} onChange={event => setTemplateBodyParameters(event.target.value)} placeholder={"Client name\nProperty reference"}/><span>Variables must match the approved template body order.</span></label>}
      </div>}
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
        <button className="primary-button" disabled={busy || !supported || !consentConfirmed || (recipientMode === "contact" ? !target.trim() : !selectedGroupJid) || (!message.trim() && !(cloudMode && templateName.trim()))} onClick={() => void scheduleMessage(false)}><CalendarClock size={16}/>{busy ? "Saving…" : sendMode === "once" ? "Schedule one message" : "Schedule follow-up sequence"}</button>
      </div>
      <p className="wa-local-storage-note"><CheckCircle2 size={14}/> {cloudMode ? "Cloud queued messages do not depend on either app being open, but delivery requires the hosted worker, scheduled invocation and Meta WhatsApp credentials to stay valid." : "The Windows sender starts hidden at login and keeps running when you close the window to the system tray. Scheduled delivery still requires Windows to stay powered on, awake and online, with WhatsApp linked. Choosing Exit AXIVESTRA or putting the PC to sleep stops/delays delivery."}</p>
    </div>

    {localNotice && <div className="notice"><Info size={16}/>{localNotice}</div>}

    <div className="wa-stats-grid">
      <div><span>Pending</span><strong>{counts.scheduled}</strong></div>
      <div><span>Sent</span><strong>{counts.sent}</strong></div>
      <div><span>Failed</span><strong>{counts.failed}</strong></div>
      <div><span>Cancelled</span><strong>{counts.cancelled}</strong></div>
    </div>

    <div className="section-heading wa-queue-heading">
      <div><span className="section-kicker">MESSAGE QUEUE</span><h2>Scheduled messages</h2><p>Delivery state and follow-up history for this Windows profile.</p></div>
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
