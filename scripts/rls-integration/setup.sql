-- Isolated PostgreSQL 17 test fixture. Never connect this to a real KHOTA database.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

CREATE TABLE public.parents(id uuid PRIMARY KEY, user_id uuid NOT NULL);
CREATE TABLE public.teachers(id uuid PRIMARY KEY, user_id uuid NOT NULL, active boolean);
CREATE TABLE public.children(id uuid PRIMARY KEY, parent_id uuid NOT NULL);
CREATE TABLE public.cohorts(id uuid PRIMARY KEY, teacher_id uuid NOT NULL);
CREATE TABLE public.subscriptions(id uuid PRIMARY KEY, child_id uuid NOT NULL, parent_id uuid NOT NULL, cohort_id uuid NOT NULL, status text NOT NULL);
CREATE TABLE public.sessions(id uuid PRIMARY KEY, cohort_id uuid NOT NULL, teacher_id uuid NOT NULL);
CREATE TABLE public.assessments(id uuid PRIMARY KEY, child_id uuid NOT NULL);
CREATE TABLE public.child_progress_snapshots(id uuid PRIMARY KEY, child_id uuid NOT NULL);
CREATE TABLE public.independence_assessments(id uuid PRIMARY KEY, child_id uuid NOT NULL);
CREATE TABLE public.weekly_goals(id uuid PRIMARY KEY, child_id uuid NOT NULL);
CREATE TABLE public.message_threads(id uuid PRIMARY KEY, parent_user_id uuid NOT NULL, teacher_user_id uuid NOT NULL);
CREATE TABLE public.messages(id uuid PRIMARY KEY, thread_id uuid NOT NULL);

DO $setup$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY[
   'parents','teachers','children','cohorts','subscriptions','sessions',
   'assessments','child_progress_snapshots','independence_assessments',
   'weekly_goals','message_threads','messages'
 ] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
 END LOOP;
END $setup$;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

