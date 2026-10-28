-- EstateFlow persistent WhatsApp identity metadata and group list.
-- Run after 202610270001_estateflow_core.sql and 202610290001_estateflow_relationship_links.sql.

alter table public.contacts
  add column if not exists whatsapp_name text not null default '',
  add column if not exists whatsapp_jid text not null default '';

create index if not exists contacts_user_whatsapp_jid_idx
  on public.contacts(user_id, whatsapp_jid)
  where whatsapp_jid <> '';

create table if not exists public.whatsapp_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  jid text not null,
  name text not null,
  description text not null default '',
  member_count integer not null default 0 check (member_count >= 0),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, jid)
);

create index if not exists whatsapp_groups_user_name_idx
  on public.whatsapp_groups(user_id, name);

drop trigger if exists estateflow_updated_at on public.whatsapp_groups;
create trigger estateflow_updated_at before update on public.whatsapp_groups
for each row execute function public.estateflow_set_updated_at();

alter table public.whatsapp_groups enable row level security;
revoke all on table public.whatsapp_groups from anon, authenticated;
grant select, insert, update, delete on table public.whatsapp_groups to authenticated;
drop policy if exists estateflow_owner_select on public.whatsapp_groups;
drop policy if exists estateflow_owner_insert on public.whatsapp_groups;
drop policy if exists estateflow_owner_update on public.whatsapp_groups;
drop policy if exists estateflow_owner_delete on public.whatsapp_groups;
create policy estateflow_owner_select on public.whatsapp_groups
for select to authenticated using ((select auth.uid()) = user_id);
create policy estateflow_owner_insert on public.whatsapp_groups
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy estateflow_owner_update on public.whatsapp_groups
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy estateflow_owner_delete on public.whatsapp_groups
for delete to authenticated using ((select auth.uid()) = user_id);
