-- KHOTA: staging-first patch for inactive teachers' authenticated SELECT reads.
-- Do NOT apply to production until real-role regression tests pass on isolated staging.
-- Preserve the ten verified policy conditions and ALL parent-facing policies unchanged.
-- Existing parent-facing teacher policy references message_threads: avoid RLS recursion
-- by using a SECURITY DEFINER helper scoped to the caller's OWN user ID.
BEGIN;
CREATE SCHEMA khota_rls;
REVOKE ALL ON SCHEMA khota_rls FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA khota_rls TO authenticated;
CREATE FUNCTION khota_rls.current_teacher_is_active()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.teachers t
    WHERE t.user_id = (SELECT auth.uid()) AND t.active IS TRUE
  );
$function$;
REVOKE ALL ON FUNCTION khota_rls.current_teacher_is_active()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION khota_rls.current_teacher_is_active() TO authenticated;

DO $migration$
DECLARE p record; n integer;
BEGIN
  SELECT count(*) INTO n
  FROM pg_catalog.pg_policies p
  JOIN (VALUES
    ('children', 'children_of_teacher_sessions'),
    ('assessments', 'assessments_of_teacher_students'),
    ('child_progress_snapshots', 'progress_snapshots_of_teacher_students'),
    ('independence_assessments', 'independence_of_teacher_students'),
    ('weekly_goals', 'weekly_goals_of_teacher_students'),
    ('sessions', 'sessions_of_own_teacher'),
    ('cohorts', 'cohorts_of_own_teacher'),
    ('subscriptions', 'subscriptions_of_own_teacher'),
    ('message_threads', 'threads_of_teacher'),
    ('messages', 'messages_of_thread_teacher')
  ) expected(tablename, policyname)
    ON p.tablename = expected.tablename AND p.policyname = expected.policyname
  WHERE p.schemaname = 'public' AND p.cmd = 'SELECT'
    AND p.permissive = 'PERMISSIVE' AND p.qual IS NOT NULL
    AND p.roles = ARRAY['public']::name[];
  IF n <> 10 THEN
    RAISE EXCEPTION 'Teacher RLS baseline drift: expected 10 reviewed policies, got %', n;
  END IF;
  FOR p IN
    SELECT pol.tablename, pol.policyname, pol.qual
    FROM pg_catalog.pg_policies pol
    JOIN (VALUES
    ('children', 'children_of_teacher_sessions'),
    ('assessments', 'assessments_of_teacher_students'),
    ('child_progress_snapshots', 'progress_snapshots_of_teacher_students'),
    ('independence_assessments', 'independence_of_teacher_students'),
    ('weekly_goals', 'weekly_goals_of_teacher_students'),
    ('sessions', 'sessions_of_own_teacher'),
    ('cohorts', 'cohorts_of_own_teacher'),
    ('subscriptions', 'subscriptions_of_own_teacher'),
    ('message_threads', 'threads_of_teacher'),
    ('messages', 'messages_of_thread_teacher')
    ) expected(tablename, policyname)
      ON pol.tablename = expected.tablename AND pol.policyname = expected.policyname
    WHERE pol.schemaname = 'public'
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON public.%I TO authenticated USING ((%s) AND (SELECT khota_rls.current_teacher_is_active()))',
      p.policyname, p.tablename, p.qual
    );
  END LOOP;
END;
$migration$;
COMMIT;
