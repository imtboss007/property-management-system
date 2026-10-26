# EstateFlow — Property Management System

A mobile-first React + TypeScript + Vite starter for a property management workspace.

## Included in this starter

- Premium responsive dashboard UI
- Six property module entry points:
  - Property Sale
  - Property Loans
  - JV / JDA / JD
  - SR Rate Settlement
  - Agricultural Land
  - Commercial Land
- Navigation placeholders for contacts, documents, schedules and WhatsApp automation
- Search field and mobile navigation

## Run locally

Install Node.js 20 or newer, then run:

```bash
npm install
npm run dev
```

To create a production build:

```bash
npm run build
npm run preview
```

## Important implementation status

This ZIP is the **starter UI**, not yet a complete deployed property management system. The dashboard currently uses placeholder navigation and does not yet persist property records, authenticate users, execute background schedules, or send/detect WhatsApp messages.

Those require subsequent implementation of a backend/database, authentication, durable scheduler/worker, and an authorized WhatsApp integration. Never put API secrets in frontend code.

Default time zone for the intended scheduler: `Asia/Kolkata`.
