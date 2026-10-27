import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { backendConfigured, supabase } from "./lib/supabase";
import {
  Building2, LayoutDashboard, LandPlot, HandCoins, Handshake, Calculator,
  Wheat, Store, CalendarClock, MessageCircle, Users, FileText, Settings,
  Search, Bell, Plus, ArrowUpRight, Clock3, CheckCircle2, Menu, X,
  Trash2, Phone, MapPin, CalendarDays, CircleCheck, ExternalLink, Pencil, Download
} from "lucide-react";

type PropertyRecord = {
  id: string; title: string; module: string; location: string; value: string;
  status: string; contact: string; notes: string; createdAt: string;
  surveyNumber: string; ownershipDetails: string; areaValue: string; areaUnit: string; dimensions: string; ratePerUnit: string;
};
type ContactRecord = { id: string; name: string; phone: string; role: string; notes: string };
type TaskRecord = { id: string; title: string; date: string; time: string; type: string; property: string; notes: string; done: boolean };
type DocumentRecord = { id: string; propertyId: string; property: string; name: string; category: string; storagePath: string; mimeType: string; sizeBytes: number; expiresOn: string; notes: string; createdAt: string };
type WhatsAppFollowup = { id: string; contactName: string; phone: string; message: string; templateName: string; templateLanguage: string; templateParameters: string[]; scheduledAt: string; consentConfirmed: boolean; stopOnReply: boolean; status: string; attemptCount: number; lastError: string };
type FinancialRecord = { id: string; propertyId: string; property: string; type: string; amount: string; date: string; party: string; reference: string; notes: string };
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
  { name: "Financials", icon: Calculator },
  { name: "Documents", icon: FileText },
  { name: "Schedule & Tasks", icon: CalendarClock },
  { name: "WhatsApp Automation", icon: MessageCircle }
];
const localDate = () => {
  const value = new Date();
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 10);
};
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
  const [financials, setFinancials] = useState<FinancialRecord[]>(() => load("estateflow.financials", []));
  const [showFinancialForm, setShowFinancialForm] = useState(false);
  const [editingFinancial, setEditingFinancial] = useState<FinancialRecord | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [documentCategory, setDocumentCategory] = useState("Sale deed");
  const [documentProperty, setDocumentProperty] = useState("");
  const [documentExpiry, setDocumentExpiry] = useState("");
  const [documentNotes, setDocumentNotes] = useState("");
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState<PropertyRecord | null>(null);
  const [editingContact, setEditingContact] = useState<ContactRecord | null>(null);
  const [editingTask, setEditingTask] = useState<TaskRecord | null>(null);
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
  const [waTemplateName, setWaTemplateName] = useState("");
  const [waTemplateLanguage, setWaTemplateLanguage] = useState("en_US");
  const [waTemplateParameters, setWaTemplateParameters] = useState("");
  const [waScheduleDate, setWaScheduleDate] = useState(localDate());
  const [waScheduleTime, setWaScheduleTime] = useState("10:00");
  const [waConsentConfirmed, setWaConsentConfirmed] = useState(false);
  const [whatsappFollowups, setWhatsappFollowups] = useState<WhatsAppFollowup[]>([]);
  const [waQueueBusy, setWaQueueBusy] = useState(false);

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

  useEffect(() => {
    if (backendConfigured && (!session || !remoteReady)) return;
    localStorage.setItem(storageKey("financials"), JSON.stringify(financials));
  }, [financials, session?.user.id, remoteReady]);

  const filteredModules = modules.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));
  const filteredProperties = useMemo(() => properties.filter(p =>
    `${p.title} ${p.module} ${p.location} ${p.contact} ${p.status}`.toLowerCase().includes(search.toLowerCase())
  ), [properties, search]);
  const upcomingTasks = tasks.filter(t => !t.done).sort((a,b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const today = new Date().toISOString().slice(0,10);
  const inflowTypes = ["Sale", "Advance", "Loan Disbursal", "Receipt"];
  const outflowTypes = ["Purchase", "Loan Repayment", "Interest", "Instalment", "Brokerage", "Expense", "Settlement"];
  const totalInflow = financials.filter(item => inflowTypes.includes(item.type)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalOutflow = financials.filter(item => outflowTypes.includes(item.type)).reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const remoteUpsert = (table: "property_records" | "contacts" | "tasks" | "financial_transactions", payload: Record<string, unknown>) => {
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
  const remoteDelete = (table: "property_records" | "contacts" | "tasks" | "financial_transactions", id: string) => {
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
    setFinancials(load(`estateflow.${scope}.financials`, []));
    (async () => {
      const [propertyResult, contactResult, taskResult, documentResult, financialResult, whatsappResult] = await Promise.all([
        supabase.from("property_records").select("id,title,module,location,value,status,contact,notes,survey_number,ownership_details,area_value,area_unit,dimensions,rate_per_unit,created_at").order("created_at", { ascending: false }),
        supabase.from("contacts").select("id,name,phone,role,notes").order("created_at", { ascending: false }),
        supabase.from("tasks").select("id,title,due_date,due_time,task_type,property_label,notes,is_done").order("due_date", { ascending: true }).order("due_time", { ascending: true }),
        supabase.from("documents").select("id,property_id,property_label,name,category,storage_path,mime_type,size_bytes,expires_on,notes,created_at").order("created_at", { ascending: false }),
        supabase.from("financial_transactions").select("id,property_id,property_label,transaction_type,amount,transaction_date,party,reference_number,notes").order("transaction_date", { ascending: false }),
        supabase.from("whatsapp_followups").select("id,contact_name,phone,message,template_name,template_language,template_parameters,scheduled_at,consent_confirmed,stop_on_reply,status,attempt_count,last_error").order("scheduled_at", { ascending: false })
      ]);
      const queryError = propertyResult.error ?? contactResult.error ?? taskResult.error ?? documentResult.error ?? financialResult.error ?? whatsappResult.error;
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
        surveyNumber: row.survey_number ?? "",
        ownershipDetails: row.ownership_details ?? "",
        areaValue: row.area_value === null || row.area_value === undefined ? "" : String(row.area_value),
        areaUnit: row.area_unit ?? "sq ft",
        dimensions: row.dimensions ?? "",
        ratePerUnit: row.rate_per_unit === null || row.rate_per_unit === undefined ? "" : String(row.rate_per_unit),
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
      setDocuments((documentResult.data ?? []).map(row => ({
        id: row.id,
        propertyId: row.property_id ?? "",
        property: row.property_label ?? "",
        name: row.name,
        category: row.category ?? "Other",
        storagePath: row.storage_path,
        mimeType: row.mime_type ?? "application/octet-stream",
        sizeBytes: Number(row.size_bytes ?? 0),
        expiresOn: row.expires_on ?? "",
        notes: row.notes ?? "",
        createdAt: row.created_at ?? new Date().toISOString()
      })));
      setFinancials((financialResult.data ?? []).map(row => ({
        id: row.id,
        propertyId: row.property_id ?? "",
        property: row.property_label ?? "",
        type: row.transaction_type,
        amount: String(row.amount ?? "0"),
        date: row.transaction_date,
        party: row.party ?? "",
        reference: row.reference_number ?? "",
        notes: row.notes ?? ""
      })));
      setWhatsappFollowups((whatsappResult.data ?? []).map(row => ({
        id: row.id,
        contactName: row.contact_name ?? "",
        phone: row.phone,
        message: row.message,
        templateName: row.template_name ?? "",
        templateLanguage: row.template_language ?? "en_US",
        templateParameters: Array.isArray(row.template_parameters) ? row.template_parameters.map(String) : [],
        scheduledAt: row.scheduled_at ?? "",
        consentConfirmed: Boolean(row.consent_confirmed),
        stopOnReply: Boolean(row.stop_on_reply),
        status: row.status,
        attemptCount: Number(row.attempt_count ?? 0),
        lastError: row.last_error ?? ""
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

  const uploadDocument = async (file: File) => {
    if (!supabase || !backendConfigured || !session) {
      setNotice("Secure document upload requires a configured and signed-in shared database.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setNotice("This file exceeds the 25 MB limit. Compress it or select a smaller file.");
      return;
    }
    const allowedTypes = [
      "application/pdf", "image/jpeg", "image/png", "image/webp", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
    if (!allowedTypes.includes(file.type)) {
      setNotice("Choose a PDF, JPEG, PNG, WebP, DOC or DOCX file.");
      return;
    }
    setUploadingDocument(true);
    const id = uid();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "document";
    const storagePath = `${session.user.id}/${id}/${safeName}`;
    try {
      const { error: uploadError } = await supabase.storage.from("property-documents").upload(storagePath, file, {
        contentType: file.type,
        upsert: false
      });
      if (uploadError) throw uploadError;
      const property = properties.find(item => item.id === documentProperty);
      const { data, error: metadataError } = await supabase.from("documents").insert({
        id,
        user_id: session.user.id,
        property_id: property?.id ?? null,
        property_label: property?.title ?? "",
        name: file.name,
        category: documentCategory,
        storage_path: storagePath,
        mime_type: file.type,
        size_bytes: file.size,
        expires_on: documentExpiry || null,
        notes: documentNotes
      }).select("id,property_id,property_label,name,category,storage_path,mime_type,size_bytes,expires_on,notes,created_at").single();
      if (metadataError) {
        await supabase.storage.from("property-documents").remove([storagePath]);
        throw metadataError;
      }
      const record: DocumentRecord = {
        id: data.id, propertyId: data.property_id ?? "", property: data.property_label ?? "",
        name: data.name, category: data.category, storagePath: data.storage_path,
        mimeType: data.mime_type, sizeBytes: Number(data.size_bytes ?? 0),
        expiresOn: data.expires_on ?? "", notes: data.notes ?? "", createdAt: data.created_at
      };
      setDocuments(prev => [record, ...prev]);
      setDocumentNotes("");
      setDocumentExpiry("");
      setNotice("Document uploaded to private cloud storage.");
    } catch (error) {
      setNotice(`Document upload failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setUploadingDocument(false);
    }
  };
  const downloadDocument = async (record: DocumentRecord) => {
    if (!supabase) return;
    const { data, error } = await supabase.storage.from("property-documents").createSignedUrl(record.storagePath, 60);
    if (error) {
      setNotice(`Could not create a secure document link: ${error.message}`);
      return;
    }
    const link = document.createElement("a");
    link.href = data.signedUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
  };
  const deleteDocument = async (record: DocumentRecord) => {
    if (!supabase || !session) return;
    const { error } = await supabase.from("documents").delete().eq("id", record.id).eq("user_id", session.user.id);
    if (error) {
      setNotice(`Document record could not be deleted: ${error.message}`);
      return;
    }
    const { error: storageError } = await supabase.storage.from("property-documents").remove([record.storagePath]);
    setDocuments(prev => prev.filter(item => item.id !== record.id));
    if (storageError) setNotice(`Metadata deleted, but file cleanup failed: ${storageError.message}`);
    else setNotice("Document and its private cloud file were deleted.");
  };

  const go = (section: Section) => { setActive(section); setMobileMenu(false); setNotice(""); };
  const openPropertyForm = (record: PropertyRecord | null = null) => { setEditingProperty(record); setShowPropertyForm(true); };
  const closePropertyForm = () => { setShowPropertyForm(false); setEditingProperty(null); };
  const openContactForm = (record: ContactRecord | null = null) => { setEditingContact(record); setShowContactForm(true); };
  const closeContactForm = () => { setShowContactForm(false); setEditingContact(null); };
  const openTaskForm = (record: TaskRecord | null = null) => { setEditingTask(record); setShowTaskForm(true); };
  const closeTaskForm = () => { setShowTaskForm(false); setEditingTask(null); };
  const openFinancialForm = (record: FinancialRecord | null = null) => { setEditingFinancial(record); setShowFinancialForm(true); };
  const closeFinancialForm = () => { setShowFinancialForm(false); setEditingFinancial(null); };

  const saveProperty = (data: Omit<PropertyRecord, "id" | "createdAt">) => {
    const record: PropertyRecord = editingProperty
      ? { ...editingProperty, ...data }
      : { ...data, id: uid(), createdAt: new Date().toISOString() };
    setProperties(prev => editingProperty
      ? prev.map(item => item.id === record.id ? record : item)
      : [record, ...prev]);
    remoteUpsert("property_records", {
      id: record.id, title: record.title, module: record.module, location: record.location,
      value: record.value.trim() ? Number(record.value) : null, status: record.status,
      contact: record.contact, notes: record.notes, created_at: record.createdAt,
      survey_number: record.surveyNumber, ownership_details: record.ownershipDetails,
      area_value: record.areaValue.trim() ? Number(record.areaValue) : null,
      area_unit: record.areaUnit, dimensions: record.dimensions,
      rate_per_unit: record.ratePerUnit.trim() ? Number(record.ratePerUnit) : null
    });
    closePropertyForm();
    setNotice(backendConfigured && session
      ? "Property record saved and synced with your shared workspace."
      : "Property record saved on this device.");
  };
  const saveContact = (data: Omit<ContactRecord, "id">) => {
    const record: ContactRecord = editingContact ? { ...editingContact, ...data } : { ...data, id: uid() };
    setContacts(prev => editingContact
      ? prev.map(item => item.id === record.id ? record : item)
      : [record, ...prev]);
    remoteUpsert("contacts", { id: record.id, name: record.name, phone: record.phone, role: record.role, notes: record.notes });
    closeContactForm();
    setNotice(backendConfigured && session
      ? "Contact saved and synced with your shared workspace."
      : "Contact saved on this device.");
  };
  const saveTask = (data: Omit<TaskRecord, "id" | "done">) => {
    const record: TaskRecord = editingTask
      ? { ...editingTask, ...data }
      : { ...data, id: uid(), done: false };
    setTasks(prev => (editingTask
      ? prev.map(item => item.id === record.id ? record : item)
      : [...prev, record]).sort((a,b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)));
    remoteUpsert("tasks", {
      id: record.id, title: record.title, due_date: record.date, due_time: record.time,
      task_type: record.type, property_label: record.property, notes: record.notes, is_done: record.done
    });
    closeTaskForm();
    setNotice(backendConfigured && session
      ? "Task saved and synced. Background notifications still require a scheduler."
      : "Task saved on this device. Background notifications still require a scheduler.");
  };
  const deleteProperty = (id: string) => { setProperties(prev => prev.filter(p => p.id !== id)); remoteDelete("property_records", id); };
  const deleteContact = (id: string) => { setContacts(prev => prev.filter(c => c.id !== id)); remoteDelete("contacts", id); };
  const deleteTask = (id: string) => { setTasks(prev => prev.filter(t => t.id !== id)); remoteDelete("tasks", id); };
  const saveFinancial = (data: Omit<FinancialRecord, "id">) => {
    const record: FinancialRecord = editingFinancial ? { ...editingFinancial, ...data } : { ...data, id: uid() };
    setFinancials(prev => editingFinancial
      ? prev.map(item => item.id === record.id ? record : item)
      : [record, ...prev]);
    remoteUpsert("financial_transactions", {
      id: record.id,
      property_id: record.propertyId || null,
      property_label: record.property,
      transaction_type: record.type,
      amount: Number(record.amount),
      transaction_date: record.date,
      party: record.party,
      reference_number: record.reference,
      notes: record.notes
    });
    closeFinancialForm();
    setNotice(backendConfigured && session
      ? "Financial transaction saved and synced with your shared workspace."
      : "Financial transaction saved on this device.");
  };
  const scheduleWhatsAppFollowup = async () => {
    if (!backendConfigured || !supabase || !session) {
      setNotice("Scheduled WhatsApp sending requires a configured and signed-in backend.");
      return;
    }
    const phone = waPhone.replace(/\D/g, "");
    const templateName = waTemplateName.trim().toLowerCase();
    if (phone.length < 10 || phone.length > 15) {
      setNotice("Enter a valid recipient number with country code, using 10–15 digits.");
      return;
    }
    if (!/^[a-z0-9_]{1,512}$/.test(templateName)) {
      setNotice("Enter the exact name of an approved WhatsApp template, for example estateflow_follow_up.");
      return;
    }
    if (!waConsentConfirmed) {
      setNotice("Confirm that this recipient has opted in to receive WhatsApp messages before scheduling.");
      return;
    }
    const scheduledAt = new Date(`${waScheduleDate}T${waScheduleTime}:00`);
    if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
      setNotice("Choose a future date and time for this one-time follow-up.");
      return;
    }
    const templateParameters = waTemplateParameters.trim()
      ? waTemplateParameters.split(",").map(value => value.trim())
      : [];
    setWaQueueBusy(true);
    try {
      const { data, error } = await supabase.from("whatsapp_followups").insert({
        user_id: session.user.id,
        phone,
        message: waMessage.trim(),
        template_name: templateName,
        template_language: waTemplateLanguage.trim() || "en_US",
        template_parameters: templateParameters,
        consent_confirmed: true,
        scheduled_at: scheduledAt.toISOString(),
        stop_on_reply: true,
        status: "scheduled"
      }).select("id,contact_name,phone,message,template_name,template_language,template_parameters,scheduled_at,consent_confirmed,stop_on_reply,status,attempt_count,last_error").single();
      if (error) throw error;
      const queued: WhatsAppFollowup = {
        id: data.id, contactName: data.contact_name ?? "", phone: data.phone,
        message: data.message, templateName: data.template_name,
        templateLanguage: data.template_language,
        templateParameters: Array.isArray(data.template_parameters) ? data.template_parameters.map(String) : [],
        scheduledAt: data.scheduled_at, consentConfirmed: Boolean(data.consent_confirmed),
        stopOnReply: Boolean(data.stop_on_reply), status: data.status,
        attemptCount: Number(data.attempt_count ?? 0), lastError: data.last_error ?? ""
      };
      setWhatsappFollowups(prev => [queued, ...prev]);
      setNotice("Follow-up queued. Deploy the WhatsApp functions and scheduled worker before expecting automatic delivery.");
    } catch (error) {
      setNotice(`Could not schedule the WhatsApp follow-up: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setWaQueueBusy(false);
    }
  };
  const cancelWhatsAppFollowup = async (record: WhatsAppFollowup) => {
    if (!supabase || !session) return;
    const { error } = await supabase.from("whatsapp_followups")
      .update({ status: "cancelled" })
      .eq("id", record.id)
      .eq("user_id", session.user.id)
      .eq("status", "scheduled");
    if (error) {
      setNotice(`Could not cancel follow-up: ${error.message}`);
      return;
    }
    setWhatsappFollowups(prev => prev.map(item => item.id === record.id ? { ...item, status: "cancelled" } : item));
    setNotice("Scheduled follow-up cancelled.");
  };

  const deleteFinancial = (id: string) => {
    setFinancials(prev => prev.filter(item => item.id !== id));
    remoteDelete("financial_transactions", id);
  };
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
            <button className="primary-button" onClick={() => active === "Contacts" ? openContactForm() : active === "Schedule & Tasks" ? openTaskForm() : active === "Financials" ? openFinancialForm() : openPropertyForm()}><Plus size={17} /> {active === "Contacts" ? "New contact" : active === "Schedule & Tasks" ? "New task" : active === "Financials" ? "New transaction" : "New record"}</button></div>
          {notice && <div className="notice"><CheckCircle2 size={17}/>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={15}/></button></div>}
          {active === "Overview" && <>
            <section className="hero-card"><div className="hero-copy"><span className="hero-label">A CLEARER WAY FORWARD</span><h2>Every deal has a next step.<br/>Never miss yours.</h2><p>Bring property records, important dates and conversations together in one calm, organised space.</p><button className="hero-button" onClick={() => go("Schedule & Tasks")}>View your schedule <ArrowUpRight size={16}/></button></div>
              <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="building-shape"><div className="building-roof"/><div className="building-body"><i/><i/><i/><i/><i/><i/></div></div><div className="floating-note"><CheckCircle2 size={16}/><span>One step at a time</span></div></div></section>
            <div className="stats-grid"><Stat label="Property records" value={properties.length} icon={<LandPlot size={18}/>} /><Stat label="Contacts" value={contacts.length} icon={<Users size={18}/>} /><Stat label="Open tasks" value={upcomingTasks.length} icon={<CalendarClock size={18}/>} /><Stat label="Due today" value={upcomingTasks.filter(t=>t.date===today).length} icon={<Clock3 size={18}/>} /></div>
            <div className="section-heading"><div><h2>Property modules</h2><p>Six dedicated workspaces, one connected system.</p></div><button className="text-button" onClick={() => go("All Properties")}>View all <ArrowUpRight size={15}/></button></div>
            <div className="module-grid">{filteredModules.map(({name,icon:Icon,color},index)=><button className="module-card" key={name} onClick={()=>go(name)}><div className={`module-icon ${color}`}><Icon size={21} strokeWidth={1.8}/></div><div className="module-number">0{index+1}</div><h3>{name}</h3><p>Manage records, contacts and next steps.</p><span className="module-link">Open workspace <ArrowUpRight size={15}/></span></button>)}</div>
            <div className="bottom-grid"><section className="panel-card"><div className="panel-heading"><div><h2>Upcoming schedule</h2><p>Your next important dates.</p></div><CalendarClock size={20}/></div>{upcomingTasks.length ? <TaskList tasks={upcomingTasks.slice(0,3)} toggle={toggleTask} remove={deleteTask} edit={openTaskForm}/> : <Empty icon={<CalendarClock size={22}/>} title="Your timeline starts here" text="Schedule a one-time reminder for a meeting, payment, registration or follow-up." action="Create schedule" onClick={()=>openTaskForm()}/>}</section>
              <section className="panel-card"><div className="panel-heading"><div><h2>WhatsApp follow-ups</h2><p>Conversations that need attention.</p></div><MessageCircle size={20}/></div><Empty icon={<MessageCircle size={22}/>} title="Keep every conversation moving" text="Create a WhatsApp message link or prepare a reminder. Automatic delivery and reply detection require a connected WhatsApp Business API." action="Open automation" onClick={()=>go("WhatsApp Automation")}/></section></div>
          </>}
          {active === "All Properties" || modules.some(m=>m.name===active) ? <section className="data-panel"><div className="section-heading"><div><h2>{active === "All Properties" ? "All property records" : active}</h2><p>{filteredProperties.filter(p=>active==="All Properties"||p.module===active).length} saved records</p></div><button className="primary-button" onClick={()=>openPropertyForm()}><Plus size={16}/> Add property</button></div>
            {filteredProperties.filter(p=>active==="All Properties"||p.module===active).length ? <div className="record-list">{filteredProperties.filter(p=>active==="All Properties"||p.module===active).map(p=><article className="record-card" key={p.id}><div className="record-symbol"><Building2 size={20}/></div><div className="record-main"><h3>{p.title}</h3><p><MapPin size={14}/>{p.location || "Location not entered"} <span>•</span> {p.module}</p>{p.contact&&<small>Contact: {p.contact}</small>}{(p.surveyNumber || p.areaValue) && <small>{p.surveyNumber ? `Survey no. ${p.surveyNumber}` : ""}{p.surveyNumber && p.areaValue ? " · " : ""}{p.areaValue ? `Area: ${p.areaValue} ${p.areaUnit || "sq ft"}` : ""}</small>}{p.ownershipDetails&&<small>Ownership: {p.ownershipDetails}</small>}{p.dimensions&&<small>Dimensions: {p.dimensions}</small>}{p.notes&&<small>{p.notes}</small>}</div><div className="record-side"><strong>{p.value ? `₹ ${p.value}` : "Value not set"}</strong><span className="status-pill">{p.status}</span><button className="edit-button" onClick={()=>openPropertyForm(p)} aria-label={`Edit ${p.title}`}><Pencil size={15}/></button><button className="delete-button" onClick={()=>deleteProperty(p.id)} aria-label={`Delete ${p.title}`}><Trash2 size={15}/></button></div></article>)}</div>:<Empty icon={<LandPlot size={22}/>} title="No property records yet" text="Add your first record. It will be stored in this browser on this device." action="Add property" onClick={()=>openPropertyForm()}/>}</section> : null}
          {active === "Contacts" && <section className="data-panel"><div className="section-heading"><div><h2>Contacts</h2><p>{contacts.length} saved contacts</p></div><button className="primary-button" onClick={()=>openContactForm()}><Plus size={16}/> Add contact</button></div>
            {contacts.length ? <div className="record-list">{contacts.filter(c=>`${c.name} ${c.phone} ${c.role}`.toLowerCase().includes(search.toLowerCase())).map(c=><article className="record-card" key={c.id}><div className="record-symbol contact-symbol"><Users size={20}/></div><div className="record-main"><h3>{c.name}</h3><p><Phone size={14}/>{c.phone || "No phone entered"} <span>•</span> {c.role || "Contact"}</p>{c.notes&&<small>{c.notes}</small>}</div><div className="record-side"><button className="edit-button" onClick={()=>openContactForm(c)} aria-label={`Edit ${c.name}`}><Pencil size={15}/></button><button className="delete-button" onClick={()=>deleteContact(c.id)} aria-label={`Delete ${c.name}`}><Trash2 size={15}/></button></div></article>)}</div>:<Empty icon={<Users size={22}/>} title="Your contact book is ready" text="Keep buyers, sellers, lawyers, brokers, lenders and other stakeholders together." action="Add contact" onClick={()=>openContactForm()}/>}</section>}
          {active === "Schedule & Tasks" && <section className="data-panel"><div className="section-heading"><div><h2>One-time schedule</h2><p>Tasks and reminders saved on this device.</p></div><button className="primary-button" onClick={()=>openTaskForm()}><Plus size={16}/> Schedule task</button></div>
            <div className="notice notice-warn"><Clock3 size={17}/> These are stored reminders, not background alarms. For reliable notifications after closing the app, we must add a deployed server scheduler in the next stage.</div>
            {tasks.length ? <TaskList tasks={[...tasks].sort((a,b)=>`${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))} toggle={toggleTask} remove={deleteTask} edit={openTaskForm}/> : <Empty icon={<CalendarClock size={22}/>} title="Nothing scheduled yet" text="Add a dated task for a payment, meeting, registration or follow-up." action="Create schedule" onClick={()=>openTaskForm()}/>}</section>}
          {active === "Financials" && <section className="data-panel">
            <div className="section-heading"><div><h2>Financial intelligence</h2><p>{financials.length} recorded transactions · amounts in INR</p></div><div className="finance-actions"><button className="secondary-button" onClick={()=>{const rows=[["Date","Type","Property","Amount INR","Party","Reference","Notes"],...financials.map(item=>[item.date,item.type,item.property,item.amount,item.party,item.reference,item.notes])];const csv=rows.map(row=>row.map(value=>`"${String(value).replace(/"/g,'""')}"`).join(",")).join("\n");const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));link.download=`estateflow-financials-${today}.csv`;link.click();URL.revokeObjectURL(link.href);}}>Export CSV</button><button className="primary-button" onClick={()=>openFinancialForm()}><Plus size={16}/> Add transaction</button></div></div>
            <div className="finance-summary"><div><span>Tracked inflows</span><strong>₹{totalInflow.toLocaleString("en-IN",{maximumFractionDigits:2})}</strong></div><div><span>Tracked outflows</span><strong>₹{totalOutflow.toLocaleString("en-IN",{maximumFractionDigits:2})}</strong></div><div><span>Net recorded movement</span><strong>₹{(totalInflow-totalOutflow).toLocaleString("en-IN",{maximumFractionDigits:2})}</strong></div></div>
            <p className="finance-footnote">Totals are category-based summaries of records entered here, not verified bank balances or accounting advice. Review transaction types and source documents before relying on settlement figures.</p>
            {financials.length ? <div className="record-list">{[...financials].sort((a,b)=>b.date.localeCompare(a.date)).map(item=><article className="record-card" key={item.id}><div className="record-symbol"><Calculator size={20}/></div><div className="record-main"><h3>{item.type} · ₹{Number(item.amount||0).toLocaleString("en-IN",{maximumFractionDigits:2})}</h3><p>{item.date}{item.property ? <><span>•</span>{item.property}</> : null}</p>{item.party&&<small>Party: {item.party}</small>}{item.reference&&<small>Reference: {item.reference}</small>}{item.notes&&<small>{item.notes}</small>}</div><div className="record-side"><button className="edit-button" onClick={()=>openFinancialForm(item)} aria-label={`Edit ${item.type} transaction`}><Pencil size={15}/></button><button className="delete-button" onClick={()=>deleteFinancial(item.id)} aria-label="Delete financial transaction"><Trash2 size={15}/></button></div></article>)}</div> : <Empty icon={<Calculator size={22}/>} title="No financial transactions yet" text="Record advances, purchase/sale values, loans, repayments, interest, receipts, brokerage, expenses and settlements." action="Add transaction" onClick={()=>openFinancialForm()}/>}
          </section>}
          {active === "Documents" && <section className="data-panel">
            <div className="section-heading"><div><h2>Private document vault</h2><p>{documents.length} saved documents · private cloud storage when connected</p></div><FileText size={21}/></div>
            {!backendConfigured || !session ? <div className="notice notice-warn">Secure document upload is disabled in local-only mode. Configure the shared database and sign in to store deeds, ECs, khata, RTC/Pahani, tax receipts and agreements privately.</div> : <div className="document-upload-card">
              <div className="form-two">
                <label>Document category<select value={documentCategory} onChange={event=>setDocumentCategory(event.target.value)}>{["Sale deed","Encumbrance Certificate","RTC / Pahani","Khata","Tax receipt","Loan document","JV / JDA agreement","Legal opinion","Identity / KYC","Other"].map(value=><option key={value}>{value}</option>)}</select></label>
                <label>Related property<select value={documentProperty} onChange={event=>setDocumentProperty(event.target.value)}><option value="">No property selected</option>{properties.map(property=><option key={property.id} value={property.id}>{property.title}</option>)}</select></label>
              </div>
              <div className="form-two">
                <label>Expiry / renewal date<input type="date" value={documentExpiry} onChange={event=>setDocumentExpiry(event.target.value)}/></label>
                <label>Notes<input value={documentNotes} onChange={event=>setDocumentNotes(event.target.value)} placeholder="Document number, authority, comments"/></label>
              </div>
              <label className="upload-picker">Select a document (PDF, image, DOC/DOCX · max 25 MB)<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" disabled={uploadingDocument} onChange={event=>{const file=event.target.files?.[0];if(file)void uploadDocument(file);event.currentTarget.value="";}}/><span>{uploadingDocument ? "Uploading privately…" : "Choose file to upload"}</span></label>
            </div>}
            {documents.length ? <div className="record-list document-list">{documents.map(record=><article className="record-card" key={record.id}><div className="record-symbol"><FileText size={20}/></div><div className="record-main"><h3>{record.name}</h3><p>{record.category}{record.property ? <><span>•</span>{record.property}</> : null}</p>{record.expiresOn&&<small>Expiry / renewal: {record.expiresOn}</small>}{record.notes&&<small>{record.notes}</small>}<small>{(record.sizeBytes/1024/1024).toFixed(2)} MB</small></div><div className="record-side"><button className="edit-button" onClick={()=>void downloadDocument(record)} aria-label={`Download ${record.name}`}><Download size={15}/></button><button className="delete-button" onClick={()=>void deleteDocument(record)} aria-label={`Delete ${record.name}`}><Trash2 size={15}/></button></div></article>)}</div> : <Empty icon={<FileText size={22}/>} title="No documents uploaded yet" text={backendConfigured && session ? "Upload a property document above. Files are private and download links expire after 60 seconds." : "Configure the backend to upload and protect documents across devices."} action="Back to overview" onClick={()=>go("Overview")}/>}
          </section>}
          {active === "WhatsApp Automation" && <section className="data-panel">
            <div className="section-heading"><div><h2>WhatsApp follow-ups</h2><p>Schedule one approved-template message and stop future sends when the recipient replies.</p></div><MessageCircle size={21}/></div>
            <div className="notice notice-warn">Automatic sending requires a deployed WhatsApp worker, Meta credentials, an approved template, a scheduled worker trigger, and the reply webhook. Queueing here does not itself send the message. Only message people who have opted in.</div>
            <div className="form-card wa-form">
              <label>Recipient phone number <span>Country code included, digits only (e.g. 919876543210)</span><input value={waPhone} onChange={event=>setWaPhone(event.target.value.replace(/[^\d]/g,""))} placeholder="91XXXXXXXXXX"/></label>
              <label>Message notes (for your records)<textarea rows={3} value={waMessage} onChange={event=>setWaMessage(event.target.value)} placeholder="Context for this follow-up"/></label>
              <div className="form-two"><label>Approved WhatsApp template name<input value={waTemplateName} onChange={event=>setWaTemplateName(event.target.value)} placeholder="estateflow_follow_up"/></label><label>Template language code<input value={waTemplateLanguage} onChange={event=>setWaTemplateLanguage(event.target.value)} placeholder="en_US"/></label></div>
              <label>Template body parameters <span>Optional; comma-separated values in the order required by your approved template</span><input value={waTemplateParameters} onChange={event=>setWaTemplateParameters(event.target.value)} placeholder="Name, property reference, next step"/></label>
              <div className="form-two"><label>Send date<input type="date" min={localDate()} value={waScheduleDate} onChange={event=>setWaScheduleDate(event.target.value)}/></label><label>Send time<input type="time" value={waScheduleTime} onChange={event=>setWaScheduleTime(event.target.value)}/></label></div>
              <label className="consent-check"><input type="checkbox" checked={waConsentConfirmed} onChange={event=>setWaConsentConfirmed(event.target.checked)}/> I confirm the recipient has opted in to receive WhatsApp messages.</label>
              <button className="primary-button" disabled={waQueueBusy || !waPhone || !waTemplateName.trim() || !waConsentConfirmed} onClick={()=>void scheduleWhatsAppFollowup()}><CalendarClock size={16}/>{waQueueBusy ? "Scheduling…" : "Schedule one-time follow-up"}</button>
              <div className="form-actions"><button className="secondary-button" disabled={!waPhone || !waMessage.trim()} onClick={()=>window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(waMessage)}`,"_blank","noopener,noreferrer")}><ExternalLink size={16}/> Open WhatsApp manually</button></div>
            </div>
            <div className="section-heading"><div><h2>Follow-up queue</h2><p>{whatsappFollowups.length} scheduled or historical messages</p></div></div>
            {whatsappFollowups.length ? <div className="record-list">{whatsappFollowups.map(record=><article className="record-card" key={record.id}><div className="record-symbol"><MessageCircle size={20}/></div><div className="record-main"><h3>{record.phone}</h3><p>{record.templateName || "Manual message"} <span>•</span> {record.scheduledAt ? new Date(record.scheduledAt).toLocaleString() : "No send time"}</p><small>Status: {record.status}{record.stopOnReply ? " · Stop on reply enabled" : ""}</small>{record.lastError&&<small>{record.lastError}</small>}</div><div className="record-side"><span className={`status-pill status-${record.status}`}>{record.status}</span>{record.status === "scheduled" && <button className="delete-button" onClick={()=>void cancelWhatsAppFollowup(record)} aria-label="Cancel follow-up"><X size={15}/></button>}</div></article>)}</div> : <Empty icon={<MessageCircle size={22}/>} title="No follow-ups queued" text="Schedule an approved template above. Automatic delivery begins only after your backend worker and webhook are deployed." action="Back to overview" onClick={()=>go("Overview")}/>}
          </section>}
          {active === "Settings" && <section className="data-panel"><div className="section-heading"><div><h2>Settings</h2><p>Workspace data and local backup</p></div></div><div className="settings-card"><h3>Local data backup</h3><p>Records are currently stored in this browser's local storage. They are not synced across devices and may be lost if browser data is cleared.</p><button className="secondary-button" onClick={()=>{const blob=new Blob([JSON.stringify({properties,contacts,tasks,exportedAt:new Date().toISOString()},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`estateflow-backup-${today}.json`;a.click();URL.revokeObjectURL(url);}}>Export backup JSON</button><button className="secondary-button" onClick={()=>{const input=document.createElement("input");input.type="file";input.accept=".json,application/json";input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!Array.isArray(data.properties)||!Array.isArray(data.contacts)||!Array.isArray(data.tasks))throw new Error("Invalid backup");setProperties(data.properties);setContacts(data.contacts);setTasks(data.tasks);setNotice("Backup imported.");}catch{setNotice("Could not import this file. Please select a valid EstateFlow backup.");}};input.click();}}>Import backup JSON</button>{backendConfigured && session && <button className="secondary-button" onClick={async () => { await supabase?.auth.signOut(); }}>Sign out of shared workspace</button>}</div></section>}
          <footer className="footer"><span>EstateFlow © 2026</span><span>{backendConfigured && session ? "Shared database connected" : "Local-only mode · Device data is not synced"}</span></footer>
        </div>
      </section>
      {showPropertyForm && <Modal title={editingProperty ? "Edit property record" : "Add property record"} onClose={()=>closePropertyForm()}><PropertyForm defaultModule={modules.some(m=>m.name===active)?active:modules[0].name} initial={editingProperty} onSave={saveProperty} onCancel={()=>closePropertyForm()}/></Modal>}
      {showContactForm && <Modal title={editingContact ? "Edit contact" : "Add contact"} onClose={()=>closeContactForm()}><ContactForm initial={editingContact} onSave={saveContact} onCancel={()=>closeContactForm()}/></Modal>}
      {showTaskForm && <Modal title={editingTask ? "Edit scheduled task" : "Schedule a one-time task"} onClose={()=>closeTaskForm()}><TaskForm properties={properties} initial={editingTask} onSave={saveTask} onCancel={()=>closeTaskForm()}/></Modal>}
      {showFinancialForm && <Modal title={editingFinancial ? "Edit financial transaction" : "Add financial transaction"} onClose={()=>closeFinancialForm()}><FinancialForm properties={properties} initial={editingFinancial} onSave={saveFinancial} onCancel={()=>closeFinancialForm()}/></Modal>}
    </main>
  );
}

function Stat({label,value,icon}:{label:string;value:number;icon:ReactNode}) { return <div className="stat-card"><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></div>; }
function Empty({icon,title,text,action,onClick}:{icon:ReactNode;title:string;text:string;action:string;onClick:()=>void}) { return <div className="empty-state"><div className="empty-icon">{icon}</div><strong>{title}</strong><p>{text}</p><button className="secondary-button" onClick={onClick}><Plus size={15}/>{action}</button></div>; }
function TaskList({tasks,toggle,remove,edit}:{tasks:TaskRecord[];toggle:(id:string)=>void;remove:(id:string)=>void;edit?:(task:TaskRecord)=>void}) {
  return <div className="task-list">{tasks.map(t=><article className={`task-row ${t.done?"task-done":""}`} key={t.id}><button className="task-check" onClick={()=>toggle(t.id)} aria-label={t.done?"Mark incomplete":"Mark complete"}><CircleCheck size={20}/></button><div className="task-details"><strong>{t.title}</strong><p><CalendarDays size={14}/>{t.date} <span>•</span> {t.time} <span>•</span> {t.type}</p>{t.property&&<small>{t.property}</small>}{t.notes&&<small>{t.notes}</small>}</div>{edit && <button className="edit-button" onClick={()=>edit(t)} aria-label={`Edit ${t.title}`}><Pencil size={15}/></button>}<button className="delete-button" onClick={()=>remove(t.id)} aria-label="Delete task"><Trash2 size={15}/></button></article>)}</div>;
}
function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}) { return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><h2>{title}</h2><button onClick={onClose} aria-label="Close"><X size={19}/></button></div>{children}</section></div>; }
function PropertyForm({defaultModule,initial,onSave,onCancel}:{defaultModule:string;initial?:PropertyRecord|null;onSave:(v:Omit<PropertyRecord,"id"|"createdAt">)=>void;onCancel:()=>void}) {
  const [form,setForm]=useState({
    title:initial?.title ?? "",module:initial?.module ?? defaultModule,location:initial?.location ?? "",
    value:initial?.value ?? "",status:initial?.status ?? "Active",contact:initial?.contact ?? "",notes:initial?.notes ?? "",
    surveyNumber:initial?.surveyNumber ?? "",ownershipDetails:initial?.ownershipDetails ?? "",areaValue:initial?.areaValue ?? "",
    areaUnit:initial?.areaUnit ?? "sq ft",dimensions:initial?.dimensions ?? "",ratePerUnit:initial?.ratePerUnit ?? ""
  });
  const update=(key:string,value:string)=>setForm(p=>({...p,[key]:value}));
  return <form className="form-card" onSubmit={e=>{e.preventDefault();if(form.title.trim())onSave(form);}}>
    <label>Property / deal name *<input required value={form.title} onChange={e=>update("title",e.target.value)} placeholder="e.g. Site on Main Road"/></label>
    <label>Module<select value={form.module} onChange={e=>update("module",e.target.value)}>{modules.map(m=><option key={m.name}>{m.name}</option>)}</select></label>
    <div className="form-two"><label>Location<input value={form.location} onChange={e=>update("location",e.target.value)} placeholder="Area / village / city"/></label><label>Value (₹)<input inputMode="decimal" value={form.value} onChange={e=>update("value",e.target.value)} placeholder="e.g. 25000000"/></label></div>
    <div className="form-two"><label>Status<select value={form.status} onChange={e=>update("status",e.target.value)}>{["Active","Under review","Negotiation","On hold","Completed","Closed"].map(s=><option key={s}>{s}</option>)}</select></label><label>Primary contact<input value={form.contact} onChange={e=>update("contact",e.target.value)} placeholder="Contact name"/></label></div>
    <div className="form-two"><label>Survey number / property ID<input value={form.surveyNumber} onChange={e=>update("surveyNumber",e.target.value)} placeholder="Survey / PID / khata no."/></label><label>Ownership details<input value={form.ownershipDetails} onChange={e=>update("ownershipDetails",e.target.value)} placeholder="Owner / co-owners"/></label></div>
    <div className="form-two"><label>Land / built-up area<input inputMode="decimal" value={form.areaValue} onChange={e=>update("areaValue",e.target.value)} placeholder="e.g. 1200"/></label><label>Area unit<select value={form.areaUnit} onChange={e=>update("areaUnit",e.target.value)}>{["sq ft","sq yd","sq m","acre","gunta","hectare","cent"].map(unit=><option key={unit}>{unit}</option>)}</select></label></div>
    <div className="form-two"><label>Dimensions / boundary notes<input value={form.dimensions} onChange={e=>update("dimensions",e.target.value)} placeholder="e.g. 30 × 40 ft; east road"/></label><label>Rate per unit (₹)<input inputMode="decimal" value={form.ratePerUnit} onChange={e=>update("ratePerUnit",e.target.value)} placeholder="Optional"/></label></div>
    <label>Notes<textarea rows={3} value={form.notes} onChange={e=>update("notes",e.target.value)} placeholder="Important details, next steps..."/></label>
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="submit" className="primary-button">{initial ? "Save changes" : "Save record"}</button></div>
  </form>;
}
function ContactForm({initial,onSave,onCancel}:{initial?:ContactRecord|null;onSave:(v:Omit<ContactRecord,"id">)=>void;onCancel:()=>void}) {
  const [form,setForm]=useState({name:initial?.name ?? "",phone:initial?.phone ?? "",role:initial?.role ?? "Buyer",notes:initial?.notes ?? ""});
  const update=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));
  return <form className="form-card" onSubmit={e=>{e.preventDefault();if(form.name.trim())onSave(form);}}>
    <label>Full name *<input required value={form.name} onChange={e=>update("name",e.target.value)} placeholder="Contact name"/></label>
    <div className="form-two"><label>Phone<input value={form.phone} onChange={e=>update("phone",e.target.value)} placeholder="+91..."/></label><label>Role<select value={form.role} onChange={e=>update("role",e.target.value)}>{["Buyer","Seller","Broker","Lawyer","Lender","Tenant","Developer","Government office","Other"].map(s=><option key={s}>{s}</option>)}</select></label></div>
    <label>Notes<textarea rows={3} value={form.notes} onChange={e=>update("notes",e.target.value)}/></label>
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="submit" className="primary-button">{initial ? "Save changes" : "Save contact"}</button></div>
  </form>;
}
function TaskForm({properties,initial,onSave,onCancel}:{properties:PropertyRecord[];initial?:TaskRecord|null;onSave:(v:Omit<TaskRecord,"id"|"done">)=>void;onCancel:()=>void}) {
  const [form,setForm]=useState({title:initial?.title ?? "",date:initial?.date ?? new Date().toISOString().slice(0,10),time:initial?.time ?? "10:00",type:initial?.type ?? "Follow-up",property:initial?.property ?? "",notes:initial?.notes ?? ""});
  const update=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));
  return <form className="form-card" onSubmit={e=>{e.preventDefault();if(form.title.trim())onSave(form);}}>
    <label>Task / reminder *<input required value={form.title} onChange={e=>update("title",e.target.value)} placeholder="e.g. Call lawyer about document"/></label>
    <div className="form-two"><label>Date *<input required type="date" value={form.date} onChange={e=>update("date",e.target.value)}/></label><label>Time *<input required type="time" value={form.time} onChange={e=>update("time",e.target.value)}/></label></div>
    <div className="form-two"><label>Task type<select value={form.type} onChange={e=>update("type",e.target.value)}>{["Follow-up","Meeting","Payment","Registration","Document deadline","Site visit","Other"].map(s=><option key={s}>{s}</option>)}</select></label><label>Related property<select value={form.property} onChange={e=>update("property",e.target.value)}><option value="">None selected</option>{properties.map(p=><option key={p.id} value={p.title}>{p.title}</option>)}</select></label></div>
    <label>Notes<textarea rows={3} value={form.notes} onChange={e=>update("notes",e.target.value)} placeholder="Details or preparation required"/></label>
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="submit" className="primary-button">{initial ? "Save changes" : "Save task"}</button></div>
  </form>;
}

function FinancialForm({properties,initial,onSave,onCancel}:{properties:PropertyRecord[];initial?:FinancialRecord|null;onSave:(value:Omit<FinancialRecord,"id">)=>void;onCancel:()=>void}) {
  const [form,setForm]=useState({
    propertyId:initial?.propertyId ?? "",
    property:initial?.property ?? "",
    type:initial?.type ?? "Receipt",
    amount:initial?.amount ?? "",
    date:initial?.date ?? new Date().toISOString().slice(0,10),
    party:initial?.party ?? "",
    reference:initial?.reference ?? "",
    notes:initial?.notes ?? ""
  });
  const update=(key:string,value:string)=>setForm(previous=>({...previous,[key]:value}));
  const types=["Purchase","Sale","Advance","Loan Disbursal","Loan Repayment","Interest","Instalment","Brokerage","Expense","Receipt","Settlement","Other"];
  return <form className="form-card" onSubmit={event=>{event.preventDefault();if(form.amount.trim() && Number(form.amount)>=0){const property=properties.find(item=>item.id===form.propertyId);onSave({...form,property:property?.title ?? form.property});}}}>
    <div className="form-two"><label>Transaction type<select value={form.type} onChange={event=>update("type",event.target.value)}>{types.map(type=><option key={type}>{type}</option>)}</select></label><label>Amount (₹) *<input required type="number" min="0" step="0.01" value={form.amount} onChange={event=>update("amount",event.target.value)} placeholder="0.00"/></label></div>
    <div className="form-two"><label>Date *<input required type="date" value={form.date} onChange={event=>update("date",event.target.value)}/></label><label>Related property<select value={form.propertyId} onChange={event=>{const value=event.target.value;update("propertyId",value);update("property",properties.find(item=>item.id===value)?.title ?? "");}}><option value="">No property selected</option>{properties.map(property=><option key={property.id} value={property.id}>{property.title}</option>)}</select></label></div>
    <div className="form-two"><label>Party / counterparty<input value={form.party} onChange={event=>update("party",event.target.value)} placeholder="Buyer, seller, bank, broker"/></label><label>Reference number<input value={form.reference} onChange={event=>update("reference",event.target.value)} placeholder="Receipt / bank reference"/></label></div>
    <label>Notes<textarea rows={3} value={form.notes} onChange={event=>update("notes",event.target.value)} placeholder="Payment method, interest period, settlement details"/></label>
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="submit" className="primary-button">{initial ? "Save changes" : "Save transaction"}</button></div>
  </form>;
}

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
