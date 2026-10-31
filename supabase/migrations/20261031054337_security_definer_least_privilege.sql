-- AXIVESTRA least-privilege hardening for SECURITY DEFINER routines.
-- Safe additive migration: does not alter or delete application data.
-- Trigger functions do not need direct EXECUTE grants for their attached triggers.
-- RLS helper functions and authenticated company creation remain callable by signed-in users.

revoke all on function public.create_company_with_owner(text) from public, anon;
grant execute on function public.create_company_with_owner(text) to authenticated;

revoke all on function public.is_company_member(uuid) from public, anon;
grant execute on function public.is_company_member(uuid) to authenticated;

revoke all on function public.has_company_role(uuid, text[]) from public, anon;
grant execute on function public.has_company_role(uuid, text[]) to authenticated;

revoke all on function public.guard_company_membership_actor() from public, anon, authenticated;
revoke all on function public.guard_company_record_identity() from public, anon, authenticated;
revoke all on function public.guard_company_record_soft_delete() from public, anon, authenticated;
revoke all on function public.log_company_membership_change() from public, anon, authenticated;
revoke all on function public.log_company_name_change() from public, anon, authenticated;
revoke all on function public.stamp_company_record_metadata() from public, anon, authenticated;

-- Explicitly retain service-role access for server-side administrative routines
-- where the platform's role model grants it, without exposing functions to clients.
