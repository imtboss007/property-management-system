# AXIVESTRA — Authentication, Company Isolation & RBAC Implementation Plan

Status: next development stage
Target branch: `feature/estateflow-unified-whatsapp-automation`
Main branch: must remain untouched until the user explicitly approves a merge.

## Goal
Add real sign-in, multi-company workspaces, and role-based permissions without misrepresenting local UI controls as security boundaries.

## Required architecture
- Use a trusted authentication provider or a maintained self-hostable authentication service; do not invent password hashing, session cryptography, or recovery flows.
- Keep company-scoped records separated by a stable `companyId` and enforce tenant authorization in the server/data layer on every read and write.
- Do not rely on hidden buttons, localStorage role flags, or client-side route guards as authorization.
- Owner/admin membership management must be auditable. Role changes, invitations, removals, and company switching require explicit confirmation.
- Never commit passwords, session cookies, refresh tokens, API keys, WhatsApp credentials, or companion tokens.
- Preserve offline-first use only where explicitly supported; offline changes must be marked pending and re-authorized on sync.
- Existing local data must be migrated safely with a backup and an explicit company assignment step; never silently expose existing records to every company.

## Initial roles
- Owner: company settings, member management, all business workspaces, export/restore, audit review.
- Admin: operational configuration and records, but cannot transfer ownership.
- Manager: create/edit operational records and review assigned approvals.
- Staff: only permitted workspaces and assigned records.
- Read-only/Auditor: view allowed company records and export permitted audit views; no mutations.

## Required acceptance tests
- Anonymous requests cannot read company data.
- User A from Company A cannot read or mutate Company B records by changing IDs or API payloads.
- Role changes take effect server-side, including direct API calls.
- Last owner cannot be removed or demoted without a safe ownership-transfer flow.
- Company switch updates every query, cache, export, sync, and WhatsApp-related business association.
- Existing local data migration creates a backup, previews counts, requires explicit company assignment, and can be rolled back.
- Session expiry, sign-out, recovery, invite expiry, and revoked membership are tested.
- Windows and Android builds pass; no merge to `main` without user approval.

## Delivery sequence
1. Choose and configure the authentication/data-service architecture.
2. Add identity, company, membership, role, and audit schemas.
3. Enforce tenant checks at the data boundary before adding UI-only role controls.
4. Add sign-in, company switcher, member management, and role-aware navigation.
5. Add safe migration, integration tests, and Windows/Android release verification.
