-- STRUCTURE ONLY: generated from production pg_catalog metadata, 2026-10-16.
-- ONLY run on isolated Supabase khota-staging (iteskfrpeeclzshauxog).
-- Never run on production. No business records, auth accounts or payment data copied.
BEGIN;
DO $reset_fixture$ DECLARE t record;
BEGIN
  FOR t IN SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' LOOP
    EXECUTE format('DROP TABLE public.%I CASCADE',t.name);
  END LOOP;
END $reset_fixture$;
DROP SCHEMA IF EXISTS khota_rls CASCADE;
CREATE TABLE public."admin_actions" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    admin_user_id uuid NOT NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    old_value jsonb,
    new_value jsonb,
    created_at timestamp with time zone DEFAULT now(),
    reason text
);

CREATE TABLE public."admin_platform_settings" (
    id boolean NOT NULL DEFAULT true,
    default_session_duration_minutes smallint NOT NULL DEFAULT 45,
    makeup_monthly_limit smallint NOT NULL DEFAULT 2,
    pause_min_days smallint NOT NULL DEFAULT 7,
    pause_max_days smallint NOT NULL DEFAULT 28,
    booking_window_days smallint NOT NULL DEFAULT 14,
    quiet_hours_start time without time zone NOT NULL DEFAULT '21:00:00'::time without time zone,
    quiet_hours_end time without time zone NOT NULL DEFAULT '08:00:00'::time without time zone,
    support_email text,
    support_phone text,
    registration_enabled boolean NOT NULL DEFAULT true,
    seat_hold_hours smallint NOT NULL DEFAULT 24,
    attendance_lock_hours smallint NOT NULL DEFAULT 24,
    default_capacity_1_3 smallint NOT NULL DEFAULT 3,
    default_capacity_4_6 smallint NOT NULL DEFAULT 4,
    default_capacity_7_9 smallint NOT NULL DEFAULT 5,
    default_capacity_10_12 smallint NOT NULL DEFAULT 5,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid
);

CREATE TABLE public."admins" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid,
    full_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    role text NOT NULL DEFAULT 'super_admin'::text,
    active boolean NOT NULL DEFAULT true,
    pending_email text
);

CREATE TABLE public."api_rate_limits" (
    key text NOT NULL,
    window_start timestamp with time zone NOT NULL,
    count integer NOT NULL DEFAULT 1,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public."assessments" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    child_id uuid NOT NULL,
    assessment_date date NOT NULL DEFAULT CURRENT_DATE,
    reading_level text,
    writing_spelling_level text,
    mathematics_level text,
    english_level text,
    focus_level text,
    independence_level text,
    teacher_notes text,
    assessment_type text NOT NULL,
    teacher_id uuid,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public."attendance" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL,
    child_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'present'::text,
    marked_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    reason text
);

CREATE TABLE public."bookings" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    audience text NOT NULL,
    need text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    notes text,
    booking_date date NOT NULL,
    booking_time text NOT NULL,
    status text NOT NULL DEFAULT 'new'::text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public."child_progress_snapshots" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    child_id uuid NOT NULL,
    snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
    reading_score smallint,
    writing_spelling_score smallint,
    mathematics_score smallint,
    english_score smallint,
    focus_score smallint,
    independence_score smallint,
    source text NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public."children" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    parent_id uuid NOT NULL,
    first_name text NOT NULL,
    birth_date date,
    grade smallint NOT NULL,
    school_name text,
    learning_notes text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public."cohorts" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    product text NOT NULL,
    plan_id text,
    title text NOT NULL,
    teacher_id uuid,
    grade_band text,
    capacity smallint NOT NULL,
    days_of_week smallint[] DEFAULT '{}'::smallint[],
    slot_code text,
    meeting_url text,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    start_date date,
    end_date date,
    status text DEFAULT 'draft'::text,
    grade smallint,
    cycle_id uuid
);

CREATE TABLE public."contact_requests" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    full_name text NOT NULL,
    email text NOT NULL,
    phone text,
    message text NOT NULL,
    status text NOT NULL DEFAULT 'new'::text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public."cycles" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    registration_start date,
    registration_end date,
    enabled_grade_bands text[],
    status text NOT NULL DEFAULT 'draft'::text,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid
);

