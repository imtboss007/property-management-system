# AXIVESTRA implementation audit

Audit date: 2026-10-31  
Repository: `imtboss007/property-management-system`  
Main branch revision: `f0b7022004647f5f1629a3ff9b3250b01d830d45`  
Merged implementation: PR #4 and PR #5  
Scope: source review, live Supabase migration history and ACL/table verification, Cloudflare dashboard inspection and GitHub Actions CI. This is not a production certification or a real Meta message-delivery acceptance report.

## Live application

- **Public web app:** https://axivestra.pages.dev
- Cloudflare Pages project: `axivestra`
- Git source: `imtboss007/property-management-system`
- Production branch: `main`
- Build command: `npm run build`
- Output directory: `dist`
- Root directory: `/`
- Node.js: `22`
- Supabase public URL and publishable key are configured in Pages production/preview variables.
- `VITE_AXIVESTRA_WHATSAPP_CLOUD_ENABLED=false`; no Worker URL is set. The cloud WhatsApp sender is not exposed in the live application yet.
- The public URL was fetched after deployment and returned the AXIVESTRA sign-in screen. This confirms the static site and app shell load, not that a real user login, password reset, or cross-device data transfer has been field-tested.

## Application and existing data

- Existing AXIVESTRA Windows Electron and Android Capacitor applications are retained; no replacement application was created.
- Existing Supabase company/RBAC and multi-device data-sync architecture remains the source of truth for shared business records.
- Existing Windows QR-linked WhatsApp sender remains available as fallback; it requires the Windows PC, online session and linked device to stay available when a message is due.
- WhatsApp contact dedup improvement is merged into `main`: stable JID match first, normalized-phone fallback, in-batch duplicate suppression, and preservation of existing master contact names/details/relationships.
- Existing local records, IndexedDB document bytes, local WhatsApp credentials and linked-device session were not migrated, cleared or deleted.

## Live Supabase project

- Existing project: `yelabsimnlcwbfstbduj`; region: Tokyo (ap-northeast-1); status: active and healthy.
- The live migration history confirms:
  - `20261030164420_auth_company_rbac`
  - `20261030164546_rbac_hardening`
  - `20261030164550_metadata_audit_hardening`
  - `20261030164556_approval_permissions`
  - `20261031054337_security_definer_least_privilege`
  - `20261031065632_whatsapp_cloud_scheduler`
- PR #4 added the least-privilege SECURITY DEFINER hardening and it was applied to the live project. ACL verification confirmed `anon` has no direct EXECUTE access to the nine reviewed pre-existing functions. Authenticated callers can invoke only the intended company-creation and RLS membership helpers, while trigger-only routines cannot be called directly by clients.
- The new `public.whatsapp_cloud_messages` queue table exists, RLS is enabled, and row count is **zero**.
- Table privileges were verified: `anon` has no SELECT or INSERT; authenticated clients have SELECT and INSERT, but no direct UPDATE or DELETE.
- New queue RPC ACLs were verified: claim, finish, inbound-reply cancellation and provider-delivery updates are service-role-only. User cancel/retry functions are authenticated-only and enforce company membership plus creator/manager checks.
- No existing property, finance, contact, document or company data was moved or rewritten.

## Cloudflare

- Account plan: **Workers Free / Pages Free**. No paid upgrade or billing method was added.
- Pages project `axivestra` is deployed at https://axivestra.pages.dev.
- Pages automatic production deploys are linked to GitHub `main`.
- Workers and D1 are available on the account; no D1 database was created. D1 is intentionally omitted because the scheduled queue already lives in Supabase Postgres and duplicating queue state would create reconciliation risk.
- No Cloudflare Worker script is deployed yet. Worker source and one-minute Cron configuration are merged into `main` at `services/axivestra-whatsapp-worker`.
- The Worker source is intentionally not connected to a live Meta sender until server-side credentials and the official Meta business phone number are available.
- The Worker is designed for the free Workers tier. It processes one queued message per minute as a conservative initial rate within the frequent-Cron free CPU budget; throughput has not been field-tested.

## Official Meta WhatsApp cloud sender

- PR #5 adds the optional official Meta WhatsApp Business Platform path through a Cloudflare Worker.
- The Worker validates Supabase JWT/company membership for its status endpoint, checks one configured AXIVESTRA company ID, dispatches due messages with server-only credentials, verifies Meta webhook HMAC signatures, scopes webhook events to the configured phone-number ID, stops future follow-ups after inbound replies, and records sent/delivered/read/failed lifecycle status.
- Current cloud mode supports individual recipients only. WhatsApp groups and personal WhatsApp address-book discovery remain on the Windows linked-device path.
- Cloud scheduling requires explicit recipient consent; future outbound sends require approved Meta templates. Immediate free-form text is only allowed inside the Meta customer-service window.
- No Meta Business Platform app, approved sending number or secret credentials have been configured. No WhatsApp messages have been sent and no Meta message charges have been triggered.

## Merged implementation and CI

### PR #4 — merged
https://github.com/imtboss007/property-management-system/pull/4

- Least-privilege Supabase SECURITY DEFINER ACL hardening.
- Incremental WhatsApp contact identity deduplication and preservation of master-contact identity.

### PR #5 — merged
https://github.com/imtboss007/property-management-system/pull/5

- Cloudflare Worker scheduled dispatcher and Meta webhook code.
- Additive Supabase company-scoped WhatsApp cloud message queue and restricted RPC functions.
- Optional cloud sender integration in existing WhatsApp Automation screen.
- Worker tests and GitHub Actions workflow.
- Migration filenames aligned to exact versions recorded in live Supabase history.
- Deployment and security documentation updated.

The final merged main revision passed all GitHub Actions workflows:
- Windows installer build — success.
- Android APK build — success.
- Existing WhatsApp Hub/security checks — success.
- Supabase Edge Function type-check — success.
- Cloud Worker unit/security tests — success.
- Main branch release workflow — success.

## Remaining prerequisites before WhatsApp cloud activation

1. Sign in to the Supabase dashboard and add `https://axivestra.pages.dev` as the project Site URL and allowed redirect URL (including the required recovery/invite paths). This is not yet verified through the Supabase Auth settings UI.
2. Complete Meta WhatsApp Business Platform onboarding for the business and an approved sending number. The Cloud API is distinct from personal QR-linked WhatsApp.
3. Configure the Cloudflare Worker secrets from `services/axivestra-whatsapp-worker/README.md` using secure dashboards. Required values include Supabase service-role key, public project URL/key, Meta access token, phone-number ID, app secret, webhook verify token, configured company UUID and scheduler secret. Never store secrets in source, GitHub build variables, Windows or Android builds, or chat.
4. Create/deploy the Worker from the merged `main` source, configure the Meta webhook callback and subscribe to the WhatsApp `messages` field. Then set the public Worker URL and cloud feature flag in Pages build variables and rebuild the app.
5. Run an owner-approved live test with one consenting recipient. Verify sending while both client devices are off, template handling, inbound reply stop, delivery-status updates, failure/uncertain-send handling and company isolation. Do not send until the owner approves the recipient/content and any applicable Meta charges.

## Release gate and data safety

- No paid Cloudflare plan, D1 database, Render service or other paid host was created.
- No Meta message was sent.
- No existing local records, company rows, documents or WhatsApp QR session were migrated, deleted or overwritten.
- Green CI and a working Pages sign-in screen do not prove real authentication, full data sync, Meta delivery or production acceptance.
- Preserve the old device data and take verified backups before any future local data import, device reset or migration.
