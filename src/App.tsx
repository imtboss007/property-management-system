import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { backendConfigured, supabase } from "./lib/supabase";
import WhatsAppScheduler from "./WhatsAppScheduler";
import {
  Building2, LayoutDashboard, LandPlot, HandCoins, Handshake, Calculator,
  Wheat, Store, CalendarClock, MessageCircle, Users, FileText, Settings,
  Search, Bell, Plus, ArrowUpRight, Clock3, CheckCircle2, Menu, X,
  Trash2, Phone, MapPin, CalendarDays, CircleCheck, ExternalLink, Pencil, Download,
  Rocket, PieChart, BriefcaseBusiness, UserRound, House, Scale, ShieldCheck, ClipboardCheck
} from "lucide-react";

type PropertyRecord = {
  id: string; title: string; module: string; location: string; value: string;
  status: string; contact: string; notes: string; createdAt: string;
  surveyNumber: string; ownershipDetails: string; areaValue: string; areaUnit: string; dimensions: string; ratePerUnit: string;
  moduleData: Record<string, string>;
};
type ContactRecord = { id: string; name: string; phone: string; role: string; notes: string };
type TaskRecord = { id: string; title: string; date: string; time: string; type: string; property: string; notes: string; done: boolean };
type DocumentRecord = { id: string; propertyId: string; property: string; name: string; category: string; storagePath: string; mimeType: string; sizeBytes: number; expiresOn: string; notes: string; createdAt: string };

type FinancialRecord = { id: string; propertyId: string; property: string; type: string; amount: string; date: string; party: string; reference: string; notes: string };
type RiskRecord = { id: string; title: string; category: string; severity: string; status: string; owner: string; dueDate: string; entity: string; mitigation: string; createdAt: string };
type ApprovalRequest = { id: string; title: string; area: string; entity: string; requestedBy: string; approver: string; priority: string; status: string; rationale: string; decisionNotes: string; requestedAt: string; decidedAt: string };
type Section = "Overview" | "All Properties" | "Contacts" | "Documents" | "Schedule & Tasks" | "WhatsApp Automation" | "Risk & Compliance" | "Approvals" | "Settings" | string;

const modules = [
  { name: "Property Sale", icon: Building2, color: "mint", group: "Real Assets", description: "Sales pipeline, price, counterparty and closing milestones." },
  { name: "Property Loans", icon: HandCoins, color: "blue", group: "Credit", description: "Secured facilities, collateral, balances and repayments." },
  { name: "JV / JDA / JD", icon: Handshake, color: "violet", group: "Development", description: "Landowner and developer terms, shares and obligations." },
  { name: "SR Rate Settlement", icon: Calculator, color: "amber", group: "Settlement", description: "Rate-based settlements, supporting records and approvals." },
  { name: "Agricultural Land", icon: Wheat, color: "green", group: "Real Assets", description: "Survey details, extent, ownership and due diligence." },
  { name: "Commercial Land", icon: Store, color: "rose", group: "Real Assets", description: "Commercial assets, counterparties and transaction stages." },
  { name: "Startup", icon: Rocket, color: "violet", group: "Capital & Ventures", description: "Founders, funding rounds, valuation and capital requirements." },
  { name: "Equity", icon: PieChart, color: "blue", group: "Capital & Ventures", description: "Shares, instruments, ownership, entry cost and valuation." },
  { name: "Unsecured Company Loan", icon: BriefcaseBusiness, color: "amber", group: "Credit & Lending", description: "Company borrowing, lender terms, guarantees and covenants." },
  { name: "Personal Loan", icon: UserRound, color: "mint", group: "Credit & Lending", description: "Borrower terms, EMI, guarantors and repayment milestones." },
  { name: "Housing Loan", icon: House, color: "green", group: "Credit & Lending", description: "Mortgage terms, LTV, interest type, EMI and balance." },
  { name: "House Purchase", icon: House, color: "rose", group: "Acquisitions", description: "Offer, advance, due diligence, registration and possession." },
  { name: "Litigation", icon: Scale, color: "amber", group: "Legal & Risk", description: "Case chronology, exposure, counsel and hearing deadlines." },
  { name: "Fund & Portfolio Management", icon: PieChart, color: "blue", group: "Portfolio & Funds", description: "Commitments, deployed capital, NAV, fees, hurdle rates and benchmarks." },
  { name: "Investor Relations", icon: Users, color: "mint", group: "Investor Services", description: "LPs, investors, commitments, paid-in capital, KYC status and reporting." },
  { name: "Compliance & KYC", icon: ShieldCheck, color: "violet", group: "Governance", description: "Counterparty onboarding, beneficial ownership, screening and review dates." }
];
const navigation = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "All Properties", icon: LandPlot },
  { name: "Contacts", icon: Users },
  { name: "Financials", icon: Calculator },
  { name: "Documents", icon: FileText },
  { name: "Schedule & Tasks", icon: CalendarClock },
  { name: "Risk & Compliance", icon: ShieldCheck },
  { name: "Approvals", icon: ClipboardCheck },
  { name: "WhatsApp Automation", icon: MessageCircle }
];

