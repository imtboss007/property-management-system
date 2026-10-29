-- AXIVESTRA authentication, company isolation and RBAC foundation.
-- Apply only to a dedicated Supabase project after reviewing the deployment guide.
-- This migration does not alter the local-first app until the client integration is enabled.

create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict
);

create table if not exists public.company_memberships (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','manager','staff','read_only')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  primary key (company_id, user_id)
);

create index if not exists company_memberships_user_idx on public.company_memberships(user_id);

create table if not exists public.company_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  record_type text not null check (record_type in (
    'property','contact','document_metadata','task','financial','risk',
    'approval','whatsapp_group','audit_event','settings'
  )),
  record_key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  unique (company_id, record_type, record_key)
);

create index if not exists company_records_scope_idx
  on public.company_records(company_id, record_type, updated_at desc);

create table if not exists public.company_audit_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('created','updated','deleted','member_added','member_role_changed','member_removed','company_settings_changed')),
  entity_type text not null,
  entity_key text not null,
  label text not null default '',
  occurred_at timestamptz not null default now()
);

create index if not exists company_audit_scope_idx
  on public.company_audit_events(company_id, occurred_at desc);

-- SECURITY DEFINER avoids recursive RLS evaluation when membership policies check membership.
create or replace function public.is_company_member(target_company uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_memberships m
    where m.company_id = target_company and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_company_role(target_company uuid, allowed_roles text[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_memberships m
    where m.company_id = target_company
      and m.user_id = auth.uid()
      and m.role = any(allowed_roles)
  );
$$;

revoke all on function public.is_company_member(uuid) from public;
revoke all on function public.has_company_role(uuid, text[]) from public;
grant execute on function public.is_company_member(uuid) to authenticated;
grant execute on function public.has_company_role(uuid, text[]) to authenticated;

alter table public.companies enable row level security;
alter table public.company_memberships enable row level security;
alter table public.company_records enable row level security;
alter table public.company_audit_events enable row level security;

create policy "members can view their companies"
on public.companies for select to authenticated
using (public.is_company_member(id));

create policy "owners and admins can update company name"
on public.companies for update to authenticated
using (public.has_company_role(id, array['owner','admin']))
with check (public.has_company_role(id, array['owner','admin']));

create policy "members can view company memberships"
on public.company_memberships for select to authenticated
using (public.is_company_member(company_id));

create policy "owners and admins can add members"
on public.company_memberships for insert to authenticated
with check (
  public.has_company_role(company_id, array['owner','admin'])
  and role <> 'owner'
  and created_by = auth.uid()
);

create policy "owners and admins can update non-owner memberships"
on public.company_memberships for update to authenticated
using (
  public.has_company_role(company_id, array['owner','admin'])
  and role <> 'owner'
)
with check (
  public.has_company_role(company_id, array['owner','admin'])
  and role <> 'owner'
);

create policy "owners and admins can remove non-owner memberships"
on public.company_memberships for delete to authenticated
using (
  public.has_company_role(company_id, array['owner','admin'])
  and role <> 'owner'
);

create policy "company members can read records"
on public.company_records for select to authenticated
using (public.is_company_member(company_id));

create policy "permitted roles can insert records"
on public.company_records for insert to authenticated
with check (
  public.has_company_role(company_id, array['owner','admin','manager','staff'])
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

create policy "permitted roles can update records"
on public.company_records for update to authenticated
using (public.has_company_role(company_id, array['owner','admin','manager','staff']))
with check (
  public.has_company_role(company_id, array['owner','admin','manager','staff'])
  and updated_by = auth.uid()
);

create policy "owners admins and managers can delete records"
on public.company_records for delete to authenticated
using (public.has_company_role(company_id, array['owner','admin','manager']));

create policy "members can read audit events"
on public.company_audit_events for select to authenticated
using (public.is_company_member(company_id));

drop policy if exists "members can append audit events" on public.company_audit_events;

-- Company creation is safe to expose because it creates a new company and makes the
-- authenticated caller its first owner in one transaction. It cannot join another company.
create or replace function public.create_company_with_owner(company_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $axivestra$
declare
  new_company_id uuid;
  clean_name text := trim(company_name);
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Authentication required.';
  end if;
  if clean_name is null or length(clean_name) < 1 or length(clean_name) > 160 then
    raise exception 'Company name must contain 1 to 160 characters.';
  end if;

  insert into public.companies(name, created_by)
  values (clean_name, caller_id)
  returning id into new_company_id;

  insert into public.company_memberships(company_id, user_id, role, created_by)
  values (new_company_id, caller_id, 'owner', caller_id);

  return new_company_id;
end;
$axivestra$;

revoke all on function public.create_company_with_owner(text) from public;
grant execute on function public.create_company_with_owner(text) to authenticated;

-- Explicit least-privilege table grants complement RLS. Policies alone do not revoke
-- underlying table privileges inherited from project default grants.
revoke all on table public.companies from anon, authenticated;
revoke all on table public.company_memberships from anon, authenticated;
revoke all on table public.company_records from anon, authenticated;
revoke all on table public.company_audit_events from anon, authenticated;

grant select, update on table public.companies to authenticated;
grant select, insert, update, delete on table public.company_memberships to authenticated;
grant select, insert, update, delete on table public.company_records to authenticated;
grant select on table public.company_audit_events to authenticated;

-- A deleted_at change is governed by the same role tier as a physical delete.
create or replace function public.guard_company_record_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $axivestra$
begin
  if old.deleted_at is not null and new.deleted_at is null then
    raise exception 'Deleted records cannot be revived by routine sync. Use an owner-approved restore process.';
  end if;
  if old.deleted_at is null and new.deleted_at is not null
     and not public.has_company_role(old.company_id, array['owner','admin','manager']) then
    raise exception 'Only owners, admins and managers can delete company records.';
  end if;
  return new;
end;
$axivestra$;

drop trigger if exists company_records_soft_delete_guard on public.company_records;
create trigger company_records_soft_delete_guard
before update on public.company_records
for each row execute function public.guard_company_record_soft_delete();


-- Prevent cross-company record reassignment, key/type changes, and creator spoofing.
create or replace function public.guard_company_record_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $axivestra$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null then
      raise exception 'Authenticated user context is required to create a company record.';
    end if;
    -- Do not trust creator/updater IDs supplied in a request payload.
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
    return new;
  end if;

  if old.company_id is distinct from new.company_id
     or old.record_type is distinct from new.record_type
     or old.record_key is distinct from new.record_key then
    raise exception 'Company, record type and record key are immutable. Create a new scoped record instead.';
  end if;
  -- Keep original creator immutable when an authorised member updates a shared record.
  new.created_by := old.created_by;
  return new;
end;
$axivestra$;

drop trigger if exists company_records_identity_guard on public.company_records;
create trigger company_records_identity_guard
before insert or update on public.company_records
for each row execute function public.guard_company_record_identity();

-- Write membership audit events on the server so clients cannot forge governance history.
create or replace function public.log_company_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $axivestra$
declare
  actor_id uuid;
  target_company_id uuid;
  target_user_id uuid;
  action_name text;
  action_label text;
begin
  if tg_op = 'INSERT' then
    target_company_id := new.company_id;
    target_user_id := new.user_id;
    actor_id := coalesce(auth.uid(), new.created_by);
    action_name := 'member_added';
    action_label := 'Company membership created with role ' || new.role;
  elsif tg_op = 'UPDATE' then
    if old.role is not distinct from new.role then
      return new;
    end if;
    target_company_id := new.company_id;
    target_user_id := new.user_id;
    actor_id := coalesce(auth.uid(), new.created_by, old.created_by);
    action_name := 'member_role_changed';
    action_label := 'Company membership role changed to ' || new.role;
  else
    target_company_id := old.company_id;
    target_user_id := old.user_id;
    actor_id := coalesce(auth.uid(), old.created_by);
    action_name := 'member_removed';
    action_label := 'Company membership removed';
  end if;

  if actor_id is not null then
    insert into public.company_audit_events(
      company_id, actor_user_id, action, entity_type, entity_key, label
    ) values (
      target_company_id, actor_id, action_name, 'membership', target_user_id::text, action_label
    );
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$axivestra$;

drop trigger if exists company_membership_audit on public.company_memberships;
create trigger company_membership_audit
after insert or update or delete on public.company_memberships
for each row execute function public.log_company_membership_change();

revoke all on function public.guard_company_record_identity() from public;
revoke all on function public.log_company_membership_change() from public;
