-- AXIVESTRA approval permissions.
-- Staff may submit pending approval requests, but only owner/admin/manager may change
-- approval records or create them in a decided state. This is enforced by restrictive
-- RLS policies so it cannot be bypassed by direct Data API requests.

drop policy if exists "approval updates require management role" on public.company_records;
create policy "approval updates require management role"
on public.company_records
as restrictive
for update
to authenticated
using (
  record_type <> 'approval'
  or public.has_company_role(company_id, array['owner','admin','manager'])
)
with check (
  record_type <> 'approval'
  or public.has_company_role(company_id, array['owner','admin','manager'])
);

drop policy if exists "staff can only submit pending approvals" on public.company_records;
create policy "staff can only submit pending approvals"
on public.company_records
as restrictive
for insert
to authenticated
with check (
  record_type <> 'approval'
  or coalesce(nullif(payload ->> 'status', ''), 'pending') = 'pending'
  or public.has_company_role(company_id, array['owner','admin','manager'])
);
