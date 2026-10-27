-- EstateFlow core backend schema
-- Run in Supabase SQL Editor or with Supabase CLI migrations.
-- All business records are private to the authenticated owner.

create extension if not exists pgcrypto;

create table if not exists public.property_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  property_code text,
  title text not null,
  module text not null check (module in (
    'Property Sale', 'Property Loans', 'JV / JDA / JD',
    'SR Rate Settlement', 'Agricultural Land', 'Commercial Land'
  )),
  location text not null default '',
  value numeric(18,2),
  status text not null default 'Active',
  contact text not null default '',
  survey_number text not null default '',
  ownership_details text not null default '',
  area_value numeric(14,4),
  area_unit text not null default 'sq ft',
  dimensions text not null default '',
  rate_per_unit numeric(18,2),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  phone text not null default '',
  email text not null default '',
  role text not null default 'Other',
  company text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  due_date date not null,
  due_time time not null,
  task_type text not null default 'Follow-up',
  property_id uuid references public.property_records(id) on delete set null,
  property_label text not null default '',
  notes text not null default '',
  is_done boolean not null default false,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  property_id uuid references public.property_records(id) on delete set null,
  property_label text not null default '',
  name text not null,
  category text not null default 'Other',
  storage_path text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  expires_on date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  property_id uuid references public.property_records(id) on delete set null,
  property_label text not null default '',
  transaction_type text not null check (transaction_type in (
    'Purchase', 'Sale', 'Advance', 'Loan Disbursal', 'Loan Repayment',
    'Interest', 'Instalment', 'Brokerage', 'Expense', 'Receipt', 'Settlement', 'Other'
  )),
  amount numeric(18,2) not null check (amount >= 0),
  transaction_date date not null default current_date,
  party text not null default '',
  reference_number text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_followups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  contact_name text not null default '',
  phone text not null,
  message text not null,
  template_name text not null default '',
  template_language text not null default 'en_US',
  template_parameters jsonb not null default '[]'::jsonb check (jsonb_typeof(template_parameters) = 'array'),
  consent_confirmed boolean not null default false,
  scheduled_at timestamptz,
  stop_on_reply boolean not null default true,
  status text not null default 'draft' check (status in (
    'draft', 'scheduled', 'processing', 'sent', 'replied', 'cancelled', 'failed'
  )),
  constraint estateflow_scheduled_followup_requires_consent check (status <> 'scheduled' or consent_confirmed = true),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  provider_message_id text,
  sent_at timestamptz,
  replied_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists property_records_user_updated_idx on public.property_records(user_id, updated_at desc);
create index if not exists property_records_survey_idx on public.property_records(user_id, survey_number);
create index if not exists contacts_user_name_idx on public.contacts(user_id, name);
create index if not exists tasks_user_due_idx on public.tasks(user_id, due_date, due_time);
create index if not exists documents_user_property_idx on public.documents(user_id, property_id);
create index if not exists documents_expiry_idx on public.documents(user_id, expires_on);
create index if not exists financial_transactions_user_date_idx on public.financial_transactions(user_id, transaction_date desc);
create index if not exists whatsapp_followups_due_idx on public.whatsapp_followups(user_id, status, scheduled_at);

create or replace function public.estateflow_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'property_records', 'contacts', 'tasks', 'documents',
    'financial_transactions', 'whatsapp_followups'
  ] loop
    execute format('drop trigger if exists estateflow_updated_at on public.%I', tbl);
    execute format(
      'create trigger estateflow_updated_at before update on public.%I for each row execute function public.estateflow_set_updated_at()',
      tbl
    );
  end loop;
end;
$$;

-- Enable RLS and explicitly limit each table to its owner.
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'property_records', 'contacts', 'tasks', 'documents',
    'financial_transactions', 'whatsapp_followups', 'audit_events'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('revoke all on table public.%I from anon, authenticated', tbl);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', tbl);
    execute format('drop policy if exists estateflow_owner_select on public.%I', tbl);
    execute format('drop policy if exists estateflow_owner_insert on public.%I', tbl);
    execute format('drop policy if exists estateflow_owner_update on public.%I', tbl);
    execute format('drop policy if exists estateflow_owner_delete on public.%I', tbl);
    execute format(
      'create policy estateflow_owner_select on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      tbl
    );
    execute format(
      'create policy estateflow_owner_insert on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      tbl
    );
    execute format(
      'create policy estateflow_owner_update on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      tbl
    );
    execute format(
      'create policy estateflow_owner_delete on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      tbl
    );
  end loop;
