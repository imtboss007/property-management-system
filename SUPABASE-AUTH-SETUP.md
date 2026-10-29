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
2. Apply all SQL migrations in order: `supabase/migrations/202610290001_auth_company_rbac.sql`, `supabase/migrations/202610290002_rbac_hardening.sql`, then `supabase/migrations/202610290003_metadata_audit_hardening.sql`, then `supabase/migrations/202610290004_approval_permissions.sql`. Review the SQL and confirm every statement succeeds. Migration 003 stamps cloud update times server-side and audits company renames; migration 004 restricts approval decisions to owner/admin/manager roles. The repository workflows commit the migrations but do **not** apply them to a live project.
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
The repository contains `supabase/functions/invite-company-member/index.ts`. Deploy it to the same project after applying all four SQL migrations:

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
- `manager`: create/update/delete operational records and decide approval requests.
- `staff`: create/update records; may submit pending approval requests but cannot approve/reject them or delete shared company records.
- `read_only`: cloud reads only. Interface guards are for usability; database RLS is the authorization boundary.

Database row-level security (RLS), least-privilege grants and immutable record identity are the security boundary for cloud records. Every business record is scoped by company ID and checked against the signed-in user's membership.

## Existing local data migration
On first access to a company on a device, AXIVESTRA detects unscoped legacy records and asks whether to import them into the selected company or use cloud data. Back up first. For the first import only, local rows win matching ID conflicts and cloud-only rows are preserved. After that, a per-company baseline reconciles local and remote edits; overlapping edits use the latest local audit time versus the server's last update time, with ties preferring the remote value. Cloud tombstones prevent stale devices from resurrecting deleted rows. This is pragmatic conflict handling, not field-level merging; review important financial/legal changes after conflict notices.

## WhatsApp search and background scheduling

- Contact and group recipient selectors support text search by name, number or group name; the directory has separate search fields.
- A successful WhatsApp sync imports the available contact and group cache into AXIVESTRA's saved records. Contact/group cache refreshes merge incoming metadata with previously saved entries, so an empty or partial response does not clear previously saved contacts/groups; sync is additive/upsert-based. Group send eligibility is still verified against the currently linked account and is never blindly unioned across accounts. User-deleted app records are a separate manual action.
- The packaged Windows app is configured to start hidden at Windows login and keeps its scheduler running in the system tray when the window is closed. Open AXIVESTRA from the tray to manage messages. Selecting **Exit AXIVESTRA** intentionally stops the sender.
- Scheduled messages still require the Windows PC to be powered on, awake, online, and linked to WhatsApp at the due time. Sleep, shutdown, internet loss, WhatsApp logout or an upstream protocol change can interrupt delivery. The Android APK is a companion UI; it does not itself host the Windows sender.

## Data boundaries
- Business records sync through the company-scoped Supabase table.
- Document file bytes stay in the local IndexedDB vault, are scoped to the active company in the UI, and need separate backup/restore per device. A schema migration adds the company index; old unassigned documents are assigned only when the user explicitly imports legacy data into a company.
- WhatsApp linked-device credentials, QR/pairing codes and the private PC companion token stay on the Windows sender and are never uploaded as business records.
- Local browser/device caches are not encrypted against someone who can access the OS profile. Use device encryption, screen locks and encrypted backups.
- Email invitations, SQL migrations and RLS policies require actual Supabase deployment and live tests. A passing build does not prove project configuration or RLS correctness.

