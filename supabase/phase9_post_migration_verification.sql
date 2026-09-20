-- ============================================================================
-- KHOTA — Phase 9 / Step 9.2A — POST-MIGRATION VERIFICATION SCRIPT
-- ============================================================================
-- Purpose: run this AFTER (and only after) a human has actually applied
-- supabase/migrations/20261002_phase9_production_reconciliation.sql against
-- the real Production database (Sunday runbook GATE 3/4), to confirm the
-- result matches exactly what that migration was designed to produce.
--
-- This is the natural successor to
-- supabase/phase9_database_reconciliation_readonly.sql (which was run BEFORE
-- the migration, to gather the evidence the migration itself was built
-- against). Run that script's Section 0 identity check first if there is any
-- doubt about which database this is running against.
--
-- SAFETY CONTRACT (read this before running):
--   - Every statement below is SELECT-only / introspection-only.
--   - Zero INSERT / UPDATE / DELETE / CREATE / ALTER / DROP.
--   - Reveals no secrets and no customer PII: inspects
--     information_schema/pg_catalog and small row COUNTS only, never row
--     contents, never names/emails/phones, never environment variables.
--   - Safe to run as many times as needed.
--
-- HOW TO READ THE RESULTS: every section below produces a table with an
-- "ok" boolean-ish column (or an explicit expected value) — a run where
-- every relevant row reads "true"/matches is GATE 4 PASS
-- (KHOTA_SUNDAY_GO_LIVE_RUNBOOK.md). Any row reading "false" or an
-- unexpected value is a STOP — do not proceed to GATE 5 until resolved.
-- ============================================================================


-- ============================================================================
-- SECTION 0 — WHICH DATABASE IS THIS?
-- ============================================================================
select current_database() as database_name,
       current_schema()   as current_schema,
       now()               as run_at_utc,
       version()           as postgres_version;


-- ============================================================================
-- SECTION 1 — PREVIOUSLY-MISSING TABLES NOW EXIST
-- ============================================================================
with expected(table_name) as (
  values
    ('cycles'), ('operational_exceptions'), ('payment_refunds'),
    ('readiness_blocker_overrides'), ('support_cases'), ('webhook_events'),
    ('admin_platform_settings')
)
select
  e.table_name,
  exists(
    select 1 from information_schema.tables t
    where t.table_schema = 'public' and t.table_name = e.table_name
  ) as now_exists
from expected e
order by e.table_name;


-- ============================================================================
-- SECTION 2 — LEGACY platform_settings TABLE UNTOUCHED (schema check only,
-- no row contents read)
-- ============================================================================
-- Expect exactly the same key/value column set the diagnostic found before
-- the migration: id, key, value, description, created_at, updated_at.
-- If this section shows anything different, the legacy table was modified
-- and that needs to be understood before continuing.
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'platform_settings'
order by ordinal_position;

select count(*) as legacy_platform_settings_row_count
from platform_settings;
-- Compare this number to whatever it was before the migration (Section 1 of
-- the pre-migration diagnostic, or manually noted beforehand) — it must be
-- unchanged. This script cannot know the "before" count on its own.


-- ============================================================================
-- SECTION 3 — PREVIOUSLY-MISSING COLUMNS NOW EXIST
-- ============================================================================
with expected(table_name, column_name) as (
  values
    ('admins', 'active'),
    ('admins', 'role'),
    ('admins', 'pending_email'),
    ('cohorts', 'cycle_id'),
    ('cohorts', 'grade'),
    ('subscriptions', 'hold_expires_at'),
    ('subscriptions', 'plan_snapshot_name'),
    ('subscriptions', 'plan_snapshot_price_sar'),
    ('subscriptions', 'plan_snapshot_sessions_per_month'),
    ('subscriptions', 'plan_snapshot_days_per_week'),
    ('teachers', 'application_id')
)
select
  e.table_name, e.column_name,
  exists(
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = e.table_name and c.column_name = e.column_name
  ) as now_exists
from expected e
order by e.table_name, e.column_name;


-- ============================================================================
-- SECTION 4 — admin_platform_settings: singleton row exists with expected
-- defaults (or an admin's real customization, which is also fine — this just
-- confirms the row exists and values are within valid range, not that they
-- equal the seed defaults verbatim)
-- ============================================================================
select
  id, registration_enabled, seat_hold_hours, attendance_lock_hours,
  default_capacity_1_3, default_capacity_4_6, default_capacity_7_9, default_capacity_10_12,
  pause_min_days, pause_max_days, makeup_monthly_limit,
  (select count(*) from admin_platform_settings) = 1 as exactly_one_row
from admin_platform_settings;


