-- Staging only: reproduce 0 anon grants, 21 authenticated read-only, and service_role full access.
BEGIN;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON TABLE
public."assessments",
public."attendance",
public."child_progress_snapshots",
public."children",
public."cohorts",
public."daily_pulse_reports",
public."daily_tasks",
public."independence_assessments",
public."learning_profiles",
public."makeup_credits",
public."message_threads",
public."messages",
public."parents",
public."plans",
public."recommendations",
public."sessions",
public."student_mode_sessions",
public."subscription_pauses",
public."subscriptions",
public."teachers",
public."weekly_goals"
TO authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
COMMIT;