type ModuleField = { key: string; label: string; placeholder: string; type?: "text" | "number" | "date" };
const moduleFields: Record<string, ModuleField[]> = {
  "Startup": [
    { key: "stage", label: "Startup stage", placeholder: "Pre-seed, seed, Series A…" },
    { key: "sector", label: "Sector", placeholder: "Fintech, healthtech, climate…" },
    { key: "founders", label: "Founders / promoters", placeholder: "Names and roles" },
    { key: "round", label: "Funding round", placeholder: "Seed / Series A / bridge" },
    { key: "capitalSought", label: "Capital sought (₹)", placeholder: "Amount", type: "number" },
    { key: "preMoneyValuation", label: "Pre-money valuation (₹)", placeholder: "Amount", type: "number" },
    { key: "equityOffered", label: "Equity offered (%)", placeholder: "Percentage", type: "number" },
    { key: "targetCloseDate", label: "Target close date", placeholder: "Date", type: "date" }
  ],
  "Equity": [
    { key: "instrument", label: "Instrument / asset class", placeholder: "Listed equity, private shares, SAFE…" },
    { key: "tickerOrSecurityId", label: "Ticker / security ID", placeholder: "Ticker, ISIN or internal code" },
    { key: "sharesOrUnits", label: "Shares / units", placeholder: "Quantity", type: "number" },
    { key: "ownershipPercent", label: "Ownership (%)", placeholder: "Percentage", type: "number" },
    { key: "entryPrice", label: "Entry price per share (₹)", placeholder: "Price", type: "number" },
    { key: "currentValuation", label: "Current valuation (₹)", placeholder: "Amount", type: "number" },
    { key: "custodian", label: "Custodian / broker", placeholder: "Institution or account reference" }
  ],
  "Unsecured Company Loan": [
    { key: "borrowerCompany", label: "Borrowing company", placeholder: "Legal company name" },
    { key: "lender", label: "Lender", placeholder: "Bank, NBFC or private lender" },
    { key: "facilityAmount", label: "Facility amount (₹)", placeholder: "Principal", type: "number" },
    { key: "interestRate", label: "Annual interest rate (%)", placeholder: "APR", type: "number" },
    { key: "tenureMonths", label: "Tenure (months)", placeholder: "Months", type: "number" },
    { key: "repaymentFrequency", label: "Repayment frequency", placeholder: "Monthly / quarterly / bullet" },
    { key: "guarantees", label: "Guarantees / covenants", placeholder: "Guarantees, DSCR, covenants…" },
    { key: "maturityDate", label: "Maturity date", placeholder: "Date", type: "date" }
  ],
  "Personal Loan": [
    { key: "borrower", label: "Borrower", placeholder: "Full legal name" },
    { key: "lender", label: "Lender", placeholder: "Bank / NBFC / lender" },
    { key: "principal", label: "Principal (₹)", placeholder: "Amount", type: "number" },
    { key: "interestRate", label: "Annual interest rate (%)", placeholder: "APR", type: "number" },
    { key: "tenureMonths", label: "Tenure (months)", placeholder: "Months", type: "number" },
    { key: "emi", label: "EMI (₹)", placeholder: "Monthly instalment", type: "number" },
    { key: "purpose", label: "Loan purpose", placeholder: "Purpose" },
    { key: "guarantor", label: "Guarantor / co-obligant", placeholder: "Optional" }
  ],
  "Housing Loan": [
    { key: "lender", label: "Lender", placeholder: "Bank / housing finance company" },
    { key: "originalPrincipal", label: "Original principal (₹)", placeholder: "Amount", type: "number" },
    { key: "outstandingPrincipal", label: "Outstanding principal (₹)", placeholder: "Amount", type: "number" },
    { key: "interestRate", label: "Annual interest rate (%)", placeholder: "APR", type: "number" },
    { key: "tenureMonths", label: "Original tenure (months)", placeholder: "Months", type: "number" },
    { key: "emi", label: "EMI (₹)", placeholder: "Monthly instalment", type: "number" },
    { key: "ltv", label: "Loan-to-value (%)", placeholder: "LTV ratio", type: "number" },
    { key: "rateType", label: "Interest rate type", placeholder: "Fixed / floating / hybrid" }
  ],
  "House Purchase": [
    { key: "buyer", label: "Buyer / purchaser", placeholder: "Buyer name" },
    { key: "seller", label: "Seller", placeholder: "Seller name" },
    { key: "agreedPrice", label: "Agreed purchase price (₹)", placeholder: "Amount", type: "number" },
    { key: "advancePaid", label: "Advance / deposit paid (₹)", placeholder: "Amount", type: "number" },
    { key: "stampDutyAndFees", label: "Stamp duty / registration estimate (₹)", placeholder: "Amount", type: "number" },
    { key: "dueDiligenceStage", label: "Due-diligence stage", placeholder: "Title, EC, tax, khata, approvals…" },
    { key: "targetRegistrationDate", label: "Target registration date", placeholder: "Date", type: "date" },
    { key: "possessionDate", label: "Possession date", placeholder: "Date", type: "date" }
  ],
  "Litigation": [
    { key: "caseNumber", label: "Case number / CNR", placeholder: "Court case reference" },
    { key: "court", label: "Court / tribunal", placeholder: "Court, bench or tribunal" },
    { key: "parties", label: "Parties and case title", placeholder: "Petitioner / respondent / claimant" },
    { key: "counsel", label: "Advocate / counsel", placeholder: "Counsel and contact" },
    { key: "caseType", label: "Case type / current stage", placeholder: "Civil, criminal, appeal, interim…" },
    { key: "claimExposure", label: "Claim / exposure (₹)", placeholder: "Amount in dispute", type: "number" },
    { key: "nextHearingDate", label: "Next hearing date", placeholder: "Date", type: "date" },
    { key: "limitationDate", label: "Limitation / next legal deadline", placeholder: "Date", type: "date" }
  ],
  "Fund & Portfolio Management": [
    { key: "fundName", label: "Fund / portfolio name", placeholder: "Legal fund or portfolio name" },
    { key: "legalStructure", label: "Legal structure", placeholder: "Trust, LLP, company, AIF, SPV…" },
    { key: "strategy", label: "Investment strategy", placeholder: "Private equity, real assets, credit…" },
    { key: "vintageYear", label: "Vintage year", placeholder: "YYYY", type: "number" },
    { key: "committedCapital", label: "Committed capital (₹)", placeholder: "Total investor commitments", type: "number" },
    { key: "deployedCapital", label: "Deployed capital (₹)", placeholder: "Invested / drawn capital", type: "number" },
    { key: "nav", label: "Net asset value (₹)", placeholder: "Reviewed NAV", type: "number" },
    { key: "managementFee", label: "Management fee (%)", placeholder: "Fee rate", type: "number" },
    { key: "performanceFee", label: "Performance / carry (%)", placeholder: "Carried interest", type: "number" },
    { key: "hurdleRate", label: "Hurdle rate (%)", placeholder: "Preferred return", type: "number" },
    { key: "benchmark", label: "Benchmark", placeholder: "Reference index or hurdle" },
    { key: "administrator", label: "Fund administrator / custodian", placeholder: "Service provider" },
    { key: "reportingPeriod", label: "Reporting period", placeholder: "Quarter / fiscal year" }
  ],
  "Investor Relations": [
    { key: "investorType", label: "Investor type", placeholder: "LP, family office, VC, institution…" },
    { key: "investorEntity", label: "Investor legal entity", placeholder: "Registered legal name" },
    { key: "commitmentAmount", label: "Commitment (₹)", placeholder: "Committed amount", type: "number" },
    { key: "paidInCapital", label: "Paid-in capital (₹)", placeholder: "Capital called and received", type: "number" },
    { key: "investorClass", label: "Investor / share class", placeholder: "Class, series or terms" },
    { key: "jurisdiction", label: "Jurisdiction", placeholder: "Country / state" },
    { key: "kycStatus", label: "KYC status", placeholder: "Pending / in review / cleared / expired" },
    { key: "sourceOfFunds", label: "Source of funds", placeholder: "Documented source-of-funds summary" },
    { key: "riskRating", label: "Investor risk rating", placeholder: "Low / medium / high" },
    { key: "lastReportDate", label: "Last investor report date", placeholder: "Date", type: "date" }
  ],
  "Compliance & KYC": [
    { key: "counterpartyLegalName", label: "Counterparty legal name", placeholder: "Name matching official records" },
    { key: "entityType", label: "Entity / customer type", placeholder: "Individual, company, trust, fund…" },
    { key: "jurisdiction", label: "Jurisdiction", placeholder: "Country / state of registration" },
    { key: "kycStatus", label: "KYC status", placeholder: "Not started / pending / cleared / expired" },
    { key: "beneficialOwner", label: "Beneficial owner(s)", placeholder: "Names and ownership / control" },
    { key: "sanctionsScreening", label: "Sanctions screening", placeholder: "Not run / clear / escalation required" },
    { key: "pepStatus", label: "PEP screening", placeholder: "Not run / negative / potential match" },
    { key: "riskRating", label: "Counterparty risk rating", placeholder: "Low / medium / high / critical" },
    { key: "reviewDueDate", label: "Next KYC review date", placeholder: "Date", type: "date" },
    { key: "evidenceStatus", label: "Evidence checklist", placeholder: "ID, registration, BO, source of funds…" }
  ]
};
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
  const [riskRecords, setRiskRecords] = useState<RiskRecord[]>(() => load("estateflow.risks", []));
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>(() => load("estateflow.approvals", []));
  const [showRiskForm, setShowRiskForm] = useState(false);
  const [showApprovalForm, setShowApprovalForm] = useState(false);
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
  useEffect(() => {
    if (backendConfigured && (!session || !remoteReady)) return;
    localStorage.setItem(storageKey("risks"), JSON.stringify(riskRecords));
  }, [riskRecords, session?.user.id, remoteReady]);
  useEffect(() => {
    if (backendConfigured && (!session || !remoteReady)) return;
    localStorage.setItem(storageKey("approvals"), JSON.stringify(approvalRequests));
  }, [approvalRequests, session?.user.id, remoteReady]);

  const filteredModules = modules.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));
  const filteredProperties = useMemo(() => properties.filter(p =>
    `${p.title} ${p.module} ${p.location} ${p.contact} ${p.status} ${p.surveyNumber} ${Object.values(p.moduleData ?? {}).join(" ")}`.toLowerCase().includes(search.toLowerCase())
  ), [properties, search]);
  const upcomingTasks = tasks.filter(t => !t.done).sort((a,b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const today = new Date().toISOString().slice(0,10);
  const inflowTypes = ["Sale", "Advance", "Loan Disbursal", "Receipt"];
  const outflowTypes = ["Purchase", "Loan Repayment", "Interest", "Instalment", "Brokerage", "Expense", "Settlement"];
  const totalInflow = financials.filter(item => inflowTypes.includes(item.type)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalOutflow = financials.filter(item => outflowTypes.includes(item.type)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const portfolioValue = properties.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const activeRecordCount = properties.filter(item => !["Completed", "Closed"].includes(item.status)).length;
  const openLitigationCount = properties.filter(item => item.module === "Litigation" && !["Completed", "Closed"].includes(item.status)).length;
  const startupCount = properties.filter(item => item.module === "Startup" && !["Completed", "Closed"].includes(item.status)).length;
  const equityCount = properties.filter(item => item.module === "Equity").length;
  const pendingApprovalCount = approvalRequests.filter(item => item.status === "pending").length;
  const highRiskCount = riskRecords.filter(item => ["High", "Critical"].includes(item.severity) && item.status !== "Closed").length;
  const overdueTaskCount = upcomingTasks.filter(item => item.date < today).length;
  const inThirtyDays = new Date();
  inThirtyDays.setDate(inThirtyDays.getDate() + 30);
  const expiryWindowDate = inThirtyDays.toISOString().slice(0, 10);
  const expiringDocumentCount = documents.filter(item => item.expiresOn && item.expiresOn >= today && item.expiresOn <= expiryWindowDate).length;

  const remoteUpsert = (table: "property_records" | "contacts" | "tasks" | "financial_transactions" | "risk_register" | "approval_requests", payload: Record<string, unknown>) => {
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
  const remoteDelete = (table: "property_records" | "contacts" | "tasks" | "financial_transactions" | "risk_register" | "approval_requests", id: string) => {
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
    setRiskRecords(load(`estateflow.${scope}.risks`, []));
    setApprovalRequests(load(`estateflow.${scope}.approvals`, []));
    (async () => {
      const [propertyResult, contactResult, taskResult, documentResult, financialResult, riskResult, approvalResult] = await Promise.all([
        supabase.from("property_records").select("id,title,module,location,value,status,contact,notes,survey_number,ownership_details,area_value,area_unit,dimensions,rate_per_unit,module_data,created_at").order("created_at", { ascending: false }),
        supabase.from("contacts").select("id,name,phone,role,notes").order("created_at", { ascending: false }),
        supabase.from("tasks").select("id,title,due_date,due_time,task_type,property_label,notes,is_done").order("due_date", { ascending: true }).order("due_time", { ascending: true }),
        supabase.from("documents").select("id,property_id,property_label,name,category,storage_path,mime_type,size_bytes,expires_on,notes,created_at").order("created_at", { ascending: false }),
        supabase.from("financial_transactions").select("id,property_id,property_label,transaction_type,amount,transaction_date,party,reference_number,notes").order("transaction_date", { ascending: false }),
        supabase.from("risk_register").select("id,title,category,severity,status,owner,due_date,entity_label,mitigation,created_at").order("created_at", { ascending: false }),
        supabase.from("approval_requests").select("id,title,approval_type,entity_label,requested_by,approver,priority,status,rationale,decision_notes,requested_at,decided_at").order("requested_at", { ascending: false })
      ]);
      const queryError = propertyResult.error ?? contactResult.error ?? taskResult.error ?? documentResult.error ?? financialResult.error ?? riskResult.error ?? approvalResult.error;
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
        moduleData: row.module_data && typeof row.module_data === "object" ? Object.fromEntries(Object.entries(row.module_data).map(([key, value]) => [key, String(value ?? "")])) : {},
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
      setRiskRecords((riskResult.data ?? []).map(row => ({
        id: row.id, title: row.title, category: row.category ?? "Operational",
        severity: row.severity ?? "Medium", status: row.status ?? "Open",
        owner: row.owner ?? "", dueDate: row.due_date ?? "", entity: row.entity_label ?? "",
        mitigation: row.mitigation ?? "", createdAt: row.created_at ?? new Date().toISOString()
      })));
      setApprovalRequests((approvalResult.data ?? []).map(row => ({
        id: row.id, title: row.title, area: row.approval_type ?? "General",
        entity: row.entity_label ?? "", requestedBy: row.requested_by ?? "",
        approver: row.approver ?? "", priority: row.priority ?? "Normal",
        status: row.status ?? "pending", rationale: row.rationale ?? "",
        decisionNotes: row.decision_notes ?? "", requestedAt: row.requested_at ?? new Date().toISOString(),
        decidedAt: row.decided_at ?? ""
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
      rate_per_unit: record.ratePerUnit.trim() ? Number(record.ratePerUnit) : null,
      module_data: record.moduleData ?? {}
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
remove old WhatsApp handlers  const deleteFinancial = (id: string) => {
    setFinancials(prev => prev.filter(item => item.id !== id));
    remoteDelete("financial_transactions", id);
  };

  const saveRisk = (data: Omit<RiskRecord, "id" | "createdAt">) => {
    const record: RiskRecord = { ...data, id: uid(), createdAt: new Date().toISOString() };
    setRiskRecords(prev => [record, ...prev]);
    remoteUpsert("risk_register", {
      id: record.id, title: record.title, category: record.category, severity: record.severity,
      status: record.status, owner: record.owner, due_date: record.dueDate || null,
      entity_label: record.entity, mitigation: record.mitigation, created_at: record.createdAt
    });
    setShowRiskForm(false);
    setNotice(backendConfigured && session ? "Risk added to the shared register." : "Risk saved on this device.");
  };
  const closeRisk = (record: RiskRecord) => {
    const updated = { ...record, status: record.status === "Closed" ? "Open" : "Closed" };
    setRiskRecords(prev => prev.map(item => item.id === record.id ? updated : item));
    remoteUpsert("risk_register", {
      id: updated.id, title: updated.title, category: updated.category, severity: updated.severity,
      status: updated.status, owner: updated.owner, due_date: updated.dueDate || null,
      entity_label: updated.entity, mitigation: updated.mitigation, created_at: updated.createdAt
    });
  };
  const deleteRisk = (id: string) => {
    setRiskRecords(prev => prev.filter(item => item.id !== id));
    remoteDelete("risk_register", id);
  };
  const saveApproval = (data: Omit<ApprovalRequest, "id" | "requestedAt" | "decidedAt" | "decisionNotes" | "status">) => {
    const record: ApprovalRequest = { ...data, id: uid(), requestedAt: new Date().toISOString(), decidedAt: "", decisionNotes: "", status: "pending" };
    setApprovalRequests(prev => [record, ...prev]);
    remoteUpsert("approval_requests", {
      id: record.id, title: record.title, approval_type: record.area, entity_label: record.entity,
      requested_by: record.requestedBy, approver: record.approver, priority: record.priority,
      status: record.status, rationale: record.rationale, decision_notes: "", requested_at: record.requestedAt, decided_at: null
    });
    setShowApprovalForm(false);
    setNotice(backendConfigured && session ? "Approval request submitted to the shared queue." : "Approval request saved on this device.");
  };
  const decideApproval = (record: ApprovalRequest, status: "approved" | "rejected") => {
    const updated: ApprovalRequest = { ...record, status, decisionNotes: status === "approved" ? "Approved in EstateFlow." : "Rejected in EstateFlow.", decidedAt: new Date().toISOString() };
    setApprovalRequests(prev => prev.map(item => item.id === record.id ? updated : item));
    remoteUpsert("approval_requests", {
      id: updated.id, title: updated.title, approval_type: updated.area, entity_label: updated.entity,
      requested_by: updated.requestedBy, approver: updated.approver, priority: updated.priority,
      status: updated.status, rationale: updated.rationale, decision_notes: updated.decisionNotes,
      requested_at: updated.requestedAt, decided_at: updated.decidedAt
    });
  };
  const deleteApproval = (id: string) => {
    setApprovalRequests(prev => prev.filter(item => item.id !== id));
    remoteDelete("approval_requests", id);
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
            <button className="primary-button" onClick={() => active === "Contacts" ? openContactForm() : active === "Schedule & Tasks" ? openTaskForm() : active === "Financials" ? openFinancialForm() : active === "Risk & Compliance" ? setShowRiskForm(true) : active === "Approvals" ? setShowApprovalForm(true) : openPropertyForm()}><Plus size={17} /> {active === "Contacts" ? "New contact" : active === "Schedule & Tasks" ? "New task" : active === "Financials" ? "New transaction" : active === "Risk & Compliance" ? "Log risk" : active === "Approvals" ? "Request approval" : "New record"}</button></div>
          {notice && <div className="notice"><CheckCircle2 size={17}/>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={15}/></button></div>}
          {active === "Overview" && <>
            <section className="institutional-banner">
              <div className="institutional-copy">
                <span className="institutional-label"><span className="live-dot"/> PORTFOLIO CONTROL CENTRE</span>
                <h2>Property. Capital. Credit. Legal.</h2>
                <p>One governed workspace for transactions, investment opportunities, lending exposure and litigation deadlines.</p>
                <div className="banner-actions"><button className="hero-button" onClick={()=>go("All Properties")}>Open deal pipeline <ArrowUpRight size={16}/></button><button className="banner-ghost" onClick={()=>go("Risk & Compliance")}>Review risk signals <ShieldCheck size={15}/></button></div>
              </div>
              <div className="banner-aside">
                <span>TRACKED PORTFOLIO VALUE</span>
                <strong>₹{portfolioValue.toLocaleString("en-IN",{maximumFractionDigits:0})}</strong>
                <small>Based on values entered in EstateFlow</small>
                <div className="banner-divider"/>
                <div className="banner-aside-row"><span>Last refreshed</span><strong>{new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</strong></div>
                <div className="banner-aside-row"><span>Data mode</span><strong>{backendConfigured && session ? "Shared workspace" : "Local device"}</strong></div>
              </div>
            </section>
            <div className="stats-grid institutional-stats">
              <Stat label="Active records" value={activeRecordCount} icon={<LandPlot size={18}/>} />
              <Stat label="Startup pipeline" value={startupCount} icon={<Rocket size={18}/>} />
              <Stat label="Equity positions" value={equityCount} icon={<PieChart size={18}/>} />
              <Stat label="Open litigation" value={openLitigationCount} icon={<Scale size={18}/>} />
            </div>
            <div className="control-strip">
              <div className="control-strip-heading"><div><span className="section-kicker">CONTROL & OVERSIGHT</span><h2>Items requiring attention</h2></div><button className="text-button" onClick={()=>go("Risk & Compliance")}>Open risk console <ArrowUpRight size={15}/></button></div>
              <div className="control-metrics">
                <button className="control-metric" onClick={()=>go("Risk & Compliance")}><span className="control-metric-icon warning"><ShieldCheck size={17}/></span><span><strong>{highRiskCount}</strong><small>High / critical risks</small></span><ArrowUpRight size={15}/></button>
                <button className="control-metric" onClick={()=>go("Approvals")}><span className="control-metric-icon blue"><ClipboardCheck size={17}/></span><span><strong>{pendingApprovalCount}</strong><small>Pending approvals</small></span><ArrowUpRight size={15}/></button>
                <button className="control-metric" onClick={()=>go("Schedule & Tasks")}><span className="control-metric-icon amber"><CalendarClock size={17}/></span><span><strong>{overdueTaskCount}</strong><small>Overdue tasks</small></span><ArrowUpRight size={15}/></button>
                <button className="control-metric" onClick={()=>go("Documents")}><span className="control-metric-icon violet"><FileText size={17}/></span><span><strong>{expiringDocumentCount}</strong><small>Documents expiring in 30 days</small></span><ArrowUpRight size={15}/></button>
              </div>
            </div>
            <div className="section-heading module-section-heading"><div><span className="section-kicker">WORKSPACES</span><h2>Business modules</h2><p>Sixteen connected modules across assets, capital, lending, funds, investor services, transactions and legal matters.</p></div><button className="text-button" onClick={()=>go("All Properties")}>View all records <ArrowUpRight size={15}/></button></div>
            <div className="module-grid">{filteredModules.map(({name,icon:Icon,color,group,description},index)=>{
              const count=properties.filter(item=>item.module===name).length;
              return <button className="module-card enterprise-module-card" key={name} onClick={()=>go(name)}>
                <div className={`module-icon ${color}`}><Icon size={20} strokeWidth={1.8}/></div>
                <div className="module-number">{String(index+1).padStart(2,"0")}</div>
                <span className="module-group">{group}</span>
                <h3>{name}</h3><p>{description}</p>
                <span className="module-footer"><span>{count} record{count===1?"":"s"}</span><span className="module-link">Open <ArrowUpRight size={14}/></span></span>
              </button>;
            })}</div>
            <div className="bottom-grid enterprise-bottom-grid">
              <section className="panel-card"><div className="panel-heading"><div><span className="section-kicker">NEXT ACTIONS</span><h2>Upcoming schedule</h2><p>Deadlines and follow-ups requiring attention.</p></div><CalendarClock size={20}/></div>{upcomingTasks.length ? <TaskList tasks={upcomingTasks.slice(0,4)} toggle={toggleTask} remove={deleteTask} edit={openTaskForm}/> : <Empty icon={<CalendarClock size={22}/>} title="No upcoming actions" text="Create a dated task for a payment, meeting, registration or follow-up." action="Create task" onClick={()=>openTaskForm()}/>}</section>
              <section className="panel-card"><div className="panel-heading"><div><span className="section-kicker">GOVERNANCE</span><h2>Approval queue</h2><p>Track requests requiring a documented decision.</p></div><ClipboardCheck size={20}/></div>{approvalRequests.filter(item=>item.status==="pending").length ? <div className="governance-list">{approvalRequests.filter(item=>item.status==="pending").slice(0,4).map(item=><div className="governance-row" key={item.id}><span className={`priority-dot priority-${item.priority.toLowerCase()}`}/><div><strong>{item.title}</strong><small>{item.area}{item.entity ? ` · ${item.entity}` : ""}</small></div><button className="text-button" onClick={()=>go("Approvals")}>Review</button></div>)}</div> : <Empty icon={<ClipboardCheck size={22}/>} title="No pending approvals" text="Create a review request when a deal, loan, expense or legal action needs a second set of eyes." action="Request approval" onClick={()=>setShowApprovalForm(true)}/>}</section>
            </div>
          </>}
          
          {active === "All Properties" || modules.some(m=>m.name===active) ? <section className="data-panel"><div className="section-heading"><div><h2>{active === "All Properties" ? "All property records" : active}</h2><p>{filteredProperties.filter(p=>active==="All Properties"||p.module===active).length} saved records</p></div><button className="primary-button" onClick={()=>openPropertyForm()}><Plus size={16}/> Add property</button></div>
            {filteredProperties.filter(p=>active==="All Properties"||p.module===active).length ? <div className="record-list">{filteredProperties.filter(p=>active==="All Properties"||p.module===active).map(p=><article className="record-card" key={p.id}><div className="record-symbol"><Building2 size={20}/></div><div className="record-main"><h3>{p.title}</h3><p><MapPin size={14}/>{p.location || "Location not entered"} <span>•</span> {p.module}</p>{p.contact&&<small>Contact: {p.contact}</small>}{(p.surveyNumber || p.areaValue) && <small>{p.surveyNumber ? `Survey no. ${p.surveyNumber}` : ""}{p.surveyNumber && p.areaValue ? " · " : ""}{p.areaValue ? `Area: ${p.areaValue} ${p.areaUnit || "sq ft"}` : ""}</small>}{p.ownershipDetails&&<small>Ownership: {p.ownershipDetails}</small>}{p.dimensions&&<small>Dimensions: {p.dimensions}</small>}{Object.entries(p.moduleData ?? {}).filter(([,value])=>String(value).trim()).slice(0,4).map(([key,value])=><small key={key}><strong>{moduleFields[p.module]?.find(field=>field.key===key)?.label ?? key}:</strong> {value}</small>)}{p.notes&&<small>{p.notes}</small>}</div><div className="record-side"><strong>{p.value ? `₹ ${p.value}` : "Value not set"}</strong><span className="status-pill">{p.status}</span><button className="edit-button" onClick={()=>openPropertyForm(p)} aria-label={`Edit ${p.title}`}><Pencil size={15}/></button><button className="delete-button" onClick={()=>deleteProperty(p.id)} aria-label={`Delete ${p.title}`}><Trash2 size={15}/></button></div></article>)}</div>:<Empty icon={<LandPlot size={22}/>} title="No property records yet" text="Add your first record. It will be stored in this browser on this device." action="Add property" onClick={()=>openPropertyForm()}/>}</section> : null}
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
          {active === "WhatsApp Automation" && <WhatsAppScheduler session={session} onNotice={setNotice} />}
          {active === "Risk & Compliance" && <section className="data-panel">
            <div className="section-heading"><div><span className="section-kicker">CONTROL FRAMEWORK</span><h2>Risk & compliance register</h2><p>Track risks, owners, mitigation and time-bound actions.</p></div><button className="primary-button" onClick={()=>setShowRiskForm(true)}><Plus size={16}/> Log risk</button></div>
            <div className="risk-overview-grid"><div className="risk-overview-card"><span>High / critical open risks</span><strong>{highRiskCount}</strong></div><div className="risk-overview-card"><span>Open litigation matters</span><strong>{openLitigationCount}</strong></div><div className="risk-overview-card"><span>Overdue tasks</span><strong>{overdueTaskCount}</strong></div><div className="risk-overview-card"><span>Documents expiring in 30 days</span><strong>{expiringDocumentCount}</strong></div></div>
            <div className="governance-callout"><ShieldCheck size={19}/><div><strong>Evidence-first governance</strong><p>Capture risk, owner, mitigation and due date against a source record. This working register is not a substitute for legal, credit, compliance or regulated-investment review.</p></div></div>
            {riskRecords.length ? <div className="record-list">{riskRecords.map(record=><article className="record-card" key={record.id}><div className={`risk-severity-mark severity-${record.severity.toLowerCase()}`}/><div className="record-main"><h3>{record.title}</h3><p>{record.category} <span>•</span> {record.entity || "No linked entity"}</p><small>Owner: {record.owner || "Unassigned"}{record.dueDate ? ` · Due ${record.dueDate}` : ""}</small>{record.mitigation&&<small>Mitigation: {record.mitigation}</small>}</div><div className="record-side"><span className={`status-pill risk-${record.severity.toLowerCase()}`}>{record.severity}</span><span className="status-pill">{record.status}</span><button className="edit-button" onClick={()=>closeRisk(record)} aria-label={record.status==="Closed"?"Reopen risk":"Close risk"}>{record.status==="Closed" ? <ArrowUpRight size={15}/> : <CheckCircle2 size={15}/>}</button><button className="delete-button" onClick={()=>deleteRisk(record.id)} aria-label="Delete risk"><Trash2 size={15}/></button></div></article>)}</div> : <Empty icon={<ShieldCheck size={22}/>} title="No manual risks recorded" text="Register credit, legal, operational, market or compliance risks with an owner and mitigation plan." action="Log first risk" onClick={()=>setShowRiskForm(true)}/>}
            <div className="section-heading"><div><h2>Automated attention signals</h2><p>Calculated from your current EstateFlow records.</p></div></div>
            <div className="signal-list">
              {openLitigationCount>0&&<div className="signal-row signal-high"><Scale size={18}/><div><strong>{openLitigationCount} open litigation matter{openLitigationCount===1?"":"s"}</strong><small>Review next hearing, limitation and exposure fields.</small></div><button className="text-button" onClick={()=>go("Litigation")}>Review</button></div>}
              {overdueTaskCount>0&&<div className="signal-row signal-medium"><CalendarClock size={18}/><div><strong>{overdueTaskCount} overdue task{overdueTaskCount===1?"":"s"}</strong><small>Past-due actions remain incomplete.</small></div><button className="text-button" onClick={()=>go("Schedule & Tasks")}>Review</button></div>}
              {expiringDocumentCount>0&&<div className="signal-row signal-medium"><FileText size={18}/><div><strong>{expiringDocumentCount} document expiry date{expiringDocumentCount===1?"":"s"} within 30 days</strong><small>Review renewal and action owners.</small></div><button className="text-button" onClick={()=>go("Documents")}>Review</button></div>}
              {highRiskCount===0&&openLitigationCount===0&&overdueTaskCount===0&&expiringDocumentCount===0&&<div className="signal-row signal-clear"><CheckCircle2 size={18}/><div><strong>No current automated attention signals</strong><small>This means none of the tracked conditions was detected; it is not a certification that the portfolio is risk-free.</small></div></div>}
            </div>
          </section>}
          {active === "Approvals" && <section className="data-panel">
            <div className="section-heading"><div><span className="section-kicker">FOUR-EYES CONTROL</span><h2>Approvals & decision log</h2><p>Record requests and decisions before executing material actions.</p></div><button className="primary-button" onClick={()=>setShowApprovalForm(true)}><Plus size={16}/> Request approval</button></div>
            <div className="approval-summary-grid"><div><span>Pending</span><strong>{approvalRequests.filter(item=>item.status==="pending").length}</strong></div><div><span>Approved</span><strong>{approvalRequests.filter(item=>item.status==="approved").length}</strong></div><div><span>Rejected</span><strong>{approvalRequests.filter(item=>item.status==="rejected").length}</strong></div></div>
            <div className="governance-callout"><ClipboardCheck size={19}/><div><strong>Decision governance</strong><p>Use for investment decisions, loan disbursals, payments, settlements, legal filings and high-impact changes. This personal-workspace version tracks decisions; production multi-user segregation of duties requires organization roles and server-enforced reviewer separation.</p></div></div>
            {approvalRequests.length ? <div className="record-list">{[...approvalRequests].sort((a,b)=>b.requestedAt.localeCompare(a.requestedAt)).map(record=><article className="record-card" key={record.id}><div className="record-symbol approval-symbol"><ClipboardCheck size={20}/></div><div className="record-main"><h3>{record.title}</h3><p>{record.area}{record.entity ? <><span>•</span>{record.entity}</> : null}</p><small>Requested by {record.requestedBy || "Unspecified"}{record.approver ? ` · Reviewer: ${record.approver}` : ""} · {new Date(record.requestedAt).toLocaleDateString("en-IN")}</small><small>Priority: {record.priority}</small>{record.rationale&&<small>Rationale: {record.rationale}</small>}{record.decisionNotes&&<small>Decision: {record.decisionNotes}</small>}</div><div className="record-side"><span className={`status-pill approval-${record.status}`}>{record.status}</span>{record.status==="pending"&&<><button className="decision-button approve" onClick={()=>decideApproval(record,"approved")}>Approve</button><button className="decision-button reject" onClick={()=>decideApproval(record,"rejected")}>Reject</button></>}<button className="delete-button" onClick={()=>deleteApproval(record.id)} aria-label="Delete approval request"><Trash2 size={15}/></button></div></article>)}</div> : <Empty icon={<ClipboardCheck size={22}/>} title="No approval requests yet" text="Create a request to document review for a capital, credit, property, settlement or legal action." action="Request approval" onClick={()=>setShowApprovalForm(true)}/>}
          </section>}
          {active === "Settings" && <section className="data-panel"><div className="section-heading"><div><h2>Settings</h2><p>Workspace data and local backup</p></div></div><div className="settings-card"><h3>Local data backup</h3><p>Records are currently stored in this browser's local storage. They are not synced across devices and may be lost if browser data is cleared.</p><button className="secondary-button" onClick={()=>{const blob=new Blob([JSON.stringify({properties,contacts,tasks,financials,riskRecords,approvalRequests,exportedAt:new Date().toISOString()},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`estateflow-backup-${today}.json`;a.click();URL.revokeObjectURL(url);}}>Export backup JSON</button><button className="secondary-button" onClick={()=>{const input=document.createElement("input");input.type="file";input.accept=".json,application/json";input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!Array.isArray(data.properties)||!Array.isArray(data.contacts)||!Array.isArray(data.tasks))throw new Error("Invalid backup");setProperties(data.properties);setContacts(data.contacts);setTasks(data.tasks);if(Array.isArray(data.financials))setFinancials(data.financials);if(Array.isArray(data.riskRecords))setRiskRecords(data.riskRecords);if(Array.isArray(data.approvalRequests))setApprovalRequests(data.approvalRequests);setNotice("Backup imported.");}catch{setNotice("Could not import this file. Please select a valid EstateFlow backup.");}};input.click();}}>Import backup JSON</button>{backendConfigured && session && <button className="secondary-button" onClick={async () => { await supabase?.auth.signOut(); }}>Sign out of shared workspace</button>}</div></section>}
          <footer className="footer"><span>EstateFlow © 2026</span><span>{backendConfigured && session ? "Shared database connected" : "Local-only mode · Device data is not synced"}</span></footer>
        </div>
      </section>
      {showPropertyForm && <Modal title={editingProperty ? "Edit property record" : "Add property record"} onClose={()=>closePropertyForm()}><PropertyForm defaultModule={modules.some(m=>m.name===active)?active:modules[0].name} initial={editingProperty} onSave={saveProperty} onCancel={()=>closePropertyForm()}/></Modal>}
      {showContactForm && <Modal title={editingContact ? "Edit contact" : "Add contact"} onClose={()=>closeContactForm()}><ContactForm initial={editingContact} onSave={saveContact} onCancel={()=>closeContactForm()}/></Modal>}
      {showTaskForm && <Modal title={editingTask ? "Edit scheduled task" : "Schedule a one-time task"} onClose={()=>closeTaskForm()}><TaskForm properties={properties} initial={editingTask} onSave={saveTask} onCancel={()=>closeTaskForm()}/></Modal>}
      {showFinancialForm && <Modal title={editingFinancial ? "Edit financial transaction" : "Add financial transaction"} onClose={()=>closeFinancialForm()}><FinancialForm properties={properties} initial={editingFinancial} onSave={saveFinancial} onCancel={()=>closeFinancialForm()}/></Modal>}
      {showRiskForm && <Modal title="Log a risk" onClose={()=>setShowRiskForm(false)}><RiskForm properties={properties} onSave={saveRisk} onCancel={()=>setShowRiskForm(false)}/></Modal>}
      {showApprovalForm && <Modal title="Request approval" onClose={()=>setShowApprovalForm(false)}><ApprovalForm properties={properties} onSave={saveApproval} onCancel={()=>setShowApprovalForm(false)}/></Modal>}
    </main>
  );
}

function Stat({label,value,icon}:{label:string;value:number|string;icon:ReactNode}) { return <div className="stat-card"><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></div>; }
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
    areaUnit:initial?.areaUnit ?? "sq ft",dimensions:initial?.dimensions ?? "",ratePerUnit:initial?.ratePerUnit ?? "",
    moduleData:initial?.moduleData ?? {}
  });
  const update=(key:string,value:string)=>setForm(previous=>({...previous,[key]:value}));
  const selectedFields=moduleFields[form.module] ?? [];
  return <form className="form-card" onSubmit={event=>{event.preventDefault();if(form.title.trim())onSave(form);}}>
    <div className="form-section-title"><span className="section-kicker">RECORD IDENTITY</span><p>Use a clear title and status so the record can be found in reports and approvals.</p></div>
    <label>Record / deal name *<input required value={form.title} onChange={event=>update("title",event.target.value)} placeholder="e.g. Series A investment / Apartment purchase"/></label>
    <label>Business module<select value={form.module} onChange={event=>update("module",event.target.value)}>{modules.map(module=><option key={module.name}>{module.name}</option>)}</select></label>
    <div className="form-two"><label>Location / jurisdiction<input value={form.location} onChange={event=>update("location",event.target.value)} placeholder="City, state, country or court"/></label><label>Headline value / exposure (₹)<input type="number" min="0" step="0.01" value={form.value} onChange={event=>update("value",event.target.value)} placeholder="Enter amount"/></label></div>
    <div className="form-two"><label>Record status<select value={form.status} onChange={event=>update("status",event.target.value)}>{["Active","Under review","Negotiation","On hold","Completed","Closed","Filed","Awaiting documents","Due diligence","Term sheet","Disbursed","Repayment","Default","Hearing scheduled","Settled"].map(status=><option key={status}>{status}</option>)}</select></label><label>Primary contact<input value={form.contact} onChange={event=>update("contact",event.target.value)} placeholder="Counterparty / founder / borrower / counsel"/></label></div>
    {["Property Sale","Property Loans","JV / JDA / JD","SR Rate Settlement","Agricultural Land","Commercial Land","House Purchase","Housing Loan","Litigation"].includes(form.module) && <div className="property-detail-section"><div className="form-section-title"><span className="section-kicker">ASSET & LEGAL DETAILS</span></div>
      <div className="form-two"><label>Survey number / property ID<input value={form.surveyNumber} onChange={event=>update("surveyNumber",event.target.value)} placeholder="Survey / PID / khata no."/></label><label>Ownership / parties<input value={form.ownershipDetails} onChange={event=>update("ownershipDetails",event.target.value)} placeholder="Owner / co-owners / parties"/></label></div>
      <div className="form-two"><label>Land / built-up area<input type="number" min="0" step="0.0001" value={form.areaValue} onChange={event=>update("areaValue",event.target.value)} placeholder="Area"/></label><label>Area unit<select value={form.areaUnit} onChange={event=>update("areaUnit",event.target.value)}>{["sq ft","sq yd","sq m","acre","gunta","hectare","cent"].map(unit=><option key={unit}>{unit}</option>)}</select></label></div>
      <div className="form-two"><label>Dimensions / boundary notes<input value={form.dimensions} onChange={event=>update("dimensions",event.target.value)} placeholder="e.g. 30 × 40 ft; east road"/></label><label>Rate per unit (₹)<input type="number" min="0" step="0.01" value={form.ratePerUnit} onChange={event=>update("ratePerUnit",event.target.value)} placeholder="Optional"/></label></div>
    </div>}
    {selectedFields.length>0 && <div className="module-data-section"><div className="form-section-title"><span className="section-kicker">{form.module.toUpperCase()} WORKSHEET</span><p>Structured fields for this workflow. Fields are saved with the record.</p></div><div className="module-data-grid">{selectedFields.map(field=><label key={field.key}>{field.label}<input type={field.type ?? "text"} min={field.type==="number" ? "0" : undefined} step={field.type==="number" ? "any" : undefined} value={form.moduleData[field.key] ?? ""} onChange={event=>setForm(previous=>({...previous,moduleData:{...previous.moduleData,[field.key]:event.target.value}}))} placeholder={field.placeholder}/></label>)}</div></div>}
    <label>Notes / investment thesis / legal context<textarea rows={3} value={form.notes} onChange={event=>update("notes",event.target.value)} placeholder="Key risks, rationale, next steps, terms or notes"/></label>
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="submit" className="primary-button">{initial ? "Save changes" : "Save record"}</button></div>
  </form>;
}

function ContactForm({initial,onSave,onCancel}:{initial?:ContactRecord|null;onSave:(v:Omit<ContactRecord,"id">)=>void;onCancel:()=>void}) {
  const [form,setForm]=useState({name:initial?.name ?? "",phone:initial?.phone ?? "",role:initial?.role ?? "Buyer",notes:initial?.notes ?? ""});
  const update=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));
  return <form className="form-card" onSubmit={e=>{e.preventDefault();if(form.name.trim())onSave(form);}}>
    <label>Full name *<input required value={form.name} onChange={e=>update("name",e.target.value)} placeholder="Contact name"/></label>
    <div className="form-two"><label>Phone<input value={form.phone} onChange={e=>update("phone",e.target.value)} placeholder="+91..."/></label><label>Role<select value={form.role} onChange={e=>update("role",e.target.value)}>{["Buyer","Seller","Broker","Lawyer","Lender","Tenant","Developer","Investor / LP","Venture capital / fund","Family office","Asset manager","Fund administrator","Auditor","KYC / compliance provider","Regulator / government office","Portfolio company","Other"].map(s=><option key={s}>{s}</option>)}</select></label></div>
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

function RiskForm({properties,onSave,onCancel}:{properties:PropertyRecord[];onSave:(value:Omit<RiskRecord,"id"|"createdAt">)=>void;onCancel:()=>void}) {
  const [form,setForm]=useState({title:"",category:"Legal",severity:"High",status:"Open",owner:"",dueDate:"",entity:"",mitigation:""});
  const update=(key:string,value:string)=>setForm(previous=>({...previous,[key]:value}));
  return <form className="form-card" onSubmit={event=>{event.preventDefault();if(form.title.trim())onSave(form);}}>
    <label>Risk title *<input required value={form.title} onChange={event=>update("title",event.target.value)} placeholder="Describe the risk or control gap"/></label>
    <div className="form-two"><label>Risk category<select value={form.category} onChange={event=>update("category",event.target.value)}>{["Credit","Financial","Legal","Operational","Market","Compliance","Fraud","Cybersecurity","Data","Reputational","Other"].map(value=><option key={value}>{value}</option>)}</select></label><label>Severity<select value={form.severity} onChange={event=>update("severity",event.target.value)}>{["Low","Medium","High","Critical"].map(value=><option key={value}>{value}</option>)}</select></label></div>
    <div className="form-two"><label>Status<select value={form.status} onChange={event=>update("status",event.target.value)}>{["Open","Mitigating","Monitoring","Closed"].map(value=><option key={value}>{value}</option>)}</select></label><label>Owner<input value={form.owner} onChange={event=>update("owner",event.target.value)} placeholder="Responsible person / team"/></label></div>
    <div className="form-two"><label>Linked deal / matter<select value={form.entity} onChange={event=>update("entity",event.target.value)}><option value="">Not linked</option>{properties.map(property=><option key={property.id}>{property.title}</option>)}</select></label><label>Action due date<input type="date" value={form.dueDate} onChange={event=>update("dueDate",event.target.value)}/></label></div>
    <label>Mitigation / next control action<textarea rows={3} value={form.mitigation} onChange={event=>update("mitigation",event.target.value)} placeholder="Control owner, evidence, action and target"/></label>
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="submit" className="primary-button">Save risk</button></div>
  </form>;
}
function ApprovalForm({properties,onSave,onCancel}:{properties:PropertyRecord[];onSave:(value:Omit<ApprovalRequest,"id"|"requestedAt"|"decidedAt"|"decisionNotes"|"status">)=>void;onCancel:()=>void}) {
  const [form,setForm]=useState({title:"",area:"Investment",entity:"",requestedBy:"",approver:"",priority:"Normal",rationale:""});
  const update=(key:string,value:string)=>setForm(previous=>({...previous,[key]:value}));
  return <form className="form-card" onSubmit={event=>{event.preventDefault();if(form.title.trim())onSave(form);}}>
    <label>Decision / approval requested *<input required value={form.title} onChange={event=>update("title",event.target.value)} placeholder="e.g. Approve loan disbursal / settlement"/></label>
    <div className="form-two"><label>Approval area<select value={form.area} onChange={event=>update("area",event.target.value)}>{["Investment","Equity","Credit","Property purchase","Property sale","Payment","Settlement","Legal filing","Expense","Document release","Other"].map(value=><option key={value}>{value}</option>)}</select></label><label>Priority<select value={form.priority} onChange={event=>update("priority",event.target.value)}>{["Low","Normal","High","Urgent"].map(value=><option key={value}>{value}</option>)}</select></label></div>
    <label>Linked record<select value={form.entity} onChange={event=>update("entity",event.target.value)}><option value="">Not linked</option>{properties.map(property=><option key={property.id}>{property.title}</option>)}</select></label>
    <div className="form-two"><label>Requested by<input value={form.requestedBy} onChange={event=>update("requestedBy",event.target.value)} placeholder="Requestor name"/></label><label>Approver / reviewer<input value={form.approver} onChange={event=>update("approver",event.target.value)} placeholder="Reviewer name"/></label></div>
    <label>Rationale and supporting evidence<textarea rows={3} value={form.rationale} onChange={event=>update("rationale",event.target.value)} placeholder="Why approval is required; evidence to review"/></label>
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="submit" className="primary-button">Submit request</button></div>
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
