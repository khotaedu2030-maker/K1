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

-- The old subscriptions_of_own_teacher reads cohorts through RLS, while
-- cohorts_of_own_children reads subscriptions through RLS. That causes
-- infinite recursion when tested as a real authenticated role. The scoped
-- membership check below removes this existing dependency loop.
CREATE FUNCTION khota_rls.current_teacher_owns_cohort(p_cohort_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $cohort$
  SELECT EXISTS (
    SELECT 1 FROM public.cohorts c
    JOIN public.teachers t ON t.id = c.teacher_id
    WHERE c.id = p_cohort_id
      AND t.user_id = (SELECT auth.uid())
      AND t.active IS TRUE
  );
$cohort$;
REVOKE ALL ON FUNCTION khota_rls.current_teacher_owns_cohort(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION khota_rls.current_teacher_owns_cohort(uuid) TO authenticated;

DO $migration$
DECLARE policy_row record; n integer;
BEGIN
  SELECT count(*) INTO n
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
  WHERE pol.schemaname = 'public' AND pol.cmd = 'SELECT'
    AND pol.permissive = 'PERMISSIVE' AND pol.qual IS NOT NULL
    AND pol.roles = ARRAY['public']::name[];
  IF n <> 10 THEN
    RAISE EXCEPTION 'Teacher RLS baseline drift: expected 10 reviewed policies, got %', n;
  END IF;
  FOR policy_row IN
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
    IF policy_row.tablename = 'subscriptions'
       AND policy_row.policyname = 'subscriptions_of_own_teacher' THEN
      -- Only exception to preserving the original qualifier verbatim:
      -- original nested cohorts -> subscriptions RLS is recursive.
      -- The replacement verifies exactly the same cohort/teacher relationship
      -- and additionally requires teachers.active IS TRUE.
      EXECUTE format(
        'ALTER POLICY %I ON public.%I TO authenticated USING (khota_rls.current_teacher_owns_cohort(cohort_id) AND (SELECT khota_rls.current_teacher_is_active()))',
        policy_row.policyname, policy_row.tablename
      );
    ELSE
      EXECUTE format(
        'ALTER POLICY %I ON public.%I TO authenticated USING ((%s) AND (SELECT khota_rls.current_teacher_is_active()))',
        policy_row.policyname, policy_row.tablename, policy_row.qual
      );
    END IF;
  END LOOP;
END;
$migration$;
COMMIT;
