-- AXIVESTRA contact intelligence profile expansion.
-- Apply this migration to the configured Supabase project before deploying a build
-- that selects/writes these columns. Existing single-role contacts are backfilled.
alter table public.contacts
  add column if not exists roles text[] not null default '{}',
  add column if not exists custom_roles text not null default '',
  add column if not exists email text not null default '',
  add column if not exists address text not null default '',
  add column if not exists profession text not null default '',
  add column if not exists employer text not null default '',
  add column if not exists designation text not null default '',
  add column if not exists business_type text not null default '',
  add column if not exists income_sources text not null default '',
  add column if not exists associated_company text not null default '',
  add column if not exists relationship_notes text not null default '';

update public.contacts
set roles = array[coalesce(nullif(role, ''), 'Other')]
where roles is null or cardinality(roles) = 0;

-- Duplicate detection is an application-level warning, not an automatic merge.
-- Phone numbers remain editable and may be shared by households or businesses.
