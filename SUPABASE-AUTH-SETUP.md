# AXIVESTRA hosted sign-in, company isolation and cloud sync

## Implemented in source
- Supabase email/password sign-in, account registration, session restoration, sign-out and password-recovery request.
- Company selector and owner-created company workspace using `create_company_with_owner`.
- Membership roles: `owner`, `admin`, `manager`, `staff`, and `read_only`.
- A separate local cache namespace per selected company. Legacy `estateflow.*` records are not auto-assigned; first-time entry asks before importing them.
- Per-record cloud sync for properties, contacts, WhatsApp groups, tasks, financials, risks, approvals and local audit events. Remote-only rows are retained; local rows win where IDs collide.
- RLS, explicit table grants, owner-safe membership policies, and role-checked cloud record deletion in SQL.
- Windows and Android build workflows accept the public client configuration from Actions secrets. Without them, builds remain in local-only mode.

## Configure Supabase (required to enable account access)
1. Create a dedicated Supabase project for AXIVESTRA.
2. In **SQL Editor**, review and apply `supabase/migrations/202610290001_auth_company_rbac.sql`. Confirm all statements succeed. This workflow commits the migration but does not apply it to a live project.
3. In Supabase **Authentication → Providers**, enable Email/password and choose email-confirmation settings.
4. Under Authentication URL configuration, set the actual deployed web origin as Site URL and add approved redirect URLs. Test password recovery from that origin.
5. For local development, copy `.env.example` to `.env.local` and set:
   - `VITE_SUPABASE_URL` — the project URL.
   - `VITE_SUPABASE_PUBLISHABLE_KEY` — the public publishable key (or legacy anon key).
6. For GitHub builds, add repository Actions secrets under **Settings → Secrets and variables → Actions**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   These are public client values embedded at build time. Never use a `service_role` key, database password, WhatsApp token or signing key in Vite variables.
7. Rebuild both the Windows installer and Android APK after adding the secrets. Old installers/APKs do not gain the configuration later.
8. Open AXIVESTRA, create an account, confirm email if enabled, sign in, and create a company. The authenticated user becomes the first owner.

## Add a member to an existing company
A member-management screen is not implemented yet. Until then, an owner/admin must add a membership in Supabase SQL Editor after verifying the user's identity and company. Replace every placeholder:

```sql
insert into public.company_memberships (company_id, user_id, role, created_by)
values (
  'COMPANY_UUID'::uuid,
  'AUTH_USER_UUID'::uuid,
  'staff',
  'OWNER_AUTH_USER_UUID'::uuid
);
```

Client membership policies prevent ordinary callers from assigning or removing an owner. Ownership transfer and removal require a dedicated audited procedure and are not exposed in the app.

## Roles and enforcement
- `owner`: full company workspace and governance.
- `admin`: company administration and business records; cannot grant/remove owner membership.
- `manager`: business create/update/delete.
- `staff`: business create/update; cannot delete shared cloud records.
- `read_only`: cloud reads only; app mutation guards are UX controls, not the security boundary.

Database row-level security (RLS) is the authorization boundary for cloud records. Each record is stored with a company ID and read/written under the signed-in Supabase identity.

## Existing local data migration
On first company access from a device, if unscoped legacy records exist, AXIVESTRA asks whether to import and merge them into that company or use cloud data. Back up first. On ID collisions, the device's local version wins; cloud-only records are kept. Do not import the same legacy records into multiple companies unless intentional.

## Important limits before production
- The migration is committed but is not applied to a live project by this workflow. Use a test project first.
- Document file bytes remain in the local IndexedDB vault; only listed business-record collections sync. Export/restore document-vault backups separately per device.
- WhatsApp linked-device credentials, QR and pairing codes remain on the Windows sender and are not uploaded.
- Company membership management UI, invite acceptance, ownership transfer, field-level conflict resolution and production Android signing are not complete.
- Device-local caches are not encrypted against someone who can access the OS profile. Use device encryption, screen locks and encrypted backups.
- Routine sync refuses to revive soft-deleted cloud records. Restoration of a deleted ID needs an owner-controlled recovery procedure.
- Real-account tests for RLS, recovery, cross-company isolation, multi-device sync and WhatsApp behaviour are still required.

## Release acceptance checklist
- [ ] Apply the migration to a dedicated Supabase test project and confirm it runs without errors.
- [ ] Create User A / Company A and User B / Company B; verify neither user can read or modify the other's records, including direct API requests.
- [ ] Verify read-only cannot write and staff cannot delete via the Data API.
- [ ] Test create company, logout/login, company switching and record isolation.
- [ ] Import local records once and verify sync from Windows to Android and back.
- [ ] Test record create/update/delete on two devices, including stale-cache deletion recovery.
- [ ] Test email confirmation, password recovery, session expiry and membership revocation.
- [ ] Test document backup/restore, including actual file bytes.
- [ ] Test WhatsApp pairing, contacts/groups, delivery, stop-on-reply and offline recovery with consenting test accounts.
- [ ] Install on a clean Windows profile and a real Android device; produce a separately signed Android release before public distribution.
- [ ] Run all CI checks and retain build artifacts.

## Security
Never commit auth tokens, WhatsApp session files, QR/pairing codes, private hub tokens, database passwords, signing keys or a Supabase service-role key. Keep network companion endpoints on trusted private networks and review RLS grants before production.