CREATE TABLE public."daily_pulse_reports" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL,
    child_id uuid NOT NULL,
    teacher_id uuid,
    tasks_completed text[] DEFAULT '{}'::text[],
    independence_rating smallint,
    focus_rating smallint,
    tomorrow_readiness text,
    teacher_note text,
    needs_specialist boolean DEFAULT false,
    focus_subject text,
    created_at timestamp with time zone DEFAULT now(),
    materials_ready boolean,
    tomorrow_test_status text,
    remaining_review text,
    readiness_status text
);

CREATE TABLE public."daily_tasks" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    child_id uuid NOT NULL,
    session_id uuid,
    title text NOT NULL,
    subject text,
    status text NOT NULL DEFAULT 'pending'::text,
    due_date date,
    created_at timestamp with time zone DEFAULT now(),
    source_key text
);

CREATE TABLE public."independence_assessments" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    child_id uuid NOT NULL,
    assessment_date date NOT NULL DEFAULT CURRENT_DATE,
    task_management smallint NOT NULL,
    task_initiation smallint NOT NULL,
    help_seeking smallint NOT NULL,
    task_completion smallint NOT NULL,
    time_organization smallint NOT NULL,
    total_score numeric(6,2) NOT NULL,
    teacher_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public."learning_profiles" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    child_id uuid NOT NULL,
    strengths text,
    weak_subjects text[] DEFAULT '{}'::text[],
    parent_notes text,
    upcoming_tests text,
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public."level_test_answers" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL,
    question_id text NOT NULL,
    selected_index smallint NOT NULL,
    correct boolean NOT NULL,
    difficulty smallint NOT NULL,
    skill text NOT NULL,
    answered_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public."level_test_sessions" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    track_id text NOT NULL,
    current_question_id text NOT NULL,
    target_difficulty smallint NOT NULL DEFAULT 2,
    max_questions smallint NOT NULL,
    status text NOT NULL DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    finished_at timestamp with time zone
);

CREATE TABLE public."makeup_credits" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    child_id uuid NOT NULL,
    subscription_id uuid,
    source_session_id uuid,
    source_type text NOT NULL,
    reason text,
    status text NOT NULL DEFAULT 'available'::text,
    issued_by uuid,
    issued_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    redeemed_session_id uuid,
    redeemed_at timestamp with time zone
);

CREATE TABLE public."message_threads" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    child_id uuid NOT NULL,
    parent_user_id uuid NOT NULL,
    teacher_user_id uuid NOT NULL,
    cohort_id uuid,
    status text NOT NULL DEFAULT 'open'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public."messages" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    thread_id uuid NOT NULL,
    sender_user_id uuid NOT NULL,
    sender_role text NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    read_at timestamp with time zone
);

CREATE TABLE public."operational_exceptions" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    exception_type text NOT NULL,
    severity text NOT NULL,
    status text NOT NULL DEFAULT 'open'::text,
    title text NOT NULL,
    description text NOT NULL,
    parent_id uuid,
    child_id uuid,
    subscription_id uuid,
    payment_id uuid,
    refund_id uuid,
    cohort_id uuid,
    session_id uuid,
    assigned_to uuid,
    source_type text NOT NULL,
    source_id uuid NOT NULL,
    detected_at timestamp with time zone NOT NULL DEFAULT now(),
    last_detected_at timestamp with time zone NOT NULL DEFAULT now(),
    resolved_at timestamp with time zone,
    resolved_by uuid,
    resolution_note text,
    metadata jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    previous_exception_id uuid,
    recurrence_group_key uuid
);

CREATE TABLE public."parents" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid,
    full_name text NOT NULL,
    phone text NOT NULL,
    email text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public."payment_refunds" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    payment_id uuid NOT NULL,
    amount_sar numeric(10,2) NOT NULL,
    refund_type text NOT NULL,
    reason text NOT NULL,
    requires_entitlement_review boolean NOT NULL DEFAULT false,
    provider_reference text,
    provider_status text,
    status text NOT NULL DEFAULT 'requested'::text,
    requested_by uuid NOT NULL,
    requested_at timestamp with time zone NOT NULL DEFAULT now(),
    processed_by uuid,
    processed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public."payments" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    subscription_id uuid NOT NULL,
    parent_id uuid NOT NULL,
    amount_sar numeric(10,2) NOT NULL,
    status text NOT NULL DEFAULT 'pending'::text,
    provider text,
    provider_ref text,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public."plans" (
    id text NOT NULL,
    product text NOT NULL,
    name text NOT NULL,
    sessions_per_month smallint,
    days_per_week smallint,
    day_patterns text[] DEFAULT '{}'::text[],
    price_sar numeric(10,2),
    active boolean DEFAULT true
);

