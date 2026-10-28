-- EstateFlow linked contacts, properties, tasks, loan deadlines and communications.
-- Safe to apply more than once after the EstateFlow core migration.

alter table public.property_records
  add column if not exists primary_contact_id uuid references public.contacts(id) on delete set null,
  add column if not exists target_deadline date,
  add column if not exists next_follow_up_date date,
  add column if not exists next_action text not null default '';

alter table public.tasks
  add column if not exists contact_id uuid references public.contacts(id) on delete set null;

alter table public.documents
  add column if not exists contact_id uuid references public.contacts(id) on delete set null;

alter table public.financial_transactions
  add column if not exists contact_id uuid references public.contacts(id) on delete set null;

alter table public.risk_register
  add column if not exists property_id uuid references public.property_records(id) on delete set null,
  add column if not exists contact_id uuid references public.contacts(id) on delete set null;

alter table public.approval_requests
  add column if not exists property_id uuid references public.property_records(id) on delete set null,
  add column if not exists contact_id uuid references public.contacts(id) on delete set null;

alter table public.whatsapp_followups
  add column if not exists property_id uuid references public.property_records(id) on delete set null,
  add column if not exists task_id uuid references public.tasks(id) on delete set null;

create index if not exists property_records_contact_deadline_idx
  on public.property_records(user_id, primary_contact_id, target_deadline);
create index if not exists property_records_followup_idx
  on public.property_records(user_id, next_follow_up_date);
create index if not exists tasks_user_contact_due_idx
  on public.tasks(user_id, contact_id, due_date, due_time);
create index if not exists financial_transactions_user_contact_idx
  on public.financial_transactions(user_id, contact_id, transaction_date desc);
create index if not exists documents_user_contact_idx
  on public.documents(user_id, contact_id);
create index if not exists risk_register_user_links_idx
  on public.risk_register(user_id, property_id, contact_id);
create index if not exists approval_requests_user_links_idx
  on public.approval_requests(user_id, property_id, contact_id);
create index if not exists whatsapp_followups_user_links_idx
  on public.whatsapp_followups(user_id, property_id, task_id);

-- Prevent a record from linking to another user's contact/property/task even if a
-- manually crafted client request bypasses the normal UI selection controls.
create or replace function public.estateflow_validate_relationship_owner()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  linked_owner uuid;
begin
  if TG_TABLE_NAME = 'property_records' then
    if new.primary_contact_id is not null then
      select user_id into linked_owner from public.contacts where id = new.primary_contact_id;
      if linked_owner is distinct from new.user_id then
        raise exception 'A property/deal may only link to a contact in the same workspace';
      end if;
    end if;
  elsif TG_TABLE_NAME = 'tasks' then
    if new.property_id is not null then
      select user_id into linked_owner from public.property_records where id = new.property_id;
      if linked_owner is distinct from new.user_id then
        raise exception 'A task may only link to a property/deal in the same workspace';
      end if;
    end if;
    if new.contact_id is not null then
      select user_id into linked_owner from public.contacts where id = new.contact_id;
      if linked_owner is distinct from new.user_id then
        raise exception 'A task may only link to a contact in the same workspace';
      end if;
    end if;
  elsif TG_TABLE_NAME in ('documents', 'financial_transactions', 'risk_register', 'approval_requests') then
    if new.property_id is not null then
      select user_id into linked_owner from public.property_records where id = new.property_id;
      if linked_owner is distinct from new.user_id then
        raise exception 'A record may only link to a property/deal in the same workspace';
      end if;
    end if;
    if new.contact_id is not null then
      select user_id into linked_owner from public.contacts where id = new.contact_id;
      if linked_owner is distinct from new.user_id then
        raise exception 'A record may only link to a contact in the same workspace';
      end if;
    end if;
  elsif TG_TABLE_NAME = 'whatsapp_followups' then
    if new.contact_id is not null then
      select user_id into linked_owner from public.contacts where id = new.contact_id;
      if linked_owner is distinct from new.user_id then
        raise exception 'A WhatsApp follow-up may only link to a contact in the same workspace';
      end if;
    end if;
    if new.property_id is not null then
      select user_id into linked_owner from public.property_records where id = new.property_id;
      if linked_owner is distinct from new.user_id then
        raise exception 'A WhatsApp follow-up may only link to a property/deal in the same workspace';
      end if;
    end if;
    if new.task_id is not null then
      select user_id into linked_owner from public.tasks where id = new.task_id;
      if linked_owner is distinct from new.user_id then
        raise exception 'A WhatsApp follow-up may only link to a task in the same workspace';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists estateflow_validate_relationship_owner on public.property_records;
create trigger estateflow_validate_relationship_owner before insert or update on public.property_records
for each row execute function public.estateflow_validate_relationship_owner();

drop trigger if exists estateflow_validate_relationship_owner on public.tasks;
create trigger estateflow_validate_relationship_owner before insert or update on public.tasks
for each row execute function public.estateflow_validate_relationship_owner();

drop trigger if exists estateflow_validate_relationship_owner on public.documents;
create trigger estateflow_validate_relationship_owner before insert or update on public.documents
for each row execute function public.estateflow_validate_relationship_owner();

drop trigger if exists estateflow_validate_relationship_owner on public.financial_transactions;
create trigger estateflow_validate_relationship_owner before insert or update on public.financial_transactions
for each row execute function public.estateflow_validate_relationship_owner();

drop trigger if exists estateflow_validate_relationship_owner on public.risk_register;
create trigger estateflow_validate_relationship_owner before insert or update on public.risk_register
for each row execute function public.estateflow_validate_relationship_owner();

drop trigger if exists estateflow_validate_relationship_owner on public.approval_requests;
create trigger estateflow_validate_relationship_owner before insert or update on public.approval_requests
for each row execute function public.estateflow_validate_relationship_owner();

drop trigger if exists estateflow_validate_relationship_owner on public.whatsapp_followups;
create trigger estateflow_validate_relationship_owner before insert or update on public.whatsapp_followups
for each row execute function public.estateflow_validate_relationship_owner();
