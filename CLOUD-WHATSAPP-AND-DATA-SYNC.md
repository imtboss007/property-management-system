# AXIVESTRA always-on WhatsApp and cross-device data

## Recommended architecture — no paid hosting required

AXIVESTRA keeps its existing Supabase project as the source of truth for company records and the scheduled-message queue. A stateless Cloudflare Worker runs a one-minute Cron trigger and dispatches due messages through Meta's official WhatsApp Business Platform.

- **Supabase Postgres:** company-scoped records, access control, audit context and durable scheduled-message queue.
- **Cloudflare Workers Free:** scheduled dispatch, authenticated status endpoint and signed Meta webhook receiver.
- **Meta WhatsApp Business Platform:** official business sender for outbound individual messages and delivery-status callbacks.
- **D1:** intentionally not used. The queue already belongs in the existing Postgres database. A second copy in D1 would introduce duplicate state and synchronization work without a real benefit.

The Cloudflare account is on Workers Free / Pages Free. The Pages project `axivestra` is deployed at https://axivestra.pages.dev from GitHub main. The Worker source is merged into `main` at `services/axivestra-whatsapp-worker` but is not yet a live Worker deployment. No D1 database is created.

## WhatsApp modes

1. **Existing Windows linked-device mode:** keeps the existing QR-linked personal WhatsApp flow and group messaging. The Windows PC must remain on, awake, online and linked when a message is due.
2. **Official cloud sender:** uses a Meta WhatsApp Business Platform number and can dispatch from the cloud while Windows and Android are off. It uses a business phone-number ID and server-side access token—not the personal WhatsApp QR login. This first version supports individual phone-number destinations only; group messaging and reading a personal WhatsApp address book remain on the existing linked-device path.

Scheduled cloud messages must use a Meta-approved template because a future send may occur outside the 24-hour customer-service window. Immediate free-form text is only available when the recipient's service window permits it. Recipient opt-in/consent is required. Meta may charge for delivered business messages under its current pricing; no message will be sent as part of setup or testing without separate approval.

## Deployment prerequisites

The Cloudflare Worker is designed for the free Workers plan. The sender cannot be activated until the owner has a Meta Business Platform app, an approved/onboarded sending number and server credentials. Required Worker secrets are listed in `services/axivestra-whatsapp-worker/README.md`; they must be added in Cloudflare's secret manager and must never be placed in source, GitHub variables, APKs, Windows builds, or chat.

The queue migration is additive and is already applied as `20261031065632_whatsapp_cloud_scheduler`; it created an empty queue table and restricted RPC functions. It did not migrate or rewrite existing AXIVESTRA records. A Worker Cron must be deployed and the Meta webhook callback registered before delivery or stop-on-reply can work.

The current implementation restricts one Worker sender configuration to one AXIVESTRA company at a time. Independent sender numbers for multiple companies require separate Worker configurations and secrets.

## Cross-device business data

The existing Supabase company sync remains responsible for properties, master contacts, WhatsApp groups, tasks, financials, risks, approval requests and audit records. Both devices must use a fresh build configured with the same Supabase URL and public publishable key, sign in, and select the same company.

Existing local records should be imported only through the application's explicit import flow after confirming the target company and checking record totals. Do not overwrite or delete old local records during migration. A cloud login alone does not import a local-only database.

Document bytes remain in the existing local IndexedDB/document companion storage path; this Worker does not move files into Supabase Storage. Personal WhatsApp linked-device credentials and QR sessions also remain local to the existing linked-device sender.

## Validation boundary and release gate

Repository CI can validate application builds, Worker unit tests, SQL security contracts and webhook logic. It cannot prove a real Meta sender is approved, live webhook delivery, provider billing, or real recipient delivery.

Before production use, a dedicated consenting test recipient must be used to validate:
- dispatch with both client devices powered off;
- approved-template scheduling;
- signed inbound reply stops future follow-ups;
- Meta delivered/read/failed webhook states are reflected in AXIVESTRA;
- failed or uncertain sends are not silently auto-resubmitted;
- another AXIVESTRA company cannot use the configured sender.

No live message should be sent until the owner explicitly approves the test, the recipient and any applicable Meta charges.
