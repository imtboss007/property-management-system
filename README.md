# AXIVESTRA — Asset Intelligence Platform
**Live web app:** https://axivestra.pages.dev (Cloudflare Pages Free, production branch `main`). The optional official WhatsApp cloud sender remains disabled until Meta Business Platform setup is complete.


AXIVESTRA is a multi-asset, capital and relationship intelligence operating platform for Windows desktop, Android and browser use. It brings together property and deal workflows, credit and lending, ventures and equity, funds and investor relations, legal matters, risk and compliance, financial movements, counterparties, evidence and operational commitments. Its primary experience is an asset-intelligence overview and decision workspace; the orbital interface is an optional visual workspace explorer, not the product itself. The platform includes interactive record-derived analytics, domain workbenches, relationship workflows, data-completeness audits and a 17-workspace directory.

## Product and intelligence boundary

AXIVESTRA is designed around four connected layers:

1. **System of record** — assets, opportunities/deals, facilities, investments, funds, investors/counterparties, legal matters, financial movements, documents, tasks, risks and approvals.
2. **Relationship intelligence** — stable links between people, organisations, assets, deals, loans, investments, funds, transactions, documents and cases.
3. **Asset and decision intelligence** — explainable portfolio/exposure views, capital movement, pipeline health, counterparty concentration, deadlines, risk signals, data completeness and decision readiness.
4. **Execution** — tasks, follow-ups, approvals, communications and auditable next actions.

**Important scope boundary:** figures labelled as live in the app are derived from records currently stored in the AXIVESTRA workspace. This does not mean that external market feeds, title/registry data, global investor databases, court systems, sanctions/KYC providers or third-party valuation systems are connected. Investor Relations currently provides a workspace for managing entered investor records; it is not yet a globally sourced investor-intelligence database. A recorded value/exposure total is not a verified net asset value, market valuation or consolidated balance sheet.

See [AXIVESTRA-PRODUCT-ARCHITECTURE.md](AXIVESTRA-PRODUCT-ARCHITECTURE.md) for the canonical product definition, current maturity assessment, target architecture and delivery gates.

## Included workspaces

- Seventeen standard workspaces: Property Sale, Property Loans, JV / JDA / JD, SR Rate Settlement, Agricultural Land, Commercial Land, Sharing Property, Startup, Equity, Unsecured Company Loan, Personal Loan, Housing Loan, House Purchase, Litigation, Fund & Portfolio Management, Investor Relations, and Compliance & KYC.
- Property and collateral records can include multiple linked properties with separate survey identifiers, area, SR / guidance rate, market rate and mortgage / encumbrance type. Rate calculations are shown per property and require matching area units.
- Settlement amount, status, date and terms are captured in Property Sale, SR Rate Settlement, Agricultural Land, Commercial Land and Litigation.
- Sharing Property captures owner percentage allocations (for example 50:50 or 60:40), gifts, share consideration, instrument / deed type, mortgage type and linked loan terms. This is recordkeeping, not a legal conclusion on title, tax or deed validity.
- Workspace records support multiple primary contacts, stakeholders, follow-up contacts and links to saved WhatsApp groups. Group association does not send messages. Custom workspace definitions are syncable and included in JSON backups.
- Property records with module, location, value, status, contact, and notes.
- Contact register for buyers, sellers, brokers, lawyers, lenders, tenants, developers, and others.
- Master contact intelligence: multiple standard/custom roles, profession, employer, designation, business type, associated company, optional income sources, email/address and referral context.
- Phone-match duplicate warning before creating a contact; records are not silently merged.
- One-time tasks with date, time, type, linked property, notes, completion and delete.
- WhatsApp click-to-chat helper and a WhatsApp Automation screen for a configured companion gateway.
- Local data persistence, IndexedDB document vault, and JSON backup/restore.
- Responsive desktop and mobile layouts.

## Local-first and hosted cloud modes

