-- Staging-only hardening of an existing trigger helper flagged by Security Advisor.
-- Use qualified references so the function can run with an empty search_path.
-- Do NOT apply to production without independent approval.
BEGIN;
CREATE OR REPLACE FUNCTION public.enforce_cohort_days_match_plan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  v_expected_days smallint;
BEGIN
  IF NEW.plan_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT days_per_week INTO v_expected_days FROM public.plans WHERE id = NEW.plan_id;
  IF v_expected_days IS NOT NULL
     AND array_length(NEW.days_of_week, 1) IS DISTINCT FROM v_expected_days THEN
    RAISE EXCEPTION 'cohort_days_mismatch: هذه المجموعة أيامها (%) لا تطابق عدد أيام باقتها (%) — راجع days_of_week وplan_id',
      COALESCE(array_length(NEW.days_of_week, 1), 0), v_expected_days;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.enforce_cohort_days_match_plan() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_cohort_days_match_plan() TO service_role;
COMMIT;