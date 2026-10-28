# AXIVESTRA — Master Relationship & Deal Intelligence Upgrade

Status: implementation blueprint and acceptance checklist for the feature branch. This document distinguishes shipped UI changes from future backend work; it is not a claim that every capability is already live.

## 1. Implemented in this commit

- The master contact editor now supports multiple simultaneous roles, including Client, Mediator, Funder, Landowner, Property Buyer, Property Seller, Builder/Developer, Borrower, Lender, Investor, Company Owner/Director, Broker/Agent, Professional Adviser, Guarantor, JV/JDA Partner, Advocate, Contractor, Employee/Salaried, Supplier/Vendor, Introducer/Referral Partner and additional operational roles.
- Users can add custom roles.
- Optional identity, email, address, profession, employer/business, designation, business/employment type, associated company, income-source and relationship/referral context fields are available.
- Responsive role selection and a scrollable contact form are styled for mobile and desktop.
- The existing single role remains as a backward-compatible primary role. Multiple roles are saved as additional contact profile fields in the existing device data object.

## 2. Master data model — the single source of truth

### Person / organisation
- Stable contact ID; legal/master name; preferred name; organisation/person type; photo/avatar reference.
- Phone numbers with country code and verification status; email addresses; address; preferred language; communication preference; WhatsApp display name and JID kept separate from the verified master name.
- Roles as a many-to-many list; custom role names; role source and effective dates.
- Profession/occupation; employer; designation; department; employment type/status; work location; joining/leaving dates when relevant.
- Business form (sole proprietor, partnership, LLP, company/director, freelancer, consultant, trader, manufacturer, contractor, professional practice); associated companies and ownership percentage when applicable.
- Optional income-source categories: salary, business, rental, agriculture, pension, investment, commission, interest and professional fees. Do not treat a self-reported amount as verified.
- Relationship source, introducer/referrer, relationship notes, created/updated timestamps and audit history.

### Deal-specific participation
Master roles describe a person generally. A separate deal-party link records the person's role in that particular transaction, e.g. one person may be a landowner in Deal A, lender in Deal B and borrower in Deal C. Each deal-party link should include contact ID, deal ID, transaction role, represented entity, responsibility, decision authority, dates, notes and verification state.

### Shared entity links
Use stable IDs and explicit links between contacts, companies, properties, deals, loans, funds/investments, tasks, documents, financial transactions, communications, legal cases and approvals. Do not rely on display names as database keys. Where legacy records lack IDs, offer a match suggestion rather than silently merging them.

## 3. Connected workspaces
Keep all existing 16 workspaces: Property Sale; Property Loans; JV / JDA / JD; SR Rate Settlement; Agricultural Land; Commercial Land; Startup; Equity; Unsecured Company Loan; Personal Loan; Housing Loan; House Purchase; Litigation; Fund & Portfolio Management; Investor Relations; Compliance & KYC.

Each workspace must support:
- Its own required and optional domain fields, stage/status, participants and role-in-this-deal.
- Related property/company/contact/fund/case links and a unified activity timeline.
- Value and currency, due dates, next action, owner, evidence/document links, financial movements and audit events where relevant.
- Search, filters, saved views, list/table, cards and pipeline where the workflow supports it; responsive scrolling and keyboard access.
- A data-completeness view that says what is missing without inventing values.

## 4. Property and loan relationship rules
- A property owner can be linked to a master contact by contact ID; store ownership share, effective dates, evidence and verification state.
- A loan links borrower(s), lender, guarantor(s), collateral property, facility terms, disbursements, repayments, charges, outstanding balance and maturity dates.
- A financial movement links payer, payee, amount, currency, date, purpose, reference, evidence and related loan/deal/property. Do not infer payment or settlement from a note.
- A property/deal task appears on its own timeline and the linked contact timeline. Completing it updates the same task, not duplicate copies.
- A legal case links parties, advocates, case numbers, filings, hearings, orders, evidence and linked properties/deals/loans.

