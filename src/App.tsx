import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { localDb } from "./lib/local-db";
import WhatsAppScheduler from "./WhatsAppScheduler";
import PortfolioAnalytics from "./PortfolioAnalytics";
import ModuleWorkbench from "./ModuleWorkbench";
import {
  Building2, LayoutDashboard, LandPlot, HandCoins, Handshake, Calculator,
  Wheat, Store, CalendarClock, MessageCircle, Users, FileText, Settings,
  Search, Bell, Plus, ArrowUpRight, Clock3, CheckCircle2, Menu, X, ChevronDown,
  Trash2, Phone, CalendarDays, CircleCheck, Pencil, Download,
  Rocket, PieChart, BriefcaseBusiness, UserRound, House, Scale, ShieldCheck, ClipboardCheck
} from "lucide-react";

type PropertyRecord = {
  id: string; title: string; module: string; location: string; value: string;
  status: string; contact: string; primaryContactId?: string; targetDeadline?: string; nextFollowUpDate?: string; nextAction?: string; notes: string; createdAt: string;
  surveyNumber: string; ownershipDetails: string; areaValue: string; areaUnit: string; dimensions: string; ratePerUnit: string;
  moduleData: Record<string, string>;
};
type ContactRecord = { id: string; name: string; phone: string; role: string; roles?: string[]; customRoles?: string; email?: string; address?: string; profession?: string; employer?: string; designation?: string; businessType?: string; incomeSources?: string; associatedCompany?: string; relationshipNotes?: string; notes: string; whatsappName?: string; whatsappJid?: string };
type SavedWhatsAppGroup = { id: string; jid: string; name: string; subject?: string; description?: string; size?: number; lastSyncedAt?: string };
type SyncedWhatsAppContact = { id: string; jid: string; phone: string; name: string; whatsappName?: string; notify?: string; verifiedName?: string };
type TaskRecord = { id: string; title: string; date: string; time: string; type: string; property: string; propertyId?: string; contactId?: string; contactName?: string; notes: string; done: boolean };
type DocumentRecord = { id: string; propertyId: string; property: string; contactId?: string; name: string; category: string; storagePath: string; mimeType: string; sizeBytes: number; expiresOn: string; notes: string; createdAt: string };

type FinancialRecord = { id: string; propertyId: string; property: string; contactId?: string; type: string; amount: string; date: string; party: string; reference: string; notes: string };
type RiskRecord = { id: string; title: string; category: string; severity: string; status: string; owner: string; dueDate: string; entity: string; propertyId?: string; contactId?: string; mitigation: string; createdAt: string };
type ApprovalRequest = { id: string; title: string; area: string; entity: string; propertyId?: string; contactId?: string; requestedBy: string; approver: string; priority: string; status: string; rationale: string; decisionNotes: string; requestedAt: string; decidedAt: string };
type AuditEvent = { id: string; at: string; action: "created" | "updated" | "deleted"; entity: string; recordId: string; label: string };
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
  { name: "Client & Deal Hub", icon: Handshake },
  { name: "Financials", icon: Calculator },
  { name: "Documents", icon: FileText },
  { name: "Schedule & Tasks", icon: CalendarClock },
  { name: "Risk & Compliance", icon: ShieldCheck },
  { name: "Approvals", icon: ClipboardCheck },
  { name: "WhatsApp Automation", icon: MessageCircle }
];