end;
$$;

-- Private document storage. File paths must begin with the authenticated user's UUID.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-documents',
  'property-documents',
  false,
  26214400,
  array[
    'application/pdf', 'image/jpeg', 'image/png',
    'image/webp', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists estateflow_docs_select_own_folder on storage.objects;
drop policy if exists estateflow_docs_insert_own_folder on storage.objects;
drop policy if exists estateflow_docs_update_own_folder on storage.objects;
drop policy if exists estateflow_docs_delete_own_folder on storage.objects;

create policy estateflow_docs_select_own_folder on storage.objects
for select to authenticated
using (bucket_id = 'property-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy estateflow_docs_insert_own_folder on storage.objects
for insert to authenticated
with check (bucket_id = 'property-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy estateflow_docs_update_own_folder on storage.objects
for update to authenticated
using (bucket_id = 'property-documents' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'property-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy estateflow_docs_delete_own_folder on storage.objects
for delete to authenticated
using (bucket_id = 'property-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);


-- Keep the audit trail append-only for application users.
revoke update, delete on table public.audit_events from authenticated;
drop policy if exists estateflow_owner_update on public.audit_events;
drop policy if exists estateflow_owner_delete on public.audit_events;


-- Atomically claim due WhatsApp follow-ups for a trusted server-side worker.
-- This function is never executable by regular application users.
create or replace function public.estateflow_claim_due_whatsapp_followups(batch_size integer default 20)
returns setof public.whatsapp_followups
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with due as (
    select id
    from public.whatsapp_followups
    where status = 'scheduled'
      and scheduled_at is not null
      and scheduled_at <= now()
      and consent_confirmed = true
    order by scheduled_at asc
    for update skip locked
    limit greatest(1, least(coalesce(batch_size, 20), 100))
  )
  update public.whatsapp_followups as followup
  set status = 'processing',
      attempt_count = followup.attempt_count + 1,
      updated_at = now()
  from due
  where followup.id = due.id
  returning followup.*;
end;
$$;

revoke all on function public.estateflow_claim_due_whatsapp_followups(integer) from public, anon, authenticated;
grant execute on function public.estateflow_claim_due_whatsapp_followups(integer) to service_role;


-- Enterprise workflows: preserve older records and enable the seven requested modules.
alter table public.property_records drop constraint if exists property_records_module_check;
alter table public.property_records add constraint property_records_module_check check (module in (
  'Property Sale', 'Property Loans', 'JV / JDA / JD',
  'SR Rate Settlement', 'Agricultural Land', 'Commercial Land',
  'Startup', 'Equity', 'Unsecured Company Loan', 'Personal Loan',
  'Housing Loan', 'House Purchase', 'Litigation'
));
alter table public.property_records add column if not exists module_data jsonb not null default '{}'::jsonb;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'property_records_module_data_object_check'
      and conrelid = 'public.property_records'::regclass
  ) then
    alter table public.property_records
      add constraint property_records_module_data_object_check check (jsonb_typeof(module_data) = 'object');
  end if;
end;
$$;

create table if not exists public.risk_register (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  category text not null default 'Operational',
  severity text not null default 'Medium' check (severity in ('Low','Medium','High','Critical')),
  status text not null default 'Open' check (status in ('Open','Mitigating','Monitoring','Closed')),
  owner text not null default '',
  due_date date,
  entity_label text not null default '',
  mitigation text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  approval_type text not null default 'General',
  entity_label text not null default '',
  requested_by text not null default '',
  approver text not null default '',
  priority text not null default 'Normal' check (priority in ('Low','Normal','High','Urgent')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  rationale text not null default '',
  decision_notes text not null default '',
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists risk_register_user_severity_idx on public.risk_register(user_id, severity, status);
create index if not exists risk_register_user_due_idx on public.risk_register(user_id, due_date);
create index if not exists approval_requests_user_status_idx on public.approval_requests(user_id, status, requested_at desc);

alter table public.risk_register enable row level security;
alter table public.approval_requests enable row level security;
revoke all on table public.risk_register, public.approval_requests from anon, authenticated;
grant select, insert, update, delete on table public.risk_register, public.approval_requests to authenticated;

drop policy if exists estateflow_owner_select on public.risk_register;
drop policy if exists estateflow_owner_insert on public.risk_register;
drop policy if exists estateflow_owner_update on public.risk_register;
drop policy if exists estateflow_owner_delete on public.risk_register;
create policy estateflow_owner_select on public.risk_register for select to authenticated using ((select auth.uid()) = user_id);
create policy estateflow_owner_insert on public.risk_register for insert to authenticated with check ((select auth.uid()) = user_id);
create policy estateflow_owner_update on public.risk_register for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy estateflow_owner_delete on public.risk_register for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists estateflow_owner_select on public.approval_requests;
drop policy if exists estateflow_owner_insert on public.approval_requests;
drop policy if exists estateflow_owner_update on public.approval_requests;
drop policy if exists estateflow_owner_delete on public.approval_requests;
create policy estateflow_owner_select on public.approval_requests for select to authenticated using ((select auth.uid()) = user_id);
create policy estateflow_owner_insert on public.approval_requests for insert to authenticated with check ((select auth.uid()) = user_id);
create policy estateflow_owner_update on public.approval_requests for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy estateflow_owner_delete on public.approval_requests for delete to authenticated using ((select auth.uid()) = user_id);

drop trigger if exists estateflow_updated_at on public.risk_register;
create trigger estateflow_updated_at before update on public.risk_register for each row execute function public.estateflow_set_updated_at();
drop trigger if exists estateflow_updated_at on public.approval_requests;
create trigger estateflow_updated_at before update on public.approval_requests for each row execute function public.estateflow_set_updated_at();

-- Append-only audit records for business and governance changes.
create or replace function public.estateflow_audit_record_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_entity_id text;
  v_payload jsonb;
begin
  if TG_OP = 'DELETE' then
    v_user_id := OLD.user_id;
    v_entity_id := OLD.id::text;
    v_payload := jsonb_build_object('operation', 'DELETE', 'previous', to_jsonb(OLD));
  else
    v_user_id := NEW.user_id;
    v_entity_id := NEW.id::text;
    if TG_OP = 'INSERT' then
      v_payload := jsonb_build_object('operation', 'INSERT', 'current', to_jsonb(NEW));
    else
      v_payload := jsonb_build_object('operation', 'UPDATE', 'previous', to_jsonb(OLD), 'current', to_jsonb(NEW));
    end if;
  end if;

  insert into public.audit_events(user_id, entity_type, entity_id, action, details)
  values (v_user_id, TG_TABLE_NAME, v_entity_id, lower(TG_OP), v_payload);

  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

drop trigger if exists estateflow_audit_changes on public.property_records;
create trigger estateflow_audit_changes after insert or update or delete on public.property_records for each row execute function public.estateflow_audit_record_change();
drop trigger if exists estateflow_audit_changes on public.contacts;
create trigger estateflow_audit_changes after insert or update or delete on public.contacts for each row execute function public.estateflow_audit_record_change();
drop trigger if exists estateflow_audit_changes on public.tasks;
create trigger estateflow_audit_changes after insert or update or delete on public.tasks for each row execute function public.estateflow_audit_record_change();
drop trigger if exists estateflow_audit_changes on public.documents;
create trigger estateflow_audit_changes after insert or update or delete on public.documents for each row execute function public.estateflow_audit_record_change();
drop trigger if exists estateflow_audit_changes on public.financial_transactions;
create trigger estateflow_audit_changes after insert or update or delete on public.financial_transactions for each row execute function public.estateflow_audit_record_change();
drop trigger if exists estateflow_audit_changes on public.whatsapp_followups;
create trigger estateflow_audit_changes after insert or update or delete on public.whatsapp_followups for each row execute function public.estateflow_audit_record_change();
drop trigger if exists estateflow_audit_changes on public.risk_register;
create trigger estateflow_audit_changes after insert or update or delete on public.risk_register for each row execute function public.estateflow_audit_record_change();
drop trigger if exists estateflow_audit_changes on public.approval_requests;
create trigger estateflow_audit_changes after insert or update or delete on public.approval_requests for each row execute function public.estateflow_audit_record_change();
