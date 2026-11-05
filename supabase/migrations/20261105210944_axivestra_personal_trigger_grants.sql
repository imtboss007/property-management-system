revoke all on function public.guard_personal_record_identity() from public, anon;
grant execute on function public.guard_personal_record_identity() to authenticated, service_role;