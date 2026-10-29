# AXIVESTRA always-on WhatsApp sender and cross-device data

## What this adds

The hosted sender is a separate, continuously running Node service. It uses the existing AXIVESTRA queue, retry/cancellation rules, per-message history, daily cap, rate limit, saved address book and stop-on-reply behavior. In cloud mode, the WhatsApp account is linked to the hosted sender by scanning its QR code or using a pairing code. The linked session and scheduled queue are stored on the host's persistent disk, not on the Windows or Android device.

This is what makes sending possible when the Windows app and Android app are both closed or switched off. The hosting service still needs to be online, the persistent disk must remain attached, and the WhatsApp session must still be connected. If the host is unavailable, the account is unlinked, or WhatsApp/Internet is unavailable, delivery is not guaranteed. The scheduler marks overdue rows failed after its current 30-minute recovery window rather than sending an old message unexpectedly.

## Deployment

1. Push this repository to GitHub.
2. In Render, create a new Blueprint from this repository and allow it to read render.yaml. The blueprint selects a persistent disk and the direct Baileys transport; Render will generate the two server-side random secrets.
3. Use a paid always-on service with a persistent disk. Do not replace it with an ephemeral filesystem, free sleeping service or an ordinary GitHub Actions job. The WhatsApp session files and queue must survive restarts.
4. After the service is deployed, copy its HTTPS service URL. Do not publish the hub token or include it in frontend build variables.
5. Deploy the Supabase Edge Function whatsapp-cloud-proxy and configure the secrets documented in SUPABASE-AUTH-SETUP.md. This keeps the hub token on the server, checks that the signed-in user belongs to the configured AXIVESTRA company, and lets the Windows/Android builds call the hosted sender without exposing the bridge secret.
6. Build both apps with VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, and VITE_AXIVESTRA_WHATSAPP_CLOUD_ENABLED=true. The final variable is a public feature switch; it is not a secret.
7. Sign in on both devices with the same AXIVESTRA account/company. Open WhatsApp Automation and choose Connect with QR. On the phone, open WhatsApp → Linked devices → Link a device and scan the QR shown by AXIVESTRA. Pair the account to the cloud sender, not to a local Windows-only sender. Once connected, the hosted process continues scheduling independently of the app windows.

The service secrets are generated in Render and must be read from its service environment when configuring the server-side Supabase function secrets. Never put the generated bridge token in source, an APK, a Windows installer, a public issue, or a VITE variable.

## Important WhatsApp account note

Direct QR linking uses the unofficial WhatsApp Web protocol through Baileys. This is convenient for testing and matches the existing QR-based AXIVESTRA workflow, but it is not the official WhatsApp Business Platform and WhatsApp may change the protocol or restrict an account. Test with a dedicated number first. For critical, high-volume or customer-facing production messaging, prefer Meta's official WhatsApp Business Platform; that option requires Meta Business onboarding and a valid server-side access token and phone-number ID rather than simply scanning a linked-device QR.

Send scheduled messages only to people who have consented or reasonably expect them. The scheduler has cancellation/retry behavior, a daily safety cap, a cooldown and explicit send confirmation, but no software can guarantee a message reaches or is read by a recipient.

## Business-data synchronization

AXIVESTRA already has company-scoped Supabase synchronization for properties, contacts, WhatsApp groups, tasks, financials, risks, approval requests and audit records. It reconciles changes and cloud deletion tombstones between signed-in clients. It works only when the Supabase project is configured, the ordered migrations are applied, a user signs in, and both devices use the same company. Merely pairing a WhatsApp number does not provide a database or synchronize property records.

The WhatsApp sender's saved WhatsApp contact/group directory is stored with the hosted sender and can be read on either connected device. Imported contacts become normal AXIVESTRA company contacts when imported into the contact register; those records then follow the existing company sync. Document file bytes currently remain in the local IndexedDB vault/companion sync path and are not automatically uploaded to Supabase Storage by this change.

## Validation boundary

Automated repository checks can validate the service, build artifacts, route security and queue behavior. They do not link a real WhatsApp account, provision a Render service, configure a user's Supabase project, or prove live message delivery. Those steps require accounts and credentials controlled by the owner.
