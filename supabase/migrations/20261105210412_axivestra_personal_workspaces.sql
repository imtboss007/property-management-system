create table if not exists public.personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_type text not null check (record_type in (
    'property','contact','document_metadata','task','financial','risk',
    'approval','whatsapp_group','audit_event','settings'
  )),
  record_key text not null check (length(record_key) between 1 and 180),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  unique (user_id, record_type, record_key)
);
create index if not exists personal_records_scope_idx
  on public.personal_records(user_id, record_type, updated_at desc);
alter table public.personal_records enable row level security;
revoke all on table public.personal_records from anon, authenticated;
grant select, insert, update, delete on table public.personal_records to authenticated;
drop policy if exists "users read own personal records" on public.personal_records;
create policy "users read own personal records" on public.personal_records
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "users insert own personal records" on public.personal_records;
create policy "users insert own personal records" on public.personal_records
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (select auth.uid()) = created_by
    and (select auth.uid()) = updated_by
  );
drop policy if exists "users update own personal records" on public.personal_records;
create policy "users update own personal records" on public.personal_records
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and (select auth.uid()) = updated_by);
drop policy if exists "users delete own personal records" on public.personal_records;
create policy "users delete own personal records" on public.personal_records
  for delete to authenticated using ((select auth.uid()) = user_id);
create or replace function public.guard_personal_record_identity()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $personal$
begin
  if auth.uid() is null then
    raise exception 'Authentication required for a personal workspace.';
  end if;
  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid() then
      raise exception 'Personal workspace owner must match the signed-in user.';
    end if;
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
    return new;
  end if;
  if old.user_id is distinct from new.user_id
     or old.record_type is distinct from new.record_type
     or old.record_key is distinct from new.record_key then
    raise exception 'Personal workspace owner, record type and record key are immutable.';
  end if;
  new.created_by := old.created_by;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$personal$;
revoke all on function public.guard_personal_record_identity() from public, anon, authenticated;
drop trigger if exists personal_records_identity_guard on public.personal_records;
create trigger personal_records_identity_guard
  before insert or update on public.personal_records
  for each row execute function public.guard_personal_record_identity();
