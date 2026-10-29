-- AXIVESTRA private company document vault in Supabase Storage.
-- Apply after the four company/RBAC migrations. File bytes live in a private bucket;
-- company_records holds the metadata and deletion tombstone for each document.

insert into storage.buckets (id, name, public, file_size_limit)
values ('axivestra-company-documents', 'axivestra-company-documents', false, 26214400)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "AXIVESTRA company document members can read" on storage.objects;
create policy "AXIVESTRA company document members can read"
on storage.objects for select to authenticated
using (
  bucket_id = 'axivestra-company-documents'
  and exists (
    select 1
    from public.company_memberships membership
    where membership.company_id::text = (storage.foldername(name))[1]
      and membership.user_id = auth.uid()
  )
);

drop policy if exists "AXIVESTRA company members can add documents" on storage.objects;
create policy "AXIVESTRA company members can add documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'axivestra-company-documents'
  and exists (
    select 1
    from public.company_memberships membership
    where membership.company_id::text = (storage.foldername(name))[1]
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'admin', 'manager', 'staff')
  )
);

drop policy if exists "AXIVESTRA company members can update documents" on storage.objects;
create policy "AXIVESTRA company members can update documents"
on storage.objects for update to authenticated
using (
  bucket_id = 'axivestra-company-documents'
  and exists (
    select 1
    from public.company_memberships membership
    where membership.company_id::text = (storage.foldername(name))[1]
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'admin', 'manager', 'staff')
  )
)
with check (
  bucket_id = 'axivestra-company-documents'
  and exists (
    select 1
    from public.company_memberships membership
    where membership.company_id::text = (storage.foldername(name))[1]
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'admin', 'manager', 'staff')
  )
);

drop policy if exists "AXIVESTRA managers can delete documents" on storage.objects;
create policy "AXIVESTRA managers can delete documents"
on storage.objects for delete to authenticated
using (
  bucket_id = 'axivestra-company-documents'
  and exists (
    select 1
    from public.company_memberships membership
    where membership.company_id::text = (storage.foldername(name))[1]
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'admin', 'manager')
  )
);
