# AXIVESTRA — Asset Intelligence Platform

A connected asset intelligence platform for property, finance, investments, legal work and operations, packaged for Windows desktop and Android mobile. Includes an animated navy/cyan command centre, selectable interactive charts, module-specific workbenches, data-completeness audits, a scrollable 16-module directory, and synced WhatsApp contacts/groups. GitHub Actions builds a Windows `.exe` installer and Android `.apk`; successful builds are available as GitHub Actions artifacts.

## AXIVESTRA interface

- AXIVESTRA brand system with a metallic/electric-blue architectural emblem, animated grid/orbit motifs, responsive side navigation and motion-aware effects.
- Portfolio intelligence with selectable ring, bar and line charts; module-level status, value and follow-up analysis; interactive legends.
- Every business module supports cards, tables, pipeline board, and data-health views with module-specific fields and stakeholders.

## Included in this build

- Sixteen connected workspaces: Property Sale, Property Loans, JV / JDA / JD, SR Rate Settlement, Agricultural Land, Commercial Land, Startup, Equity, Unsecured Company Loan, Personal Loan, Housing Loan, House Purchase, Litigation, Fund & Portfolio Management, Investor Relations, and Compliance & KYC.
- Property records with module, location, value, status, contact, and notes.
- Contact register for buyers, sellers, brokers, lawyers, lenders, tenants, developers, and others.
- Master contact intelligence: multiple simultaneous standard/custom roles, profession, employer, designation, business type, associated company, optional income sources, email/address and referral context; role and professional fields appear in contact search/cards.
- Phone-match duplicate warning before creating a new contact; it does not silently merge records.
- One-time task records with date, time, type, linked property, notes, completion, and delete.
- WhatsApp click-to-chat helper that opens a prefilled message.
- Local data persistence in the app's browser/device storage, IndexedDB document vault, and JSON backup/restore.
- Responsive layouts for desktop and mobile.

## Local-first architecture

AXIVESTRA does not use Supabase or require a hosted database. Business records stay in the device's existing browser storage; document files are stored in a local IndexedDB vault using [Dexie.js](https://github.com/dexie/Dexie.js) (Apache-2.0). JSON backup/restore covers business records; download document files separately before changing devices or clearing app data. No automatic PC-to-Android synchronization or cloud login is provided. The Windows WhatsApp linked-device workflow remains a separate local companion service and requires its own gateway/runtime configuration.

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
