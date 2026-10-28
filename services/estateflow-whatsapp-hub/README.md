# EstateFlow WhatsApp Hub

This small adapter lets the existing EstateFlow WhatsApp screen use one normalized API while the transport underneath is OpenWA or WA-AKG. It combines useful patterns from both projects:

- A persistent scheduler with one-time and recurring client follow-ups.
- Gateway API access, QR/pairing flow, and connection status.
- Syncable WhatsApp contacts, phone numbers/display names, and group names cached in the hub's persistent data directory.
- Individual or group destinations linked to EstateFlow contacts, properties/deals and tasks; group sends require the exact group ID to have been confirmed for the currently synced account.
- EstateFlow-owned queue, opt-in confirmation, stop-on-contact-reply or group activity, cancellation/retry, cooldown, daily cap, and message history fields.
- One common API so EstateFlow does not need separate screens for the two gateway products.

This adds integration code; it does not copy either upstream project's source code. If both gateways are configured with the automatic setting, OpenWA is selected as the only active transport. EstateFlow never sends a queued message through both providers.

## WhatsApp account warning

Both WA-AKG and OpenWA use unofficial WhatsApp Web connections. They can expose a linked account to restriction or logout. Use a dedicated test number first; do not begin with a primary personal or business number. For production customer messaging, EstateFlow's existing Supabase functions for the official WhatsApp Business Platform are the preferred compliance-oriented route.

Only message people who have opted in or otherwise expect the communication. The repeat cap is 20 messages per sequence, sends are rate-limited, and the system does not create an infinite “send until reply” loop. A “sent” result means the gateway accepted the send request; it does not mean that the recipient read it.

## Simple setup

1. Run one gateway server. Do not create two sessions for the same WhatsApp number in both gateways.
2. Copy the example environment file to a real .env file.
3. Generate two different random secrets, each at least 32 characters long. Put one in ESTATEFLOW_BRIDGE_TOKEN and the other in ESTATEFLOW_WEBHOOK_TOKEN.
4. Put the gateway API address and key in the matching settings below:
   - OpenWA API base URL usually ends in /api and its default port is 2785.
   - WA-AKG API base URL usually ends in /api and its default port is 3000.
   - A session ID is optional; the hub can create a session named estateflow and remember its ID when you connect.
5. Leave ESTATEFLOW_GATEWAY_PROVIDER as auto. It detects whichever gateway is configured. If both are set, OpenWA is selected deterministically so no message is sent twice.
6. Use HTTPS for gateway endpoints reached over an untrusted network. Allow insecure HTTP only on a trusted local/Docker network. Do not expose either the hub or gateway directly to the public internet.
7. Start the hub from this directory by running npm install, npm test, then npm start. To use Docker, configure .env first and run docker compose up -d --build.

The service refuses to start if either secret is missing or too short. The runtime data directory stores the session ID and queue and is excluded from Git. Back it up securely. Never commit .env, API keys, linked-session credentials, QR codes, or pairing codes.

## Connect EstateFlow

In the WhatsApp Automation screen, enter the hub's address and ESTATEFLOW_BRIDGE_TOKEN in the companion connection section. For a PC and phone on the same trusted LAN, use the PC's private LAN address. For remote access, use an HTTPS reverse proxy and its HTTPS address. The supplied Docker Compose file binds the hub to host loopback by default. For an Android phone on the same LAN, set HUB_BIND_IP in .env to the host's private LAN IP and restrict port 47822 with the host firewall to that LAN only; never expose raw HTTP on a public interface. For cloud access, keep the hub bound to loopback and use an HTTPS reverse proxy. ESTATEFLOW_PUBLIC_WEBHOOK_URL must be a public HTTPS URL ending in /api/webhook/incoming.

The endpoints mirror EstateFlow's companion API:
- GET /api/status
- GET /api/queue
- GET /api/address-book
- POST /api/sync-address-book
- POST /api/connect
- POST /api/pairing-code
- POST /api/disconnect
- POST /api/schedule
- POST /api/send-now
- POST /api/cancel
- POST /api/retry

Every /api endpoint requires the X-EstateFlow-Token header. The public health endpoint reveals configuration state only, not credentials.

## QR and pairing

Use Connect with QR in EstateFlow. If pairing by phone number is preferred, use the pairing-code control. On the phone, open WhatsApp, then Linked devices, and follow the on-screen linking steps. The hub asks the configured gateway to create or start a session, then reads its connection state and QR endpoint.

Gateway versions may change their response format. Before linking a real number, verify that /api/status returns the real status and QR image from the installed gateway version. The adapter reports status errors instead of assuming a connection worked.

## Stop follow-ups after a reply

Set ESTATEFLOW_PUBLIC_WEBHOOK_URL to the hub's public HTTPS URL ending in /api/webhook/incoming. After the WhatsApp session is started, the hub registers a message.received webhook with the selected provider:
- OpenWA: POST /api/sessions/{sessionId}/webhooks and verifies the X-OpenWA-Signature HMAC header.
- WA-AKG: POST /api/webhooks/{sessionId} and verifies the X-Webhook-Signature HMAC header.

Both signatures are checked against the exact raw request body with ESTATEFLOW_WEBHOOK_TOKEN. The app shows a warning when stop-on-reply is not configured. The hub does not treat a mere status response or an unsigned webhook as an authenticated reply.

A verified private one-to-one inbound message cancels pending follow-ups for that number. A verified incoming group message cancels the remaining pending sequence for that same group when stop-on-reply is enabled. Messages sent from your own account are ignored. Test the signature and payload with a consenting test contact and test group before using production recipients.

## Scope and deployment status

This adapter implements the unified interface and local queue. It still requires a running upstream gateway, server credentials, webhook configuration, and live end-to-end testing. No gateway has been deployed or linked by committing these files. See the main EstateFlow repository's setup notes for its official WhatsApp Business Platform path, which remains separate from these unofficial gateway adapters.
