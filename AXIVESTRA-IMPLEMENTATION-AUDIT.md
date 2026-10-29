# AXIVESTRA implementation audit

Audit date: 2026-10-29  
Audited branch: `feature/estateflow-unified-whatsapp-automation`  
Main branch: unchanged; no merge performed.  
Scope: source, database migrations, Edge Function, workflow configuration and the CI results linked below. This is not a live Supabase deployment, live WhatsApp test report or real-device acceptance certificate.

## Implemented in source

- AXIVESTRA branded 16-workspace property/finance/investment/legal/operations interface, responsive layout, search, data entry, activity history and local backup/restore.
- Single-file document-vault backup/restore with metadata and file bytes, input validation, duplicate-ID overwrite confirmation, and a 100 MB decoded vault cap. IndexedDB now stores a company ID and the UI filters documents, downloads, deletes and backups to the active company. Legacy file vaults are assigned only after explicit import consent.
- Windows Electron WhatsApp linked-device service with QR/pairing, contact/group cache, scheduled queue, recurring series, cancel/retry, consent confirmation, stop-on-reply logic, cooldown and daily sending limit.
- Android/browser companion route to the Windows sender. The Android APK does not run the Windows WhatsApp sender by itself.
- Optional Supabase email/password sign-in, account registration, session restoration, sign-out, password-recovery request, company selection and company creation.
- Company membership roles: owner, admin, manager, staff and read-only; Settings UI to list members, invite a new email, add/change an existing account by UUID, and remove non-owner memberships.
- Company-scoped local cache namespaces and per-record cloud sync with a persisted baseline, periodic refresh, local/remote change reconciliation, safe deletion tombstones and a deterministic conflict rule (latest local audit timestamp vs cloud update timestamp; ties favour the cloud record). This is not field-level merge.
- Three ordered SQL migrations for company/membership/record tables, RLS policies, least-privilege grants, owner-safe company creation, company-record identity immutability, role-guarded deletion, server-generated membership governance events, server-stamped cloud timestamps and company-rename audit entries.
- Supabase Edge Function `invite-company-member` that requires a signed-in JWT and checks company owner/admin membership before inviting a new email and assigning a non-owner role.
- CI step to type-check the Deno Edge Function.
- Windows and Android build workflows with optional public Supabase client configuration. Without project URL/key, the build explicitly remains local-only.
- Changes remain on the feature branch. No code was merged into `main`.

## CI validation

- Previous failure found: the membership UI omitted a React hook import; corrected.
- Previous function-check failure found: Deno's npm resolver needed repository dependencies installed; corrected workflow.
- The `AXIVESTRA WhatsApp Hub Checks` run for the latest app-code revision reported passing app build, existing tests/checks, Electron syntax check and Deno type-check for the invitation Edge Function: [workflow details](https://github.com/imtboss007/property-management-system/actions).
- Windows installer and Android APK packaging are run via GitHub Actions. Check the latest successful run on the feature branch before distributing; artifacts are debug/test builds unless a separate production signing setup is configured.

## Implementation status and hard blockers

| Area | Status | Remaining work |
|---|---|---|
| Core UI and 16 workspaces | Implemented in repository | Real screen-by-screen Windows/mobile usability review and business acceptance tests |
| Local storage / backup | Implemented in source | Verify real browser/device backup restore, corrupted backups, large documents and ID collisions |
| WhatsApp | User reported QR, pairing and PC/mobile use working in this chat | Preserve the working build; regression-test delivery, reply cancellation, offline recovery and rate limits on real consenting test accounts |
| Authentication UI | Implemented in source | Configure real Supabase project, Auth email provider and site/recovery URLs |
| Multi-company/RBAC | SQL and client integration implemented in source | Apply all three migrations; test cross-company isolation and direct API attempts against a real Supabase test project |
| Email invitations | Edge Function and UI implemented in source | Deploy function; configure email/SMTP; test an actual invite and account acceptance |
| Cloud sync | Baseline-aware reconciliation implemented in source | Test two real devices, offline edits, simultaneous edits, deletion tombstones and review conflict outcomes |
| Membership audit | Database trigger source implemented | Validate trigger behaviour and audit visibility against the hosted database |
| Android packaging | Debug APK workflow | A signed production APK and secure signing-key setup are still required for public distribution |
| Production readiness | Not certified | Security, privacy, data recovery, performance, account lifecycle and real-device tests remain |

## Required one-time hosted setup

1. Create a dedicated Supabase project.
2. Apply all three SQL migrations in order:
   - `supabase/migrations/202610290001_auth_company_rbac.sql`
   - `supabase/migrations/202610290002_rbac_hardening.sql`
   - `supabase/migrations/202610290003_metadata_audit_hardening.sql`
3. Configure Supabase Auth email/signup/recovery URLs.
4. Deploy `supabase/functions/invite-company-member/index.ts` to that project; configure invitation email delivery and the allowed redirect origin.
5. For fresh builds, set GitHub Actions secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. These are public client settings; never use a service/secret key in a Vite build.
6. Install fresh Windows and Android builds made after the settings are added.

This cannot be completed against a real Supabase project by repository-only changes: the project has not been linked, migrations have not been applied to a live database, the Edge Function has not been deployed, and no service keys or project credentials were supplied. No credentials should be committed to this public repository.

## Acceptance tests required before production

- [ ] Apply all three SQL migrations to a dedicated test project with zero SQL errors.
- [ ] Create two test users and two companies; verify neither user can read, insert, update or delete the other company's rows using both UI and direct Data API requests.
- [ ] Verify read-only is denied writes; staff is denied deletion; non-owner members cannot grant, edit or remove an owner.
- [ ] Create a company, sign out/in, switch companies and verify data does not bleed across local caches.
- [ ] Send an invitation email, accept the invite and verify the user receives only the chosen company's chosen role.
- [ ] Test baseline sync on Windows and Android: add/edit/delete; offline changes; same-record conflict; remote-only record; tombstone prevents resurrection.
- [ ] Test document backup restore with real file bytes and large/corrupt backups.
- [ ] Test QR/pairing, contact/group sync, delivery, consent checks, recurring sends, stop-on-reply, daily cap, network loss/recovery with consenting test accounts.
- [ ] Install on a clean Windows profile and a real Android device; test upgrade/uninstall and preserve local data safely.
- [ ] Build and sign a production Android package before public release.

## Security and continuity

Never commit passwords, Supabase service/secret keys, WhatsApp session files, QR/pairing codes, private PC companion tokens or app-signing keys. Keep the companion on a trusted private network. This audit distinguishes source/CI checks from live deployment and hardware testing; passing builds do not certify the latter.