## Release acceptance checklist
- [ ] Apply all four migrations in order to a dedicated Supabase test project and verify they run without SQL errors.
- [ ] Configure Auth email confirmation, recovery URLs and invite SMTP delivery.
- [ ] Deploy `invite-company-member`, send a test invite and complete signup via the email link.
- [ ] Create User A / Company A and User B / Company B; verify neither can read or modify the other's records, including direct API requests.
- [ ] Verify Read-only cannot write, Staff cannot delete or decide approvals, and staff cannot create an already-approved/rejected request through direct API requests.
- [ ] Test company create, logout/login, company switching and cache isolation.
- [ ] Create/update/delete a record on Windows and confirm a second device receives changes; test offline changes and deletion tombstones.
- [ ] Test simultaneous edits of a record and manually review the chosen conflict result.
- [ ] Test session expiry, email confirmation, password recovery, revoked membership and attempted owner escalation.
- [ ] Back up/restore documents and verify actual file bytes, company-vault separation and legacy assignment.
- [ ] Test WhatsApp QR/pairing, search by contact/group name, cache persistence after disconnect/restart, individual/group one-time messages, repeat sequences, stop-on-reply and offline recovery with consenting real test accounts.
- [ ] Install on a clean Windows profile and real Android device. The current APK workflow produces a debug APK; configure a separate signed release before public distribution.
- [ ] Run all CI checks. Keep `main` unchanged until you explicitly approve merging the feature branch.

## Security rules
Never commit auth tokens, WhatsApp session files, QR/pairing codes, private hub tokens, database passwords, signing keys or Supabase secret/service-role keys. Keep the Windows companion on a trusted private network.

## Always-on WhatsApp sender (optional)

To send scheduled messages while both the Windows and Android apps are closed or powered off, deploy the dedicated hosted sender from the repository Blueprint. The sender must be continuously running and keep its persistent disk. This is separate from database sync.

1. Create the Render Blueprint from the repository's render.yaml. Select the configured paid always-on service and persistent disk. Render generates ESTATEFLOW_BRIDGE_TOKEN and ESTATEFLOW_WEBHOOK_TOKEN server-side.
2. In the Render service, confirm ESTATEFLOW_GATEWAY_PROVIDER is set to baileys and /health responds over HTTPS. Protect the service's environment and disk. Do not put the generated bridge token into any VITE_* variable, application source or APK/installer.
3. Create or select your AXIVESTRA company and record its UUID. The proxy is deliberately tenant-bound to one company and rejects a different company ID.
4. Set these secrets in the linked Supabase project:
   
   ```sh
   supabase secrets set AXIVESTRA_WHATSAPP_HUB_URL=https://YOUR-RENDER-SERVICE.onrender.com
   supabase secrets set AXIVESTRA_WHATSAPP_HUB_TOKEN=YOUR_RENDER_ESTATEFLOW_BRIDGE_TOKEN
   supabase secrets set AXIVESTRA_WHATSAPP_COMPANY_ID=YOUR_AXIVESTRA_COMPANY_UUID
   supabase functions deploy whatsapp-cloud-proxy
   ```

   Substitute actual values in your private terminal; do not post the token into chat, GitHub, a screenshot, or source code. The Supabase proxy verifies the signed-in user and their membership before forwarding a whitelisted action. Read-only members may inspect the queue and address book but cannot change the sender or queue messages.
5. Add the public GitHub Actions repository variable VITE_AXIVESTRA_WHATSAPP_CLOUD_ENABLED and set it to true. Keep the existing VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY Actions secrets configured. Rebuild Windows and Android after changing these values. The feature switch is not a secret; the hub token remains only in Render/Supabase server-side settings.
6. Sign in to the same company on both devices, open WhatsApp Automation, and connect the WhatsApp account to the hosted sender using its QR code. After connection, scheduled messages are processed by the hosted server even with both app windows closed. WhatsApp may still log out the linked device, and host/network outages can interrupt sending.

### WhatsApp transport caveat

The QR-linked hosted sender uses Baileys, an unofficial WhatsApp Web protocol. WhatsApp can change the protocol or restrict an account. Use a dedicated test number first. For critical production messaging, the supported long-term choice is Meta's official WhatsApp Business Platform, which needs Meta onboarding and server-side API credentials instead of a linked-device QR.

### Sync coverage

After the existing Supabase migrations are applied and both devices sign in to the same company, properties, contacts, groups, tasks, financials, risks, approvals and audit records sync through the current company-scoped sync engine. Imported WhatsApp contacts need to be imported into the AXIVESTRA contact register to become standard company contacts. The hub stores the WhatsApp address book for reuse across devices. Documents' file bytes are not uploaded to Supabase Storage by the hosted WhatsApp feature and continue using the existing local vault/companion sync.
