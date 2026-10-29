# AXIVESTRA — Asset Intelligence Platform

AXIVESTRA is a local-first property, finance, investment, legal and operations workspace packaged for Windows desktop, Android and browser use. It includes an animated navy/cyan command centre, interactive charts, module-specific workbenches, data-completeness audits and a 16-module directory.

## Included workspaces

- Sixteen workspaces: Property Sale, Property Loans, JV / JDA / JD, SR Rate Settlement, Agricultural Land, Commercial Land, Startup, Equity, Unsecured Company Loan, Personal Loan, Housing Loan, House Purchase, Litigation, Fund & Portfolio Management, Investor Relations, and Compliance & KYC.
- Property records with module, location, value, status, contact, and notes.
- Contact register for buyers, sellers, brokers, lawyers, lenders, tenants, developers, and others.
- Master contact intelligence: multiple standard/custom roles, profession, employer, designation, business type, associated company, optional income sources, email/address and referral context.
- Phone-match duplicate warning before creating a contact; records are not silently merged.
- One-time tasks with date, time, type, linked property, notes, completion and delete.
- WhatsApp click-to-chat helper and a WhatsApp Automation screen for a configured companion gateway.
- Local data persistence, IndexedDB document vault, and JSON backup/restore.
- Responsive desktop and mobile layouts.

## Local-first architecture — no Supabase

AXIVESTRA's core application does not use Supabase and does not require a hosted database. Business records are stored in the browser/device's local storage; document files are stored in a local IndexedDB vault using [Dexie.js](https://github.com/dexie/Dexie.js) (Apache-2.0).

**Local storage is per installation/device.** Data does not automatically synchronize between browser, Windows and Android. JSON backup/restore covers business records; download document files separately before moving devices or clearing app data. The app does not provide a cloud login or remote database.

WhatsApp linked-device automation is a separate companion service. It requires a compatible gateway, a running companion service, private gateway credentials and appropriate webhook configuration for stop-on-reply. QR/pairing, sending, reply cancellation and Android-to-PC connectivity still require live end-to-end testing on the actual gateway and devices. Unofficial WhatsApp Web gateways may risk account restrictions; use a dedicated test number and only message people who expect or consent to receive messages.

## Build Windows + Android

The GitHub Actions workflow is `.github/workflows/main.yml`. It runs on pushes to `main`, pull requests targeting `main`, or manual dispatch from the Actions tab. The workflow builds a Windows `.exe` installer and Android debug `.apk`, then uploads each as an Actions artifact. It does not automatically publish a GitHub Release.

1. Open the repository's **Actions** tab.
2. Open the successful **AXIVESTRA Windows and Android builds** run.
3. Download the `AXIVESTRA-Windows` and/or `AXIVESTRA-Android` artifact.
4. Install the Windows installer on Windows. On Android, open the APK and approve installation from that source if prompted.

The Android project is created on the GitHub runner with `npx cap add android`, then synced and built. It is a generated build output and is not required to be committed to this source branch.

## Run in a browser for development

Requires Node.js 22 and npm.

```bash
npm install
npm run dev
```

## Package locally

Windows (run on Windows):

```bash
npm install
npm run desktop:dist
```

Android (requires Java 17 and Android SDK):

```bash
npm install
npm run build
npx cap add android
npx cap sync android
cd android
./gradlew assembleDebug
```

## Repository layout

- `src/` — app interface and features
- `electron/` — Windows desktop entry point
- `capacitor.config.ts` — shared Android wrapper configuration
- `.github/workflows/main.yml` — Windows and Android build workflow
- `services/estateflow-whatsapp-hub/` — separate WhatsApp companion adapter

## Security

Do not place API tokens, WhatsApp linked-session credentials, QR codes, pairing codes or signing keys in source files. Keep the companion service and gateway on a trusted private network; do not expose raw HTTP endpoints to the public internet. Back up local data before clearing app storage or changing devices.
