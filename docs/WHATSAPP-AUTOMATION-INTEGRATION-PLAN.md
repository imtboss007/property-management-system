# EstateFlow WhatsApp Automation — Integration Plan

## Status
Planning and integration boundary only. Neither WA-AKG nor OpenWA is installed, deployed, or connected by this document. No WhatsApp number, QR session, API key, message, or contact has been configured.

## Goal
Extend EstateFlow with a reliable contact-linked WhatsApp workflow for property leads, buyers, sellers, brokers, tenants, lenders, lawyers, and follow-ups:
- Link a contact to a phone number and an EstateFlow property/task.
- Create one-time and recurring scheduled reminders.
- Send only after an authorized user enables the schedule and confirms the message.
- Record attempts, provider message IDs, delivery/read events when available, inbound replies, and opt-outs.
- Pause follow-ups when a contact replies, opts out, a task is completed, or the schedule is disabled.
- Provide a manual review queue for failed sends, missing consent, and ambiguous inbound messages.
- Preserve the current local-only app behavior until a hosted backend is configured.

## Gateway options

### Option A — WA-AKG
Repository: https://github.com/mrifqidaffaaditya/WA-AKG
- Next.js dashboard with multi-session handling, contacts, scheduler, auto-replies, and webhooks.
- Exposes REST APIs and documents an API key header.
- MIT license was observed in the public repository LICENSE file when inspected; verify current upstream license and dependencies before distributing.
- Requires server/runtime and database configuration.
- Uses Baileys, an unofficial WhatsApp Web connection. Account restrictions are a real risk; do not use a primary personal/business number for initial experiments.

### Option B — OpenWA
Repository: https://github.com/rmyndharis/OpenWA
- Dashboard, REST API, webhook support, multi-session, schedule/automation integration paths, and n8n integration.
- Offers MCP endpoints with read-only tools by default when enabled; write tools require explicit configuration.
- Has session-scoped and chat-scoped API-key access controls documented upstream.
- MIT license is stated in the upstream README; verify current LICENSE before distributing.
- Uses unofficial WhatsApp Web engines (whatsapp-web.js/Baileys); account restrictions are possible. Do not use a primary personal/business number for experiments.

## Suggested architecture
EstateFlow desktop/Android UI
  -> authenticated EstateFlow backend (contact/property/task database)
  -> durable schedule queue + retry policy + audit log
  -> adapter interface
      -> WA-AKG REST/webhooks OR OpenWA REST/webhooks
  -> WhatsApp account/session

Keep the gateway behind the backend. Never embed gateway API keys in the Windows app, Android APK, browser code, or Git repository. Only server-side environment variables/secrets should contain credentials. Use HTTPS between deployed services and verify webhook signatures where supported.

## Recommended first milestone
1. Select one gateway only for the first implementation; do not operate both gateways against the same number.
2. Review current versions, license, security posture, API paths, and data flows.
3. Deploy privately and test using a dedicated disposable test number and consenting contacts.
4. Build a small adapter with mock tests first: contact validation, message preview, consent/opt-out, schedule create/cancel, inbound-reply pause, retries and audit log.
5. Add gateway integration behind a feature flag. Keep the existing click-to-chat workflow as a fallback.
6. Run end-to-end tests before enabling real sends.
7. Only then decide whether to open a pull request for merge into main.

## Messaging safety and user controls
- Require explicit opt-in / a documented lawful basis appropriate to the message; identify the business and give a clear opt-out route.
- Do not repeatedly send unwanted messages. Stop automated follow-up immediately on opt-out, reply requiring human attention, or manual pause.
- Use bounded retries and per-contact caps. Never implement an infinite “send until reply” loop.
- Respect WhatsApp policies and applicable Indian privacy and communications law. For production/customer messaging, assess Meta's official WhatsApp Business Platform as the lower-compliance-risk option; unofficial gateways may cause account restrictions.
- Keep an audit record of who scheduled/approved a message, intended recipient, template/body, timestamps, provider response, and cancellation reason. Avoid storing unnecessary chat content.

## Acceptance criteria before production
- Secrets absent from source and client builds.
- Authentication and authorization tested.
- Contact-to-property/task linkage tested.
- No message sent without user approval and recipient eligibility.
- Reply/opt-out pauses the schedule.
- Duplicate prevention and bounded retry tests pass.
- Webhook authenticity/replay handling is tested.
- Backup/restore and data retention are documented.
- Successful test delivery is verified on a dedicated number.
- Main remains unchanged until reviewed and approved.

## Source repositories
- WA-AKG: https://github.com/mrifqidaffaaditya/WA-AKG
- OpenWA: https://github.com/rmyndharis/OpenWA
