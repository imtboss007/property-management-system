# AXIVESTRA — Canonical Product Architecture

**Product identity:** Multi-Asset, Capital & Relationship Intelligence Operating Platform  
**Repository:** `imtboss007/property-management-system`  
**Status:** Product architecture baseline and implementation-gap register  
**Rule:** A navigation effect or animated dashboard is never accepted as a substitute for a working domain capability or intelligence service.

## 1. What AXIVESTRA is

AXIVESTRA is a connected operating and intelligence platform that helps an asset/investment business capture, connect, understand, control and act on assets, capital, counterparties, transactions, legal matters and obligations.

The core product is the **intelligence layer over a trusted connected system of record**. It must answer, with traceable evidence:

- What assets, deals, loans, investments, funds and legal matters exist?
- Who owns, funds, borrows, lends, advises, guarantees, represents or participates in each?
- What money has been committed, deployed, received, paid, repaid or remains outstanding?
- What is verified, unverified, missing, stale, disputed or at risk?
- What deadlines, covenants, hearings, KYC reviews, approvals and commitments require action?
- How are counterparties, entities, assets, deals, loans, funds and cases connected?
- What decision is required next, what evidence supports it, and what assumptions remain?

AXIVESTRA is not an orbital dashboard, a property CRM alone, a static contact book, or a generic task manager. These are supporting capabilities inside a broader asset-intelligence operating system.

## 2. Product domains

Preserve all 16 existing workspaces and add Sharing Property as the 17th core domain entry point. None may be deleted or collapsed:

| Domain | Existing workspaces |
|---|---|
| Real assets and transactions | Property Sale; Agricultural Land; Commercial Land; House Purchase |
| Development and settlement | JV / JDA / JD; SR Rate Settlement |
| Credit and lending | Property Loans; Unsecured Company Loan; Personal Loan; Housing Loan |
| Ventures and securities | Startup; Equity |
| Funds and investor services | Fund & Portfolio Management; Investor Relations |
| Legal and governance | Litigation; Compliance & KYC |

Cross-domain capabilities are shared services, not additional unrelated silos:
- Master people and organisation directory
- Deal-specific parties and roles
- Financial ledger / transaction register
- Document and evidence vault
- Tasks, commitments and follow-ups
- Risk register and controls
- Approval and decision log
- Communications and consent
- Audit and data-quality history
- Search, analytics and reporting

## 3. Target architecture

### A. System-of-record layer

Use explicit, versioned entities with stable IDs. Target entities include:
- Person and organisation
- Asset / property
- Opportunity / deal / transaction
- Credit facility / loan
- Investment position / security
- Fund / portfolio
- Investor / commitment / capital call
- Legal matter / case / hearing / filing / order
- Financial transaction / repayment / distribution
- Document / evidence item / version
- Task / commitment / reminder
- Risk / control / screening result
- Approval / decision / audit event

Each domain entity retains its specific fields, statuses, lifecycle and validation rules. Shared record fields do not replace domain-specific data.

### B. Relationship graph

Relationships must use stable IDs, not display-name matching. The graph must support:
- Person ↔ organisation, role and representation
- Person ↔ deal-specific party role
- Asset ↔ owner, co-owner, tenant, buyer, seller and collateral
- Deal ↔ parties, assets, facilities, milestones and evidence
- Facility ↔ borrower, lender, guarantor, collateral, terms, repayments and maturity
- Investment ↔ issuer, investor, fund, security, commitment and valuation
- Fund ↔ investors, commitments, capital calls, distributions and underlying positions
- Legal matter ↔ parties, counsel, assets, deals, facilities, filings, hearings, orders and evidence
- Financial movement ↔ payer, payee, source, purpose and related entity
- Task / commitment ↔ owner, responsible party, due date and linked entity

A relationship must carry type, source, effective dates, verification state and audit history where relevant. Legacy name-only matches may be suggested for review; they must not silently create or merge identity.

### C. Intelligence services