## 5. Contact and WhatsApp import rules
- Preserve original WhatsApp display name and phone/JID as imported-source fields; never silently overwrite the verified master name.
- Normalize phone numbers for duplicate suggestions. Show potential matches before merge; never merge two people automatically based only on a similar name.
- Contacts and saved groups must persist independently of whether WhatsApp is currently linked. Store group JID, name/subject, description, membership snapshots and last sync time when available.
- Import, sync, disconnect, and reconnect actions must report what changed and what could not be imported.
- Keep message scheduling, group messaging and reply-stop logic behind explicit consent, supported provider capabilities, opt-out handling, rate limits and an auditable queue. Do not promise reply detection until a configured inbound webhook/provider has been tested end-to-end.
- Do not expose access tokens in client-side code or commit secrets.

## 6. Tasks, commitments and follow-up
- Each task must have an owner, due date/time, status, priority, contact/deal/property link, next action, reminder channel and completion history.
- Support one-time and recurring reminders, escalation after missed deadlines, snooze, cancel and "stop follow-ups when a reply is received" only where an inbound message event has actually been received.
- Keep promises/commitments as structured records: who promised what, to whom, on which date, linked deal, due date, source/evidence and status.
- Daily command-centre view: overdue, due today, upcoming, unassigned, stalled deals, expiring documents, loan maturities and pending approvals.

## 7. Documents, evidence and verification
- Link documents to one or more relevant contacts, deals, properties, loans and cases.
- Record document type, source, upload date, expiry, version, verification status, reviewer and notes.
- Keep originals immutable when evidence integrity matters; represent corrections as new versions with audit trail.
- Sensitive identity, salary, income and financial fields should be optional, access-controlled, minimized and visible only to authorised users. Use consent and lawful-purpose checks for imports and communications.

## 8. Analytics and decision support
- Portfolio allocation by module, asset value, record count and status.
- Pipeline conversion and stalled-stage analysis based only on saved records.
- Recorded cashflow by month with inflow/outflow categories; forecasts must be labelled as forecasts and assumptions exposed.
- Follow-up performance, overdue obligations, maturity calendar, contact/deal completeness, referral sources and concentration by counterparty.
- Every chart selection should navigate to the underlying filtered records. Empty states must not show fabricated sample data.

## 9. Production architecture and migration gates
The current repository README identifies local device storage as the default and says PC/Android synchronization, secure cloud roles and cloud document storage are not fully connected. Therefore:
1. Keep local persistence and JSON backup/restore working.
2. Before cloud sync, create versioned database migrations for contact roles, contact profile fields, companies, deal parties, entity relationships, communications, tasks and audit events.
3. Add authentication, server-side row-level access policies, role-based permissions, encryption in transit/at rest, secret management, backup/restore and data export/delete workflows.
4. Migrate existing single-role contacts to a roles array without losing the legacy primary role; validate counts and provide rollback.
5. Add idempotent sync and conflict resolution before claiming PC/Android records are shared.
6. Run TypeScript build, lint/tests if configured, Electron package checks, Android build, schema migration tests and import/duplicate regression tests.
7. Validate with a small non-sensitive test dataset before real legal/financial data is imported.

## 10. Acceptance checklist
- [ ] Existing contact records still load; old role displays correctly.
- [ ] One person can select multiple standard roles and save custom roles.
- [ ] Optional profile fields persist after reload and export/restore.
- [ ] Same contact can appear in multiple deals with a different role in each deal.
- [ ] Deal party, property owner, borrower, lender and guarantor links use stable IDs.
- [ ] Duplicate detection suggests matches without silently merging people.
- [ ] WhatsApp display name does not overwrite master name.
- [ ] Contacts/groups remain saved when WhatsApp is disconnected.
- [ ] Tasks and deadlines link back to the right contact and deal.
- [ ] Sensitive fields are optional and access controlled in any shared/cloud deployment.
- [ ] Desktop and Android layouts remain usable with long forms and large contact lists.
- [ ] Builds and end-to-end provider tests pass before calling the release production-ready.

## 11. Honest scope boundary
The contact-editor multi-role and profile-field UI is being added in the feature branch. This alone does not implement a normalized relational database, cross-device sync, a verified WhatsApp contact/group importer, production message delivery, inbound reply detection, or full role-based access control. Those require backend schema, provider credentials/configuration, migrations, tests and deployment. Keep the branch unmerged until its checks and user acceptance are complete.
