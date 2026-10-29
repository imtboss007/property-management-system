# AXIVESTRA hosted authentication/RBAC setup

## Current state
The SQL migration in `supabase/migrations/202610290001_auth_company_rbac.sql` establishes database-level company membership and row-level access policies. It is a backend foundation, **not a complete login integration**. The current app remains local-first until the Supabase client, sign-in screens, company context, and migration flow are implemented and tested.

## Setup requirements
1. Create a dedicated Supabase project for AXIVESTRA (do not use a production database for experiments).
2. Review and apply the SQL migration in the Supabase SQL editor or via Supabase CLI.
3. Configure email/password or another supported sign-in method, recovery, redirect URLs, and rate limits in Supabase Auth.
4. Store only the project URL and public/anon key in client build configuration. Never put the service-role key in the browser, Android APK, Windows renderer, or public repository.
5. Bootstrap the first company and owner membership using a trusted administrative operation. The client is intentionally not allowed to self-assign the owner role.
6. Implement the app integration and tests before migrating any real local records.

## Roles
- `owner`: company governance and all operational records.
- `admin`: company administration and operational records, but client policies prevent assigning/removing owner membership.
- `manager`: operational create/read/update/delete and review workflows.
- `staff`: operational create/read/update; no record deletion.
- `read_only`: read-only company access.

## Important security limits
- Never treat hidden UI controls or localStorage as authorization.
- Every cloud record must be stored with its company_id and accessed through RLS.
- Company creation, ownership transfer, owner removal, invitation acceptance, and account recovery need trusted flows and audit logging.
- Document bytes and WhatsApp linked-device credentials are not included in `company_records`; design separate protected storage/secret handling.
- The first migration deliberately has no public or client policy to create a company or assign an owner.
- Review policies against your required business rules before production. Apply migrations first to a test project and run cross-company isolation tests.

## Next implementation steps
1. Add Supabase client dependency and environment variable validation.
2. Build login, logout, recovery and session refresh screens.
3. Add company selection and membership/role context.
4. Migrate local records with backup, preview, explicit company assignment and rollback.
5. Add integration tests proving one company cannot read or modify another company's records.
6. Only then enable cloud sync for real business data.
