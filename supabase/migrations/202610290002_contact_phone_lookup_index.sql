-- AXIVESTRA: make duplicate-phone lookups efficient without enforcing uniqueness.
-- Shared phone numbers are valid (families, reception desks, company switchboards),
-- so this is deliberately a non-unique expression index.
create index if not exists contacts_phone_digits_idx
  on public.contacts ((regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')))
  where nullif(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), '') is not null;

comment on index public.contacts_phone_digits_idx is
  'Supports normalized phone duplicate suggestions. Never use this index as permission to auto-merge contacts.';
