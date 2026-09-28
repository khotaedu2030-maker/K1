begin;

-- ============================================================
-- 1. Anonymous clients should not directly read public tables.
-- Public website data is served by trusted server paths.
-- ============================================================

revoke select
on all tables in schema public
from anon;

alter default privileges for role postgres in schema public
  revoke select on tables
  from anon;


-- ============================================================
-- 2. Remove authenticated SELECT from server-only tables.
-- ============================================================

revoke select
on table
  public.admin_platform_settings,
  public.contact_requests,
  public.cycles,
  public.level_test_answers,
  public.level_test_sessions,
  public.operational_exceptions,
  public.payment_refunds,
  public.platform_settings,
  public.premium_requests,
  public.readiness_blocker_overrides,
  public.support_cases,
  public.teacher_applications,
  public.teacher_availability,
  public.webhook_events
from authenticated;


-- Legacy direct admin-settings read policy is no longer required.
drop policy if exists "Admins can read platform settings"
on public.platform_settings;


-- ============================================================
-- 3. Existing public RPCs are now server/service-role only.
-- ============================================================

revoke execute
on function public.cohort_available_seats(uuid)
from public, anon, authenticated;

grant execute
on function public.cohort_available_seats(uuid)
to service_role;

revoke execute
on function public.public_cohorts_catalog(text)
from public, anon, authenticated;

grant execute
on function public.public_cohorts_catalog(text)
to service_role;

commit;
