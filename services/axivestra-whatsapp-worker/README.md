# AXIVESTRA WhatsApp Cloud Worker

This Worker provides the always-on scheduled dispatcher and Meta webhook endpoint. It is designed for Cloudflare Workers Free and the existing AXIVESTRA Supabase project.

## Architecture

- Supabase Postgres is the durable, company-scoped message queue and source of truth.
- Cloudflare Worker Cron runs once per minute and claims due rows through service-role-only Postgres RPC functions.
- Meta WhatsApp Business Platform is the sender. It does not use WhatsApp Web QR or a personal linked-device session.
- Both the Windows PC and Android phone may be off while a scheduled message is dispatched.
- D1 is deliberately not used. Supabase already provides the durable queue, tenant RLS and audit context; duplicating the queue in D1 would add split-brain and reconciliation risk without improving this workflow.

## Deploy prerequisites

1. Apply the AXIVESTRA migrations in order, including `supabase/migrations/202610310002_whatsapp_cloud_scheduler.sql`.
2. Connect an approved Meta WhatsApp Business Platform sender and a phone number ID.
3. Know the target AXIVESTRA company UUID. The sender is intentionally restricted to one company per Worker deployment.
4. Configure the following Worker secrets (never put them in Vite variables, client apps, source control or chat):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` (or the public publishable key)
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `META_ACCESS_TOKEN`
   - `META_PHONE_NUMBER_ID`
   - `AXIVESTRA_WA_COMPANY_ID`
   - `AXIVESTRA_SCHEDULER_SECRET` (at least 32 random characters)
   - `META_APP_SECRET`
   - `META_WEBHOOK_VERIFY_TOKEN` (at least 32 random characters)
5. Deploy from this directory using Wrangler. The configured Cron trigger is one minute.
6. Configure the Meta webhook callback as `https://<worker-subdomain>.workers.dev/webhook`, subscribe to WhatsApp `messages`, and use the same verify token in the Meta console.

## Local checks

```sh
npm test
```

## HTTP endpoints

- `GET /health`: non-sensitive liveness check.
- `POST /status`: validates the signed-in Supabase user and company membership, then verifies the Meta sender.
- `POST /dispatch`: optional manual dispatch; requires `x-axivestra-scheduler-secret`.
- `GET /webhook`: Meta webhook challenge verification.
- `POST /webhook`: verifies the Meta HMAC signature, cancels future follow-ups on an inbound reply, and stores sent/delivered/read/failed status events.

## Safety controls

- No dispatch occurs until all required server secrets are present.
- A sender is restricted to one configured AXIVESTRA company UUID.
- The queue requires explicit consent and only allows permitted company roles to insert rows.
- Claim and completion functions are service-role-only.
- A message left in `sending` for more than ten minutes is changed to `failed` with an uncertain-delivery warning. It is never silently resent.
- A successful send means Meta accepted the API request; `delivered` and `read` are separate webhook states.
- This is not production-ready until Meta credentials, webhook, approved templates and a live consenting test are configured and verified.
