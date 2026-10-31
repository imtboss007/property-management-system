-- AXIVESTRA integrity follow-up: use server time for conflict resolution and audit company renames.
-- Apply after 202610290001_auth_company_rbac.sql and 202610290002_rbac_hardening.sql.

create or replace function public.stamp_company_record_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $axivestra$
begin
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$axivestra$;

revoke all on function public.stamp_company_record_metadata() from public;

drop trigger if exists company_record_metadata_stamp on public.company_records;
create trigger company_record_metadata_stamp
before insert or update on public.company_records
for each row execute function public.stamp_company_record_metadata();

create or replace function public.log_company_name_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $axivestra$
declare
  actor_id uuid;
begin
  if old.name is not distinct from new.name then
    return new;
  end if;

  actor_id := auth.uid();
  if actor_id is not null then
    insert into public.company_audit_events(
      company_id, actor_user_id, action, entity_type, entity_key, label
    ) values (
      new.id, actor_id, 'company_settings_changed', 'company', new.id::text, 'Company name updated'
    );
  end if;
  return new;
end;
$axivestra$;

revoke all on function public.log_company_name_change() from public;

drop trigger if exists company_name_change_audit on public.companies;
create trigger company_name_change_audit
after update of name on public.companies
for each row execute function public.log_company_name_change();