1. **Asset intelligence:** asset register, ownership/interest, title and diligence state, location, comparables, valuation provenance, condition, encumbrances and lifecycle.
2. **Capital intelligence:** commitments, deployments, receipts, debt, repayment schedules, outstanding exposure, interest, cashflow, fund allocation and counterparty exposure.
3. **Investment intelligence:** positions, instruments, cost basis, valuations, performance, concentration, liquidity and exit milestones.
4. **Investor intelligence:** investor profiles, mandates, sectors, ticket sizes, geography, relationship history, commitments, KYC state and source provenance. External sourcing/enrichment requires a compliant, licensed provider or a verified public-source ingestion process.
5. **Legal intelligence:** matter chronology, court/case identifiers, parties, counsel, hearings, limitation dates, filings, orders, evidence and linked financial/property exposure.
6. **Risk and compliance intelligence:** policy rules, KYC/beneficial-owner evidence, screening source, alert state, reviewer, risk rationale, remediation and next review.
7. **Operational intelligence:** overdue and upcoming actions, stalled workflows, unassigned responsibilities, expiring documents, covenants, approvals and unresolved blockers.
8. **Portfolio intelligence:** exposure by domain, asset class, geography, counterparty, status and maturity; capital movement; concentration; record completeness; scenario assumptions; and decision readiness.

Every output must show whether it is a recorded fact, derived calculation, user-entered assessment, external sourced result, assumption or forecast. Each calculation must expose its inputs and rules.

### D. Decision and execution layer

- Surface the next required action and responsible owner.
- Explain the evidence and rules that caused a signal.
- Show missing inputs and confidence/verification limitations.
- Support what-if scenarios without overwriting actuals.
- Require human approval for legally, financially or operationally consequential actions.
- Record who decided, when, against which evidence and under which version of the rule.
- Automate only where the event source, permissions, consent, schedule and failure handling are implemented and tested.

## 4. Experience architecture

The application must present the product in this order:

1. **Asset Intelligence Overview** — the default landing page. Show portfolio/exposure position, capital movement, pipeline status, concentration, critical risks, obligations, upcoming milestones, approvals and data-quality signals.
2. **Intelligence Hub** — cross-domain analysis, record-derived intelligence, explainable signals, relationship summaries and decision support.
3. **Domain workspaces** — the 16 existing workspaces, each with domain-specific record fields, workflow, linked parties, evidence, timeline, analytics and completeness.
4. **Cross-domain operations** — contacts/organisations, deals, tasks, follow-ups, financials, documents, risks, compliance and approvals.
5. **Workspace Explorer** — optional orbital/grid visual navigation to open the 17 core workspaces and any custom workspaces. It is not the product home, an intelligence engine or a data model.

Desktop, tablet and mobile must preserve the same workflows and underlying records. Interaction affordances must actually work; decorative controls are not acceptance criteria.

## 5. Current implementation assessment

This is a code/document review, not a production certification.

| Capability | Observed in repository | Maturity |
|---|---|---|
| 17 core domain workspaces and field maps | Present in `src/App.tsx` | Implemented foundation |
| Shared property/deal record workbench | Cards, table, pipeline, analytics and data-health views in `src/ModuleWorkbench.tsx` | Partial; domain-specific depth varies |
| Contact directory and multiple roles | Present; additional roles/profile details are stored on contact records | Partial |
| Role-in-record links | Primary and role-specific contact IDs are stored in existing records; the new relationship resolver reads those IDs without name matching | Partial foundation; not a normalized person/organisation graph or complete role coverage |
| Tasks, financials, risks, approvals and follow-ups | Present as separate collections; explicit contactId links are used by the relationship resolver, while entity linkage varies by record type | Partial; broader entity links and workflow coverage remain incomplete |
| Documents | IndexedDB document vault exists | Partial; file bytes remain local to the device |
| Portfolio and cashflow charts | Derived from stored records | Basic record-derived analytics |
| Cross-workspace relationship intelligence | Read-only contact relationship summary from explicit IDs on workspace records, tasks, financials, risks, approvals and documents; unresolved IDs are surfaced | First usable slice; organisation/entity graph, deal-specific canonical party links, verification and relationship history remain future work |
| Intent Canvas | Panels, rule/keyword command handling and saved layout exist | Basic rule-based navigation/summary; not a general AI reasoning engine |
| Orbital workspace visual | Present | Navigation only |
| Cloud and device sync | Auth/company and sync code plus migrations exist; configuration and end-to-end acceptance are required | Conditional / not universally verified |
| External asset/market data | No connected provider evidenced in this repository review | Not implemented |
| Global investor sourcing and enrichment | Investor Relations data-entry workspace exists; external investor discovery is not evidenced | Not implemented |
| Automated legal research / court integrations | Litigation record fields exist; verified legal data integrations are not evidenced | Not implemented |
| Third-party KYC/sanctions screening | Compliance fields exist; a verified screening provider is not evidenced | Not implemented |
| Predictive AI / autonomous decisions | No validated predictive model or general reasoning service evidenced | Not implemented |
| Reliable background reminders | Task page currently identifies reminders as stored reminders, not guaranteed alarms | Not implemented as a dependable service |

