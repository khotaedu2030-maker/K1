-- Read-only metadata snapshot of production RLS policies. Staging only.
BEGIN;
DO $enable$ DECLARE t record; BEGIN FOR t IN SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t.name); END LOOP; END $enable$;
CREATE POLICY "assessments_of_own_children" ON public."assessments" AS PERMISSIVE FOR SELECT TO public USING ((child_id IN ( SELECT children.id
   FROM children
  WHERE (children.parent_id IN ( SELECT parents.id
           FROM parents
          WHERE (parents.user_id = auth.uid()))))));
CREATE POLICY "assessments_of_teacher_students" ON public."assessments" AS PERMISSIVE FOR SELECT TO public USING ((child_id IN ( SELECT s.child_id
   FROM (subscriptions s
     JOIN cohorts c ON ((c.id = s.cohort_id)))
  WHERE (c.teacher_id IN ( SELECT teachers.id
           FROM teachers
          WHERE (teachers.user_id = auth.uid()))))));
CREATE POLICY "attendance_of_own_children" ON public."attendance" AS PERMISSIVE FOR SELECT TO public USING ((child_id IN ( SELECT children.id
   FROM children
  WHERE (children.parent_id IN ( SELECT parents.id
           FROM parents
          WHERE (parents.user_id = auth.uid()))))));
CREATE POLICY "progress_snapshots_of_own_children" ON public."child_progress_snapshots" AS PERMISSIVE FOR SELECT TO public USING ((child_id IN ( SELECT children.id
   FROM children
  WHERE (children.parent_id IN ( SELECT parents.id
           FROM parents
          WHERE (parents.user_id = auth.uid()))))));
CREATE POLICY "progress_snapshots_of_teacher_students" ON public."child_progress_snapshots" AS PERMISSIVE FOR SELECT TO public USING ((child_id IN ( SELECT s.child_id
   FROM (subscriptions s
     JOIN cohorts c ON ((c.id = s.cohort_id)))
  WHERE (c.teacher_id IN ( SELECT teachers.id
           FROM teachers
          WHERE (teachers.user_id = auth.uid()))))));
CREATE POLICY "children_of_own_parent" ON public."children" AS PERMISSIVE FOR SELECT TO public USING ((parent_id IN ( SELECT parents.id
   FROM parents
  WHERE (parents.user_id = auth.uid()))));
CREATE POLICY "children_of_teacher_sessions" ON public."children" AS PERMISSIVE FOR SELECT TO public USING ((id IN ( SELECT s.child_id
   FROM (subscriptions s
     JOIN cohorts c ON ((c.id = s.cohort_id)))
  WHERE (c.teacher_id IN ( SELECT teachers.id
           FROM teachers
          WHERE (teachers.user_id = auth.uid()))))));
CREATE POLICY "cohorts_of_own_children" ON public."cohorts" AS PERMISSIVE FOR SELECT TO public USING ((id IN ( SELECT subscriptions.cohort_id
   FROM subscriptions
  WHERE (subscriptions.parent_id IN ( SELECT parents.id
           FROM parents
          WHERE (parents.user_id = auth.uid()))))));
CREATE POLICY "cohorts_of_own_teacher" ON public."cohorts" AS PERMISSIVE FOR SELECT TO public USING ((teacher_id IN ( SELECT teachers.id
   FROM teachers
  WHERE (teachers.user_id = auth.uid()))));
CREATE POLICY "daily_pulse_of_own_children" ON public."daily_pulse_reports" AS PERMISSIVE FOR SELECT TO public USING ((child_id IN ( SELECT children.id
   FROM children
  WHERE (children.parent_id IN ( SELECT parents.id
           FROM parents
          WHERE (parents.user_id = auth.uid()))))));
CREATE POLICY "daily_tasks_of_own_children" ON public."daily_tasks" AS PERMISSIVE FOR SELECT TO public USING ((child_id IN ( SELECT children.id
   FROM children
  WHERE (children.parent_id IN ( SELECT parents.id
           FROM parents
          WHERE (parents.user_id = auth.uid()))))));
CREATE POLICY "independence_of_own_children" ON public."independence_assessments" AS PERMISSIVE FOR SELECT TO public USING ((child_id IN ( SELECT children.id
   FROM children
  WHERE (children.parent_id IN ( SELECT parents.id
           FROM parents
          WHERE (parents.user_id = auth.uid()))))));
CREATE POLICY "independence_of_teacher_students" ON public."independence_assessments" AS PERMISSIVE FOR SELECT TO public USING ((child_id IN ( SELECT s.child_id
   FROM (subscriptions s
     JOIN cohorts c ON ((c.id = s.cohort_id)))
  WHERE (c.teacher_id IN ( SELECT teachers.id
           FROM teachers
          WHERE (teachers.user_id = auth.uid()))))));