AXIVESTRA remains usable as a local-first app without hosted credentials. When `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are configured at build time, the app enables Supabase email/password authentication, company selection, company-scoped cloud records, and role-aware company access. The sign-in screen also offers **Continue without login · Local storage only**, so users can choose not to authenticate. Without hosted credentials, AXIVESTRA opens directly in Local Only mode.

Each device has its own **storage preference** in Settings: **Login ID** or **Local Only**. Login ID stores records in the signed-in personal/company workspace and synchronizes them across any Windows PC, Android phone or browser using the same account. Local Only stores records in that device's local storage, makes no account-record cloud sync calls, and can be used without signing in. To synchronize Local Only records between a Windows PC and Android phone, select Local Only on both devices and pair them over the trusted local network. Local Only is otherwise independent per device. Switching modes does not delete, copy or merge either dataset; use the JSON backup export/import controls when deliberately moving records between storage locations.

In cloud mode, the ordered migrations in `supabase/migrations/` define company memberships, role checks, row-level policies, immutable record scope and server-generated membership audit events. The first signed-in user can create a company and becomes its owner. Apply all migrations in order that are not already recorded as applied in the target Supabase project and deploy the invitation Edge Function before using those features. Migration 003 adds server-stamped update times and an audit entry for company renames; migration 004 ensures staff can submit pending approval requests but cannot approve/reject them. WhatsApp recipient and directory lists support live name/number search; Windows scheduled sends continue from the system tray while Windows stays running, awake, online and the WhatsApp link remains connected.

Cloud sync is phone-first and PC-first: a user can sign up and create a company from Android without owning or pairing a Windows PC, then later sign in to that same account and company on a PC. Either device can manually trigger **Sync now**, and changes continue to reconcile automatically while online. Cloud sync covers properties, contacts, WhatsApp groups, custom workspace definitions, tasks, financials, risks, approval requests and local audit events. Records are reconciled with a per-company baseline, and cloud deletion tombstones prevent stale devices resurrecting deleted records. Email invitations and role changes are available to owners/admins once the Supabase Edge Function is deployed. Document file bytes remain in the local IndexedDB vault; WhatsApp linked-device credentials remain on the Windows sender. Existing unscoped local records are imported only after an explicit choice.

To enable cloud mode:
1. Copy `.env.example` to `.env.local` for local development and set the Supabase Project URL and public publishable/anon key.
2. Apply the SQL migration to the same project and configure Supabase Auth email settings and approved redirect URLs.
3. For GitHub Actions builds, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` under **Settings → Secrets and variables → Actions**. For the optional official WhatsApp cloud sender, add the public repository variables `VITE_AXIVESTRA_WHATSAPP_WORKER_URL` and `VITE_AXIVESTRA_WHATSAPP_CLOUD_ENABLED=true` after deploying the Cloudflare Worker. The Worker URL must be HTTPS; all sender credentials remain server-side.
4. Build fresh Windows and Android artifacts after adding those values. Existing installers do not gain them retroactively.

See [SUPABASE-AUTH-SETUP.md](SUPABASE-AUTH-SETUP.md) for Supabase setup, Edge Function deployment, role limits, data migration and release acceptance tests. This is an implementation stage, not a claim of production certification; test row-level security with separate users/companies before real sensitive data is used.

WhatsApp has two modes: the existing Windows-linked-device sender (PC must remain on) and the optional official Meta WhatsApp Business Platform sender dispatched by a Cloudflare Worker Cron. The Worker is designed for the Cloudflare Workers Free tier and uses the existing Supabase Postgres queue; D1 is intentionally not added as a duplicate queue store. It is not live until the Worker, server-only secrets, Meta Business sender and webhook have been configured. See [CLOUD-WHATSAPP-AND-DATA-SYNC.md](CLOUD-WHATSAPP-AND-DATA-SYNC.md) and [services/axivestra-whatsapp-worker/README.md](services/axivestra-whatsapp-worker/README.md). Meta message charges and opt-in/template rules still apply; no messages are sent during deployment.


## Indian INR amount entry

All AXIVESTRA fields labelled with ₹ accept either plain numeric amounts or Indian shorthand. Examples:

- `25000` or `25 thousand` → ₹25,000
- `5 lakh` → ₹5,00,000
- `2 crore` → ₹2,00,00,000
- `1 crore 25 lakh` → ₹1,25,00,000

This applies across the module worksheets' rupee fields, common property value/exposure and rate-per-unit fields, and Financials transactions. Percentage, area, quantity, year and tenure fields remain ordinary numeric inputs. Amounts are normalized to a numeric INR value before saving, so existing records, calculations and CSV exports continue using rupees rather than display text.


## Build Windows + Android

The GitHub Actions workflow is `.github/workflows/main.yml`. It runs on pushes to `main`, pull requests targeting `main`, or manual dispatch from the Actions tab. The workflow builds a Windows `.exe` installer and Android debug `.apk`, then uploads each as an Actions artifact. It does not automatically publish a GitHub Release.

1. Open the repository's **Actions** tab.
2. Open the successful **AXIVESTRA Windows and Android builds** run.
3. Download the `AXIVESTRA-Windows` and/or `AXIVESTRA-Android` artifact.
4. Install the Windows installer on Windows. On Android, open the APK and approve installation from that source if prompted.

The Android project is created on the GitHub runner with `npx cap add android`, then synced and built. It is a generated build output and is not required to be committed to this source branch.

## Run in a browser for development

Requires Node.js 22 and npm.

```bash
npm install
npm run dev
```

## Package locally

Windows (run on Windows):

```bash
npm install
npm run desktop:dist
```

Android (requires Java 17 and Android SDK):

```bash
npm install
npm run build
npx cap add android
npx cap sync android
cd android
./gradlew assembleDebug
```

## Repository layout

- `src/` — app interface and features
- `electron/` — Windows desktop entry point
- `capacitor.config.ts` — shared Android wrapper configuration
- `.github/workflows/main.yml` — Windows and Android build workflow
- `services/estateflow-whatsapp-hub/` — separate WhatsApp companion adapter

## Security

Do not place API tokens, WhatsApp linked-session credentials, QR codes, pairing codes or signing keys in source files. Keep the companion service and gateway on a trusted private network; do not expose raw HTTP endpoints to the public internet. Back up local data before clearing app storage or changing devices.
