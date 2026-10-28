# AXIVESTRA — Asset Intelligence Platform

A connected asset intelligence platform for property, finance, investments, legal work and operations, packaged for Windows desktop and Android mobile. Includes an animated navy/cyan command centre, selectable interactive charts, module-specific workbenches, data-completeness audits, a scrollable 16-module directory, and synced WhatsApp contacts/groups. GitHub Actions builds a Windows `.exe` installer and Android `.apk`; successful builds are published in GitHub Releases.

## AXIVESTRA interface

- AXIVESTRA brand system with a metallic/electric-blue architectural emblem, animated grid/orbit motifs, responsive side navigation and motion-aware effects.
- Portfolio intelligence with selectable ring, bar and line charts; module-level status, value and follow-up analysis; interactive legends.
- Every business module supports cards, tables, pipeline board, and data-health views with module-specific fields and stakeholders.

## Included in this build

- Six property workspaces: Property Sale, Property Loans, JV / JDA / JD, SR Rate Settlement, Agricultural Land, and Commercial Land.
- Property records with module, location, value, status, contact, and notes.
- Contact register for buyers, sellers, brokers, lawyers, lenders, tenants, developers, and others.
- One-time task records with date, time, type, linked property, notes, completion, and delete.
- WhatsApp click-to-chat helper that opens a prefilled message.
- Local data persistence in the app's browser/device storage and JSON backup/restore.
- Responsive layouts for desktop and mobile.

## Important scope notes

This is the cross-platform installable MVP. Data is stored locally on each device and does not yet synchronize between PC and Android. Saved tasks are records; reliable background notifications require a hosted scheduler and notification channel. The WhatsApp screen opens a prefilled chat but does not auto-send, repeat messages, or detect inbound replies. These production automation features require a deployed backend, WhatsApp Business Platform credentials, webhook configuration, message-template compliance where applicable, consent/opt-out handling, and server-side job tracking. Secure cloud login, roles, and cloud document storage are not yet connected.

## Download Windows + Android from this repository

1. Upload this repository's files to your GitHub repository and push them to `main` (or `master`).
2. Open the repository's **Actions** tab. Allow the workflow to finish successfully.
3. The workflow publishes an `AXIVESTRA Build N` entry in **Releases** with both the Windows `.exe` installer and Android `.apk`.
4. On Windows, download and run the `.exe`. On Android, download the `.apk`, open it, and approve installation from that source if Android asks.

The first successful Android build runs `npx cap add android` in the GitHub runner, so the generated native Android project is a build output and isn't required to be committed into this source archive.

## Run in a browser for development

Requires Node.js 22 and npm.

```bash
npm ci
npm run dev
```

## Packaging locally

Windows (run on Windows):

```bash
npm ci
npm run desktop:dist
```

Android (requires Java 17 and Android SDK):

```bash
npm ci
npm run build
npx cap add android
npx cap sync android
cd android
./gradlew assembleDebug
```

## Repository files

- `src/` — app interface and features
- `electron/` — secure Electron desktop entry point
- `capacitor.config.ts` — shared Android wrapper config
- `.github/workflows/build-release.yml` — automatic Windows/APK build and release workflow

## Security

Do not place API tokens or signing keys in source files. Use GitHub Actions secrets for future production backend and signing configuration.
