# EstateFlow WhatsApp Automation — Start Here

## What has been combined

EstateFlow now has a single integration for useful pieces of WA-AKG and OpenWA. You do not need to maintain two separate WhatsApp screens.

- One interface for connecting a WhatsApp gateway.
- QR / linked-device pairing flow through the selected gateway.
- Contacts and property-linked follow-up schedules.
- One-time and recurring messages, with a maximum of 20 messages per sequence.
- A saved queue, cancellation/retry, daily send limit and pause when the contact replies (after an authenticated inbound webhook is configured).
- One gateway sends each message. If both gateway APIs are configured in automatic mode, OpenWA is selected; WA-AKG is not used as a second sender. This prevents accidental duplicate sends.

## What still needs to be connected

Code in GitHub cannot log into your WhatsApp or create a server by itself. For real delivery, three things must exist:
1. A running gateway server (OpenWA or WA-AKG).
2. Its API address and API key, stored privately in the hub environment file.
3. A WhatsApp account paired with that gateway, plus an authenticated webhook URL for automatic stop-on-reply.

The adapter is not deployed yet and does not contain any live API keys or WhatsApp session credentials.

## What to install

For the gateway and hub, use a small server or a PC that can stay on and remain connected to the internet. Docker is the easiest way to run the hub; follow the provider's own setup instructions for the selected gateway:
- OpenWA: https://github.com/rmyndharis/OpenWA
- WA-AKG: https://github.com/mrifqidaffaaditya/WA-AKG

The hub itself lives in services/estateflow-whatsapp-hub. Copy .env.example to .env, replace both placeholder secrets with separate random values at least 32 characters long, then add the API address/key for the gateway server. Do not put secrets in the EstateFlow app, GitHub source files, chat messages, or Android APK.

Run local checks from that folder:

    npm install
    npm test
    npm start

Or configure .env and run:

    docker compose up -d --build

## Connect the EstateFlow app

Open WhatsApp Automation in EstateFlow. Enter the hub address and the same ESTATEFLOW_BRIDGE_TOKEN value saved privately in the hub's .env, then press Save hub connection. Use an HTTPS address for remote access. Use plain HTTP only on a trusted local network. Leave the hub fields empty on Windows if you intend to use the existing built-in desktop sender instead.

Then connect through QR first. Scan only with the WhatsApp account you intend to link. Use a dedicated test account while verifying the setup; unofficial WhatsApp Web gateways can be restricted by WhatsApp.

## Important boundaries

- This branch has not been merged into main.
- No AWS/host deployment has been performed.
- No gateway API key, WhatsApp number, QR session, or customer message has been configured or used.
- Do not message people who have not agreed to receive the messages. Keep stop-on-reply enabled and configure the authenticated inbound webhook before depending on automatic cancellation.
- The official WhatsApp Business Platform path already present in EstateFlow's Supabase functions is a safer option for production business messaging. The WA-AKG/OpenWA adapters here are for the unofficial linked-device gateway path and carry account-restriction risk.
