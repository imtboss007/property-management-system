-- WhatsApp queue metadata for high-volume scheduling and official Groups API routing.
alter table public.whatsapp_followups
  add column if not exists recipient_type text not null default 'individual',
  add column if not exists batch_id uuid,
  add column if not exists audience_label text not null default '',
  add column if not exists target_label text not null default '';

alter table public.whatsapp_followups drop constraint if exists whatsapp_followups_recipient_type_check;
alter table public.whatsapp_followups add constraint whatsapp_followups_recipient_type_check
  check (recipient_type in ('individual', 'group'));

create index if not exists whatsapp_followups_user_batch_idx
  on public.whatsapp_followups(user_id, batch_id, created_at desc);
create index if not exists whatsapp_followups_due_status_idx
  on public.whatsapp_followups(status, scheduled_at);

create or replace function public.estateflow_claim_due_whatsapp_followups(batch_size integer default 100)
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
    limit greatest(1, least(coalesce(batch_size, 100), 100))
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
