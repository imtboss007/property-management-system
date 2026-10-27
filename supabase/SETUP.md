# EstateFlow backend setup

EstateFlow can run in local-only mode without credentials. To enable secure shared data across the Windows and Android builds, connect a Supabase project.

## 1. Create the project
Create a Supabase project from the Supabase dashboard. Keep the project URL and publishable/anon key available. Do not use a `service_role` key in the app.

## 2. Create the tables and private document bucket
Open the project's SQL Editor, copy the complete contents of `supabase/migrations/202610270001_estateflow_core.sql` from this repository, and run it.

The migration creates owner-scoped tables for:
- Property records across all six EstateFlow modules
- Contacts
- One-time tasks and due dates
- Private document metadata
- Financial transactions
- WhatsApp follow-up queue metadata
- Audit events

It also creates a private `property-documents` Storage bucket with user-folder policies. Do not make the bucket public.

## 3. Enable login
In Supabase Authentication, enable Email/Password sign-in. If email confirmation is enabled, new users must confirm their email before signing in.

## 4. Configure Windows and Android builds
In GitHub, open **Settings → Secrets and variables → Actions → Variables** and add:
- `VITE_SUPABASE_URL` = your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` = your Supabase publishable/anon key

These are client-side values; database access must be protected by the row-level security policies in the migration. Never place a `service_role` key or WhatsApp access token in a `VITE_` variable.

A commit to `main` triggers a new Windows installer and Android APK build with these values embedded. Without the two variables, the app stays in local-only mode.

## Current integration scope
The current frontend has authentication and remote load/save/delete sync wired for property records, contacts, and tasks. The local cache is separated by signed-in user. The schema includes document, financial and WhatsApp queue tables, but their full upload/transaction/automated-send workflows still need front-end and server-side integration.

A date/time stored by the app is not a reliable background reminder by itself. Server scheduling and WhatsApp sending/reply webhooks require a deployed trusted server-side worker and authorized WhatsApp Business Platform credentials. Keep those secrets server-side.
