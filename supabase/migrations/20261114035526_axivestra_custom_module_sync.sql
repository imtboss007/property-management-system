-- Permit custom module definitions to participate in the same scoped workspace sync
-- as the other first-class record collections. Existing installations need this
-- forward migration before custom modules can be uploaded to either cloud workspace.

alter table public.company_records
  drop constraint if exists company_records_record_type_check;

alter table public.company_records
  add constraint company_records_record_type_check
  check (record_type in (
    'property','contact','document_metadata','task','financial','risk',
    'approval','whatsapp_group','audit_event','settings','custom_module'
  ));

alter table public.personal_records
  drop constraint if exists personal_records_record_type_check;

alter table public.personal_records
  add constraint personal_records_record_type_check
  check (record_type in (
    'property','contact','document_metadata','task','financial','risk',
    'approval','whatsapp_group','audit_event','settings','custom_module'
  ));