CREATE POLICY parents_self_select ON public.parents FOR SELECT USING (user_id = auth.uid());
CREATE POLICY teachers_self_select ON public.teachers FOR SELECT USING (user_id = auth.uid());
CREATE POLICY teachers_visible_to_messaging_parents ON public.teachers FOR SELECT USING (
 user_id IN (SELECT mt.teacher_user_id FROM public.message_threads mt WHERE mt.parent_user_id = auth.uid())
);
CREATE POLICY children_of_own_parent ON public.children FOR SELECT USING (
 parent_id IN (SELECT id FROM public.parents WHERE user_id = auth.uid())
);
CREATE POLICY cohorts_of_own_children ON public.cohorts FOR SELECT USING (
 id IN (SELECT cohort_id FROM public.subscriptions WHERE parent_id IN (SELECT id FROM public.parents WHERE user_id = auth.uid()))
);
CREATE POLICY cohorts_of_own_teacher ON public.cohorts FOR SELECT USING (
 teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid())
);
CREATE POLICY subscriptions_of_own_parent ON public.subscriptions FOR SELECT USING (
 parent_id IN (SELECT id FROM public.parents WHERE user_id = auth.uid())
);
CREATE POLICY subscriptions_of_own_teacher ON public.subscriptions FOR SELECT USING (
 cohort_id IN (SELECT id FROM public.cohorts WHERE teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()))
);
CREATE POLICY children_of_teacher_sessions ON public.children FOR SELECT USING (
 id IN (SELECT s.child_id FROM public.subscriptions s JOIN public.cohorts c ON c.id=s.cohort_id
        WHERE c.teacher_id IN (SELECT id FROM public.teachers WHERE user_id=auth.uid()))
);
CREATE POLICY assessments_of_own_children ON public.assessments FOR SELECT USING (
 child_id IN (SELECT id FROM public.children WHERE parent_id IN (SELECT id FROM public.parents WHERE user_id=auth.uid()))
);
CREATE POLICY assessments_of_teacher_students ON public.assessments FOR SELECT USING (
 child_id IN (SELECT s.child_id FROM public.subscriptions s JOIN public.cohorts c ON c.id=s.cohort_id
              WHERE c.teacher_id IN (SELECT id FROM public.teachers WHERE user_id=auth.uid()))
);
CREATE POLICY progress_snapshots_of_own_children ON public.child_progress_snapshots FOR SELECT USING (
 child_id IN (SELECT id FROM public.children WHERE parent_id IN (SELECT id FROM public.parents WHERE user_id=auth.uid()))
);
CREATE POLICY progress_snapshots_of_teacher_students ON public.child_progress_snapshots FOR SELECT USING (
 child_id IN (SELECT s.child_id FROM public.subscriptions s JOIN public.cohorts c ON c.id=s.cohort_id
              WHERE c.teacher_id IN (SELECT id FROM public.teachers WHERE user_id=auth.uid()))
);
CREATE POLICY independence_of_own_children ON public.independence_assessments FOR SELECT USING (
 child_id IN (SELECT id FROM public.children WHERE parent_id IN (SELECT id FROM public.parents WHERE user_id=auth.uid()))
);
CREATE POLICY independence_of_teacher_students ON public.independence_assessments FOR SELECT USING (
 child_id IN (SELECT s.child_id FROM public.subscriptions s JOIN public.cohorts c ON c.id=s.cohort_id
              WHERE c.teacher_id IN (SELECT id FROM public.teachers WHERE user_id=auth.uid()))
);
CREATE POLICY weekly_goals_of_own_children ON public.weekly_goals FOR SELECT USING (
 child_id IN (SELECT id FROM public.children WHERE parent_id IN (SELECT id FROM public.parents WHERE user_id=auth.uid()))
);
CREATE POLICY weekly_goals_of_teacher_students ON public.weekly_goals FOR SELECT USING (
 child_id IN (SELECT s.child_id FROM public.subscriptions s JOIN public.cohorts c ON c.id=s.cohort_id
              WHERE c.teacher_id IN (SELECT id FROM public.teachers WHERE user_id=auth.uid()))
);
CREATE POLICY sessions_of_own_children ON public.sessions FOR SELECT USING (
 cohort_id IN (SELECT cohort_id FROM public.subscriptions WHERE parent_id IN (SELECT id FROM public.parents WHERE user_id=auth.uid()))
);
CREATE POLICY sessions_of_own_teacher ON public.sessions FOR SELECT USING (
 teacher_id IN (SELECT id FROM public.teachers WHERE user_id=auth.uid())
);
CREATE POLICY threads_of_parent ON public.message_threads FOR SELECT USING (parent_user_id=auth.uid());
CREATE POLICY threads_of_teacher ON public.message_threads FOR SELECT USING (teacher_user_id=auth.uid());
CREATE POLICY messages_of_thread_parent ON public.messages FOR SELECT USING (
 thread_id IN (SELECT id FROM public.message_threads WHERE parent_user_id=auth.uid())
);
CREATE POLICY messages_of_thread_teacher ON public.messages FOR SELECT USING (
 thread_id IN (SELECT id FROM public.message_threads WHERE teacher_user_id=auth.uid())
);

INSERT INTO public.parents VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111');
INSERT INTO public.parents VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222');
INSERT INTO public.teachers VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','33333333-3333-4333-8333-333333333333',true);
INSERT INTO public.teachers VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','44444444-4444-4444-8444-444444444444',true);
INSERT INTO public.children VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO public.cohorts VALUES ('ffffffff-ffff-4fff-8fff-ffffffffffff','cccccccc-cccc-4ccc-8ccc-cccccccccccc');
INSERT INTO public.subscriptions VALUES ('55555555-5555-4555-8555-555555555555','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ffffffff-ffff-4fff-8fff-ffffffffffff','active');
INSERT INTO public.sessions VALUES ('66666666-6666-4666-8666-666666666666','ffffffff-ffff-4fff-8fff-ffffffffffff','cccccccc-cccc-4ccc-8ccc-cccccccccccc');
INSERT INTO public.assessments VALUES ('77777777-7777-4777-8777-777777777777','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
INSERT INTO public.child_progress_snapshots VALUES ('88888888-8888-4888-8888-888888888888','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
INSERT INTO public.independence_assessments VALUES ('99999999-9999-4999-8999-999999999999','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
INSERT INTO public.weekly_goals VALUES ('12121212-1212-4212-8212-121212121212','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
INSERT INTO public.message_threads VALUES ('13131313-1313-4313-8313-131313131313','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333');
INSERT INTO public.messages VALUES ('14141414-1414-4414-8414-141414141414','13131313-1313-4313-8313-131313131313');
