-- Runs against a disposable PostgreSQL CI service only, after setup and migration.
-- Execute all SELECTs as authenticated, never as the table owner or service_role.
CREATE FUNCTION public.assert_rls_counts(expected_count integer, actor text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $fn$
DECLARE tab text; found_rows integer;
BEGIN
  FOREACH tab IN ARRAY ARRAY[
    'children','assessments','child_progress_snapshots','independence_assessments',
    'weekly_goals','sessions','cohorts','subscriptions','message_threads','messages'
  ] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', tab) INTO found_rows;
    IF found_rows <> expected_count THEN
      RAISE EXCEPTION 'RLS %: % returned %, expected %',actor,tab,found_rows,expected_count;
    END IF;
  END LOOP;
END $fn$;
GRANT EXECUTE ON FUNCTION public.assert_rls_counts(integer,text) TO authenticated;

DO $audit$
DECLARE guarded integer;
BEGIN
  SELECT count(*) INTO guarded FROM pg_catalog.pg_policies
  WHERE schemaname='public' AND qual LIKE '%khota_rls.current_teacher_is_active()%';
  IF guarded <> 10 THEN RAISE EXCEPTION 'Expected ten guarded policies, got %', guarded; END IF;
  IF has_function_privilege('anon','khota_rls.current_teacher_is_active()','EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous role must not execute RLS helper';
  END IF;
  IF has_schema_privilege('anon','khota_rls','USAGE') THEN
    RAISE EXCEPTION 'Anonymous role must not use RLS helper schema';
  END IF;
END $audit$;

SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
SELECT public.assert_rls_counts(1,'active teacher');
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claim.sub='44444444-4444-4444-8444-444444444444';
SELECT public.assert_rls_counts(0,'unrelated active teacher');
RESET ROLE;

UPDATE public.teachers SET active=false WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
SELECT public.assert_rls_counts(0,'inactive teacher');
RESET ROLE;

UPDATE public.teachers SET active=NULL WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
SELECT public.assert_rls_counts(0,'null-active teacher');
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
SELECT public.assert_rls_counts(1,'actual parent');
DO $parent$
DECLARE visible_count integer;
BEGIN
  SELECT count(*) INTO visible_count FROM public.teachers
  WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  IF visible_count <> 1 THEN RAISE EXCEPTION 'Parent lost past teacher contact access'; END IF;
END $parent$;
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
SELECT public.assert_rls_counts(0,'unrelated parent');
RESET ROLE;

SELECT 'Real PostgreSQL RLS roles and message recursion passed' AS result;