### Important data-quality limitation

The application has a shared `PropertyRecord`-shaped collection for records across the 16 modules. Domain-specific values are stored in a flexible `moduleData` string map. The shared `value` field is also used as generic value/exposure across workspaces. Therefore, a sum of `value` across every module must be labelled **recorded value / exposure**, not net asset value, asset allocation, total wealth or a reconciled balance sheet. Debt, claim exposure, fund NAV and real-asset value must be separated by typed financial meaning before those conclusions are presented.

## 6. Delivery order and gates

### Gate 0 — Product and experience correction
- Default landing page is the asset-intelligence overview.
- Orbital interface is moved to a dedicated Workspace Explorer destination.
- Dashboard terminology distinguishes recorded amount/exposure from verified valuation.
- Product README and architecture document state what exists and what is not connected.
- No legacy module, record, local database or cloud schema is removed.

### Gate 1 — Canonical data model
- Define typed entities and explicit foreign-key relationships.
- Map every legacy field and ID to the canonical model.
- Add versioned, additive migrations only.
- Include idempotency, conflict resolution, tenant isolation and audit history.
- Build migration reconciliation reports and rollback paths before data movement.

### Gate 2 — Relationship intelligence
- Deal-party links with transaction-specific roles.
- Organisation ownership/representation and asset interests.
- One relationship graph across assets, counterparties, facilities, investments, funds, cases, evidence and money movements.
- Traceable relationship sources and verification state.
- No inferred/auto-merged relationships without review.

### Gate 3 — Domain intelligence engines
Build and validate separate engines for asset/title/valuation, credit/lending, investment/funds, investor relations, legal matters, compliance/risk and operational commitments. Each engine needs typed inputs, rules, provenance, test fixtures, exception handling and explicit outputs.

### Gate 4 — Verified external data
Select providers and official sources per jurisdiction and business need. Validate licenses, lawful basis, source reliability, update cadence, attribution, caching and failure states. Never label manually entered data as externally verified.

### Gate 5 — Explainable decision support
- Scenario model with explicit editable assumptions.
- Risk and concentration analysis with source-linked reasoning.
- Recommendations with rationale, evidence, constraints and confidence limits.
- Human review / approval gates for consequential recommendations.
- No autonomous legal, investment, credit or compliance decision.

### Gate 6 — Operational automation
- Dependable event or server-based reminders.
- Retry, deduplication, audit and failure notifications.
- Provider consent and communication opt-out handling.
- End-to-end tests for actual provider delivery before claiming the automation is live.

### Gate 7 — Release acceptance
- TypeScript production build and full unit/regression suite.
- Desktop and Android packaging.
- Desktop/mobile interaction review at real viewport sizes.
- Tenant/RLS and role-boundary tests with separate accounts.
- Backup/restore and migration reconciliation tests.
- No regression or data loss in local-first mode.
- Documented release notes that distinguish passed tests from untested external integrations.

## 7. Non-negotiable engineering rules

1. Preserve all 16 original workspaces and their saved records; add Sharing Property as workspace 17.
2. Never delete or silently rewrite user data to simplify a UI.
3. Do not treat a contact display name as an entity key.
4. Do not combine asset value, debt, cash, commitment, fund NAV and disputed claim exposure into one financial measure.
5. Do not claim live market, investor, court, KYC, sanctions or valuation data unless the provider/source is connected and its latest data timestamp is visible.
6. Do not label keyword routing as AI reasoning or a forecast as an actual.
7. Every dashboard figure must be traceable to source records and a defined calculation.
8. Empty states must remain empty rather than use fabricated sample values.
9. Keep the orbital workspace map as optional navigation; it must never displace core workflows.
10. Mark external integrations, cloud configuration and production acceptance as pending until verified.