-- ============================================================================
-- SECTION 5 — RPC SIGNATURES: every function this migration installs or
-- redefines, confirmed present with the expected argument list
-- ============================================================================
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'cohort_occupied_seats', 'cohort_available_seats', 'public_cohorts_catalog',
    'enroll_subscription_atomic', 'activate_subscription_atomic',
    'admin_update_cohort_operations_atomic',
    'transition_payment_refund_nonfinancial_atomic', 'complete_payment_refund_atomic',
    'transition_operational_exception_atomic', 'transition_support_case_atomic',
    'convert_contact_request_to_support_case_atomic', 'sync_operational_exceptions',
    'activate_teacher_from_application_atomic', 'transfer_subscription_cohort_atomic',
    'admin_create_subscription_pause_atomic', 'admin_cancel_subscription_pause_atomic',
    'admin_issue_makeup_credit_atomic', 'admin_cancel_makeup_credit_atomic',
    'complete_cycle_atomic', 'override_readiness_blocker_atomic',
    'admin_change_role_atomic', 'admin_set_active_atomic',
    'admin_override_attendance_atomic', 'admin_update_plan_atomic',
    'admin_update_platform_settings'
  )
order by p.proname, arguments;
-- Expect exactly one row per name EXCEPT enroll_subscription_atomic (two rows
-- expected: the pre-existing 4-parameter version and the 8-parameter
-- snapshot-aware version) and admin_update_platform_settings (exactly one
-- row, 17 parameters -- if a 10-parameter row also appears, the obsolete
-- overload drop did not take effect and needs investigation).


-- ============================================================================
-- SECTION 6 — OBSOLETE OVERLOAD CONFIRMED GONE
-- ============================================================================
select count(*) as obsolete_10_param_overload_count
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'admin_update_platform_settings'
  and pg_get_function_identity_arguments(p.oid) = 'uuid, smallint, smallint, smallint, smallint, smallint, time without time zone, time without time zone, text, text';
-- Must be 0.


-- ============================================================================
-- SECTION 7 — EXECUTE PRIVILEGES: least-privilege spot check
-- ============================================================================
select
  p.proname,
  (
    select string_agg(r.rolname, ', ' order by r.rolname)
    from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    join pg_roles r on r.oid = a.grantee
    where a.privilege_type = 'EXECUTE'
  ) as execute_grantees
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'admin_update_platform_settings', 'admin_change_role_atomic', 'admin_set_active_atomic',
    'admin_override_attendance_atomic', 'complete_cycle_atomic',
    'cohort_available_seats', 'public_cohorts_catalog'
  )
order by p.proname;
-- The first five should list only the table owner and service_role (never
-- anon/authenticated). cohort_available_seats and public_cohorts_catalog
-- should include anon and authenticated -- they are the intentionally-public
-- catalog/availability functions.


-- ============================================================================
-- SECTION 8 — REQUIRED INDEXES/CONSTRAINTS PRESENT
-- ============================================================================
select indexname, tablename
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'uq_paylink_one_pending_per_subscription',
    'idx_operational_exceptions_active_dedupe',
    'idx_support_cases_contact_request_unique',
    'idx_teachers_application_unique',
    'idx_readiness_overrides_active_unique'
  )
order by indexname;
-- Expect exactly 5 rows.


-- ============================================================================
-- SECTION 9 — ROW LEVEL SECURITY ENABLED ON EVERY NEW TABLE
-- ============================================================================
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in (
    'cycles', 'operational_exceptions', 'payment_refunds',
    'readiness_blocker_overrides', 'support_cases', 'webhook_events',
    'admin_platform_settings'
  )
order by relname;
-- Every row must show rls_enabled = true.


-- ============================================================================
-- SECTION 10 — EXISTING ADMIN ACCOUNTS SAFELY MIGRATED (no lockout)
-- ============================================================================
select
  count(*) as total_admins,
  count(*) filter (where role = 'super_admin') as super_admins,
  count(*) filter (where active = true) as active_admins,
  count(*) filter (where active is distinct from true) as inactive_or_null_admins
from admins;
-- inactive_or_null_admins should be 0 immediately after this migration --
-- every pre-existing admin row must have become active=true, role=super_admin
-- automatically (no admin locked out by this migration). A non-zero count
-- here after a fresh application is a STOP -- investigate before GATE 5.


-- ============================================================================
-- SECTION 11 — DATA ROW COUNTS ON CORE TABLES (for before/after comparison
-- against whatever was noted immediately before applying the migration)
-- ============================================================================
select 'parents' as table_name, count(*) as row_count from parents
union all select 'children', count(*) from children
union all select 'teachers', count(*) from teachers
union all select 'plans', count(*) from plans
union all select 'cohorts', count(*) from cohorts
union all select 'subscriptions', count(*) from subscriptions
union all select 'payments', count(*) from payments
union all select 'admins', count(*) from admins
union all select 'admin_actions', count(*) from admin_actions
order by table_name;
-- None of these numbers should be lower than they were immediately before
-- the migration ran. This migration never deletes rows from any table --
-- any decrease here means something else touched the database between the
-- "before" snapshot and this check, not this migration.
-- ============================================================================
-- End of verification. No further sections.
-- ============================================================================
