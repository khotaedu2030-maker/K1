-- STAGING-ONLY. Synthetic transaction; nothing persists (ROLLBACK).
-- Never apply to production. Includes dummy auth.users rows only to satisfy FK
-- in the complete, production-shaped public schema.
BEGIN;
INSERT INTO auth.users(id,email) VALUES
 ('11111111-1111-4111-8111-111111111111','khota-rsl-parent1@example.invalid'),
 ('22222222-2222-4222-8222-222222222222','khota-rsl-parent2@example.invalid'),
 ('33333333-3333-4333-8333-333333333333','khota-rsl-teacher1@example.invalid'),
 ('44444444-4444-4444-8444-444444444444','khota-rsl-teacher2@example.invalid');

INSERT INTO public.parents(id,user_id,full_name,phone) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Test Parent A','+10000000001'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Test Parent B','+10000000002');
INSERT INTO public.teachers(id,user_id,full_name,active) VALUES
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','33333333-3333-4333-8333-333333333333','Teacher A',true),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','44444444-4444-4444-8444-444444444444','Teacher B',true);
INSERT INTO public.children(id,parent_id,first_name,grade) VALUES
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Student A',5);
INSERT INTO public.plans(id,product,name) VALUES ('rls_test','english','RLS test plan');
INSERT INTO public.cohorts(id,product,plan_id,title,teacher_id,capacity,days_of_week,start_time,end_time)
 VALUES ('ffffffff-ffff-4fff-8fff-ffffffffffff','english','rls_test','Test group','cccccccc-cccc-4ccc-8ccc-cccccccccccc',3,'{1,3}'::smallint[],'10:00','11:00');
INSERT INTO public.subscriptions(id,child_id,parent_id,plan_id,cohort_id,status)
 VALUES ('55555555-5555-4555-8555-555555555555','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','rls_test','ffffffff-ffff-4fff-8fff-ffffffffffff','active');
INSERT INTO public.sessions(id,cohort_id,teacher_id,session_date)
 VALUES ('66666666-6666-4666-8666-666666666666','ffffffff-ffff-4fff-8fff-ffffffffffff','cccccccc-cccc-4ccc-8ccc-cccccccccccc',CURRENT_DATE);
INSERT INTO public.assessments(id,child_id,assessment_type)
 VALUES ('77777777-7777-4777-8777-777777777777','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','baseline');
INSERT INTO public.child_progress_snapshots(id,child_id,source)
 VALUES ('88888888-8888-4888-8888-888888888888','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','manual');
INSERT INTO public.independence_assessments(id,child_id,task_management,task_initiation,help_seeking,task_completion,time_organization,total_score)
 VALUES ('99999999-9999-4999-8999-999999999999','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',3,3,3,3,3,15);
INSERT INTO public.weekly_goals(id,child_id,week_start,title)
 VALUES ('12121212-1212-4212-8212-121212121212','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',CURRENT_DATE,'Sample goal');
INSERT INTO public.message_threads(id,child_id,parent_user_id,teacher_user_id,cohort_id)
 VALUES ('13131313-1313-4313-8313-131313131313','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','ffffffff-ffff-4fff-8fff-ffffffffffff');
INSERT INTO public.messages(id,thread_id,sender_user_id,sender_role,body)
 VALUES ('14141414-1414-4414-8414-141414141414','13131313-1313-4313-8313-131313131313','11111111-1111-4111-8111-111111111111','parent','Synthetic history only');

-- Real Postgres authenticated impersonation through Supabase production-shaped DDL.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $assert$
DECLARE tbl text; n integer;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['children','assessments','child_progress_snapshots',
  'independence_assessments','weekly_goals','sessions','cohorts','subscriptions',
  'message_threads','messages'] LOOP
  EXECUTE format('SELECT count(*) FROM public.%I',tbl) INTO n;
  IF n<>1 THEN RAISE EXCEPTION 'active teacher % returned %, expected 1',tbl,n; END IF;
 END LOOP;
END $assert$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='44444444-4444-4444-8444-444444444444';
DO $assert$
DECLARE tbl text; n integer;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['children','assessments','child_progress_snapshots',
  'independence_assessments','weekly_goals','sessions','cohorts','subscriptions',
  'message_threads','messages'] LOOP
  EXECUTE format('SELECT count(*) FROM public.%I',tbl) INTO n;
  IF n<>0 THEN RAISE EXCEPTION 'unrelated teacher % returned %, expected 0',tbl,n; END IF;
 END LOOP;
END $assert$;
RESET ROLE;

UPDATE public.teachers SET active=false WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $assert$
DECLARE tbl text; n integer;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['children','assessments','child_progress_snapshots',
  'independence_assessments','weekly_goals','sessions','cohorts','subscriptions',
  'message_threads','messages'] LOOP
  EXECUTE format('SELECT count(*) FROM public.%I',tbl) INTO n;
  IF n<>0 THEN RAISE EXCEPTION 'inactive teacher % returned %, expected 0',tbl,n; END IF;
 END LOOP;
END $assert$;
RESET ROLE;

UPDATE public.teachers SET active=NULL WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $assert$
DECLARE tbl text; n integer;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['children','assessments','child_progress_snapshots',
  'independence_assessments','weekly_goals','sessions','cohorts','subscriptions',
  'message_threads','messages'] LOOP
  EXECUTE format('SELECT count(*) FROM public.%I',tbl) INTO n;
  IF n<>0 THEN RAISE EXCEPTION 'NULL-active teacher % returned %, expected 0',tbl,n; END IF;
 END LOOP;
END $assert$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
DO $assert$
DECLARE tbl text; n integer;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['children','assessments','child_progress_snapshots',
  'independence_assessments','weekly_goals','sessions','cohorts','subscriptions',
  'message_threads','messages'] LOOP
  EXECUTE format('SELECT count(*) FROM public.%I',tbl) INTO n;
  IF n<>1 THEN RAISE EXCEPTION 'correct parent % returned %, expected 1',tbl,n; END IF;
 END LOOP;
 SELECT count(*) INTO n FROM public.teachers WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 IF n<>1 THEN RAISE EXCEPTION 'correct parent lost former teacher contact'; END IF;
END $assert$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
DO $assert$
DECLARE tbl text; n integer;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['children','assessments','child_progress_snapshots',
  'independence_assessments','weekly_goals','sessions','cohorts','subscriptions',
  'message_threads','messages'] LOOP
  EXECUTE format('SELECT count(*) FROM public.%I',tbl) INTO n;
  IF n<>0 THEN RAISE EXCEPTION 'unrelated parent % returned %, expected 0',tbl,n; END IF;
 END LOOP;
END $assert$;
RESET ROLE;

SELECT '60/60 actual Supabase RLS checks passed, ROLLBACK synthetic data' AS outcome;
ROLLBACK;