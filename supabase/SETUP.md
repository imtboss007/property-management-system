# EstateFlow backend setup

EstateFlow can run in local-only mode without credentials. To enable secure shared data across the Windows and Android builds, connect a Supabase project.

## 1. Create the project
Create a Supabase project from the Supabase dashboard. Keep the project URL and publishable/anon key available. Do not use a `service_role` key in the app.

## 2. Create the tables and private document bucket
Open the project's SQL Editor, copy the complete contents of `supabase/migrations/202610270001_estateflow_core.sql` from this repository, and run it.

The migration creates owner-scoped tables for:
- Property records across all six EstateFlow modules
- Contacts
- One-time tasks and due dates
- Private document metadata
- Financial transactions
- WhatsApp follow-up queue metadata
- Audit events

It also creates a private `property-documents` Storage bucket with user-folder policies. Do not make the bucket public.

## 3. Enable login
In Supabase Authentication, enable Email/Password sign-in. If email confirmation is enabled, new users must confirm their email before signing in.

## 4. Configure Windows and Android builds
In GitHub, open **Settings → Secrets and variables → Actions → Variables** and add:
- `VITE_SUPABASE_URL` = your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` = your Supabase publishable/anon key

These are client-side values; database access must be protected by the row-level security policies in the migration. Never place a `service_role` key or WhatsApp access token in a `VITE_` variable.

A commit to `main` triggers a new Windows installer and Android APK build with these values embedded. Without the two variables, the app stays in local-only mode.

## Current integration scope
The current frontend has authentication and remote load/save/delete sync wired for property records, contacts, and tasks. The local cache is separated by signed-in user. The schema includes document, financial and WhatsApp queue tables, but their full upload/transaction/automated-send workflows still need front-end and server-side integration.

A date/time stored by the app is not a reliable background reminder by itself. Server scheduling and WhatsApp sending/reply webhooks require a deployed trusted server-side worker and authorized WhatsApp Business Platform credentials. Keep those secrets server-side.


## WhatsApp queue, automatic delivery and stop-on-reply

The front end can queue a single scheduled follow-up only after the recipient opt-in checkbox is confirmed. The server worker sends an **approved WhatsApp template**; the free-form notes in EstateFlow are not sent as the actual template body. Template parameter values must match the order and count configured in the approved Meta template.

### Deploy Edge Functions
Install the Supabase CLI, link this repository to your Supabase project, then deploy both functions:

```bash
supabase functions deploy whatsapp-worker
supabase functions deploy whatsapp-webhook
```

Set these Edge Function secrets in the Supabase dashboard or with `supabase secrets set`:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only; never put this in the app or GitHub Actions variables)
- `ESTATEFLOW_WORKER_SECRET` (a long random secret used only by the scheduled worker trigger)
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_GRAPH_API_VERSION` (a supported Meta Graph API version, e.g. the currently supported version from Meta's developer docs)
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_VERIFY_TOKEN`

### Schedule the worker once per minute
Enable `pg_cron`, `pg_net`, and Supabase Vault in the Supabase dashboard. Store the project URL and the same worker secret in Vault (never put these values in this repository). Then configure a cron job to POST to:

`https://YOUR_PROJECT_REF.supabase.co/functions/v1/whatsapp-worker`

The request must include `x-estateflow-worker-secret` with the Vault-held secret. The worker atomically claims only due rows with confirmed opt-in and sends the saved approved template. In the current UI, a row is scheduled once. It is not automatically retried after a provider failure.

### Configure Meta reply webhooks
In Meta's WhatsApp app configuration, use the callback URL:

`https://YOUR_PROJECT_REF.supabase.co/functions/v1/whatsapp-webhook`

Enter the same value as `WHATSAPP_VERIFY_TOKEN` for webhook verification, configure the Meta App Secret as `WHATSAPP_APP_SECRET`, and subscribe the WhatsApp messages webhook field. The function validates `X-Hub-Signature-256`. Incoming replies update matching queued/sent records to `replied`, preventing any later scheduled sends for that number.

Do not schedule messages to recipients without their opt-in. Use approved templates in line with Meta's business messaging rules. The worker and webhook code are committed, but neither is live until deployed and configured in your Supabase/Meta projects.


## Investment, credit, legal and governance modules

The app includes thirteen connected workspaces: Property Sale, Property Loans, JV / JDA / JD, SR Rate Settlement, Agricultural Land, Commercial Land, Startup, Equity, Unsecured Company Loan, Personal Loan, Housing Loan, House Purchase and Litigation. The new module worksheets write their additional fields to the JSONB `module_data` column on `property_records`.

The overview now calculates a tracked-value total from the headline values entered by the user and shows attention signals for high/critical risks, pending approvals, overdue tasks and upcoming document expiries. These are operational indicators based on captured data, not valuation opinions or an assurance that no other risks exist.

The Risk & Compliance workspace supports a register with category, severity, status, owner, due date, linked matter and mitigation. The Approvals workspace records requests, rationale, priority and approval/rejection outcomes. The migration enables row-level security on both tables and adds database audit events for business record changes.

### Important governance boundary

The current model is user-scoped for private records. The approval queue records decisions but does **not** enforce multi-user separation of duties, independent approver identity, maker-checker restrictions, legal sign-off, delegated limits, or workflow blocks at the database layer. Before use at an institutional scale, add organization/workspace membership, role-based policies, independent approver authorization, immutable decision identity, retention controls, test coverage and an operational security review. The styling is enterprise-oriented; this does not make the current build certified or production-approved for BlackRock or any regulated institution.