CREATE TABLE public."platform_settings" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    key text NOT NULL,
    value jsonb NOT NULL,
    description text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public."premium_requests" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    product text NOT NULL,
    full_name text,
    phone text NOT NULL,
    goal text,
    preferred_schedule text,
    status text DEFAULT 'new'::text,
    created_at timestamp with time zone DEFAULT now(),
    source_recommendation_id uuid
);

CREATE TABLE public."readiness_blocker_overrides" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    blocker_key text NOT NULL,
    reason text NOT NULL,
    overridden_by uuid NOT NULL,
    overridden_at timestamp with time zone NOT NULL DEFAULT now(),
    active boolean NOT NULL DEFAULT true
);

CREATE TABLE public."recommendations" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    child_id uuid NOT NULL,
    teacher_id uuid,
    subject text,
    reason text NOT NULL,
    status text DEFAULT 'open'::text,
    created_at timestamp with time zone DEFAULT now(),
    source_session_id uuid
);

CREATE TABLE public."sessions" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    cohort_id uuid NOT NULL,
    teacher_id uuid,
    session_date date NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    meeting_url text,
    status text DEFAULT 'scheduled'::text,
    cancelled_by text,
    makeup_eligible boolean NOT NULL DEFAULT false
);

CREATE TABLE public."student_mode_sessions" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    parent_user_id uuid NOT NULL,
    child_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    active boolean NOT NULL DEFAULT true
);

CREATE TABLE public."subscription_pauses" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    subscription_id uuid NOT NULL,
    requested_by uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason text,
    status text NOT NULL DEFAULT 'requested'::text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public."subscriptions" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    child_id uuid,
    parent_id uuid NOT NULL,
    plan_id text NOT NULL,
    cohort_id uuid,
    status text DEFAULT 'pending_payment'::text,
    start_date date,
    renewal_date date,
    created_at timestamp with time zone DEFAULT now(),
    hold_expires_at timestamp with time zone,
    plan_snapshot_name text,
    plan_snapshot_price_sar numeric(10,2),
    plan_snapshot_sessions_per_month smallint,
    plan_snapshot_days_per_week smallint,
    plan_snapshot_captured_at timestamp with time zone
);

CREATE TABLE public."support_cases" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    parent_id uuid,
    child_id uuid,
    subscription_id uuid,
    contact_request_id uuid,
    category text NOT NULL,
    priority text NOT NULL DEFAULT 'normal'::text,
    status text NOT NULL DEFAULT 'new'::text,
    subject text NOT NULL,
    description text NOT NULL,
    assigned_to uuid,
    resolution_note text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    resolved_at timestamp with time zone,
    resolved_by uuid
);

CREATE TABLE public."teacher_applications" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    full_name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    specialization text NOT NULL,
    years_experience smallint,
    cv_url text,
    status text NOT NULL DEFAULT 'new'::text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public."teacher_availability" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    teacher_id uuid NOT NULL,
    day_of_week smallint NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    active boolean DEFAULT true
);

CREATE TABLE public."teachers" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid,
    full_name text NOT NULL,
    active boolean DEFAULT true,
    application_id uuid,
    activated_by uuid,
    activated_at timestamp with time zone
);

CREATE TABLE public."webhook_events" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    provider text NOT NULL DEFAULT 'paylink'::text,
    event_type text NOT NULL,
    payment_reference text,
    received_at timestamp with time zone NOT NULL DEFAULT now(),
    processed_at timestamp with time zone,
    success boolean,
    error_code text,
    error_message text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public."weekly_goals" (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    child_id uuid NOT NULL,
    week_start date NOT NULL,
    title text NOT NULL,
    description text,
    category text,
    status text NOT NULL DEFAULT 'active'::text,
    progress smallint DEFAULT 0,
    created_by_teacher_id uuid,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
COMMIT;
