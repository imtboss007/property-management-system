-- AXIVESTRA always-on WhatsApp queue.
-- The queue lives in Postgres; device power state does not control due-time processing.
-- Provider credentials are server-side Edge Function secrets and are never stored in rows.

create table if not exists public.whatsapp_cloud_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  series_id uuid,
  sequence integer not null default 1 check (sequence between 1 and 20),
  repeat_count integer not null default 1 check (repeat_count between 1 and 20),
  to_phone text not null check (to_phone ~ '^[0-9]{8,15} text not null default '' check (length(recipient_name) <= 160),
  message text not null default '' check (length(message) <= 4000),
  message_type text not null default 'text' check (message_type in ('text','template')),
  template_name text,
  template_language text not null default 'en_US',
  template_params jsonb not null default '[]'::jsonb check (jsonb_typeof(template_params) = 'array'),
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','sending','sent','failed','cancelled')),
  consent_confirmed boolean not null default false,
  stop_on_reply boolean not null default true,
  property_id text not null default '',
  property_title text not null default '',
  task_id text not null default '',
  task_title text not null default '',
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  provider_message_id text not null default '',
  sent_at timestamptz,
  last_error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_cloud_message_content check (
    (message_type = 'text' and length(trim(message)) > 0 and template_name is null)
    or
    (message_type = 'template' and template_name is not null and template_name ~ '^[a-zA-Z0-9_]+
  ),
  constraint whatsapp_cloud_message_consent check (consent_confirmed = true)
);

create index if not exists whatsapp_cloud_due_idx
  on public.whatsapp_cloud_messages(status, scheduled_at)
  where status = 'scheduled';
create index if not exists whatsapp_cloud_company_queue_idx
  on public.whatsapp_cloud_messages(company_id, created_at desc);
create index if not exists whatsapp_cloud_reply_idx
  on public.whatsapp_cloud_messages(to_phone, status, scheduled_at)
  where status = 'scheduled' and stop_on_reply = true;

alter table public.whatsapp_cloud_messages enable row level security;
revoke all on table public.whatsapp_cloud_messages from anon, authenticated;
grant select, insert on table public.whatsapp_cloud_messages to authenticated;

create policy "company members can view their WhatsApp queue"
on public.whatsapp_cloud_messages for select to authenticated
using (public.is_company_member(company_id));

create policy "permitted company members can schedule consented messages"
on public.whatsapp_cloud_messages for insert to authenticated
with check (
  public.has_company_role(company_id, array['owner','admin','manager','staff'])
  and created_by = auth.uid()
  and consent_confirmed = true
  and status = 'scheduled'
  and attempt_count = 0
  and provider_message_id = ''
  and sent_at is null
);

create or replace function public.cancel_whatsapp_cloud_message(target_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $axivestra$
declare
  changed integer;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  update public.whatsapp_cloud_messages m
    set status = 'cancelled', updated_at = now()
    where m.id = target_message_id
      and m.status = 'scheduled'
      and (
        m.created_by = auth.uid()
        or public.has_company_role(m.company_id, array['owner','admin','manager'])
      );
  get diagnostics changed = row_count;
  return changed = 1;
end;
$axivestra$;

create or replace function public.retry_whatsapp_cloud_message(target_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $axivestra$
declare
  changed integer;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  update public.whatsapp_cloud_messages m
    set status = 'scheduled',
        scheduled_at = now() + interval '1 minute',
        attempt_count = 0,
        last_error = '',
        provider_message_id = '',
        sent_at = null,
        updated_at = now()
    where m.id = target_message_id
      and m.status = 'failed'
      and (
        m.created_by = auth.uid()
        or public.has_company_role(m.company_id, array['owner','admin','manager'])
      );
  get diagnostics changed = row_count;
  return changed = 1;
end;
$axivestra$;

create or replace function public.claim_due_whatsapp_messages(batch_size integer default 10, target_company_id uuid default null)
returns setof public.whatsapp_cloud_messages
language plpgsql
security definer
set search_path = ''
as $axivestra$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;

  if target_company_id is null then raise exception 'Configured company scope required.'; end if;

  -- A process crash after claiming a row must not silently resend it: surface uncertain
  -- sends for human review rather than retrying a message that may already have reached Meta.
  update public.whatsapp_cloud_messages
    set status = 'failed',
        last_error = 'Delivery status is uncertain because the cloud worker stopped while sending. Check the WhatsApp chat before retrying to avoid a duplicate.',
        updated_at = now()
    where status = 'sending' and updated_at < now() - interval '10 minutes';

  return query
    with due as (
      select m.id
      from public.whatsapp_cloud_messages m
      where m.status = 'scheduled' and m.scheduled_at <= now()
        and m.company_id = target_company_id
      order by m.scheduled_at, m.created_at
      for update skip locked
      limit greatest(1, least(coalesce(batch_size, 10), 25))
    )
    update public.whatsapp_cloud_messages m
      set status = 'sending', attempt_count = m.attempt_count + 1, updated_at = now()
      from due
      where m.id = due.id
      returning m.*;
end;
$axivestra$;

create or replace function public.finish_whatsapp_cloud_message(
  target_message_id uuid,
  final_status text,
  provider_id text default '',
  failure_reason text default ''
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $axivestra$
declare
  changed integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  if final_status not in ('sent','failed') then
    raise exception 'Final status must be sent or failed.';
  end if;
  update public.whatsapp_cloud_messages
    set status = final_status,
        provider_message_id = left(coalesce(provider_id, ''), 300),
        sent_at = case when final_status = 'sent' then now() else null end,
        last_error = case when final_status = 'sent' then '' else left(coalesce(failure_reason, 'Delivery failed.'), 1500) end,
        updated_at = now()
    where id = target_message_id and status = 'sending';
  get diagnostics changed = row_count;
  return changed = 1;
end;
$axivestra$;

create or replace function public.cancel_whatsapp_cloud_followups_for_reply(target_phone text, target_company_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $axivestra$
declare
  changed integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  if target_company_id is null then raise exception 'Configured company scope required.'; end if;
  update public.whatsapp_cloud_messages
    set status = 'cancelled',
        last_error = 'Cancelled automatically because the recipient replied.',
        updated_at = now()
    where to_phone = target_phone
      and company_id = target_company_id
      and status = 'scheduled'
      and stop_on_reply = true
      and scheduled_at > now();
  get diagnostics changed = row_count;
  return changed;
end;
$axivestra$;

revoke all on function public.cancel_whatsapp_cloud_message(uuid) from public, anon;
revoke all on function public.retry_whatsapp_cloud_message(uuid) from public, anon;
revoke all on function public.claim_due_whatsapp_messages(integer,uuid) from public, anon, authenticated;
revoke all on function public.finish_whatsapp_cloud_message(uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.cancel_whatsapp_cloud_followups_for_reply(text,uuid) from public, anon, authenticated;
grant execute on function public.cancel_whatsapp_cloud_message(uuid) to authenticated;
grant execute on function public.retry_whatsapp_cloud_message(uuid) to authenticated;
grant execute on function public.claim_due_whatsapp_messages(integer,uuid) to service_role;
grant execute on function public.finish_whatsapp_cloud_message(uuid,text,text,text) to service_role;
grant execute on function public.cancel_whatsapp_cloud_followups_for_reply(text,uuid) to service_role;
),
  contact_id text not null default '' check (length(contact_id) <= 120),
  recipient_name text not null default '' check (length(recipient_name) <= 160),
  message text not null default '' check (length(message) <= 4000),
  message_type text not null default 'text' check (message_type in ('text','template')),
  template_name text,
  template_language text not null default 'en_US',
  template_params jsonb not null default '[]'::jsonb check (jsonb_typeof(template_params) = 'array'),
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','sending','sent','failed','cancelled')),
  consent_confirmed boolean not null default false,
  stop_on_reply boolean not null default true,
  property_id text not null default '',
  property_title text not null default '',
  task_id text not null default '',
  task_title text not null default '',
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  provider_message_id text not null default '',
  sent_at timestamptz,
  last_error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_cloud_message_content check (
    (message_type = 'text' and length(trim(message)) > 0 and template_name is null)
    or
    (message_type = 'template' and template_name ~ '^[a-zA-Z0-9_]+$' and length(template_language) between 2 and 20)
  ),
  constraint whatsapp_cloud_message_consent check (consent_confirmed = true)
);

create index if not exists whatsapp_cloud_due_idx
  on public.whatsapp_cloud_messages(status, scheduled_at)
  where status = 'scheduled';
create index if not exists whatsapp_cloud_company_queue_idx
  on public.whatsapp_cloud_messages(company_id, created_at desc);
create index if not exists whatsapp_cloud_reply_idx
  on public.whatsapp_cloud_messages(to_phone, status, scheduled_at)
  where status = 'scheduled' and stop_on_reply = true;

alter table public.whatsapp_cloud_messages enable row level security;
revoke all on table public.whatsapp_cloud_messages from anon, authenticated;
grant select, insert on table public.whatsapp_cloud_messages to authenticated;

create policy "company members can view their WhatsApp queue"
on public.whatsapp_cloud_messages for select to authenticated
using (public.is_company_member(company_id));

create policy "permitted company members can schedule consented messages"
on public.whatsapp_cloud_messages for insert to authenticated
with check (
  public.has_company_role(company_id, array['owner','admin','manager','staff'])
  and created_by = auth.uid()
  and consent_confirmed = true
  and status = 'scheduled'
  and attempt_count = 0
  and provider_message_id = ''
  and sent_at is null
);

create or replace function public.cancel_whatsapp_cloud_message(target_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $axivestra$
declare
  changed integer;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  update public.whatsapp_cloud_messages m
    set status = 'cancelled', updated_at = now()
    where m.id = target_message_id
      and m.status = 'scheduled'
      and (
        m.created_by = auth.uid()
        or public.has_company_role(m.company_id, array['owner','admin','manager'])
      );
  get diagnostics changed = row_count;
  return changed = 1;
end;
$axivestra$;

create or replace function public.retry_whatsapp_cloud_message(target_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $axivestra$
declare
  changed integer;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  update public.whatsapp_cloud_messages m
    set status = 'scheduled',
        scheduled_at = now() + interval '1 minute',
        attempt_count = 0,
        last_error = '',
        provider_message_id = '',
        sent_at = null,
        updated_at = now()
    where m.id = target_message_id
      and m.status = 'failed'
      and (
        m.created_by = auth.uid()
        or public.has_company_role(m.company_id, array['owner','admin','manager'])
      );
  get diagnostics changed = row_count;
  return changed = 1;
end;
$axivestra$;

create or replace function public.claim_due_whatsapp_messages(batch_size integer default 10)
returns setof public.whatsapp_cloud_messages
language plpgsql
security definer
set search_path = ''
as $axivestra$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;

  -- A process crash after claiming a row must not silently resend it: surface uncertain
  -- sends for human review rather than retrying a message that may already have reached Meta.
  update public.whatsapp_cloud_messages
    set status = 'failed',
        last_error = 'Delivery status is uncertain because the cloud worker stopped while sending. Check the WhatsApp chat before retrying to avoid a duplicate.',
        updated_at = now()
    where status = 'sending' and updated_at < now() - interval '10 minutes';

  return query
    with due as (
      select m.id
      from public.whatsapp_cloud_messages m
      where m.status = 'scheduled' and m.scheduled_at <= now()
      order by m.scheduled_at, m.created_at
      for update skip locked
      limit greatest(1, least(coalesce(batch_size, 10), 25))
    )
    update public.whatsapp_cloud_messages m
      set status = 'sending', attempt_count = m.attempt_count + 1, updated_at = now()
      from due
      where m.id = due.id
      returning m.*;
end;
$axivestra$;

create or replace function public.finish_whatsapp_cloud_message(
  target_message_id uuid,
  final_status text,
  provider_id text default '',
  failure_reason text default ''
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $axivestra$
declare
  changed integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  if final_status not in ('sent','failed') then
    raise exception 'Final status must be sent or failed.';
  end if;
  update public.whatsapp_cloud_messages
    set status = final_status,
        provider_message_id = left(coalesce(provider_id, ''), 300),
        sent_at = case when final_status = 'sent' then now() else null end,
        last_error = case when final_status = 'sent' then '' else left(coalesce(failure_reason, 'Delivery failed.'), 1500) end,
        updated_at = now()
    where id = target_message_id and status = 'sending';
  get diagnostics changed = row_count;
  return changed = 1;
end;
$axivestra$;

create or replace function public.cancel_whatsapp_cloud_followups_for_reply(target_phone text)
returns integer
language plpgsql
security definer
set search_path = ''
as $axivestra$
declare
  changed integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  update public.whatsapp_cloud_messages
    set status = 'cancelled',
        last_error = 'Cancelled automatically because the recipient replied.',
        updated_at = now()
    where to_phone = target_phone
      and status = 'scheduled'
      and stop_on_reply = true
      and scheduled_at > now();
  get diagnostics changed = row_count;
  return changed;
end;
$axivestra$;

revoke all on function public.cancel_whatsapp_cloud_message(uuid) from public, anon;
revoke all on function public.retry_whatsapp_cloud_message(uuid) from public, anon;
revoke all on function public.claim_due_whatsapp_messages(integer,uuid) from public, anon, authenticated;
revoke all on function public.finish_whatsapp_cloud_message(uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.cancel_whatsapp_cloud_followups_for_reply(text,uuid) from public, anon, authenticated;
grant execute on function public.cancel_whatsapp_cloud_message(uuid) to authenticated;
grant execute on function public.retry_whatsapp_cloud_message(uuid) to authenticated;
grant execute on function public.claim_due_whatsapp_messages(integer,uuid) to service_role;
grant execute on function public.finish_whatsapp_cloud_message(uuid,text,text,text) to service_role;
grant execute on function public.cancel_whatsapp_cloud_followups_for_reply(text,uuid) to service_role;
 and length(template_language) between 2 and 20)
  ),
  constraint whatsapp_cloud_message_consent check (consent_confirmed = true)
);

create index if not exists whatsapp_cloud_due_idx
  on public.whatsapp_cloud_messages(status, scheduled_at)
  where status = 'scheduled';
create index if not exists whatsapp_cloud_company_queue_idx
  on public.whatsapp_cloud_messages(company_id, created_at desc);
create index if not exists whatsapp_cloud_reply_idx
  on public.whatsapp_cloud_messages(to_phone, status, scheduled_at)
  where status = 'scheduled' and stop_on_reply = true;

alter table public.whatsapp_cloud_messages enable row level security;
revoke all on table public.whatsapp_cloud_messages from anon, authenticated;
grant select, insert on table public.whatsapp_cloud_messages to authenticated;

create policy "company members can view their WhatsApp queue"
on public.whatsapp_cloud_messages for select to authenticated
using (public.is_company_member(company_id));

create policy "permitted company members can schedule consented messages"
on public.whatsapp_cloud_messages for insert to authenticated
with check (
  public.has_company_role(company_id, array['owner','admin','manager','staff'])
  and created_by = auth.uid()
  and consent_confirmed = true
  and status = 'scheduled'
  and attempt_count = 0
  and provider_message_id = ''
  and sent_at is null
);

create or replace function public.cancel_whatsapp_cloud_message(target_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $axivestra$
declare
  changed integer;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  update public.whatsapp_cloud_messages m
    set status = 'cancelled', updated_at = now()
    where m.id = target_message_id
      and m.status = 'scheduled'
      and (
        m.created_by = auth.uid()
        or public.has_company_role(m.company_id, array['owner','admin','manager'])
      );
  get diagnostics changed = row_count;
  return changed = 1;
end;
$axivestra$;

create or replace function public.retry_whatsapp_cloud_message(target_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $axivestra$
declare
  changed integer;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  update public.whatsapp_cloud_messages m
    set status = 'scheduled',
        scheduled_at = now() + interval '1 minute',
        attempt_count = 0,
        last_error = '',
        provider_message_id = '',
        sent_at = null,
        updated_at = now()
    where m.id = target_message_id
      and m.status = 'failed'
      and (
        m.created_by = auth.uid()
        or public.has_company_role(m.company_id, array['owner','admin','manager'])
      );
  get diagnostics changed = row_count;
  return changed = 1;
end;
$axivestra$;

create or replace function public.claim_due_whatsapp_messages(batch_size integer default 10)
returns setof public.whatsapp_cloud_messages
language plpgsql
security definer
set search_path = ''
as $axivestra$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;

  -- A process crash after claiming a row must not silently resend it: surface uncertain
  -- sends for human review rather than retrying a message that may already have reached Meta.
  update public.whatsapp_cloud_messages
    set status = 'failed',
        last_error = 'Delivery status is uncertain because the cloud worker stopped while sending. Check the WhatsApp chat before retrying to avoid a duplicate.',
        updated_at = now()
    where status = 'sending' and updated_at < now() - interval '10 minutes';

  return query
    with due as (
      select m.id
      from public.whatsapp_cloud_messages m
      where m.status = 'scheduled' and m.scheduled_at <= now()
      order by m.scheduled_at, m.created_at
      for update skip locked
      limit greatest(1, least(coalesce(batch_size, 10), 25))
    )
    update public.whatsapp_cloud_messages m
      set status = 'sending', attempt_count = m.attempt_count + 1, updated_at = now()
      from due
      where m.id = due.id
      returning m.*;
end;
$axivestra$;

create or replace function public.finish_whatsapp_cloud_message(
  target_message_id uuid,
  final_status text,
  provider_id text default '',
  failure_reason text default ''
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $axivestra$
declare
  changed integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  if final_status not in ('sent','failed') then
    raise exception 'Final status must be sent or failed.';
  end if;
  update public.whatsapp_cloud_messages
    set status = final_status,
        provider_message_id = left(coalesce(provider_id, ''), 300),
        sent_at = case when final_status = 'sent' then now() else null end,
        last_error = case when final_status = 'sent' then '' else left(coalesce(failure_reason, 'Delivery failed.'), 1500) end,
        updated_at = now()
    where id = target_message_id and status = 'sending';
  get diagnostics changed = row_count;
  return changed = 1;
end;
$axivestra$;

create or replace function public.cancel_whatsapp_cloud_followups_for_reply(target_phone text)
returns integer
language plpgsql
security definer
set search_path = ''
as $axivestra$
declare
  changed integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  update public.whatsapp_cloud_messages
    set status = 'cancelled',
        last_error = 'Cancelled automatically because the recipient replied.',
        updated_at = now()
    where to_phone = target_phone
      and status = 'scheduled'
      and stop_on_reply = true
      and scheduled_at > now();
  get diagnostics changed = row_count;
  return changed;
end;
$axivestra$;

revoke all on function public.cancel_whatsapp_cloud_message(uuid) from public, anon;
revoke all on function public.retry_whatsapp_cloud_message(uuid) from public, anon;
revoke all on function public.claim_due_whatsapp_messages(integer,uuid) from public, anon, authenticated;
revoke all on function public.finish_whatsapp_cloud_message(uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.cancel_whatsapp_cloud_followups_for_reply(text,uuid) from public, anon, authenticated;
grant execute on function public.cancel_whatsapp_cloud_message(uuid) to authenticated;
grant execute on function public.retry_whatsapp_cloud_message(uuid) to authenticated;
grant execute on function public.claim_due_whatsapp_messages(integer,uuid) to service_role;
grant execute on function public.finish_whatsapp_cloud_message(uuid,text,text,text) to service_role;
grant execute on function public.cancel_whatsapp_cloud_followups_for_reply(text,uuid) to service_role;
),
  contact_id text not null default '' check (length(contact_id) <= 120),
  recipient_name text not null default '' check (length(recipient_name) <= 160),
  message text not null default '' check (length(message) <= 4000),
  message_type text not null default 'text' check (message_type in ('text','template')),
  template_name text,
  template_language text not null default 'en_US',
  template_params jsonb not null default '[]'::jsonb check (jsonb_typeof(template_params) = 'array'),
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','sending','sent','failed','cancelled')),
  consent_confirmed boolean not null default false,
  stop_on_reply boolean not null default true,
  property_id text not null default '',
  property_title text not null default '',
  task_id text not null default '',
  task_title text not null default '',
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  provider_message_id text not null default '',
  sent_at timestamptz,
  last_error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_cloud_message_content check (
    (message_type = 'text' and length(trim(message)) > 0 and template_name is null)
    or
    (message_type = 'template' and template_name is not null and template_name ~ '^[a-zA-Z0-9_]+
  ),
  constraint whatsapp_cloud_message_consent check (consent_confirmed = true)
);

create index if not exists whatsapp_cloud_due_idx
  on public.whatsapp_cloud_messages(status, scheduled_at)
  where status = 'scheduled';
create index if not exists whatsapp_cloud_company_queue_idx
  on public.whatsapp_cloud_messages(company_id, created_at desc);
create index if not exists whatsapp_cloud_reply_idx
  on public.whatsapp_cloud_messages(to_phone, status, scheduled_at)
  where status = 'scheduled' and stop_on_reply = true;

alter table public.whatsapp_cloud_messages enable row level security;
revoke all on table public.whatsapp_cloud_messages from anon, authenticated;
grant select, insert on table public.whatsapp_cloud_messages to authenticated;

create policy "company members can view their WhatsApp queue"
on public.whatsapp_cloud_messages for select to authenticated
using (public.is_company_member(company_id));

create policy "permitted company members can schedule consented messages"
on public.whatsapp_cloud_messages for insert to authenticated
with check (
  public.has_company_role(company_id, array['owner','admin','manager','staff'])
  and created_by = auth.uid()
  and consent_confirmed = true
  and status = 'scheduled'
  and attempt_count = 0
  and provider_message_id = ''
  and sent_at is null
);

create or replace function public.cancel_whatsapp_cloud_message(target_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $axivestra$
declare
  changed integer;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  update public.whatsapp_cloud_messages m
    set status = 'cancelled', updated_at = now()
    where m.id = target_message_id
      and m.status = 'scheduled'
      and (
        m.created_by = auth.uid()
        or public.has_company_role(m.company_id, array['owner','admin','manager'])
      );
  get diagnostics changed = row_count;
  return changed = 1;
end;
$axivestra$;

create or replace function public.retry_whatsapp_cloud_message(target_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $axivestra$
declare
  changed integer;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  update public.whatsapp_cloud_messages m
    set status = 'scheduled',
        scheduled_at = now() + interval '1 minute',
        attempt_count = 0,
        last_error = '',
        provider_message_id = '',
        sent_at = null,
        updated_at = now()
    where m.id = target_message_id
      and m.status = 'failed'
      and (
        m.created_by = auth.uid()
        or public.has_company_role(m.company_id, array['owner','admin','manager'])
      );
  get diagnostics changed = row_count;
  return changed = 1;
end;
$axivestra$;

create or replace function public.claim_due_whatsapp_messages(batch_size integer default 10)
returns setof public.whatsapp_cloud_messages
language plpgsql
security definer
set search_path = ''
as $axivestra$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;

  -- A process crash after claiming a row must not silently resend it: surface uncertain
  -- sends for human review rather than retrying a message that may already have reached Meta.
  update public.whatsapp_cloud_messages
    set status = 'failed',
        last_error = 'Delivery status is uncertain because the cloud worker stopped while sending. Check the WhatsApp chat before retrying to avoid a duplicate.',
        updated_at = now()
    where status = 'sending' and updated_at < now() - interval '10 minutes';

  return query
    with due as (
      select m.id
      from public.whatsapp_cloud_messages m
      where m.status = 'scheduled' and m.scheduled_at <= now()
      order by m.scheduled_at, m.created_at
      for update skip locked
      limit greatest(1, least(coalesce(batch_size, 10), 25))
    )
    update public.whatsapp_cloud_messages m
      set status = 'sending', attempt_count = m.attempt_count + 1, updated_at = now()
      from due
      where m.id = due.id
      returning m.*;
end;
$axivestra$;

create or replace function public.finish_whatsapp_cloud_message(
  target_message_id uuid,
  final_status text,
  provider_id text default '',
  failure_reason text default ''
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $axivestra$
declare
  changed integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  if final_status not in ('sent','failed') then
    raise exception 'Final status must be sent or failed.';
  end if;
  update public.whatsapp_cloud_messages
    set status = final_status,
        provider_message_id = left(coalesce(provider_id, ''), 300),
        sent_at = case when final_status = 'sent' then now() else null end,
        last_error = case when final_status = 'sent' then '' else left(coalesce(failure_reason, 'Delivery failed.'), 1500) end,
        updated_at = now()
    where id = target_message_id and status = 'sending';
  get diagnostics changed = row_count;
  return changed = 1;
end;
$axivestra$;

create or replace function public.cancel_whatsapp_cloud_followups_for_reply(target_phone text)
returns integer
language plpgsql
security definer
set search_path = ''
as $axivestra$
declare
  changed integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  update public.whatsapp_cloud_messages
    set status = 'cancelled',
        last_error = 'Cancelled automatically because the recipient replied.',
        updated_at = now()
    where to_phone = target_phone
      and status = 'scheduled'
      and stop_on_reply = true
      and scheduled_at > now();
  get diagnostics changed = row_count;
  return changed;
end;
$axivestra$;

revoke all on function public.cancel_whatsapp_cloud_message(uuid) from public, anon;
revoke all on function public.retry_whatsapp_cloud_message(uuid) from public, anon;
revoke all on function public.claim_due_whatsapp_messages(integer,uuid) from public, anon, authenticated;
revoke all on function public.finish_whatsapp_cloud_message(uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.cancel_whatsapp_cloud_followups_for_reply(text,uuid) from public, anon, authenticated;
grant execute on function public.cancel_whatsapp_cloud_message(uuid) to authenticated;
grant execute on function public.retry_whatsapp_cloud_message(uuid) to authenticated;
grant execute on function public.claim_due_whatsapp_messages(integer,uuid) to service_role;
grant execute on function public.finish_whatsapp_cloud_message(uuid,text,text,text) to service_role;
grant execute on function public.cancel_whatsapp_cloud_followups_for_reply(text,uuid) to service_role;
 and length(template_language) between 2 and 20)
  ),
  constraint whatsapp_cloud_message_consent check (consent_confirmed = true)
);

create index if not exists whatsapp_cloud_due_idx
  on public.whatsapp_cloud_messages(status, scheduled_at)
  where status = 'scheduled';
create index if not exists whatsapp_cloud_company_queue_idx
  on public.whatsapp_cloud_messages(company_id, created_at desc);
create index if not exists whatsapp_cloud_reply_idx
  on public.whatsapp_cloud_messages(to_phone, status, scheduled_at)
  where status = 'scheduled' and stop_on_reply = true;

alter table public.whatsapp_cloud_messages enable row level security;
revoke all on table public.whatsapp_cloud_messages from anon, authenticated;
grant select, insert on table public.whatsapp_cloud_messages to authenticated;

create policy "company members can view their WhatsApp queue"
on public.whatsapp_cloud_messages for select to authenticated
using (public.is_company_member(company_id));

create policy "permitted company members can schedule consented messages"
on public.whatsapp_cloud_messages for insert to authenticated
with check (
  public.has_company_role(company_id, array['owner','admin','manager','staff'])
  and created_by = auth.uid()
  and consent_confirmed = true
  and status = 'scheduled'
  and attempt_count = 0
  and provider_message_id = ''
  and sent_at is null
);

create or replace function public.cancel_whatsapp_cloud_message(target_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $axivestra$
declare
  changed integer;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  update public.whatsapp_cloud_messages m
    set status = 'cancelled', updated_at = now()
    where m.id = target_message_id
      and m.status = 'scheduled'
      and (
        m.created_by = auth.uid()
        or public.has_company_role(m.company_id, array['owner','admin','manager'])
      );
  get diagnostics changed = row_count;
  return changed = 1;
end;
$axivestra$;

create or replace function public.retry_whatsapp_cloud_message(target_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $axivestra$
declare
  changed integer;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  update public.whatsapp_cloud_messages m
    set status = 'scheduled',
        scheduled_at = now() + interval '1 minute',
        attempt_count = 0,
        last_error = '',
        provider_message_id = '',
        sent_at = null,
        updated_at = now()
    where m.id = target_message_id
      and m.status = 'failed'
      and (
        m.created_by = auth.uid()
        or public.has_company_role(m.company_id, array['owner','admin','manager'])
      );
  get diagnostics changed = row_count;
  return changed = 1;
end;
$axivestra$;

create or replace function public.claim_due_whatsapp_messages(batch_size integer default 10)
returns setof public.whatsapp_cloud_messages
language plpgsql
security definer
set search_path = ''
as $axivestra$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;

  -- A process crash after claiming a row must not silently resend it: surface uncertain
  -- sends for human review rather than retrying a message that may already have reached Meta.
  update public.whatsapp_cloud_messages
    set status = 'failed',
        last_error = 'Delivery status is uncertain because the cloud worker stopped while sending. Check the WhatsApp chat before retrying to avoid a duplicate.',
        updated_at = now()
    where status = 'sending' and updated_at < now() - interval '10 minutes';

  return query
    with due as (
      select m.id
      from public.whatsapp_cloud_messages m
      where m.status = 'scheduled' and m.scheduled_at <= now()
      order by m.scheduled_at, m.created_at
      for update skip locked
      limit greatest(1, least(coalesce(batch_size, 10), 25))
    )
    update public.whatsapp_cloud_messages m
      set status = 'sending', attempt_count = m.attempt_count + 1, updated_at = now()
      from due
      where m.id = due.id
      returning m.*;
end;
$axivestra$;

create or replace function public.finish_whatsapp_cloud_message(
  target_message_id uuid,
  final_status text,
  provider_id text default '',
  failure_reason text default ''
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $axivestra$
declare
  changed integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  if final_status not in ('sent','failed') then
    raise exception 'Final status must be sent or failed.';
  end if;
  update public.whatsapp_cloud_messages
    set status = final_status,
        provider_message_id = left(coalesce(provider_id, ''), 300),
        sent_at = case when final_status = 'sent' then now() else null end,
        last_error = case when final_status = 'sent' then '' else left(coalesce(failure_reason, 'Delivery failed.'), 1500) end,
        updated_at = now()
    where id = target_message_id and status = 'sending';
  get diagnostics changed = row_count;
  return changed = 1;
end;
$axivestra$;

create or replace function public.cancel_whatsapp_cloud_followups_for_reply(target_phone text)
returns integer
language plpgsql
security definer
set search_path = ''
as $axivestra$
declare
  changed integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  update public.whatsapp_cloud_messages
    set status = 'cancelled',
        last_error = 'Cancelled automatically because the recipient replied.',
        updated_at = now()
    where to_phone = target_phone
      and status = 'scheduled'
      and stop_on_reply = true
      and scheduled_at > now();
  get diagnostics changed = row_count;
  return changed;
end;
$axivestra$;

revoke all on function public.cancel_whatsapp_cloud_message(uuid) from public, anon;
revoke all on function public.retry_whatsapp_cloud_message(uuid) from public, anon;
revoke all on function public.claim_due_whatsapp_messages(integer,uuid) from public, anon, authenticated;
revoke all on function public.finish_whatsapp_cloud_message(uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.cancel_whatsapp_cloud_followups_for_reply(text,uuid) from public, anon, authenticated;
grant execute on function public.cancel_whatsapp_cloud_message(uuid) to authenticated;
grant execute on function public.retry_whatsapp_cloud_message(uuid) to authenticated;
grant execute on function public.claim_due_whatsapp_messages(integer,uuid) to service_role;
grant execute on function public.finish_whatsapp_cloud_message(uuid,text,text,text) to service_role;
grant execute on function public.cancel_whatsapp_cloud_followups_for_reply(text,uuid) to service_role;