type ModuleField = { key: string; label: string; placeholder: string; type?: "text" | "number" | "date" };
const moduleFields: Record<string, ModuleField[]> = {
  "Property Sale": [
    { key: "seller", label: "Seller / owner", placeholder: "Seller contact or legal entity" },
    { key: "buyer", label: "Buyer", placeholder: "Buyer contact or legal entity" },
    { key: "askingPrice", label: "Asking price (₹)", placeholder: "Amount", type: "number" },
    { key: "agreedPrice", label: "Agreed price (₹)", placeholder: "Amount", type: "number" },
    { key: "offerDate", label: "Offer date", placeholder: "Date", type: "date" },
    { key: "targetClosingDate", label: "Target closing / registration date", placeholder: "Date", type: "date" },
    { key: "closingStage", label: "Closing stage", placeholder: "Offer / diligence / agreement / registration" }
  ],
  "Property Loans": [
    { key: "borrower", label: "Borrower / applicant", placeholder: "Client or company" },
    { key: "lender", label: "Lender / loan provider", placeholder: "Bank, NBFC or private lender" },
    { key: "loanType", label: "Loan type", placeholder: "Mortgage / LAP / business / construction" },
    { key: "loanAmount", label: "Loan amount requested (₹)", placeholder: "Amount", type: "number" },
    { key: "sanctionedAmount", label: "Sanctioned amount (₹)", placeholder: "Amount", type: "number" },
    { key: "outstandingAmount", label: "Outstanding amount (₹)", placeholder: "Amount", type: "number" },
    { key: "interestRate", label: "Annual interest rate (%)", placeholder: "Rate", type: "number" },
    { key: "loanStage", label: "Loan processing stage", placeholder: "Lead / documents / valuation / legal / sanction / disbursal" },
    { key: "applicationDate", label: "Application date", placeholder: "Date", type: "date" },
    { key: "targetSanctionDate", label: "Target sanction date", placeholder: "Date", type: "date" },
    { key: "targetDisbursementDate", label: "Target disbursement / completion date", placeholder: "Date", type: "date" },
    { key: "loanOfficer", label: "Loan officer / person to call", placeholder: "Name / contact" },
    { key: "pendingDocuments", label: "Pending documents / blockers", placeholder: "KYC, bank statements, title, valuation…" }
  ],
  "JV / JDA / JD": [
    { key: "landowner", label: "Landowner / owner group", placeholder: "Names or entity" },
    { key: "developer", label: "Developer / partner", placeholder: "Company or contact" },
    { key: "sharingRatio", label: "Sharing ratio / allocation", placeholder: "e.g. 60:40" },
    { key: "projectValue", label: "Estimated project value (₹)", placeholder: "Amount", type: "number" },
    { key: "agreementStage", label: "Agreement stage", placeholder: "Term sheet / diligence / draft / signed" },
    { key: "targetSigningDate", label: "Target agreement signing", placeholder: "Date", type: "date" },
    { key: "targetHandoverDate", label: "Target handover / possession", placeholder: "Date", type: "date" },
    { key: "keyObligations", label: "Key obligations / blockers", placeholder: "Approvals, allocation, construction milestones" }
  ],
  "SR Rate Settlement": [
    { key: "settlementParties", label: "Settlement parties", placeholder: "Names / entities" },
    { key: "settlementBasis", label: "Settlement basis", placeholder: "Rate per unit / area / fixed amount" },
    { key: "settlementRate", label: "Agreed rate per unit (₹)", placeholder: "Rate", type: "number" },
    { key: "settlementAmount", label: "Settlement amount (₹)", placeholder: "Amount", type: "number" },
    { key: "settlementStage", label: "Settlement stage", placeholder: "Proposal / negotiation / approved / paid" },
    { key: "targetSettlementDate", label: "Target settlement date", placeholder: "Date", type: "date" },
    { key: "supportingReference", label: "MOU / reference / supporting documents", placeholder: "Reference details" }
  ],
  "Agricultural Land": [
    { key: "landClassification", label: "Land classification", placeholder: "Agricultural / converted / restricted" },
    { key: "rtcStatus", label: "RTC / Pahani status", placeholder: "Available / pending / requires correction" },
    { key: "waterAndAccess", label: "Water, access and utilities", placeholder: "Borewell / road / power" },
    { key: "dueDiligenceStatus", label: "Due diligence status", placeholder: "Title / survey / mutation / conversion" },
    { key: "targetDueDiligenceDate", label: "Target due-diligence completion", placeholder: "Date", type: "date" },
    { key: "targetClosingDate", label: "Target acquisition / registration", placeholder: "Date", type: "date" }
  ],
  "Commercial Land": [
    { key: "zoning", label: "Zoning / permitted use", placeholder: "Commercial / industrial / mixed use" },
    { key: "currentUse", label: "Current use / tenant", placeholder: "Occupancy / lease" },
    { key: "titleStatus", label: "Title / encumbrance status", placeholder: "Clear / pending / issue identified" },
    { key: "dueDiligenceStage", label: "Due diligence stage", placeholder: "Title / zoning / access / approvals" },
    { key: "targetClosingDate", label: "Target closing / registration date", placeholder: "Date", type: "date" },
    { key: "commercialNotes", label: "Utilities / lease / access notes", placeholder: "Operational detail" }
  ],
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
    { key: "custodian", label: "Custodian / broker", placeholder: "Institution or account reference" },
    { key: "targetExitDate", label: "Target exit / review date", placeholder: "Date", type: "date" }
  ],
  "Unsecured Company Loan": [
    { key: "borrowerCompany", label: "Borrowing company", placeholder: "Legal company name" },
    { key: "lender", label: "Lender", placeholder: "Bank, NBFC or private lender" },
    { key: "facilityAmount", label: "Facility amount (₹)", placeholder: "Principal", type: "number" },
    { key: "interestRate", label: "Annual interest rate (%)", placeholder: "APR", type: "number" },
    { key: "tenureMonths", label: "Tenure (months)", placeholder: "Months", type: "number" },
    { key: "repaymentFrequency", label: "Repayment frequency", placeholder: "Monthly / quarterly / bullet" },
    { key: "guarantees", label: "Guarantees / covenants", placeholder: "Guarantees, DSCR, covenants…" },
    { key: "targetDisbursementDate", label: "Target disbursement date", placeholder: "Date", type: "date" },
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
    { key: "guarantor", label: "Guarantor / co-obligant", placeholder: "Optional" },
    { key: "targetSanctionDate", label: "Target sanction date", placeholder: "Date", type: "date" },
    { key: "targetDisbursementDate", label: "Target disbursement date", placeholder: "Date", type: "date" },
    { key: "firstEmiDate", label: "First EMI date", placeholder: "Date", type: "date" }
  ],
  "Housing Loan": [
    { key: "lender", label: "Lender", placeholder: "Bank / housing finance company" },
    { key: "originalPrincipal", label: "Original principal (₹)", placeholder: "Amount", type: "number" },
    { key: "outstandingPrincipal", label: "Outstanding principal (₹)", placeholder: "Amount", type: "number" },
    { key: "interestRate", label: "Annual interest rate (%)", placeholder: "APR", type: "number" },
    { key: "tenureMonths", label: "Original tenure (months)", placeholder: "Months", type: "number" },
    { key: "emi", label: "EMI (₹)", placeholder: "Monthly instalment", type: "number" },
    { key: "ltv", label: "Loan-to-value (%)", placeholder: "LTV ratio", type: "number" },
    { key: "rateType", label: "Interest rate type", placeholder: "Fixed / floating / hybrid" },
    { key: "applicationDate", label: "Application date", placeholder: "Date", type: "date" },
    { key: "targetSanctionDate", label: "Target sanction date", placeholder: "Date", type: "date" },
    { key: "targetDisbursementDate", label: "Target disbursement date", placeholder: "Date", type: "date" },
    { key: "firstEmiDate", label: "First EMI date", placeholder: "Date", type: "date" },
    { key: "maturityDate", label: "Maturity date", placeholder: "Date", type: "date" }
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
    { key: "reportingPeriod", label: "Reporting period", placeholder: "Quarter / fiscal year" },
    { key: "nextReportingDate", label: "Next reporting deadline", placeholder: "Date", type: "date" }
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
    { key: "lastReportDate", label: "Last investor report date", placeholder: "Date", type: "date" },
    { key: "nextContactDate", label: "Next investor follow-up date", placeholder: "Date", type: "date" }
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
type ModuleContactField = { key: string; label: string };
const moduleContactFields: Record<string, ModuleContactField[]> = {
  "Property Sale": [
    { key: "__contact_seller", label: "Seller / property owner" },
    { key: "__contact_buyer", label: "Buyer" },
    { key: "__contact_broker", label: "Broker / agent" },
    { key: "__contact_legalCounsel", label: "Lawyer / conveyance" }
  ],
  "Property Loans": [
    { key: "__contact_borrower", label: "Borrower / applicant" },
    { key: "__contact_lender", label: "Lender / person providing loan" },
    { key: "__contact_loanOfficer", label: "Bank / loan officer to call" },
    { key: "__contact_guarantor", label: "Guarantor / co-borrower" },
    { key: "__contact_collateralOwner", label: "Collateral property owner" },
    { key: "__contact_valuator", label: "Valuer / technical agent" }
  ],
  "JV / JDA / JD": [
    { key: "__contact_landowner", label: "Landowner / owner representative" },
    { key: "__contact_developer", label: "Developer / JV partner" },
    { key: "__contact_broker", label: "Broker / facilitator" },
    { key: "__contact_legalCounsel", label: "Lawyer / drafting counsel" }
  ],
  "SR Rate Settlement": [
    { key: "__contact_client", label: "Client / instructing party" },
    { key: "__contact_counterparty", label: "Settlement counterparty" },
    { key: "__contact_mediator", label: "Mediator / facilitator" },
    { key: "__contact_settlementOfficer", label: "Settlement / accounts officer" }
  ],
  "Agricultural Land": [
    { key: "__contact_owner", label: "Landowner" },
    { key: "__contact_buyer", label: "Buyer / investor" },
    { key: "__contact_broker", label: "Broker / local representative" },
    { key: "__contact_legalCounsel", label: "Lawyer / title diligence" }
  ],
  "Commercial Land": [
    { key: "__contact_owner", label: "Property owner" },
    { key: "__contact_buyerTenant", label: "Buyer / tenant / occupier" },
    { key: "__contact_broker", label: "Broker / leasing agent" },
    { key: "__contact_legalCounsel", label: "Lawyer / title diligence" }
  ],
  "Startup": [
    { key: "__contact_founder", label: "Founder / promoter" },
    { key: "__contact_investor", label: "Investor" },
    { key: "__contact_leadInvestor", label: "Lead investor / fund" },
    { key: "__contact_advisor", label: "Advisor / mentor" }
  ],
  "Equity": [
    { key: "__contact_issuer", label: "Issuer / company representative" },
    { key: "__contact_investor", label: "Investor / shareholder" },
    { key: "__contact_brokerCustodian", label: "Broker / custodian" },
    { key: "__contact_advisor", label: "Advisor" }
  ],
  "Unsecured Company Loan": [
    { key: "__contact_borrower", label: "Borrowing company representative" },
    { key: "__contact_lender", label: "Lender / loan provider" },
    { key: "__contact_loanOfficer", label: "Loan officer to call" },
    { key: "__contact_guarantor", label: "Guarantor / security provider" }
  ],
  "Personal Loan": [
    { key: "__contact_borrower", label: "Borrower" },
    { key: "__contact_lender", label: "Lender / loan provider" },
    { key: "__contact_loanOfficer", label: "Loan officer to call" },
    { key: "__contact_guarantor", label: "Guarantor / co-borrower" }
  ],
  "Housing Loan": [
    { key: "__contact_borrower", label: "Borrower / applicant" },
    { key: "__contact_lender", label: "Bank / housing lender contact" },
    { key: "__contact_loanOfficer", label: "Loan officer to call" },
    { key: "__contact_guarantor", label: "Co-borrower / guarantor" },
    { key: "__contact_collateralOwner", label: "Collateral property owner" }
  ],
  "House Purchase": [
    { key: "__contact_buyer", label: "Buyer / purchaser" },
    { key: "__contact_seller", label: "Seller" },
    { key: "__contact_broker", label: "Broker / agent" },
    { key: "__contact_legalCounsel", label: "Lawyer / conveyance" }
  ],
  "Litigation": [
    { key: "__contact_client", label: "Client / party represented" },
    { key: "__contact_advocate", label: "Advocate / counsel" },
    { key: "__contact_opposingParty", label: "Opposing party / counsel" },
    { key: "__contact_mediator", label: "Mediator / court-appointed contact" }
  ],
  "Fund & Portfolio Management": [
    { key: "__contact_fundManager", label: "Fund / portfolio manager" },
    { key: "__contact_administrator", label: "Fund administrator" },
    { key: "__contact_custodian", label: "Custodian / bank" },
    { key: "__contact_auditor", label: "Auditor / accountant" },
    { key: "__contact_investor", label: "Investor / LP contact" }
  ],
  "Investor Relations": [
    { key: "__contact_investor", label: "Investor / LP" },
    { key: "__contact_relationshipManager", label: "Relationship manager" },
    { key: "__contact_advisor", label: "Investor advisor" },
    { key: "__contact_compliance", label: "KYC / compliance contact" }
  ],
  "Compliance & KYC": [
    { key: "__contact_counterparty", label: "Customer / counterparty" },
    { key: "__contact_beneficialOwner", label: "Beneficial owner contact" },
    { key: "__contact_reviewer", label: "Compliance reviewer" },
    { key: "__contact_provider", label: "KYC / due-diligence provider" }
  ]
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

type SyncSnapshot = {
  properties: Array<{ id: string }>;
  contacts: Array<{ id: string }>;
  whatsappGroups: Array<{ id: string }>;
  tasks: Array<{ id: string }>;
  financials: Array<{ id: string }>;
  riskRecords: Array<{ id: string }>;
  approvalRequests: Array<{ id: string }>;
  auditEvents: Array<{ id: string }>;
};

function mergeById<T extends { id: string }>(localRows: T[], remoteRows: T[]): T[] {
  const merged = new Map<string, T>();
  for (const row of localRows) if (row && typeof row.id === "string" && row.id) merged.set(row.id, row);
  for (const row of remoteRows) if (row && typeof row.id === "string" && row.id && !merged.has(row.id)) merged.set(row.id, row);
  return Array.from(merged.values());
}


export default function App() {
  const [active, setActive] = useState<Section>("Overview");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [properties, setProperties] = useState<PropertyRecord[]>(() => load("estateflow.properties", []));
  const [contacts, setContacts] = useState<ContactRecord[]>(() => load("estateflow.contacts", []));
  const [savedWhatsAppGroups, setSavedWhatsAppGroups] = useState<SavedWhatsAppGroup[]>(() => load("estateflow.whatsappGroups", []));
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
  const [taskPrefill, setTaskPrefill] = useState<Partial<TaskRecord> | null>(null);
  const [whatsAppPrefill, setWhatsAppPrefill] = useState<{ contactId?: string; propertyId?: string; taskId?: string; taskTitle?: string } | null>(null);
  const [documentContact, setDocumentContact] = useState("");
  const [notice, setNotice] = useState("");
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(() => load("estateflow.auditEvents", []));
  const auditSnapshot = useRef<Record<string, Array<{ id: string; fingerprint: string; label: string }>> | null>(null);
  const [syncHost, setSyncHost] = useState(() => load("axivestra.syncHost", ""));
  const [syncToken, setSyncToken] = useState(() => load("axivestra.syncToken", ""));
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>(".topbar .search-box input")?.focus();
      }
      if (event.key === "Escape") {
        setMobileMenu(false);
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Local-first mode keeps the existing estateflow.* browser keys for backward compatibility.

  useEffect(() => {
    let cancelled = false;
    void localDb.documents.orderBy("createdAt").reverse().toArray().then(saved => {
      if (!cancelled) setDocuments(saved.map(({ file: _file, ...record }) => record));
    }).catch(error => {
      if (!cancelled) setNotice("Local document vault could not be opened: " + (error instanceof Error ? error.message : String(error)));
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    localStorage.setItem("estateflow.properties", JSON.stringify(properties));
  }, [properties]);

  useEffect(() => {
    localStorage.setItem("estateflow.contacts", JSON.stringify(contacts));
  }, [contacts]);
  useEffect(() => {
    localStorage.setItem("estateflow.whatsappGroups", JSON.stringify(savedWhatsAppGroups));
  }, [savedWhatsAppGroups]);

  useEffect(() => {
    localStorage.setItem("estateflow.tasks", JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem("estateflow.financials", JSON.stringify(financials));
  }, [financials]);
  useEffect(() => {
    localStorage.setItem("estateflow.risks", JSON.stringify(riskRecords));
  }, [riskRecords]);
  useEffect(() => {
    localStorage.setItem("estateflow.approvals", JSON.stringify(approvalRequests));
  }, [approvalRequests]);

  // Local audit trail: record entity-level changes without copying private field values into the log.
  useEffect(() => {
    localStorage.setItem("estateflow.auditEvents", JSON.stringify(auditEvents));
  }, [auditEvents]);

  useEffect(() => {
    const collections: Record<string, unknown[]> = {
      Property: properties,
      Contact: contacts,
      Task: tasks,
      Financial: financials,
      Risk: riskRecords,
      Approval: approvalRequests
    };
    const snapshot: Record<string, Array<{ id: string; fingerprint: string; label: string }>> = {};
    for (const [entity, rawRecords] of Object.entries(collections)) {
      const records = rawRecords as Array<{ id: string; [key: string]: unknown }>;
      snapshot[entity] = records.map(record => ({
        id: String(record.id),
        fingerprint: JSON.stringify(record),
        label: String(record.title || record.name || record.type || record.module || record.id).slice(0, 160)
      }));
    }
    const previous = auditSnapshot.current;
    auditSnapshot.current = snapshot;
    if (!previous) return;

    const changes: AuditEvent[] = [];
    const now = new Date().toISOString();
    for (const [entity, records] of Object.entries(snapshot)) {
      const before = new Map((previous[entity] || []).map(record => [record.id, record]));
      const after = new Map(records.map(record => [record.id, record]));
      for (const record of records) {
        const prior = before.get(record.id);
        if (!prior) changes.push({ id: uid(), at: now, action: "created", entity, recordId: record.id, label: record.label });
        else if (prior.fingerprint !== record.fingerprint) changes.push({ id: uid(), at: now, action: "updated", entity, recordId: record.id, label: record.label });
      }
      for (const record of previous[entity] || []) {
        if (!after.has(record.id)) changes.push({ id: uid(), at: now, action: "deleted", entity, recordId: record.id, label: record.label });
      }
    }
    if (changes.length) setAuditEvents(current => [...changes.reverse(), ...current].slice(0, 1000));
  }, [properties, contacts, tasks, financials, riskRecords, approvalRequests]);

  const mergeSyncSnapshot = (remote: Partial<SyncSnapshot>) => {
    const merged = {
      properties: mergeById(properties, Array.isArray(remote.properties) ? remote.properties : []),
      contacts: mergeById(contacts, Array.isArray(remote.contacts) ? remote.contacts : []),
      whatsappGroups: mergeById(savedWhatsAppGroups, Array.isArray(remote.whatsappGroups) ? remote.whatsappGroups : []),
      tasks: mergeById(tasks, Array.isArray(remote.tasks) ? remote.tasks : []),
      financials: mergeById(financials, Array.isArray(remote.financials) ? remote.financials : []),
      riskRecords: mergeById(riskRecords, Array.isArray(remote.riskRecords) ? remote.riskRecords : []),
      approvalRequests: mergeById(approvalRequests, Array.isArray(remote.approvalRequests) ? remote.approvalRequests : []),
      auditEvents: mergeById(auditEvents, Array.isArray(remote.auditEvents) ? remote.auditEvents : [])
    };
    setProperties(merged.properties as PropertyRecord[]);
    setContacts(merged.contacts as ContactRecord[]);
    setSavedWhatsAppGroups(merged.whatsappGroups as SavedWhatsAppGroup[]);
    setTasks(merged.tasks as TaskRecord[]);
    setFinancials(merged.financials as FinancialRecord[]);
    setRiskRecords(merged.riskRecords as RiskRecord[]);
    setApprovalRequests(merged.approvalRequests as ApprovalRequest[]);
    setAuditEvents(merged.auditEvents as AuditEvent[]);
    return merged as SyncSnapshot;
  };

  const syncWithPc = async () => {
    const host = syncHost.trim().replace(/\/+$/, "");
    const token = syncToken.trim();
    let parsed: URL;
    try { parsed = new URL(host); } catch { setSyncStatus("Enter the PC companion address shown in WhatsApp Automation."); return; }
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
      setSyncStatus("Use the full local PC companion URL without a username, password, query or fragment."); return;
    }
    const hostname = parsed.hostname.toLowerCase();
    const isPrivate = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname) || hostname.endsWith(".local")
      || /^10\./.test(hostname) || /^192\.168\./.test(hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
    if (parsed.protocol === "http:" && !isPrivate) { setSyncStatus("Use HTTPS outside your trusted local network."); return; }
    if (!token) { setSyncStatus("Enter the companion token from the Windows PC."); return; }
    if (!window.confirm("Sync business records with the selected PC? Records are merged by ID; this device's version wins when the same ID exists on both devices. Remote-only records are retained. Deletions are not propagated. Documents are not included. Export a backup first if these records are important.")) return;

    setSyncBusy(true); setSyncStatus("Connecting to the PC and merging records…");
    localStorage.setItem("axivestra.syncHost", host);
    localStorage.setItem("axivestra.syncToken", token);
    try {
      const request = async (method: "GET" | "POST", body?: Record<string, unknown>) => {
        const response = await fetch(host + "/api/data-sync", {
          method,
          headers: { "Content-Type": "application/json", "X-EstateFlow-Token": token },
          body: method === "POST" ? JSON.stringify(body || {}) : undefined
        });
        const data = await response.json() as { ok?: boolean; error?: string; revision?: number; updatedAt?: string; snapshot?: Partial<SyncSnapshot> };
        if (!response.ok || data.ok === false) {
          const error = new Error(data.error || "PC sync request failed (" + response.status + ").") as Error & { status?: number; data?: typeof data };
          error.status = response.status; error.data = data; throw error;
        }
        return data;
      };
      let remote = await request("GET");
      let merged = mergeSyncSnapshot(remote.snapshot || {});
      try {
        const pushed = await request("POST", { expectedRevision: remote.revision ?? 0, snapshot: merged });
        setSyncStatus("Sync complete. PC revision " + pushed.revision + " saved at " + new Date(String(pushed.updatedAt)).toLocaleString("en-IN") + ". This is an additive sync; verify important changes on both devices.");
      } catch (error) {
        const syncError = error as Error & { status?: number };
        if (syncError.status !== 409) throw error;
        remote = await request("GET");
        merged = mergeSyncSnapshot(remote.snapshot || {});
        const pushed = await request("POST", { expectedRevision: remote.revision ?? 0, snapshot: merged });
        setSyncStatus("Sync complete after a concurrent update. PC revision " + pushed.revision + " saved. Local versions win for matching record IDs; verify important changes.");
      }
    } catch (error) {
      setSyncStatus("Sync failed: " + (error instanceof Error ? error.message : String(error)));
    } finally { setSyncBusy(false); }
  };

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

  // Local-only persistence is handled by the state effects above.
  const remoteUpsert = (_table: string, _payload: Record<string, unknown>) => {};
  const remoteUpdateTask = (_id: string, _payload: Record<string, unknown>) => {};
  const remoteDelete = (_table: string, _id: string) => {};

  const uploadDocument = async (file: File) => {
    const maxBytes = 25 * 1024 * 1024;
    if (file.size > maxBytes) {
      setNotice("This file exceeds the 25 MB local-vault limit. Compress it or choose a smaller file.");
      return;
    }
    const allowedMimeTypes = new Set([
      "application/pdf", "image/jpeg", "image/png", "image/webp", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]);
    const allowedExtensions = /\.(pdf|jpe?g|png|webp|docx?)$/i;
    if (!allowedMimeTypes.has(file.type) && !allowedExtensions.test(file.name)) {
      setNotice("Choose a PDF, JPEG, PNG, WebP, DOC or DOCX file.");
      return;
    }
    setUploadingDocument(true);
    const id = uid();
    const property = properties.find(item => item.id === documentProperty);
    const record: DocumentRecord = {
      id, propertyId: property?.id ?? "", property: property?.title ?? "", contactId: documentContact || "",
      name: file.name, category: documentCategory, storagePath: id,
      mimeType: file.type || "application/octet-stream", sizeBytes: file.size, expiresOn: documentExpiry,
      notes: documentNotes, createdAt: new Date().toISOString()
    };
    try {
      await localDb.documents.put({ ...record, file });
      setDocuments(previous => [record, ...previous.filter(item => item.id !== id)]);
      setDocumentNotes("");
      setDocumentExpiry("");
      setDocumentContact("");
      setNotice("Document saved in AXIVESTRA's local vault on this device.");
    } catch (error) {
      setNotice("Local document save failed: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setUploadingDocument(false);
    }
  };

  const downloadDocument = async (record: DocumentRecord) => {
    try {
      const saved = await localDb.documents.get(record.id);
      if (!saved?.file) {
        setNotice("The document file is missing from this device. Restore it from your own document backup.");
        return;
      }
      const url = URL.createObjectURL(saved.file);
      const link = document.createElement("a");
      link.href = url;
      link.download = saved.name;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      setNotice("Document download started.");
    } catch (error) {
      setNotice("Document download failed: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const deleteDocument = async (record: DocumentRecord) => {
    if (!window.confirm("Permanently delete the local file '" + record.name + "'?")) return;
    try {
      await localDb.documents.delete(record.id);
      setDocuments(previous => previous.filter(item => item.id !== record.id));
      setNotice("Document and local file deleted.");
    } catch (error) {
      setNotice("Document delete failed: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const go = (section: Section) => { setActive(section); setMobileMenu(false); setNotice(""); if (section !== "WhatsApp Automation") setWhatsAppPrefill(null); };
  const openPropertyForm = (record: PropertyRecord | null = null) => { setEditingProperty(record); setShowPropertyForm(true); };
  const closePropertyForm = () => { setShowPropertyForm(false); setEditingProperty(null); };
  const openContactForm = (record: ContactRecord | null = null) => { setEditingContact(record); setShowContactForm(true); };
  const closeContactForm = () => { setShowContactForm(false); setEditingContact(null); };
  const openTaskForm = (record: TaskRecord | null = null, prefill: Partial<TaskRecord> | null = null) => { setEditingTask(record); setTaskPrefill(prefill); setShowTaskForm(true); };
  const closeTaskForm = () => { setShowTaskForm(false); setEditingTask(null); setTaskPrefill(null); };
  const openWhatsAppFor = (contactId?: string, propertyId?: string, taskId?: string, taskTitle?: string) => { setWhatsAppPrefill({ contactId, propertyId, taskId, taskTitle }); setActive("WhatsApp Automation"); setMobileMenu(false); setNotice(""); };
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
      contact: record.contact, primary_contact_id: record.primaryContactId || null,
      target_deadline: record.targetDeadline || null, next_follow_up_date: record.nextFollowUpDate || null,
      next_action: record.nextAction || "", notes: record.notes, created_at: record.createdAt,
      survey_number: record.surveyNumber, ownership_details: record.ownershipDetails,
      area_value: record.areaValue.trim() ? Number(record.areaValue) : null,
      area_unit: record.areaUnit, dimensions: record.dimensions,
      rate_per_unit: record.ratePerUnit.trim() ? Number(record.ratePerUnit) : null,
      module_data: record.moduleData ?? {}
    });
    closePropertyForm();
    setNotice("Property record saved on this device.");
  };
  const saveContact = (data: Omit<ContactRecord, "id">) => {
    const record: ContactRecord = editingContact ? { ...editingContact, ...data } : { ...data, id: uid() };
    const possibleDuplicate = !editingContact && Boolean(record.phone) && contacts.find(item => sameContactPhone(item.phone, record.phone));
    if (possibleDuplicate && !window.confirm(`A contact with a matching phone already exists: ${possibleDuplicate.name}. Save a separate contact anyway?`)) return;
    setContacts(prev => editingContact
      ? prev.map(item => item.id === record.id ? record : item)
      : [record, ...prev]);
    remoteUpsert("contacts", { id: record.id, name: record.name, phone: record.phone, role: record.role, roles: record.roles ?? [record.role], custom_roles: record.customRoles || "", email: record.email || "", address: record.address || "", profession: record.profession || "", employer: record.employer || "", designation: record.designation || "", business_type: record.businessType || "", income_sources: record.incomeSources || "", associated_company: record.associatedCompany || "", relationship_notes: record.relationshipNotes || "", notes: record.notes, whatsapp_name: record.whatsappName || "", whatsapp_jid: record.whatsappJid || "" });
    closeContactForm();
    setNotice("Contact saved on this device.");
  };
  const normalizedContactPhone = (value: string) => {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    return digits;
  };
  const sameContactPhone = (left: string, right: string) => {
    const a = normalizedContactPhone(left);
    const b = normalizedContactPhone(right);
    return a === b || (a.length === 10 && b.length === 12 && b.startsWith("91") && b.endsWith(a)) || (b.length === 10 && a.length === 12 && a.startsWith("91") && a.endsWith(b));
  };

  const importWhatsAppContacts = (incoming: SyncedWhatsAppContact[]) => {
    const next = [...contacts];
    const changed: ContactRecord[] = [];
    let added = 0;
    let refreshed = 0;
    for (const item of incoming) {
      const phone = String(item.phone || "").trim();
      const digits = normalizedContactPhone(phone);
      if (digits.length < 8 || digits.length > 15) continue;
      const waName = String(item.whatsappName || item.name || item.notify || "").trim();
      if (!waName) continue;
      const currentIndex = next.findIndex(contact => sameContactPhone(contact.phone, phone));
      if (currentIndex >= 0) {
        const previous = next[currentIndex];
        // Keep the verified or user-edited master name intact on WhatsApp re-sync.
        const merged: ContactRecord = {
          ...previous,
          name: previous.name, // WhatsApp display names must never overwrite the saved master name.
          phone: previous.phone || phone,
          whatsappName: waName,
          whatsappJid: item.jid || item.id || previous.whatsappJid || ""
        };
        if (merged.name !== previous.name || merged.whatsappName !== previous.whatsappName || merged.whatsappJid !== previous.whatsappJid || merged.phone !== previous.phone) {
          next[currentIndex] = merged;
          changed.push(merged);
          refreshed++;
        }
      } else {
        const record: ContactRecord = {
          id: uid(),
          name: waName,
          phone,
          role: "Other",
          notes: "Imported from the linked WhatsApp address book.",
          whatsappName: waName,
          whatsappJid: item.jid || item.id || ""
        };
        next.unshift(record);
        changed.push(record);
        added++;
      }
    }
    if (changed.length) {
      setContacts(next);
      changed.forEach(record => remoteUpsert("contacts", {
        id: record.id, name: record.name, phone: record.phone, role: record.role, notes: record.notes,
        whatsapp_name: record.whatsappName || "", whatsapp_jid: record.whatsappJid || ""
      }));
    }
    setNotice(`WhatsApp contacts saved: ${added} added, ${refreshed} existing contact records refreshed. They remain in AXIVESTRA when WhatsApp is disconnected.`);
  };

  const importWhatsAppGroups = (incoming: SavedWhatsAppGroup[]) => {
    const next = [...savedWhatsAppGroups];
    const changed: SavedWhatsAppGroup[] = [];
    for (const group of incoming) {
      const jid = String(group.jid || group.id || "").trim();
      if (!jid.endsWith("@g.us")) continue;
      const existingIndex = next.findIndex(item => item.jid === jid);
      const previous = existingIndex >= 0 ? next[existingIndex] : undefined;
      const sourceId = String(group.id || "");
      const record: SavedWhatsAppGroup = {
        id: previous?.id || (sourceId && !sourceId.endsWith("@g.us") ? sourceId : uid()),
        jid,
        name: String(group.name || group.subject || previous?.name || "WhatsApp group"),
        description: String(group.description || previous?.description || ""),
        size: Number(group.size ?? previous?.size ?? 0),
        lastSyncedAt: String(group.lastSyncedAt || new Date().toISOString())
      };
      if (previous) {
        if (previous.name !== record.name || previous.description !== record.description || previous.size !== record.size || previous.lastSyncedAt !== record.lastSyncedAt) {
          next[existingIndex] = record;
          changed.push(record);
        }
      } else {
        next.push(record);
        changed.push(record);
      }
    }
    if (changed.length) {
      setSavedWhatsAppGroups(next);
      changed.forEach(group => remoteUpsert("whatsapp_groups", {
        id: group.id, jid: group.jid, name: group.name, description: group.description,
        member_count: group.size || 0, last_synced_at: group.lastSyncedAt || null
      }));
    }
    setNotice(`WhatsApp groups saved: ${changed.length} added or refreshed. Saved group names remain in AXIVESTRA after WhatsApp is disconnected.`);
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
      task_type: record.type, property_id: record.propertyId || null, contact_id: record.contactId || null,
      property_label: record.property, notes: record.notes, is_done: record.done
    });
    closeTaskForm();
    setNotice("Task saved on this device. Background notifications still require a scheduler.");
  };
  const deleteProperty = (id: string) => { const record = properties.find(item => item.id === id); if (!window.confirm(`Delete ${record?.title || "this record"}? This removes it from your AXIVESTRA workspace.`)) return; setProperties(prev => prev.filter(p => p.id !== id)); remoteDelete("property_records", id); };
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
      contact_id: record.contactId || null,
      transaction_type: record.type,
      amount: Number(record.amount),
      transaction_date: record.date,
      party: record.party,
      reference_number: record.reference,
      notes: record.notes
    });
    closeFinancialForm();
    setNotice("Financial transaction saved on this device.");
  };
  const deleteFinancial = (id: string) => {
    setFinancials(prev => prev.filter(item => item.id !== id));
    remoteDelete("financial_transactions", id);
  };

  const saveRisk = (data: Omit<RiskRecord, "id" | "createdAt">) => {
    const record: RiskRecord = { ...data, id: uid(), createdAt: new Date().toISOString() };
    setRiskRecords(prev => [record, ...prev]);
    remoteUpsert("risk_register", {
      id: record.id, title: record.title, category: record.category, severity: record.severity,
      status: record.status, owner: record.owner, due_date: record.dueDate || null,
      entity_label: record.entity, property_id: record.propertyId || null, contact_id: record.contactId || null,
      mitigation: record.mitigation, created_at: record.createdAt
    });
    setShowRiskForm(false);
    setNotice("Risk saved on this device.");
  };
  const closeRisk = (record: RiskRecord) => {
    const updated = { ...record, status: record.status === "Closed" ? "Open" : "Closed" };
    setRiskRecords(prev => prev.map(item => item.id === record.id ? updated : item));
    remoteUpsert("risk_register", {
      id: updated.id, title: updated.title, category: updated.category, severity: updated.severity,
      status: updated.status, owner: updated.owner, due_date: updated.dueDate || null,
      entity_label: updated.entity, property_id: updated.propertyId || null, contact_id: updated.contactId || null,
      mitigation: updated.mitigation, created_at: updated.createdAt
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
      property_id: record.propertyId || null, contact_id: record.contactId || null,
      requested_by: record.requestedBy, approver: record.approver, priority: record.priority,
      status: record.status, rationale: record.rationale, decision_notes: "", requested_at: record.requestedAt, decided_at: null
    });
    setShowApprovalForm(false);
    setNotice("Approval request saved on this device.");
  };
  const decideApproval = (record: ApprovalRequest, status: "approved" | "rejected") => {
    const updated: ApprovalRequest = { ...record, status, decisionNotes: status === "approved" ? "Approved in AXIVESTRA." : "Rejected in AXIVESTRA.", decidedAt: new Date().toISOString() };
    setApprovalRequests(prev => prev.map(item => item.id === record.id ? updated : item));
    remoteUpsert("approval_requests", {
      id: updated.id, title: updated.title, approval_type: updated.area, entity_label: updated.entity,
      property_id: updated.propertyId || null, contact_id: updated.contactId || null,
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

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand"><div className="brand-mark ax-brand-mark"><img src="./axivestra-mark.svg" alt="" /></div><div><strong>AXIVESTRA</strong><span>ASSET INTELLIGENCE</span></div>
          <button className="mobile-close" onClick={() => setMobileMenu(false)} aria-label="Close menu"><X size={19} /></button></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="nav-list">{navigation.map(({ name, icon: Icon }) => <button key={name} className={`nav-item ${active === name ? "active" : ""}`} onClick={() => go(name)}><Icon size={18} strokeWidth={1.8} /><span>{name}</span>{name === "Schedule & Tasks" && upcomingTasks.length > 0 && <span className="nav-count">{upcomingTasks.length}</span>}</button>)}</nav>
        <details className="ax-sidebar-modules" open><summary><span>MODULE DIRECTORY</span><ChevronDown size={13}/></summary><div className="ax-sidebar-module-list">{modules.map(({name,icon:Icon},index)=><button key={name} className={`ax-sidebar-module ${active===name?"active":""}`} onClick={()=>go(name)}><Icon size={14}/><span>{name}</span><small>{String(index+1).padStart(2,"0")}</small></button>)}</div></details>
        <div className="sidebar-bottom"><div className="help-card"><span className="help-icon"><Clock3 size={18} /></span><strong>Stay ahead</strong><p>Keep every deal and deadline in one place.</p></div>
          <button className={`nav-item ${active === "Settings" ? "active" : ""}`} onClick={() => go("Settings")}><Settings size={18} /> Settings</button>
          <div className="profile"><div className="avatar ax-avatar">AX</div><div className="profile-text"><strong>AXIVESTRA</strong><span>Command workspace</span></div><span className="online-dot" /></div></div>
      </aside>
      {mobileMenu && <button className="scrim" onClick={() => setMobileMenu(false)} aria-label="Close menu" />}
      <section className="main-panel">
        <header className="topbar"><button className="menu-toggle" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu size={21} /></button>
          <div className="breadcrumb">Workspace <span>/</span> <strong>{active}</strong></div>
          <div className="top-actions"><label className="search-box"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search records..." /><kbd>Ctrl K</kbd></label><button className="icon-button" aria-label="Notifications" onClick={() => go("Schedule & Tasks")}><Bell size={19} /><i /></button></div>
        </header>
        <div className="content">
          <div className="welcome-row"><div><div className="eyebrow"><span className="live-dot" /> INTELLIGENCE COMMAND CENTRE</div><h1>{active === "Overview" ? "See your entire portfolio clearly." : active}</h1><p className="subtitle">{active === "Overview" ? "One live workspace for assets, capital, counterparties, obligations and decisions." : `Manage your ${active.toLowerCase()} in one connected workspace.`}</p></div>
            <button className="primary-button" onClick={() => active === "Contacts" ? openContactForm() : active === "Schedule & Tasks" ? openTaskForm() : active === "Financials" ? openFinancialForm() : active === "Risk & Compliance" ? setShowRiskForm(true) : active === "Approvals" ? setShowApprovalForm(true) : openPropertyForm()}><Plus size={17} /> {active === "Contacts" ? "New contact" : active === "Schedule & Tasks" ? "New task" : active === "Financials" ? "New transaction" : active === "Risk & Compliance" ? "Log risk" : active === "Approvals" ? "Request approval" : active === "Client & Deal Hub" ? "New deal / property" : "New record"}</button></div>
          {notice && <div className="notice"><CheckCircle2 size={17}/>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={15}/></button></div>}
          {active === "Overview" && <>
            <section className="institutional-banner">
              <div className="institutional-copy">
                <span className="institutional-label"><span className="live-dot"/> AXIVESTRA COMMAND MATRIX</span>
                <h2>Every asset. Every obligation. One intelligence layer.</h2>
                <p>Unify property operations, lending, investments, legal matters and follow-ups in a single command centre.</p>
                <div className="banner-actions"><button className="hero-button" onClick={()=>go("All Properties")}>Open deal pipeline <ArrowUpRight size={16}/></button><button className="banner-ghost" onClick={()=>go("Risk & Compliance")}>Review risk signals <ShieldCheck size={15}/></button></div>
              </div>
              <div className="banner-aside">
                <span>TRACKED PORTFOLIO VALUE</span>
                <strong>₹{portfolioValue.toLocaleString("en-IN",{maximumFractionDigits:0})}</strong>
                <small>Based on values entered in AXIVESTRA</small>
                <div className="banner-divider"/>
                <div className="banner-aside-row"><span>Last refreshed</span><strong>{new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</strong></div>
                <div className="banner-aside-row"><span>Data mode</span><strong>Local device</strong></div>
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
            <PortfolioAnalytics
              properties={properties.map(item => ({ id: item.id, title: item.title, module: item.module, value: item.value, status: item.status }))}
              financials={financials.map(item => ({ id: item.id, type: item.type, amount: item.amount, date: item.date }))}
              tasks={tasks.map(item => ({ id: item.id, date: item.date, done: item.done, type: item.type }))}
              modules={modules.map(item => ({ name: item.name, value: 0, count: properties.filter(property => property.module === item.name).length }))}
              onOpenModule={name => go(name)}
            />
            <div className="section-heading module-section-heading"><div><span className="section-kicker">CONNECTED SYSTEMS</span><h2>Explore your operating modules</h2><p>Sixteen interconnected workspaces across assets, capital, lending, funds, investor services, transactions and legal matters.</p></div><button className="text-button" onClick={()=>go("All Properties")}>View all records <ArrowUpRight size={15}/></button></div>
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
          
          {active === "All Properties" || modules.some(m=>m.name===active) ? <ModuleWorkbench
            moduleName={active === "All Properties" ? "All Properties" : active}
            description={active === "All Properties" ? "Search, inspect, compare and action every property, deal, loan, investment and legal workstream from one live register." : modules.find(item=>item.name===active)?.description || "Manage every detail, stakeholder, date, value and next action for this workstream."}
            records={filteredProperties.filter(record=>active==="All Properties"||record.module===active)}
            fields={active==="All Properties" ? [] : moduleFields[active] || []}
            contacts={contacts}
            onAdd={()=>openPropertyForm()}
            onEdit={record=>openPropertyForm(record)}
            onDelete={deleteProperty}
            onSchedule={(record,contact)=>openTaskForm(null,{title:`Follow up · ${record.title}`,date:record.nextFollowUpDate||record.targetDeadline||today,time:"10:00",type:"Follow-up",property:record.title,propertyId:record.id,contactId:contact?.id||record.primaryContactId,contactName:contact?.name})}
            onWhatsApp={(contactId,propertyId)=>openWhatsAppFor(contactId,propertyId)}
          /> : null}
          {active === "Contacts" && <section className="data-panel"><div className="section-heading"><div><h2>Contacts</h2><p>{contacts.length} saved contacts</p></div><button className="primary-button" onClick={()=>openContactForm()}><Plus size={16}/> Add contact</button></div>
            {contacts.length ? <div className="record-list">{contacts.filter(c=>`${c.name} ${c.phone} ${c.role} ${(c.roles ?? []).join(" ")} ${c.customRoles ?? ""} ${c.profession ?? ""} ${c.employer ?? ""} ${c.associatedCompany ?? ""}`.toLowerCase().includes(search.toLowerCase())).map(c=><article className="record-card" key={c.id}><div className="record-symbol contact-symbol"><Users size={20}/></div><div className="record-main"><h3>{c.name}</h3><p><Phone size={14}/>{c.phone || "No phone entered"} <span>•</span> {[...new Set([...(c.roles?.length ? c.roles : [c.role || "Contact"]),...(c.customRoles || "").split(",").map(role=>role.trim()).filter(Boolean)])].join(" · ")}</p>{(c.profession || c.employer || c.designation || c.associatedCompany) && <small>{[c.profession,c.designation,c.employer,c.associatedCompany].filter(Boolean).join(" · ")}</small>}{c.email && <small>Email: {c.email}</small>}{c.relationshipNotes && <small>Relationship: {c.relationshipNotes}</small>}{c.notes&&<small>{c.notes}</small>}{c.whatsappName && c.whatsappName !== c.name && <small>WhatsApp saved name: {c.whatsappName}</small>}<small>Linked records: {properties.filter(property=>property.primaryContactId===c.id || (property.moduleData?.__linkedContactIds ?? "").split(",").includes(c.id) || Object.entries(property.moduleData ?? {}).some(([key,value])=>key.startsWith("__contact_") && value===c.id) || (!property.primaryContactId && (property.contact || "").trim().toLowerCase()===c.name.trim().toLowerCase())).length} · Open tasks: {tasks.filter(task=>task.contactId===c.id && !task.done).length}</small>{c.phone&&<div className="linked-actions"><a className="secondary-button" href={`tel:${c.phone}`}>Call now</a><button className="secondary-button" onClick={()=>openTaskForm(null,{title:`Call ${c.name}`,date:today,time:"10:00",type:"Call",contactId:c.id,contactName:c.name})}>Schedule call</button><button className="secondary-button" onClick={()=>openWhatsAppFor(c.id,properties.find(property=>property.primaryContactId===c.id || (property.moduleData?.__linkedContactIds ?? "").split(",").includes(c.id) || Object.entries(property.moduleData ?? {}).some(([key,value])=>key.startsWith("__contact_") && value===c.id))?.id)}>Schedule WhatsApp</button></div>}</div><div className="record-side"><button className="edit-button" onClick={()=>openContactForm(c)} aria-label={`Edit ${c.name}`}><Pencil size={15}/></button><button className="delete-button" onClick={()=>deleteContact(c.id)} aria-label={`Delete ${c.name}`}><Trash2 size={15}/></button></div></article>)}</div>:<Empty icon={<Users size={22}/>} title="Your contact book is ready" text="Keep buyers, sellers, lawyers, brokers, lenders and other stakeholders together." action="Add contact" onClick={()=>openContactForm()}/>}</section>}
          {active === "Client & Deal Hub" && <RelationshipHub
            properties={properties} contacts={contacts} tasks={tasks} financials={financials} today={today}
            onEditProperty={openPropertyForm}
            onAddProperty={()=>openPropertyForm()}
            onAddContact={()=>openContactForm()}
            onOpenContacts={()=>go("Contacts")}
            onOpenTasks={()=>go("Schedule & Tasks")}
            onSchedule={(property,contact)=>openTaskForm(null,{title:`Call ${contact?.name ?? "stakeholder"} · ${property.title}`,date:property.nextFollowUpDate || getPropertyDeadline(property)?.date || today,time:"10:00",type:"Call",property:property.title,propertyId:property.id,contactId:contact?.id,contactName:contact?.name})}
            onWhatsApp={openWhatsAppFor}
            onEditTask={openTaskForm}
            onToggleTask={toggleTask}
            onDeleteTask={deleteTask}
          />}
          {active === "Schedule & Tasks" && <section className="data-panel"><div className="section-heading"><div><h2>One-time schedule</h2><p>Tasks and reminders saved on this device.</p></div><button className="primary-button" onClick={()=>openTaskForm()}><Plus size={16}/> Schedule task</button></div>
            <div className="notice notice-warn"><Clock3 size={17}/> These are stored reminders, not background alarms. For reliable notifications after closing the app, we must add a deployed server scheduler in the next stage.</div>
            {tasks.length ? <TaskList tasks={[...tasks].sort((a,b)=>`${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))} toggle={toggleTask} remove={deleteTask} edit={openTaskForm}/> : <Empty icon={<CalendarClock size={22}/>} title="Nothing scheduled yet" text="Add a dated task for a payment, meeting, registration or follow-up." action="Create schedule" onClick={()=>openTaskForm()}/>}</section>}
          {active === "Financials" && <section className="data-panel">
            <div className="section-heading"><div><h2>Financial intelligence</h2><p>{financials.length} recorded transactions · amounts in INR</p></div><div className="finance-actions"><button className="secondary-button" onClick={()=>{const rows=[["Date","Type","Property","Amount INR","Party","Reference","Notes"],...financials.map(item=>[item.date,item.type,item.property,item.amount,item.party,item.reference,item.notes])];const csv=rows.map(row=>row.map(value=>`"${String(value).replace(/"/g,'""')}"`).join(",")).join("\n");const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));link.download=`estateflow-financials-${today}.csv`;link.click();URL.revokeObjectURL(link.href);}}>Export CSV</button><button className="primary-button" onClick={()=>openFinancialForm()}><Plus size={16}/> Add transaction</button></div></div>
            <div className="finance-summary"><div><span>Tracked inflows</span><strong>₹{totalInflow.toLocaleString("en-IN",{maximumFractionDigits:2})}</strong></div><div><span>Tracked outflows</span><strong>₹{totalOutflow.toLocaleString("en-IN",{maximumFractionDigits:2})}</strong></div><div><span>Net recorded movement</span><strong>₹{(totalInflow-totalOutflow).toLocaleString("en-IN",{maximumFractionDigits:2})}</strong></div></div>
            <p className="finance-footnote">Totals are category-based summaries of records entered here, not verified bank balances or accounting advice. Review transaction types and source documents before relying on settlement figures.</p>
            {financials.length ? <div className="record-list">{[...financials].sort((a,b)=>b.date.localeCompare(a.date)).map(item=><article className="record-card" key={item.id}><div className="record-symbol"><Calculator size={20}/></div><div className="record-main"><h3>{item.type} · ₹{Number(item.amount||0).toLocaleString("en-IN",{maximumFractionDigits:2})}</h3><p>{item.date}{item.property ? <><span>•</span>{item.property}</> : null}</p>{item.party&&<small>Party: {item.party}</small>}{item.reference&&<small>Reference: {item.reference}</small>}{item.notes&&<small>{item.notes}</small>}</div><div className="record-side"><button className="edit-button" onClick={()=>openFinancialForm(item)} aria-label={`Edit ${item.type} transaction`}><Pencil size={15}/></button><button className="delete-button" onClick={()=>deleteFinancial(item.id)} aria-label="Delete financial transaction"><Trash2 size={15}/></button></div></article>)}</div> : <Empty icon={<Calculator size={22}/>} title="No financial transactions yet" text="Record advances, purchase/sale values, loans, repayments, interest, receipts, brokerage, expenses and settlements." action="Add transaction" onClick={()=>openFinancialForm()}/>}
          </section>}
          {active === "Client & Deal Hub" && <RelationshipHub
            properties={properties} contacts={contacts} tasks={tasks} financials={financials} today={today}
            onEditProperty={openPropertyForm}
            onAddProperty={()=>openPropertyForm()}
            onAddContact={()=>openContactForm()}
            onOpenContacts={()=>go("Contacts")}
            onOpenTasks={()=>go("Schedule & Tasks")}
            onSchedule={(property,contact)=>openTaskForm(null,{title:`Call ${contact?.name ?? "stakeholder"} · ${property.title}`,date:property.nextFollowUpDate || getPropertyDeadline(property)?.date || today,time:"10:00",type:"Call",property:property.title,propertyId:property.id,contactId:contact?.id,contactName:contact?.name})}
            onWhatsApp={openWhatsAppFor}
            onEditTask={openTaskForm}
            onToggleTask={toggleTask}
            onDeleteTask={deleteTask}
          />}
          {active === "Documents" && <section className="data-panel">
            <div className="section-heading"><div><h2>Local document vault</h2><p>{documents.length} saved documents · files stored on this device</p></div><FileText size={21}/></div>
            <div className="notice notice-warn">Documents are saved in this browser/app's local database. They do not sync to your PC or other phone automatically. Download important files separately before changing devices or clearing app data.</div>
            <div className="document-upload-card">
              <div className="form-two">
                <label>Document category<select value={documentCategory} onChange={event=>setDocumentCategory(event.target.value)}>{["Sale deed","Encumbrance Certificate","RTC / Pahani","Khata","Tax receipt","Loan document","JV / JDA agreement","Legal opinion","Identity / KYC","Other"].map(value=><option key={value}>{value}</option>)}</select></label>
                <label>Related property<select value={documentProperty} onChange={event=>setDocumentProperty(event.target.value)}><option value="">No property selected</option>{properties.map(property=><option key={property.id} value={property.id}>{property.title}</option>)}</select></label>
              </div>
              <div className="form-two">
                <label>Related contact<select size={Math.min(Math.max(contacts.length,3),5)} value={documentContact} onChange={event=>setDocumentContact(event.target.value)}><option value="">No contact selected</option>{contacts.map(contact=><option key={contact.id} value={contact.id}>{contact.name}{contact.whatsappName && contact.whatsappName !== contact.name ? " · WhatsApp: " + contact.whatsappName : ""} · {contact.role}</option>)}</select></label>
                <label>Expiry / renewal date<input type="date" value={documentExpiry} onChange={event=>setDocumentExpiry(event.target.value)}/></label>
                <label>Notes<input value={documentNotes} onChange={event=>setDocumentNotes(event.target.value)} placeholder="Document number, authority, comments"/></label>
              </div>
              <label className="upload-picker">Select a document (PDF, image, DOC/DOCX · max 25 MB)<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" disabled={uploadingDocument} onChange={event=>{const file=event.target.files?.[0];if(file)void uploadDocument(file);event.currentTarget.value="";}}/><span>{uploadingDocument ? "Saving locally…" : "Save document on this device"}</span></label>
            </div>
            {documents.length ? <div className="record-list document-list">{documents.map(record=><article className="record-card" key={record.id}><div className="record-symbol"><FileText size={20}/></div><div className="record-main"><h3>{record.name}</h3><p>{record.category}{record.property ? <><span>•</span>{record.property}</> : null}</p>{record.expiresOn&&<small>Expiry / renewal: {record.expiresOn}</small>}{record.notes&&<small>{record.notes}</small>}<small>{(record.sizeBytes/1024/1024).toFixed(2)} MB · Saved locally</small></div><div className="record-side"><button className="edit-button" onClick={()=>void downloadDocument(record)} aria-label={"Download " + record.name}><Download size={15}/></button><button className="delete-button" onClick={()=>void deleteDocument(record)} aria-label={"Delete " + record.name}><Trash2 size={15}/></button></div></article>)}</div> : <Empty icon={<FileText size={22}/>} title="No documents uploaded yet" text="Select a document above to store it in the local vault." action="Back to overview" onClick={()=>go("Overview")}/>}
          </section>}
          {active === "WhatsApp Automation" && <WhatsAppScheduler contacts={contacts.map(contact => ({ id: contact.id, name: contact.name, phone: contact.phone, role: contact.role, whatsappName: contact.whatsappName, whatsappJid: contact.whatsappJid }))} properties={properties.map(property => ({ id: property.id, title: property.title }))} savedGroups={savedWhatsAppGroups} onImportContacts={importWhatsAppContacts} onImportGroups={importWhatsAppGroups} initialContactId={whatsAppPrefill?.contactId} initialPropertyId={whatsAppPrefill?.propertyId} initialTaskId={whatsAppPrefill?.taskId} initialTaskTitle={whatsAppPrefill?.taskTitle} onNotice={setNotice} />}
          {active === "Risk & Compliance" && <section className="data-panel">
            <div className="section-heading"><div><span className="section-kicker">CONTROL FRAMEWORK</span><h2>Risk & compliance register</h2><p>Track risks, owners, mitigation and time-bound actions.</p></div><button className="primary-button" onClick={()=>setShowRiskForm(true)}><Plus size={16}/> Log risk</button></div>
            <div className="risk-overview-grid"><div className="risk-overview-card"><span>High / critical open risks</span><strong>{highRiskCount}</strong></div><div className="risk-overview-card"><span>Open litigation matters</span><strong>{openLitigationCount}</strong></div><div className="risk-overview-card"><span>Overdue tasks</span><strong>{overdueTaskCount}</strong></div><div className="risk-overview-card"><span>Documents expiring in 30 days</span><strong>{expiringDocumentCount}</strong></div></div>
            <div className="governance-callout"><ShieldCheck size={19}/><div><strong>Evidence-first governance</strong><p>Capture risk, owner, mitigation and due date against a source record. This working register is not a substitute for legal, credit, compliance or regulated-investment review.</p></div></div>
            {riskRecords.length ? <div className="record-list">{riskRecords.map(record=><article className="record-card" key={record.id}><div className={`risk-severity-mark severity-${record.severity.toLowerCase()}`}/><div className="record-main"><h3>{record.title}</h3><p>{record.category} <span>•</span> {record.entity || "No linked entity"}</p><small>Owner: {record.owner || "Unassigned"}{record.dueDate ? ` · Due ${record.dueDate}` : ""}</small>{record.mitigation&&<small>Mitigation: {record.mitigation}</small>}</div><div className="record-side"><span className={`status-pill risk-${record.severity.toLowerCase()}`}>{record.severity}</span><span className="status-pill">{record.status}</span><button className="edit-button" onClick={()=>closeRisk(record)} aria-label={record.status==="Closed"?"Reopen risk":"Close risk"}>{record.status==="Closed" ? <ArrowUpRight size={15}/> : <CheckCircle2 size={15}/>}</button><button className="delete-button" onClick={()=>deleteRisk(record.id)} aria-label="Delete risk"><Trash2 size={15}/></button></div></article>)}</div> : <Empty icon={<ShieldCheck size={22}/>} title="No manual risks recorded" text="Register credit, legal, operational, market or compliance risks with an owner and mitigation plan." action="Log first risk" onClick={()=>setShowRiskForm(true)}/>}
            <div className="section-heading"><div><h2>Automated attention signals</h2><p>Calculated from your current AXIVESTRA records.</p></div></div>
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
          {active === "Settings" && <section className="data-panel"><div className="section-heading"><div><h2>Settings</h2><p>Workspace data and local backup</p></div></div><div className="settings-card"><h3>Local data backup</h3><p>Business records are stored in this device's browser storage; document files are saved in the local IndexedDB vault. There is no cloud account or automatic device-to-device sync. Export business records as JSON, and download document files separately before changing devices or clearing app data.</p><button className="secondary-button" onClick={()=>{const blob=new Blob([JSON.stringify({properties,contacts,whatsappGroups:savedWhatsAppGroups,tasks,financials,riskRecords,approvalRequests,auditEvents,exportedAt:new Date().toISOString()},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`estateflow-backup-${today}.json`;a.click();URL.revokeObjectURL(url);}}>Export backup JSON</button><button className="secondary-button" onClick={()=>{const input=document.createElement("input");input.type="file";input.accept=".json,application/json";input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!Array.isArray(data.properties)||!Array.isArray(data.contacts)||!Array.isArray(data.tasks))throw new Error("Invalid backup");setProperties(data.properties);setContacts(data.contacts);setTasks(data.tasks);if(Array.isArray(data.financials))setFinancials(data.financials);if(Array.isArray(data.riskRecords))setRiskRecords(data.riskRecords);if(Array.isArray(data.approvalRequests))setApprovalRequests(data.approvalRequests);if(Array.isArray(data.auditEvents))setAuditEvents(data.auditEvents);if(Array.isArray(data.whatsappGroups)){setSavedWhatsAppGroups(data.whatsappGroups);}setNotice("Backup imported.");}catch{setNotice("Could not import this file. Please select a valid AXIVESTRA backup.");}};input.click();}}>Import backup JSON</button></div><div className="settings-card"><h3>PC ↔ Android local-network sync</h3><p>Merge business records over your trusted local network using the authenticated Windows companion. No cloud account is used. This sync is additive: matching IDs keep this device's version, PC-only records are retained, and deletions are not propagated. Documents are excluded and must be backed up separately.</p><div className="form-two"><label>Windows PC companion address<input value={syncHost} onChange={event=>setSyncHost(event.target.value)} placeholder="http://192.168.1.10:47822" autoComplete="url"/></label><label>Companion token<input value={syncToken} onChange={event=>setSyncToken(event.target.value)} placeholder="Paste the private PC companion token" autoComplete="off"/></label></div><div className="settings-actions"><button className="primary-button" disabled={syncBusy} onClick={()=>void syncWithPc()}>{syncBusy ? "Syncing…" : "Merge with PC now"}</button></div>{syncStatus&&<p role="status" className="sync-status">{syncStatus}</p>}<p className="ax-form-note">Both devices must be on the same trusted Wi-Fi network, and AXIVESTRA must be running on the Windows PC. In WhatsApp Automation, open the companion setup panel to find the PC address and token. Treat the token like a password; do not share it or save it in GitHub.</p></div><div className="settings-card"><h3>Local audit history</h3><p>Tracks creation, edits and deletions for properties, contacts, tasks, financial transactions, risks and approvals on this device. The log records record labels and IDs, not the private field contents. This is a local activity history, not a tamper-proof or multi-user compliance audit.</p><div className="settings-actions"><button className="secondary-button" onClick={()=>{const blob=new Blob([JSON.stringify(auditEvents,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`axivestra-audit-${today}.json`;a.click();URL.revokeObjectURL(url);}}>Export audit log</button></div>{auditEvents.length ? <div className="audit-event-list">{auditEvents.slice(0,50).map(event=><article className="audit-event-row" key={event.id}><span className={`audit-event-action audit-${event.action}`}>{event.action}</span><div><strong>{event.entity}: {event.label}</strong><small>{event.recordId} · {new Date(event.at).toLocaleString("en-IN")}</small></div></article>)}</div> : <p>No changes have been recorded yet. New record changes will appear here.</p>}</div></section>}
          <footer className="footer"><span>AXIVESTRA © 2026</span><span>Local-first mode · optional trusted-network sync</span></footer>
        </div>
      </section>
      {showPropertyForm && <Modal title={editingProperty ? "Edit property record" : "Add property record"} onClose={()=>closePropertyForm()}><PropertyForm defaultModule={modules.some(m=>m.name===active)?active:modules[0].name} contacts={contacts} initial={editingProperty} onSave={saveProperty} onCancel={()=>closePropertyForm()}/></Modal>}
      {showContactForm && <Modal title={editingContact ? "Edit contact" : "Add contact"} onClose={()=>closeContactForm()}><ContactForm initial={editingContact} onSave={saveContact} onCancel={()=>closeContactForm()}/></Modal>}
      {showTaskForm && <Modal title={editingTask ? "Edit scheduled task" : "Schedule a one-time task"} onClose={()=>closeTaskForm()}><TaskForm properties={properties} contacts={contacts} initial={editingTask} defaultValues={taskPrefill} onSave={saveTask} onCancel={()=>closeTaskForm()}/></Modal>}
      {showFinancialForm && <Modal title={editingFinancial ? "Edit financial transaction" : "Add financial transaction"} onClose={()=>closeFinancialForm()}><FinancialForm properties={properties} contacts={contacts} initial={editingFinancial} onSave={saveFinancial} onCancel={()=>closeFinancialForm()}/></Modal>}
      {showRiskForm && <Modal title="Log a risk" onClose={()=>setShowRiskForm(false)}><RiskForm properties={properties} contacts={contacts} onSave={saveRisk} onCancel={()=>setShowRiskForm(false)}/></Modal>}
      {showApprovalForm && <Modal title="Request approval" onClose={()=>setShowApprovalForm(false)}><ApprovalForm properties={properties} contacts={contacts} onSave={saveApproval} onCancel={()=>setShowApprovalForm(false)}/></Modal>}
    </main>
  );
}

function getLinkedContactsForRecord(property: PropertyRecord, contacts: ContactRecord[]): ContactRecord[] {
  const roleIds = Object.entries(property.moduleData ?? {})
    .filter(([key,value]) => key.startsWith("__contact_") && Boolean(value))
    .map(([,value]) => String(value));
  const ids = [property.primaryContactId ?? "", ...(property.moduleData?.__linkedContactIds ?? "").split(","), ...roleIds].filter(Boolean);
  const linked = ids.map(id => contacts.find(contact => contact.id === id)).filter((contact): contact is ContactRecord => Boolean(contact));
  const unique = linked.filter((contact,index) => linked.findIndex(other => other.id === contact.id) === index);
  if (unique.length) return unique;
  const legacy = contacts.find(contact => contact.name.trim().toLowerCase() === (property.contact || "").trim().toLowerCase());
  return legacy ? [legacy] : [];
}
function getLinkedContactRoleLabels(property: PropertyRecord, contacts: ContactRecord[]): string[] {
  return (moduleContactFields[property.module] ?? [])
    .map(field => ({ label: field.label, contact: contacts.find(contact => contact.id === property.moduleData?.[field.key]) }))
    .filter((item): item is { label: string; contact: ContactRecord } => Boolean(item.contact))
    .map(item => `${item.label}: ${item.contact.name}`);
}

function getPropertyDeadline(property: PropertyRecord): { date: string; label: string } | null {
  if (property.targetDeadline) return { date: property.targetDeadline, label: "Target completion / loan deadline" };
  const candidates: Record<string, Array<[string,string]>> = {
    "Property Sale": [["targetClosingDate","Target closing / registration date"]],
    "Property Loans": [["targetSanctionDate","Target sanction date"],["targetDisbursementDate","Target disbursement date"]],
    "JV / JDA / JD": [["targetSigningDate","Target agreement signing"],["targetHandoverDate","Target handover / possession"]],
    "SR Rate Settlement": [["targetSettlementDate","Target settlement date"]],
    "Agricultural Land": [["targetDueDiligenceDate","Target due-diligence completion"],["targetClosingDate","Target acquisition / registration"]],
    "Commercial Land": [["targetClosingDate","Target closing / registration date"]],
    "Startup": [["targetCloseDate","Target close date"]],
    "Equity": [["targetExitDate","Target exit / review date"]],
    "Unsecured Company Loan": [["targetDisbursementDate","Target disbursement date"],["maturityDate","Maturity date"]],
    "Personal Loan": [["targetSanctionDate","Target sanction date"],["targetDisbursementDate","Target disbursement date"],["firstEmiDate","First EMI date"]],
    "Housing Loan": [["targetSanctionDate","Target sanction date"],["targetDisbursementDate","Target disbursement date"],["firstEmiDate","First EMI date"],["maturityDate","Maturity date"]],
    "House Purchase": [["targetRegistrationDate","Target registration date"],["possessionDate","Possession date"]],
    "Litigation": [["limitationDate","Limitation / legal deadline"],["nextHearingDate","Next hearing date"]],
    "Fund & Portfolio Management": [["nextReportingDate","Next reporting deadline"]],
    "Investor Relations": [["nextContactDate","Next investor follow-up date"]],
    "Compliance & KYC": [["reviewDueDate","Next KYC review date"]]
  };
  for (const [key,label] of candidates[property.module] ?? []) {
    const date = property.moduleData?.[key];
    if (date) return { date, label };
  }
  return null;
}

type RelationshipHubProps = {
  properties: PropertyRecord[];
  contacts: ContactRecord[];
  tasks: TaskRecord[];
  financials: FinancialRecord[];
  today: string;
  onEditProperty: (property: PropertyRecord) => void;
  onAddProperty: () => void;
  onAddContact: () => void;
  onOpenContacts: () => void;
  onOpenTasks: () => void;
  onSchedule: (property: PropertyRecord, contact?: ContactRecord) => void;
  onWhatsApp: (contactId?: string, propertyId?: string, taskId?: string, taskTitle?: string) => void;
  onEditTask: (task: TaskRecord) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
};
function RelationshipHub({properties,contacts,tasks,financials,today,onEditProperty,onAddProperty,onAddContact,onOpenContacts,onOpenTasks,onSchedule,onWhatsApp,onEditTask,onToggleTask,onDeleteTask}:RelationshipHubProps) {
  const resolveContact=(property:PropertyRecord)=>contacts.find(contact=>contact.id===property.primaryContactId)
    || contacts.find(contact=>contact.name.trim().toLowerCase()===(property.contact || "").trim().toLowerCase());
  const activeProperties=properties.filter(property=>!["Completed","Closed","Settled"].includes(property.status));
  const overdueDeadlines=activeProperties.filter(property=>{const deadline=getPropertyDeadline(property);return Boolean(deadline && deadline.date<today);});
  const overdueFollowups=activeProperties.filter(property=>Boolean(property.nextFollowUpDate && property.nextFollowUpDate<today));
  const openTasks=tasks.filter(task=>!task.done).sort((a,b)=>`${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const orderedProperties=[...properties].sort((a,b)=>(getPropertyDeadline(a)?.date || a.nextFollowUpDate || "9999-12-31").localeCompare(getPropertyDeadline(b)?.date || b.nextFollowUpDate || "9999-12-31"));
  return <section className="data-panel relationship-hub">
    <div className="section-heading"><div><span className="section-kicker">CONNECTED CLIENT WORKFLOW</span><h2>Client, deal and loan control</h2><p>One linked view across all 16 business modules: clients, properties/deals, money movement, calls, follow-ups and deadlines.</p></div><div className="finance-actions"><button className="secondary-button" onClick={onAddContact}><Plus size={15}/> Add contact</button><button className="primary-button" onClick={onAddProperty}><Plus size={15}/> Add deal / property</button></div></div>
    <div className="finance-summary relationship-summary"><div><span>Contacts</span><strong>{contacts.length}</strong></div><div><span>Deal / module records</span><strong>{properties.length}</strong></div><div><span>Target deadlines overdue</span><strong>{overdueDeadlines.length}</strong></div><div><span>Follow-ups overdue</span><strong>{overdueFollowups.length}</strong></div></div>
    <div className="notice"><Handshake size={17}/>Select one saved contact on each deal record. The same contact then appears across call reminders, financial transactions, risk/approval items and WhatsApp follow-ups.</div>
    {properties.length===0 && <Empty icon={<LandPlot size={22}/>} title="Add your first deal or property record" text="Every module record can be linked to a client, deadline and next action here." action="Create deal record" onClick={onAddProperty}/>}
    {properties.length>0 && <div className="record-list">{orderedProperties.map(property=>{
      const stakeholders=getLinkedContactsForRecord(property,contacts);
      const contact=stakeholders[0] ?? resolveContact(property);
      const relatedTasks=tasks.filter(task=>(task.propertyId===property.id || (!task.propertyId && task.property===property.title)) && !task.done);
      const relatedFinancials=financials.filter(item=>item.propertyId===property.id || (!item.propertyId && item.property===property.title));
      const deadline=getPropertyDeadline(property);
      const deadlineOverdue=Boolean(deadline && deadline.date<today && !["Completed","Closed","Settled","Disbursed"].includes(property.status));
      const followupOverdue=Boolean(property.nextFollowUpDate && property.nextFollowUpDate<today);
      const recordedAmount=relatedFinancials.reduce((sum,item)=>sum+Number(item.amount||0),0);
      return <article className="record-card relationship-record" key={property.id}>
        <div className="record-symbol"><Building2 size={20}/></div>
        <div className="record-main">
          <h3>{property.title}</h3>
          <p>{property.module} <span>•</span> {property.location || "Location not entered"}</p>
          <small>Contact: {contact ? <button className="inline-link" onClick={onOpenContacts}>{contact.name} · {contact.role}</button> : <button className="inline-link" onClick={onEditProperty.bind(null,property)}>Link a contact</button>}</small>
          {contact?.phone && <small>Phone: {contact.phone}</small>}{getLinkedContactRoleLabels(property,contacts).length>0 && <small><strong>Linked roles:</strong> {getLinkedContactRoleLabels(property,contacts).join(" · ")}</small>}{stakeholders.length>1 && <small>Linked stakeholders: {stakeholders.map(item=>`${item.name} (${item.role})`).join(" · ")}</small>}
          {deadline && <small><strong>{deadline.label}:</strong> <span className={deadlineOverdue?"deadline-overdue":""}>{deadline.date}{deadlineOverdue?" · OVERDUE":""}</span></small>}
          {property.nextFollowUpDate && <small><strong>Next follow-up:</strong> <span className={followupOverdue?"deadline-overdue":""}>{property.nextFollowUpDate}{followupOverdue?" · OVERDUE":""}</span></small>}
          {property.nextAction && <small><strong>Next action:</strong> {property.nextAction}</small>}
          <small>Linked open tasks: {relatedTasks.length} · Financial records: {relatedFinancials.length} · Recorded transaction total: ₹{recordedAmount.toLocaleString("en-IN",{maximumFractionDigits:2})}</small>
          {relatedTasks.slice(0,2).map(task=><small key={task.id}>Next task: {task.title} · {task.date} {task.time}{task.contactName ? ` · ${task.contactName}` : ""}</small>)}
          <div className="linked-actions">
            <button className="secondary-button" onClick={()=>onEditProperty(property)}><Pencil size={14}/> Edit links / deadlines</button>
            {stakeholders.map(stakeholder=><span className="linked-stakeholder" key={stakeholder.id}><strong>{stakeholder.name}</strong><small>{getLinkedContactRoleLabels(property,contacts).filter(label=>label.endsWith(": "+stakeholder.name)).join(" · ") || stakeholder.role}</small>{stakeholder.phone && <a className="secondary-button" href={`tel:${stakeholder.phone}`}><Phone size={14}/> Call</a>}<button className="secondary-button" onClick={()=>onSchedule(property,stakeholder)}><CalendarClock size={14}/> Schedule call</button><button className="secondary-button" onClick={()=>onWhatsApp(stakeholder.id,property.id)}><MessageCircle size={14}/> WhatsApp</button></span>)}
          </div>
        </div>
        <div className="record-side"><strong>{property.value ? `₹ ${Number(property.value).toLocaleString("en-IN",{maximumFractionDigits:2})}` : "Value not set"}</strong><span className={`status-pill ${deadlineOverdue?"deadline-status":""}`}>{deadlineOverdue?"Deadline overdue":property.status}</span></div>
      </article>;
    })}</div>}
    <div className="section-heading"><div><span className="section-kicker">CALLS & FOLLOW-UP QUEUE</span><h2>Next actions across your contacts</h2><p>Each reminder can be linked to a person and a deal.</p></div><button className="secondary-button" onClick={onOpenTasks}>Open full schedule <ArrowUpRight size={15}/></button></div>
    {openTasks.length ? <TaskList tasks={openTasks.slice(0,8)} toggle={onToggleTask} remove={onDeleteTask} edit={onEditTask} onWhatsApp={onWhatsApp}/> : <Empty icon={<CalendarClock size={22}/>} title="No open reminders" text="Create a call, document collection, loan deadline or meeting reminder." action="Open schedule" onClick={onOpenTasks}/>}
    <div className="relationship-footer-actions"><button className="secondary-button" onClick={onOpenContacts}><Users size={15}/> Manage contacts</button><button className="secondary-button" onClick={onOpenTasks}><CalendarClock size={15}/> Manage reminders</button></div>
  </section>;
}

function Stat({label,value,icon}:{label:string;value:number|string;icon:ReactNode}) { return <div className="stat-card"><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></div>; }
function Empty({icon,title,text,action,onClick}:{icon:ReactNode;title:string;text:string;action:string;onClick:()=>void}) { return <div className="empty-state"><div className="empty-icon">{icon}</div><strong>{title}</strong><p>{text}</p><button className="secondary-button" onClick={onClick}><Plus size={15}/>{action}</button></div>; }
function TaskList({tasks,toggle,remove,edit,onWhatsApp}:{tasks:TaskRecord[];toggle:(id:string)=>void;remove:(id:string)=>void;edit?:(task:TaskRecord)=>void;onWhatsApp?:(contactId?:string,propertyId?:string,taskId?:string,taskTitle?:string)=>void}) {
  return <div className="task-list">{tasks.map(t=><article className={`task-row ${t.done?"task-done":""}`} key={t.id}><button className="task-check" onClick={()=>toggle(t.id)} aria-label={t.done?"Mark incomplete":"Mark complete"}><CircleCheck size={20}/></button><div className="task-details"><strong>{t.title}</strong><p><CalendarDays size={14}/>{t.date} <span>•</span> {t.time} <span>•</span> {t.type}</p>{t.property&&<small>Deal: {t.property}</small>}{t.contactName&&<small>Contact: {t.contactName}</small>}{t.notes&&<small>{t.notes}</small>}</div>{edit && <button className="edit-button" onClick={()=>edit(t)} aria-label={`Edit ${t.title}`}><Pencil size={15}/></button>}{onWhatsApp && t.contactId && <button className="edit-button" onClick={()=>onWhatsApp(t.contactId,t.propertyId,t.id,t.title)} aria-label={`Schedule WhatsApp for ${t.title}`} title="Schedule WhatsApp"><MessageCircle size={15}/></button>}<button className="delete-button" onClick={()=>remove(t.id)} aria-label="Delete task"><Trash2 size={15}/></button></article>)}</div>;
}
function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}) { return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><h2>{title}</h2><button onClick={onClose} aria-label="Close"><X size={19}/></button></div>{children}</section></div>; }
function PropertyForm({defaultModule,contacts,initial,onSave,onCancel}:{defaultModule:string;contacts:ContactRecord[];initial?:PropertyRecord|null;onSave:(v:Omit<PropertyRecord,"id"|"createdAt">)=>void;onCancel:()=>void}) {
  const [form,setForm]=useState({
    title:initial?.title ?? "",module:initial?.module ?? defaultModule,location:initial?.location ?? "",
    value:initial?.value ?? "",status:initial?.status ?? "Active",contact:initial?.contact ?? "",
    primaryContactId:initial?.primaryContactId ?? contacts.find(item=>item.name.trim().toLowerCase()===(initial?.contact ?? "").trim().toLowerCase())?.id ?? "",
    targetDeadline:initial?.targetDeadline ?? "",nextFollowUpDate:initial?.nextFollowUpDate ?? "",
    nextAction:initial?.nextAction ?? "",notes:initial?.notes ?? "",
    surveyNumber:initial?.surveyNumber ?? "",ownershipDetails:initial?.ownershipDetails ?? "",areaValue:initial?.areaValue ?? "",
    areaUnit:initial?.areaUnit ?? "sq ft",dimensions:initial?.dimensions ?? "",ratePerUnit:initial?.ratePerUnit ?? "",
    moduleData:initial?.moduleData ?? {}
  });
  const update=(key:string,value:string)=>setForm(previous=>({...previous,[key]:value}));
  const selectedFields=moduleFields[form.module] ?? [];
  return <form className="form-card" onSubmit={event=>{event.preventDefault();if(form.title.trim())onSave(form);}}>
    <div className="form-section-title"><span className="section-kicker">RECORD IDENTITY</span><p>Use the same contact record across every business module. This creates a reusable link across the workspace.</p></div>
    <label>Record / deal name *<input required value={form.title} onChange={event=>update("title",event.target.value)} placeholder="e.g. Apartment purchase / Housing loan file"/></label>
    <label>Business module<select value={form.module} onChange={event=>{const module=event.target.value;setForm(previous=>({...previous,module,moduleData:Object.fromEntries(Object.entries(previous.moduleData).filter(([key])=>!key.startsWith("__contact_")))}));}}>{modules.map(module=><option key={module.name}>{module.name}</option>)}</select></label>
    <div className="form-two"><label>Location / jurisdiction<input value={form.location} onChange={event=>update("location",event.target.value)} placeholder="City, state, country or court"/></label><label>Headline value / exposure (₹)<input type="number" min="0" step="0.01" value={form.value} onChange={event=>update("value",event.target.value)} placeholder="Enter amount"/></label></div>
    <div className="form-two"><label>Record status<select value={form.status} onChange={event=>update("status",event.target.value)}>{["Active","Under review","Negotiation","On hold","Completed","Closed","Filed","Awaiting documents","Due diligence","Term sheet","Disbursed","Repayment","Default","Hearing scheduled","Settled"].map(status=><option key={status}>{status}</option>)}</select></label><label>Primary contact<select size={Math.min(Math.max(contacts.length,3),5)} value={form.primaryContactId} onChange={event=>{const id=event.target.value;setForm(previous=>({...previous,primaryContactId:id,contact:contacts.find(item=>item.id===id)?.name ?? ""}));}}><option value="">No contact linked</option>{contacts.map(contact=><option key={contact.id} value={contact.id}>{contact.name}{contact.whatsappName && contact.whatsappName !== contact.name ? " · WhatsApp: " + contact.whatsappName : ""} · {contact.role}{contact.phone ? ` · ${contact.phone}` : ""}</option>)}</select></label></div>
    {form.contact && !form.primaryContactId && <p className="form-help">This older record has a contact name but no linked contact entry yet. Add/select the person in Contacts to create the connection.</p>}
    <label>Other linked stakeholders (select multiple)<select multiple size={Math.min(Math.max(contacts.length,3),6)} value={(form.moduleData.__linkedContactIds ?? "").split(",").filter(Boolean)} onChange={event=>{const ids=Array.from(event.target.selectedOptions,option=>option.value);setForm(previous=>({...previous,moduleData:{...previous.moduleData,__linkedContactIds:ids.join(",")}}));}}><option value="" disabled>Select stakeholders below</option>{contacts.map(contact=><option key={contact.id} value={contact.id}>{contact.name}{contact.whatsappName && contact.whatsappName !== contact.name ? " · WhatsApp: " + contact.whatsappName : ""} · {contact.role}{contact.phone ? ` · ${contact.phone}` : ""}</option>)}</select><small>Use contact roles to capture borrowers, lenders, owners, brokers, lawyers, loan officers and other stakeholders on the same deal.</small></label>
    {(moduleContactFields[form.module] ?? []).length > 0 && <div className="module-data-section"><div className="form-section-title"><span className="section-kicker">ROLE-SPECIFIC CONTACT LINKS</span><p>Choose the actual saved contact for each role. This makes the lender, borrower, owner and person-to-call traceable across the workspace.</p></div><div className="module-data-grid">{(moduleContactFields[form.module] ?? []).map(field=><label key={field.key}>{field.label}<select value={form.moduleData[field.key] ?? ""} size={Math.min(Math.max(contacts.length,3),5)} onChange={event=>setForm(previous=>({...previous,moduleData:{...previous.moduleData,[field.key]:event.target.value}}))}><option value="">Not linked</option>{contacts.map(contact=><option key={contact.id} value={contact.id}>{contact.name}{contact.whatsappName && contact.whatsappName !== contact.name ? " · WhatsApp: " + contact.whatsappName : ""} · {contact.role}{contact.phone ? ` · ${contact.phone}` : ""}</option>)}</select></label>)}</div></div>}
    <div className="property-detail-section"><div className="form-section-title"><span className="section-kicker">DEAL DEADLINES & NEXT ACTION</span><p>Use this for loan approval/disbursement deadlines, property registration, document collection or any other module milestone.</p></div>
      <div className="form-two"><label>Target completion / loan deadline<input type="date" value={form.targetDeadline} onChange={event=>update("targetDeadline",event.target.value)}/></label><label>Next contact / follow-up date<input type="date" value={form.nextFollowUpDate} onChange={event=>update("nextFollowUpDate",event.target.value)}/></label></div>
      <label>Next action / person to call<input value={form.nextAction} onChange={event=>update("nextAction",event.target.value)} placeholder="e.g. Call loan officer for sanction update; ask client for bank statement"/></label>
    </div>
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
  const roleOptions=["Client","Mediator","Funder","Landowner","Property buyer","Property seller","Builder / developer","Borrower","Lender","Investor","Company owner / director","Broker / agent","Professional adviser","Guarantor","JV / JDA partner","Advocate","Contractor","Employee / salaried","Supplier / vendor","Introducer / referral partner","Tenant","Loan officer","Bank relationship manager","Auditor","Valuer / surveyor","Document agent","KYC / compliance provider","Other"];
  const initialRoles=initial?.roles?.length ? initial.roles : initial?.role ? [initial.role] : ["Client"];
  const [form,setForm]=useState({name:initial?.name ?? "",phone:initial?.phone ?? "",role:initial?.role ?? initialRoles[0] ?? "Client",roles:initialRoles,customRoles:initial?.customRoles ?? "",email:initial?.email ?? "",address:initial?.address ?? "",profession:initial?.profession ?? "",employer:initial?.employer ?? "",designation:initial?.designation ?? "",businessType:initial?.businessType ?? "",incomeSources:initial?.incomeSources ?? "",associatedCompany:initial?.associatedCompany ?? "",relationshipNotes:initial?.relationshipNotes ?? "",notes:initial?.notes ?? ""});
  const update=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));
  const toggleRole=(role:string,checked:boolean)=>setForm(p=>({...p,roles:checked?[...p.roles,role]:p.roles.filter(item=>item!==role),role:checked&&p.roles.length===0?role:p.role}));
  return <form className="form-card ax-contact-intelligence-form" onSubmit={e=>{e.preventDefault();if(form.name.trim())onSave({...form,role:form.roles[0]||form.role,roles:form.roles});}}>
    <h3>Identity & contact</h3>
    <label>Full / legal name *<input required value={form.name} onChange={e=>update("name",e.target.value)} placeholder="Contact or company name"/></label>
    <div className="form-two"><label>Phone / WhatsApp<input value={form.phone} onChange={e=>update("phone",e.target.value)} placeholder="+91..."/></label><label>Email<input type="email" value={form.email} onChange={e=>update("email",e.target.value)} placeholder="name@company.com"/></label></div>
    <label>Address<input value={form.address} onChange={e=>update("address",e.target.value)} placeholder="Optional address"/></label>
    <h3>Multiple roles <small>Select every role that applies</small></h3>
    <div className="ax-role-picker">{roleOptions.map(role=><label key={role} className={form.roles.includes(role)?"selected":""}><input type="checkbox" checked={form.roles.includes(role)} onChange={e=>toggleRole(role,e.target.checked)}/><span>{role}</span></label>)}</div>
    <label>Custom roles (comma-separated)<input value={form.customRoles} onChange={e=>update("customRoles",e.target.value)} placeholder="Add roles not listed above"/></label>
    <h3>Profession, employment & business</h3>
    <div className="form-two"><label>Profession / occupation<input value={form.profession} onChange={e=>update("profession",e.target.value)} placeholder="e.g. manufacturer, consultant"/></label><label>Employer / business<input value={form.employer} onChange={e=>update("employer",e.target.value)} placeholder="Company or employer"/></label></div>
    <div className="form-two"><label>Designation<input value={form.designation} onChange={e=>update("designation",e.target.value)} placeholder="Director, manager, employee…"/></label><label>Business / employment type<input value={form.businessType} onChange={e=>update("businessType",e.target.value)} placeholder="Salaried, proprietor, partner, director…"/></label></div>
    <div className="form-two"><label>Associated company / entities<input value={form.associatedCompany} onChange={e=>update("associatedCompany",e.target.value)} placeholder="Companies or businesses"/></label><label>Income sources (optional)<input value={form.incomeSources} onChange={e=>update("incomeSources",e.target.value)} placeholder="Salary, rent, agriculture, business…"/></label></div>
    <label>Relationship / referral context<textarea rows={2} value={form.relationshipNotes} onChange={e=>update("relationshipNotes",e.target.value)} placeholder="Who introduced this person? Relevant business connections…"/></label>
    <label>Notes / verification context<textarea rows={3} value={form.notes} onChange={e=>update("notes",e.target.value)} placeholder="Keep sensitive details minimal and record source/verification where relevant."/></label>
    <p className="ax-form-note">Optional fields may be left blank. A contact can hold several roles at once; the role used in a particular deal should be recorded separately on that deal.</p>
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="submit" className="primary-button">{initial ? "Save changes" : "Save master contact"}</button></div>
  </form>;
}
function TaskForm({properties,contacts,initial,defaultValues,onSave,onCancel}:{properties:PropertyRecord[];contacts:ContactRecord[];initial?:TaskRecord|null;defaultValues?:Partial<TaskRecord>|null;onSave:(v:Omit<TaskRecord,"id"|"done">)=>void;onCancel:()=>void}) {
  const [form,setForm]=useState(()=>{
    const selectedPropertyId=initial?.propertyId || defaultValues?.propertyId || properties.find(item=>item.title===initial?.property)?.id || "";
    const selectedContactId=initial?.contactId || defaultValues?.contactId || contacts.find(item=>item.name.trim().toLowerCase()===(initial?.contactName ?? "").trim().toLowerCase())?.id || "";
    return {title:initial?.title ?? defaultValues?.title ?? "",date:initial?.date ?? defaultValues?.date ?? new Date().toISOString().slice(0,10),
      time:initial?.time ?? defaultValues?.time ?? "10:00",type:initial?.type ?? defaultValues?.type ?? "Follow-up",
      propertyId:selectedPropertyId,property:initial?.property ?? defaultValues?.property ?? properties.find(item=>item.id===selectedPropertyId)?.title ?? "",
      contactId:selectedContactId,contactName:initial?.contactName ?? defaultValues?.contactName ?? contacts.find(item=>item.id===selectedContactId)?.name ?? "",
      notes:initial?.notes ?? defaultValues?.notes ?? ""};
  });
  const update=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));
  return <form className="form-card" onSubmit={e=>{e.preventDefault();if(form.title.trim())onSave({...form,property:properties.find(item=>item.id===form.propertyId)?.title ?? form.property,contactName:contacts.find(item=>item.id===form.contactId)?.name ?? form.contactName});}}>
    <label>Task / reminder *<input required value={form.title} onChange={e=>update("title",e.target.value)} placeholder="e.g. Call loan officer about sanction status"/></label>
    <div className="form-two"><label>Date *<input required type="date" value={form.date} onChange={e=>update("date",e.target.value)}/></label><label>Time *<input required type="time" value={form.time} onChange={e=>update("time",e.target.value)}/></label></div>
    <div className="form-two"><label>Task type<select value={form.type} onChange={e=>update("type",e.target.value)}>{["Call","WhatsApp follow-up","Loan processing","Loan deadline","Document collection","Follow-up","Meeting","Payment","Registration","Document deadline","Site visit","Other"].map(value=><option key={value}>{value}</option>)}</select></label><label>Related deal / property<select value={form.propertyId} onChange={e=>{const id=e.target.value;setForm(p=>({...p,propertyId:id,property:properties.find(item=>item.id===id)?.title ?? ""}));}}><option value="">None selected</option>{properties.map(p=><option key={p.id} value={p.id}>{p.title} · {p.module}</option>)}</select></label></div>
    <label>Related contact<select size={Math.min(Math.max(contacts.length,3),5)} value={form.contactId} onChange={e=>{const id=e.target.value;setForm(p=>({...p,contactId:id,contactName:contacts.find(item=>item.id===id)?.name ?? ""}));}}><option value="">No contact selected</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.name} · {c.role}{c.phone ? ` · ${c.phone}` : ""}</option>)}</select></label>
    <label>Notes<textarea rows={3} value={form.notes} onChange={e=>update("notes",e.target.value)} placeholder="What to ask, what is pending, and next step"/></label>
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="submit" className="primary-button">{initial ? "Save changes" : "Save task"}</button></div>
  </form>;
}
function FinancialForm({properties,contacts,initial,onSave,onCancel}:{properties:PropertyRecord[];contacts:ContactRecord[];initial?:FinancialRecord|null;onSave:(value:Omit<FinancialRecord,"id">)=>void;onCancel:()=>void}) {
  const [form,setForm]=useState(()=>{
    const contactId=initial?.contactId || contacts.find(item=>item.name.trim().toLowerCase()===(initial?.party ?? "").trim().toLowerCase())?.id || "";
    return {propertyId:initial?.propertyId ?? "",property:initial?.property ?? "",contactId,type:initial?.type ?? "Receipt",
      amount:initial?.amount ?? "",date:initial?.date ?? new Date().toISOString().slice(0,10),party:initial?.party ?? "",
      reference:initial?.reference ?? "",notes:initial?.notes ?? ""};
  });
  const update=(key:string,value:string)=>setForm(previous=>({...previous,[key]:value}));
  const types=["Purchase","Sale","Advance","Loan Disbursal","Loan Repayment","Interest","Instalment","Brokerage","Expense","Receipt","Settlement","Other"];
  return <form className="form-card" onSubmit={event=>{event.preventDefault();if(form.amount.trim() && Number(form.amount)>=0){const property=properties.find(item=>item.id===form.propertyId);const contact=contacts.find(item=>item.id===form.contactId);onSave({...form,property:property?.title ?? form.property,party:contact?.name ?? form.party});}}}>
    <div className="form-two"><label>Transaction type<select value={form.type} onChange={event=>update("type",event.target.value)}>{types.map(type=><option key={type}>{type}</option>)}</select></label><label>Amount (₹) *<input required type="number" min="0" step="0.01" value={form.amount} onChange={event=>update("amount",event.target.value)} placeholder="0.00"/></label></div>
    <div className="form-two"><label>Date *<input required type="date" value={form.date} onChange={event=>update("date",event.target.value)}/></label><label>Related deal / property<select value={form.propertyId} onChange={event=>{const value=event.target.value;update("propertyId",value);update("property",properties.find(item=>item.id===value)?.title ?? "");}}><option value="">No property selected</option>{properties.map(property=><option key={property.id} value={property.id}>{property.title} · {property.module}</option>)}</select></label></div>
    <label>Related contact<select size={Math.min(Math.max(contacts.length,3),5)} value={form.contactId} onChange={event=>{const id=event.target.value;setForm(previous=>({...previous,contactId:id,party:contacts.find(item=>item.id===id)?.name ?? previous.party}));}}><option value="">Select borrower / lender / counterparty</option>{contacts.map(contact=><option key={contact.id} value={contact.id}>{contact.name}{contact.whatsappName && contact.whatsappName !== contact.name ? " · WhatsApp: " + contact.whatsappName : ""} · {contact.role}</option>)}</select></label>
    <div className="form-two"><label>Party / counterparty name<input value={form.party} onChange={event=>update("party",event.target.value)} placeholder="Borrower, lender, buyer or seller"/></label><label>Reference number<input value={form.reference} onChange={event=>update("reference",event.target.value)} placeholder="Receipt / bank reference"/></label></div>
    <label>Notes<textarea rows={3} value={form.notes} onChange={event=>update("notes",event.target.value)} placeholder="Payment method, interest period, settlement details"/></label>
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="submit" className="primary-button">{initial ? "Save changes" : "Save transaction"}</button></div>
  </form>;
}
function RiskForm({properties,contacts,onSave,onCancel}:{properties:PropertyRecord[];contacts:ContactRecord[];onSave:(value:Omit<RiskRecord,"id"|"createdAt">)=>void;onCancel:()=>void}) {
  const [form,setForm]=useState({title:"",category:"Legal",severity:"High",status:"Open",owner:"",dueDate:"",entity:"",propertyId:"",contactId:"",mitigation:""});
  const update=(key:string,value:string)=>setForm(previous=>({...previous,[key]:value}));
  return <form className="form-card" onSubmit={event=>{event.preventDefault();if(form.title.trim())onSave(form);}}>
    <label>Risk title *<input required value={form.title} onChange={event=>update("title",event.target.value)} placeholder="Describe the risk or control gap"/></label>
    <div className="form-two"><label>Risk category<select value={form.category} onChange={event=>update("category",event.target.value)}>{["Credit","Financial","Legal","Operational","Market","Compliance","Fraud","Cybersecurity","Data","Reputational","Other"].map(value=><option key={value}>{value}</option>)}</select></label><label>Severity<select value={form.severity} onChange={event=>update("severity",event.target.value)}>{["Low","Medium","High","Critical"].map(value=><option key={value}>{value}</option>)}</select></label></div>
    <div className="form-two"><label>Status<select value={form.status} onChange={event=>update("status",event.target.value)}>{["Open","Mitigating","Monitoring","Closed"].map(value=><option key={value}>{value}</option>)}</select></label><label>Owner<input value={form.owner} onChange={event=>update("owner",event.target.value)} placeholder="Responsible person / team"/></label></div>
    <div className="form-two"><label>Linked deal / matter<select value={form.propertyId} onChange={event=>{const id=event.target.value;setForm(p=>({...p,propertyId:id,entity:properties.find(item=>item.id===id)?.title ?? ""}));}}><option value="">Not linked</option>{properties.map(property=><option key={property.id} value={property.id}>{property.title} · {property.module}</option>)}</select></label><label>Action due date<input type="date" value={form.dueDate} onChange={event=>update("dueDate",event.target.value)}/></label></div>
    <label>Related contact<select size={Math.min(Math.max(contacts.length,3),5)} value={form.contactId} onChange={event=>update("contactId",event.target.value)}><option value="">No contact selected</option>{contacts.map(contact=><option key={contact.id} value={contact.id}>{contact.name}{contact.whatsappName && contact.whatsappName !== contact.name ? " · WhatsApp: " + contact.whatsappName : ""} · {contact.role}</option>)}</select></label>
    <label>Mitigation / next control action<textarea rows={3} value={form.mitigation} onChange={event=>update("mitigation",event.target.value)} placeholder="Control owner, evidence, action and target"/></label>
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="submit" className="primary-button">Save risk</button></div>
  </form>;
}
function ApprovalForm({properties,contacts,onSave,onCancel}:{properties:PropertyRecord[];contacts:ContactRecord[];onSave:(value:Omit<ApprovalRequest,"id"|"requestedAt"|"decidedAt"|"decisionNotes"|"status">)=>void;onCancel:()=>void}) {
  const [form,setForm]=useState({title:"",area:"Investment",entity:"",propertyId:"",contactId:"",requestedBy:"",approver:"",priority:"Normal",rationale:""});
  const update=(key:string,value:string)=>setForm(previous=>({...previous,[key]:value}));
  return <form className="form-card" onSubmit={event=>{event.preventDefault();if(form.title.trim())onSave(form);}}>
    <label>Decision / approval requested *<input required value={form.title} onChange={event=>update("title",event.target.value)} placeholder="e.g. Approve loan disbursal / settlement"/></label>
    <div className="form-two"><label>Approval area<select value={form.area} onChange={event=>update("area",event.target.value)}>{["Investment","Equity","Credit","Property purchase","Property sale","Payment","Settlement","Legal filing","Expense","Document release","Other"].map(value=><option key={value}>{value}</option>)}</select></label><label>Priority<select value={form.priority} onChange={event=>update("priority",event.target.value)}>{["Low","Normal","High","Urgent"].map(value=><option key={value}>{value}</option>)}</select></label></div>
    <label>Linked deal / record<select value={form.propertyId} onChange={event=>{const id=event.target.value;setForm(p=>({...p,propertyId:id,entity:properties.find(item=>item.id===id)?.title ?? ""}));}}><option value="">Not linked</option>{properties.map(property=><option key={property.id} value={property.id}>{property.title} · {property.module}</option>)}</select></label>
    <label>Related contact<select size={Math.min(Math.max(contacts.length,3),5)} value={form.contactId} onChange={event=>update("contactId",event.target.value)}><option value="">No contact selected</option>{contacts.map(contact=><option key={contact.id} value={contact.id}>{contact.name}{contact.whatsappName && contact.whatsappName !== contact.name ? " · WhatsApp: " + contact.whatsappName : ""} · {contact.role}</option>)}</select></label>
    <div className="form-two"><label>Requested by<input value={form.requestedBy} onChange={event=>update("requestedBy",event.target.value)} placeholder="Requestor name"/></label><label>Approver / reviewer<input value={form.approver} onChange={event=>update("approver",event.target.value)} placeholder="Reviewer name"/></label></div>
    <label>Rationale and supporting evidence<textarea rows={3} value={form.rationale} onChange={event=>update("rationale",event.target.value)} placeholder="Why approval is required; evidence to review"/></label>
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="submit" className="primary-button">Submit request</button></div>
  </form>;
}
