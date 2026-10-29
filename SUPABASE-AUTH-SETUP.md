# AXIVESTRA hosted sign-in, company isolation, invitations and cloud sync

## Implemented in source
- Supabase email/password sign-in, account registration, session restoration, sign-out and password-recovery request.
- Company selector and owner-created company workspace using the `create_company_with_owner` RPC.
- Company membership roles: `owner`, `admin`, `manager`, `staff`, and `read_only`.
- Settings UI for listing company members, changing non-owner roles, removing non-owner members, inviting a new email, and adding/updating an existing Supabase Auth user by UUID.
- Server-side Edge Function for company invitation. The function verifies the caller, checks owner/admin membership, blocks assignment of owner, sends the Supabase Auth invite, and grants company access.
- Database-generated membership audit entries; clients do not have direct insert privileges to the governance audit table.
- Per-company local cache and baseline-aware cloud sync for properties, contacts, WhatsApp groups, tasks, financials, risks, approvals and local audit events. Sync pulls newer remote values, uploads local changes, merges remote-only rows, periodically refreshes while the workspace is open, and respects cloud deletion tombstones.
- Company record keys/types/company IDs are immutable in the database; the creator identity is set server-side and preserved on update.
- Optional cloud auth. Without configured public Supabase client values, the app remains available in explicitly labelled local-only mode.

## Configure Supabase
1. Create a dedicated Supabase project for AXIVESTRA.
2. Apply all SQL migrations in order: `supabase/migrations/202610290001_auth_company_rbac.sql`, then `supabase/migrations/202610290002_rbac_hardening.sql`. Review the SQL and confirm every statement succeeds. The repository workflows commit the migrations but do **not** apply them to a live project.
3. In **Authentication → Providers**, enable Email/password and configure whether signup requires email confirmation.
4. Under **Authentication URL Configuration**, set the actual deployed web origin as Site URL and allow the approved redirect origins. Password recovery and invitation links must be tested from that origin.
5. For local development, copy `.env.example` to `.env.local` and set:
   - `VITE_SUPABASE_URL`: the Supabase project URL.
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: public publishable key (or legacy anon key).
6. For GitHub builds, add repository Actions secrets under **Settings → Secrets and variables → Actions**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   These are public client values embedded at build time. Never place a `service_role`/secret key, database password, WhatsApp token or signing key in Vite variables.
7. Rebuild both Windows and Android after adding these values. Existing installers/APKs do not gain the configuration retroactively.
8. Open AXIVESTRA, create an account, confirm the email if required, sign in, and create a company. The authenticated user becomes that company's first owner.

## Deploy the invitation Edge Function
The repository contains `supabase/functions/invite-company-member/index.ts`. Deploy it to the same project after applying both SQL migrations:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy invite-company-member
```

Supabase provides the function's server-side project URL and keys. The function supports both the legacy `SUPABASE_SERVICE_ROLE_KEY` environment variable and newer `SUPABASE_SECRET_KEYS` JSON environment configuration; it never sends a privileged key to the app. Do not paste any service/secret key into GitHub source or `VITE_*` variables. The function requires a valid signed-in user's JWT and independently checks the caller's company membership.

Optionally configure an approved invitation redirect URL in Supabase Edge Function secrets, using the real deployed app origin:

```bash
supabase secrets set AXIVESTRA_INVITE_REDIRECT_URL=https://YOUR_APPROVED_APP_ORIGIN
```

Also configure Supabase Auth's invite email template, SMTP/provider delivery and rate limits. If the email already has a Supabase account, the app explains that you should use the existing user's UUID flow. Email invitations have not been live-tested because this repository workflow has no access to your project.

## Manage company members
In **Settings → Company member access**, an owner/admin can:
- Invite a new user by email and choose Admin, Manager, Staff or Read-only.
- Add/change an existing Supabase Auth user by UUID if the email already has an account.
- Remove non-owner membership or change roles. An owner cannot be changed or removed through this UI.

The UI updates company membership through RLS policies; member changes are written to `company_audit_events` by a database trigger. Owner transfer/removal needs a separate reviewed governance procedure and is not included.

## Roles and enforcement
- `owner`: all company workspace and governance.
- `admin`: company settings and member administration; cannot grant/remove owner membership.
- `manager`: create/update/delete operational records.
- `staff`: create/update records; cannot delete shared company records.
- `read_only`: cloud reads only. Interface guards are for usability; database RLS is the authorization boundary.

Database row-level security (RLS), least-privilege grants and immutable record identity are the security boundary for cloud records. Every business record is scoped by company ID and checked against the signed-in user's membership.

## Existing local data migration
On first access to a company on a device, AXIVESTRA detects unscoped legacy records and asks whether to import them into the selected company or use cloud data. Back up first. For the first import only, local rows win matching ID conflicts and cloud-only rows are preserved. After that, a per-company baseline reconciles local and remote edits; overlapping edits use the latest local audit time versus the server's last update time, with ties preferring the remote value. Cloud tombstones prevent stale devices from resurrecting deleted rows. This is pragmatic conflict handling, not field-level merging; review important financial/legal changes after conflict notices.

## Data boundaries
- Business records sync through the company-scoped Supabase table.
- Document file bytes stay in the local IndexedDB vault, are scoped to the active company in the UI, and need separate backup/restore per device. A schema migration adds the company index; old unassigned documents are assigned only when the user explicitly imports legacy data into a company.
- WhatsApp linked-device credentials, QR/pairing codes and the private PC companion token stay on the Windows sender and are never uploaded as business records.
- Local browser/device caches are not encrypted against someone who can access the OS profile. Use device encryption, screen locks and encrypted backups.
- Email invitations, SQL migrations and RLS policies require actual Supabase deployment and live tests. A passing build does not prove project configuration or RLS correctness.

## Release acceptance checklist
- [ ] Apply the migration to a dedicated Supabase test project and verify it runs without SQL errors.
- [ ] Configure Auth email confirmation, recovery URLs and invite SMTP delivery.
- [ ] Deploy `invite-company-member`, send a test invite and complete signup via the email link.
- [ ] Create User A / Company A and User B / Company B; verify neither can read or modify the other's records, including direct API requests.
- [ ] Verify Read-only cannot write and Staff cannot delete through direct API requests.
- [ ] Test company create, logout/login, company switching and cache isolation.
- [ ] Create/update/delete a record on Windows and confirm a second device receives changes; test offline changes and deletion tombstones.
- [ ] Test simultaneous edits of a record and manually review the chosen conflict result.
- [ ] Test session expiry, email confirmation, password recovery, revoked membership and attempted owner escalation.
- [ ] Back up/restore documents and verify actual file bytes, company-vault separation and legacy assignment.
- [ ] Test WhatsApp QR/pairing, contacts/groups, delivery, stop-on-reply and offline recovery with consenting real test accounts.
- [ ] Install on a clean Windows profile and real Android device. The current APK workflow produces a debug APK; configure a separate signed release before public distribution.
- [ ] Run all CI checks. Keep `main` unchanged until you explicitly approve merging the feature branch.

## Security rules
Never commit auth tokens, WhatsApp session files, QR/pairing codes, private hub tokens, database passwords, signing keys or Supabase secret/service-role keys. Keep the Windows companion on a trusted private network.
