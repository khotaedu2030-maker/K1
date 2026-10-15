-- Staging only: original trigger metadata (no data).
BEGIN;
CREATE TRIGGER trg_enforce_cohort_days_match_plan BEFORE INSERT OR UPDATE OF days_of_week, plan_id ON cohorts FOR EACH ROW EXECUTE FUNCTION enforce_cohort_days_match_plan();
COMMIT;
