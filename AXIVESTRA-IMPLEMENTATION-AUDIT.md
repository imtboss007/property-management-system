# AXIVESTRA implementation audit

Audit date: 2026-10-31  
Repository: `imtboss007/property-management-system`  
Main branch baseline: PR #4 merged; PR #5 is the current Cloudflare Worker implementation branch.  
Scope: source review, live Supabase migration history and function ACL checks, Cloudflare dashboard inspection, and GitHub Actions CI. This is not a production certification or a real Meta message-delivery acceptance report.

## Current verified state

### Application and data

- Existing AXIVESTRA local-first Windows Electron and Android Capacitor applications are retained; this work does not replace the application.
- Existing Supabase company/RBAC and multi-device data-sync architecture remains the source of truth for shared business records.
- Existing Windows WhatsApp linked-device sender and QR workflow remain available as a fallback; it requires the Windows PC and linked session to be online when the message is due.
- WhatsApp contact dedup improvement was merged into `main`: stable JID match first, normalized-phone fallback, in-batch duplicate suppression, and preservation of existing master contact names/details/relationships.
- Existing local records, IndexedDB document bytes, local WhatsApp credentials and linked-device session were not migrated, cleared or deleted.

### Live Supabase project

- Existing project: `yelabsimnlcwbfstbduj`.
- Live migration history confirms these five schema migrations are already recorded as applied:
  - `20261030164420_auth_company_rbac`
  - `20261030164546_rbac_hardening`
  - `20261030164550_metadata_audit_hardening`
  - `20261030164556_approval_permissions`
  - `20261031054337_security_definer_least_privilege`
- PR #4 added the least-privilege security migration and it was applied to the live project. ACL verification confirmed `anon` has no direct EXECUTE access to the nine reviewed SECURITY DEFINER functions. Authenticated users can execute only the intended company-creation and RLS membership helper functions; trigger-only routines cannot be called directly by clients.
- Existing live tables were previously verified RLS-enabled and empty at the last inspection; this does not mean local data on user devices is empty.
- The WhatsApp cloud queue migration `20261031065632_whatsapp_cloud_scheduler.sql` is applied to the existing Supabase project. Verification confirms RLS enabled, zero queue rows, no `anon` access, authenticated SELECT/INSERT only, and no authenticated UPDATE/DELETE. No existing application rows were modified.

### Cloudflare

- TinyFish authenticated dashboard inspection confirmed the Cloudflare **Workers Free** plan is active, with no payment method on file.
- Workers and D1 are available; no Worker projects or D1 databases existed at inspection.
- The Worker source and one-minute Cron configuration are prepared in PR #5.
- D1 is deliberately omitted. The durable queue belongs in existing Supabase Postgres so there is one queue source of truth with company scoping, RLS and audit context. A second queue copy in D1 would require unnecessary state reconciliation.
- Free-tier Cron processing is intentionally limited to one queued message per minute in the current source to keep each invocation small within Cloudflare's 10 ms free CPU allowance for frequent Cron triggers. This is a conservative initial throughput limit, not a tested production throughput guarantee.

### Official Meta WhatsApp cloud sender

- PR #5 adds the optional official Meta WhatsApp Business Platform path through Cloudflare Worker Cron.
- The Worker validates Supabase JWT/company membership for the status endpoint, checks one configured AXIVESTRA company ID, dispatches due messages with server-only credentials, verifies Meta webhook HMAC signatures, scopes webhook events to the configured phone-number ID, stops future follow-ups after inbound replies, and records sent/delivered/read/failed lifecycle status.
- Cloud sending supports individual recipients only; WhatsApp group messaging and personal WhatsApp address-book discovery remain on the existing linked-device path.
- Scheduling requires recipient consent; scheduled sends use approved templates. Meta message charges may apply. No messages have been sent and no provider charges have been triggered.

## Merged changes

### PR #4 — merged to main

PR: https://github.com/imtboss007/property-management-system/pull/4

- Least-privilege Supabase SECURITY DEFINER ACL hardening.
- Incremental WhatsApp contact JID/phone deduplication and preservation of master-contact identity.
- Regression security-contract check corrected to assert actual cache behavior.
- Windows installer, Android APK, WhatsApp checks, existing app tests and Deno function type-check all passed on the merged revision.

## Current implementation branch

### PR #5 — open, not merged

PR: https://github.com/imtboss007/property-management-system/pull/5

- Adds the Cloudflare Worker source, Cron configuration, health/status/dispatch routes and Meta webhook handler.
- Adds new Supabase message queue migration and service-role-only queue functions.
- Integrates an optional Cloudflare-backed official Meta sender in the existing WhatsApp Automation UI, retaining the Windows linked-device flow as fallback.
- Adds dedicated Worker unit/security tests and CI workflow.
- Updates setup documents and aligns already-applied migration filenames to the exact versions found in live Supabase migration history, preventing future CLI migration version drift.
- CI initially exposed a stale test path; the test was updated to target the new queue migration. The latest CI runs are being checked before merge.
- PR #5 is source-only until reviewed and merged; no Cloudflare Worker or queue table has been deployed/created yet.

## Remaining blockers for live cloud delivery

1. CI must be green for Worker tests, Windows installer, Android APK and existing security checks on the final PR revision.
2. Apply the new additive queue migration to the existing Supabase project after confirming the migration SQL and history. Then re-check RLS, grants, function signatures and advisors.
3. The owner must have an approved Meta WhatsApp Business Platform app/Business Account and a sending phone number, then configure the required server-only access token, phone-number ID, app secret and webhook verify token. These credentials must be entered only in trusted provider secret managers, never in chat, source control or client builds.
4. Deploy the Worker on the Cloudflare Free plan, set the public Worker URL in the app build environment, and configure the Meta webhook callback and `messages` subscription.
5. Build fresh Windows/Android packages with the existing Supabase public URL/key and the Worker public URL. Existing installations do not acquire new build-time variables retroactively.
6. Run a live test only after owner approval, with a dedicated consenting recipient. Verify dispatch with both devices off, templates, reply-stop, delivery states, failure recovery and company isolation. Meta pricing applies to the applicable message categories; no real send will occur without approval.

## Data protection and release gate

- No local business data, property records, documents or contact register has been transferred to a new database in this work.
- No application records were deleted or rewritten.
- No Cloudflare paid plan upgrade, billing method, Worker or D1 database has been created.
- No WhatsApp message has been sent.
- A green CI run proves automated code/build tests only; it does not prove a live Meta number is approved, delivery occurs or both real devices stay in sync under field conditions.
- Preserve the existing app's local data and take a verified backup before any future import, device reset or migration.
