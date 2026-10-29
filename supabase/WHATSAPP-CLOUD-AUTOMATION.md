# AXIVESTRA always-on WhatsApp automation

This feature adds a cloud-stored message queue and a server-side dispatcher. Once activated, message timing is independent of the Windows PC and Android phone: both apps may be closed or both devices powered off.

**This source change is not a live deployment.** The cloud queue will not send until the migration is applied, the Edge Function is deployed, a one-minute scheduled invocation is active, the supported Meta WhatsApp Business Platform sender is connected, and the correct AXIVESTRA company is configured.

## What can sync

The existing Supabase workspace sync already covers properties, master contacts (including imported WhatsApp contacts once saved into the AXIVESTRA contact register), WhatsApp group records, tasks, financials, risks, approvals, and audit events. It needs a real Supabase project, the public URL/key embedded in fresh builds, a signed-in user, and the same company membership on both devices. The one-time Windows-to-Android QR is a local network companion connection; it is not an internet-wide database.

Document bytes and the personal WhatsApp linked-device authentication do not automatically become cloud data. Keep backup and document-sharing requirements separate.

## Important sender distinction

There are two modes:

- **Current Windows linked-device mode:** preserves the existing WhatsApp linked-device/QR flow and group messaging. The PC and its Windows session must be on, awake, online, and connected to WhatsApp at send time.
- **Cloud sender in this feature:** uses Meta's official WhatsApp Business Platform API. It can send while both devices are off, because the server holds the queue and dispatches due messages. It does not use the normal WhatsApp Web linked-device QR. It currently supports individual phone-number destinations, not WhatsApp groups or personal-address-book discovery. Master contacts already saved in AXIVESTRA remain available through company cloud sync.

Use a dedicated, approved Meta WhatsApp Business Platform sender. A personal WhatsApp number/QR alone is not sufficient to activate this service. Meta provider rules apply: outside the 24-hour customer-service window, use an approved message template. Recipients must expect and consent to messages. A queue status of sent means Meta accepted the API request, not that the recipient read it.

This implementation configures one hosted sending number for **one AXIVESTRA company workspace** at a time. The company ID guard prevents a global sender token from dispatching other companies' queued messages. Multi-company sending with independent numbers/credentials requires a separate sender configuration per company.

## Deployment

Use a dedicated Supabase project. Review and run all migrations in order, including the new `202610290005_whatsapp_cloud_scheduler.sql`. Existing production data should be backed up first. Do not put service-role keys, Meta access tokens, app secrets, scheduler secrets or webhook verification tokens in source code, a Vite variable, the Android APK, or an app settings screen.

### 1. Enable AXIVESTRA cloud records

1. Apply the four existing migrations (001–004), then apply migration 005.
2. Add repository Actions secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Build new Windows and Android packages after adding those secrets.
4. Open each app, sign in with the same AXIVESTRA account, and select the same company. On the first device, explicitly import the existing local records into the intended company. Check contact and property totals on both devices before relying on cloud sync.

The public publishable key is designed to be present in client apps; it is not a substitute for database row-level security. Never expose a secret/service-role key to the client.

### 2. Connect Meta WhatsApp Business Platform

1. In Meta's developer/business tools, create or select a WhatsApp Business Platform app and complete phone-number onboarding. Record its Phone Number ID and obtain an access token with only the permissions required to send and manage the WhatsApp account.
2. Determine the AXIVESTRA company UUID after signing into that company. Use that UUID for `AXIVESTRA_WA_COMPANY_ID`.
3. Generate independent long random values (at least 32 characters) for `AXIVESTRA_SCHEDULER_SECRET` and `META_WEBHOOK_VERIFY_TOKEN`. Keep them private. The App Secret is the Meta application's own secret, not a generated substitute.
4. Deploy the function:
   ```sh
   supabase functions deploy whatsapp-cloud-scheduler --no-verify-jwt
   supabase secrets set META_ACCESS_TOKEN='YOUR_META_ACCESS_TOKEN'
   supabase secrets set META_PHONE_NUMBER_ID='YOUR_META_PHONE_NUMBER_ID'
   supabase secrets set META_GRAPH_API_VERSION='v26.0'
   supabase secrets set AXIVESTRA_WA_COMPANY_ID='YOUR_AXIVESTRA_COMPANY_UUID'
   supabase secrets set AXIVESTRA_SCHEDULER_SECRET='YOUR_LONG_RANDOM_SCHEDULER_SECRET'
   supabase secrets set META_APP_SECRET='YOUR_META_APP_SECRET'
   supabase secrets set META_WEBHOOK_VERIFY_TOKEN='YOUR_LONG_RANDOM_VERIFY_TOKEN'
   ```
   The environment values above are placeholders, not real credentials. Use your own actual values only in the trusted Supabase CLI or server secret manager. Never send these values in chat.

### 3. Keep the cloud scheduler running

Enable the Supabase `pg_cron`, `pg_net`, and Vault extensions from the Supabase dashboard (or use the platform-supported extension setup). Then run the following SQL in the project's SQL editor after replacing the project URL and secret values using the secure dashboard/CLI workflow. Vault stores server-only secrets so they are not checked into the repository.

```sql
select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'axivestra_wa_project_url');
select vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'axivestra_wa_service_key');
select vault.create_secret('YOUR_SCHEDULER_SECRET', 'axivestra_wa_scheduler_secret');

select cron.schedule(
  'axivestra-whatsapp-cloud-tick',
  '* * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'axivestra_wa_project_url')
      || '/functions/v1/whatsapp-cloud-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'axivestra_wa_service_key'),
      'x-axivestra-scheduler-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'axivestra_wa_scheduler_secret')
    ),
    body := '{"action":"dispatch"}'::jsonb
  );
  $job$
);
```

Use the real service-role key only in Vault; never pass it into Vite or commit it. Keep the scheduler secret the same as the Edge Function secret. To inspect or remove the schedule, use `cron.job` and `cron.unschedule(jobid)` from the database. Confirm every SQL statement succeeds and that the scheduled job is running before scheduling a real message.

### 4. Configure replies and test

In Meta's Webhooks dashboard, subscribe the WhatsApp product to inbound `messages` notifications. Set the callback URL to `https://YOUR_PROJECT_REF.supabase.co/functions/v1/whatsapp-cloud-scheduler` and use the same value configured in `META_WEBHOOK_VERIFY_TOKEN` as the Verify Token. The handler verifies Meta's `X-Hub-Signature-256` signature with `META_APP_SECRET`; unsigned incoming content does not cancel messages.

Use a dedicated consenting test recipient first. Test: queue persists after closing apps; a due message sends with both devices powered off; future follow-ups cancel after a real reply; a failed send is not automatically retried (to avoid duplicates); cancellation/retry permissions; and that a second company cannot use the configured sender. Check the Supabase Edge Function logs, Cron job history, Meta delivery webhook events and recipient chat. Do not consider the service production-ready until this live test passes.

## Known limits

- The code is committed on a feature branch; migration and function are not applied/deployed to your live project by GitHub CI.
- Cloud sender supports text in the active customer-service window and approved templates otherwise; template name/language/variables must exactly match a template approved in Meta.
- Only individual contacts are enabled on cloud sender. Group sending stays on the existing Windows linked-device path.
- Internet, Supabase, Meta and valid credentials are still required at the scheduled time. If the cloud provider is down, delivery can fail or be delayed.
- This is application code, not a Meta/Supabase certification or a guarantee against provider outages, rate limits or policy enforcement.