CREATE POLICY "learning_profiles_of_own_children" ON public."learning_profiles" AS PERMISSIVE FOR SELECT TO public USING ((child_id IN ( SELECT children.id
   FROM children
  WHERE (children.parent_id IN ( SELECT parents.id
           FROM parents
          WHERE (parents.user_id = auth.uid()))))));
CREATE POLICY "makeup_credits_of_own_children" ON public."makeup_credits" AS PERMISSIVE FOR SELECT TO public USING ((child_id IN ( SELECT children.id
   FROM children
  WHERE (children.parent_id IN ( SELECT parents.id
           FROM parents
          WHERE (parents.user_id = auth.uid()))))));
CREATE POLICY "threads_of_parent" ON public."message_threads" AS PERMISSIVE FOR SELECT TO public USING ((parent_user_id = auth.uid()));
CREATE POLICY "threads_of_teacher" ON public."message_threads" AS PERMISSIVE FOR SELECT TO public USING ((teacher_user_id = auth.uid()));
CREATE POLICY "messages_of_thread_parent" ON public."messages" AS PERMISSIVE FOR SELECT TO public USING ((thread_id IN ( SELECT message_threads.id
   FROM message_threads
  WHERE (message_threads.parent_user_id = auth.uid()))));
CREATE POLICY "messages_of_thread_teacher" ON public."messages" AS PERMISSIVE FOR SELECT TO public USING ((thread_id IN ( SELECT message_threads.id
   FROM message_threads
  WHERE (message_threads.teacher_user_id = auth.uid()))));
CREATE POLICY "parents_self_select" ON public."parents" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "plans_public_read" ON public."plans" AS PERMISSIVE FOR SELECT TO public USING ((active = true));
CREATE POLICY "recommendations_of_own_children" ON public."recommendations" AS PERMISSIVE FOR SELECT TO public USING ((child_id IN ( SELECT children.id
   FROM children
  WHERE (children.parent_id IN ( SELECT parents.id
           FROM parents
          WHERE (parents.user_id = auth.uid()))))));
CREATE POLICY "sessions_of_own_children" ON public."sessions" AS PERMISSIVE FOR SELECT TO public USING ((cohort_id IN ( SELECT subscriptions.cohort_id
   FROM subscriptions
  WHERE (subscriptions.parent_id IN ( SELECT parents.id
           FROM parents
          WHERE (parents.user_id = auth.uid()))))));
CREATE POLICY "sessions_of_own_teacher" ON public."sessions" AS PERMISSIVE FOR SELECT TO public USING ((teacher_id IN ( SELECT teachers.id
   FROM teachers
  WHERE (teachers.user_id = auth.uid()))));
CREATE POLICY "student_session_self_read" ON public."student_mode_sessions" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = parent_user_id));
CREATE POLICY "pauses_of_own_subscriptions" ON public."subscription_pauses" AS PERMISSIVE FOR SELECT TO public USING ((subscription_id IN ( SELECT subscriptions.id
   FROM subscriptions
  WHERE (subscriptions.parent_id IN ( SELECT parents.id
           FROM parents
          WHERE (parents.user_id = auth.uid()))))));
CREATE POLICY "subscriptions_of_own_parent" ON public."subscriptions" AS PERMISSIVE FOR SELECT TO public USING ((parent_id IN ( SELECT parents.id
   FROM parents
  WHERE (parents.user_id = auth.uid()))));
CREATE POLICY "subscriptions_of_own_teacher" ON public."subscriptions" AS PERMISSIVE FOR SELECT TO public USING ((cohort_id IN ( SELECT cohorts.id
   FROM cohorts
  WHERE (cohorts.teacher_id IN ( SELECT teachers.id
           FROM teachers
          WHERE (teachers.user_id = auth.uid()))))));
CREATE POLICY "teachers_self_select" ON public."teachers" AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "teachers_visible_to_messaging_parents" ON public."teachers" AS PERMISSIVE FOR SELECT TO public USING ((user_id IN ( SELECT message_threads.teacher_user_id
   FROM message_threads
  WHERE (message_threads.parent_user_id = auth.uid()))));
CREATE POLICY "weekly_goals_of_own_children" ON public."weekly_goals" AS PERMISSIVE FOR SELECT TO public USING ((child_id IN ( SELECT children.id
   FROM children
  WHERE (children.parent_id IN ( SELECT parents.id
           FROM parents
          WHERE (parents.user_id = auth.uid()))))));
CREATE POLICY "weekly_goals_of_teacher_students" ON public."weekly_goals" AS PERMISSIVE FOR SELECT TO public USING ((child_id IN ( SELECT s.child_id
   FROM (subscriptions s
     JOIN cohorts c ON ((c.id = s.cohort_id)))
  WHERE (c.teacher_id IN ( SELECT teachers.id
           FROM teachers
          WHERE (teachers.user_id = auth.uid()))))));
COMMIT;
