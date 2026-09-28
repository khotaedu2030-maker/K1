begin;

revoke all on function public.enroll_subscription_atomic(
uuid, uuid, text, uuid
) from public, anon, authenticated;

grant execute on function public.enroll_subscription_atomic(
uuid, uuid, text, uuid
) to service_role;

revoke all on function public.enroll_subscription_atomic(
uuid, uuid, text, uuid, text, numeric, smallint, smallint
) from public, anon, authenticated;

grant execute on function public.enroll_subscription_atomic(
uuid, uuid, text, uuid, text, numeric, smallint, smallint
) to service_role;

revoke all on function public.enforce_cohort_days_match_plan()
from public, anon, authenticated;

commit;
