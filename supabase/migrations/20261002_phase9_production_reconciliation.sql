-- =====================================================================================
-- 20261002_phase9_production_reconciliation.sql
-- KHOTA — Phase 9 / Step 9.2A — Production Reconciliation Migration
-- =====================================================================================
--
-- PURPOSE
-- This is the single additive migration that brings the real, evidence-confirmed
-- Production database (as read-only-diagnosed on 20 Sep 2026, see the evidence summary
-- below) up to the final Admin OS schema this application expects. It is NOT a replay of
-- supabase/migrations/*.sql: those files contain now-superseded intermediate versions of
-- several functions (each later redefined by a subsequent file), and one of them
-- (20260917_platform_settings.sql, extended by 20260920_settings_foundation_extension.sql)
-- assumes a platform_settings table shape that directly conflicts with the real Production
-- table. This migration reconciles all of that into one final, reviewable, idempotent
-- statement set. It does not execute anything -- applying it is a separate, later step,
-- never performed by this pass.
--
-- ACTUAL PRODUCTION EVIDENCE THIS MIGRATION IS BUILT AGAINST (20 Sep 2026, read-only):
--   * platform_settings EXISTS but with an OLD key/value schema (id uuid, key text,
--     value jsonb, description text, created_at, updated_at) -- NOT the typed singleton
--     row (id boolean, pause_max_days smallint, ...) that every Admin OS migration and
--     this application's code assumes. See SECTION 0 for how this is reconciled.
--   * MISSING tables: cycles, operational_exceptions, payment_refunds,
--     readiness_blocker_overrides, support_cases, webhook_events.
--   * MISSING columns: admins.active, admins.role, cohorts.cycle_id,
--     subscriptions.hold_expires_at, subscriptions.plan_snapshot_name,
--     subscriptions.plan_snapshot_price_sar, teachers.application_id.
--   * CONFIRMED PRESENT: admin_actions.reason.
--   * NOT checked by the diagnostic (treated conservatively as unknown, handled with
--     `if not exists`/`add column if not exists` throughout so either state is safe):
--     teacher_applications, contact_requests, cohorts.grade, makeup_credits,
--     subscription_pauses, uq_paylink_one_pending_per_subscription, and every RPC
--     signature not explicitly named above.
--
-- A FINDING FROM BUILDING THIS MIGRATION, BEYOND WHAT THE EVIDENCE ABOVE FLAGGED:
-- supabase/schema.sql (the cumulative, hand-consolidated reference file) folds several
-- Admin-OS columns directly into their table's base `create table if not exists`
-- statement, instead of keeping them as a separate `alter table ... add column`, e.g.
-- admins.role, cohorts.cycle_id, cohorts.grade, and subscriptions.hold_expires_at.
-- Because the underlying tables (admins/cohorts/subscriptions) ALREADY EXIST in
-- Production, `create table if not exists` against them is a silent no-op -- so naively
-- replaying schema.sql's base table statements would NEVER add these columns, exactly
-- the same trap the platform_settings evidence warned about, just undocumented for these
-- four. This was found by systematically diffing every `add column if not exists`
-- statement across supabase/migrations/*.sql against supabase/schema.sql and confirming
-- which ones survive there as their own standalone statement versus which were folded
-- into a base table definition. SECTION 3 below adds each of these back explicitly.
--
-- WHAT THIS MIGRATION DELIBERATELY DOES NOT DO:
--   * Does not touch, rename, or read data from the existing key/value platform_settings
--     table in any way. It is left 100% untouched -- schema, rows, name, everything.
--   * Does not replay every historical migration file verbatim -- functions that were
--     redefined multiple times across the tracked migration set are installed here only
--     in their final approved form (the same form supabase/schema.sql converges to),
--     never as intermediate versions immediately overwritten later in this same file.
--   * Does not invent a default Cycle or backfill cohorts.cycle_id -- legacy cohorts stay
--     cycle_id = NULL, surfaced in the UI as "بيانات سابقة / غير مصنَّفة" (unchanged,
--     pre-existing behavior in this codebase).
--   * Does not touch admin_actions (already correct in Production per evidence) beyond a
--     no-op-safe `create table if not exists` / `add column if not exists`.
--   * Does not drop or alter the type of any existing column.
--
-- SETTINGS ARCHITECTURE DECISION (full reasoning in KHOTA_PHASE9_PRODUCTION_DELTA_REPORT.md):
-- Production's platform_settings is a real key/value table whose actual key names and
-- value shapes are unknown to this pass (no evidence was gathered on its row contents).
-- Guessing key names to build a pivot view risks either finding nothing (functionally
-- identical to just using defaults) or, worse, colliding with an existing key that means
-- something unrelated to Admin OS. The safer, equally-compliant reading of "keep key/value
-- storage and expose typed runtime settings through application helpers" is: leave the kv
-- table completely untouched and inert, and add a NEW, separate, additive singleton table
-- -- admin_platform_settings -- for the Admin OS typed settings this application actually
-- reads and writes. SECTION 0 below creates it, seeded with exactly the defaults this
-- instruction specifies. The application code (src/lib/platform-settings.ts and every
-- other direct query site) is updated in this same pass to point at the new table -- see
-- the code-changes list in KHOTA_PHASE9_PRODUCTION_DELTA_REPORT.md.
--
-- IDEMPOTENCY: every statement in this file uses `if not exists` / `add column if not
-- exists` / `create or replace function` / `drop ... if exists` before add, so running
-- this migration a second time against a database where it already succeeded is a safe
-- no-op throughout (verified locally -- see SECTION 7 of the offline pass's report).
--
-- THIS MIGRATION IS NOT EXECUTED BY THIS PASS. No SQL in this file has been run against
-- any real Supabase Production database. It has been tested only against a local,
-- approximate, non-Supabase PostgreSQL simulation (see
-- KHOTA_PHASE9_PRODUCTION_DELTA_REPORT.md section on local simulation results).
-- =====================================================================================

begin;

-- =====================================================================================
-- SECTION 0 — Settings reconciliation
-- Leaves the existing key/value `platform_settings` table completely untouched (schema,
-- rows, name). Creates a new, separate, additive typed singleton table for Admin OS
-- settings under a different name so the two can never collide.
-- =====================================================================================

create table if not exists admin_platform_settings(
  id boolean primary key default true check (id = true), -- singleton -- exactly one row
  default_session_duration_minutes smallint not null default 45,
  makeup_monthly_limit smallint not null default 2,
  pause_min_days smallint not null default 7,
  pause_max_days smallint not null default 28,
  booking_window_days smallint not null default 14,
  quiet_hours_start time not null default '21:00',
  quiet_hours_end time not null default '08:00',
  support_email text,
  support_phone text,
  registration_enabled boolean not null default true,
  seat_hold_hours smallint not null default 24 check (seat_hold_hours between 1 and 72),
  attendance_lock_hours smallint not null default 24 check (attendance_lock_hours between 1 and 168),
  default_capacity_1_3 smallint not null default 3 check (default_capacity_1_3 between 1 and 30),
  default_capacity_4_6 smallint not null default 4 check (default_capacity_4_6 between 1 and 30),
  default_capacity_7_9 smallint not null default 5 check (default_capacity_7_9 between 1 and 30),
  default_capacity_10_12 smallint not null default 5 check (default_capacity_10_12 between 1 and 30),
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id),
  check (pause_min_days >= 7 and pause_max_days <= 28 and pause_min_days <= pause_max_days)
);

-- Seeds exactly the defaults this instruction specifies. Safe to re-run: `on conflict do
-- nothing` means an admin's real customizations (made via admin_update_platform_settings
-- after first deploy) are never overwritten by a later re-run of this migration.
insert into admin_platform_settings (
  id, registration_enabled, seat_hold_hours, attendance_lock_hours,
  default_capacity_1_3, default_capacity_4_6, default_capacity_7_9, default_capacity_10_12,
  pause_min_days, pause_max_days, makeup_monthly_limit
) values (
  true, true, 24, 24, 3, 4, 5, 5, 7, 28, 2
) on conflict (id) do nothing;

alter table admin_platform_settings enable row level security;
-- No policy at all -- service_role only, same convention as every other Admin OS table.

-- Explicitly drop the obsolete 10-parameter overload some environments may have from an
-- earlier, partial application of 20260917_platform_settings.sql, so it can never
-- accidentally be called again (instruction section 5: "do not leave an obsolete
-- overload that could accidentally be called"). Safe no-op if it never existed.
drop function if exists public.admin_update_platform_settings(uuid, smallint, smallint, smallint, smallint, smallint, time, time, text, text);

-- Final approved settings-update RPC -- same validation logic as the historical
-- migrations, retargeted to admin_platform_settings.
create or replace function public.admin_update_platform_settings(
  p_admin_user_id uuid,
  p_default_session_duration_minutes smallint,
  p_makeup_monthly_limit smallint,
  p_pause_min_days smallint,
  p_pause_max_days smallint,
  p_booking_window_days smallint,
  p_quiet_hours_start time,
  p_quiet_hours_end time,
  p_support_email text,
  p_support_phone text,
  p_registration_enabled boolean,
  p_seat_hold_hours smallint,
  p_attendance_lock_hours smallint,
  p_default_capacity_1_3 smallint,
  p_default_capacity_4_6 smallint,
  p_default_capacity_7_9 smallint,
  p_default_capacity_10_12 smallint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_default_session_duration_minutes not between 15 and 180 then
    raise exception 'invalid_session_duration';
  end if;
  if p_makeup_monthly_limit not between 0 and 10 then
    raise exception 'invalid_makeup_limit';
  end if;
  if p_pause_min_days < 7 or p_pause_max_days > 28 or p_pause_max_days < p_pause_min_days then
    raise exception 'invalid_pause_range';
  end if;
  if p_booking_window_days not between 1 and 90 then
    raise exception 'invalid_booking_window';
  end if;
  if p_seat_hold_hours not between 1 and 72 then
    raise exception 'invalid_seat_hold_hours';
  end if;
  if p_attendance_lock_hours not between 1 and 168 then
    raise exception 'invalid_attendance_lock_hours';
  end if;
  if p_default_capacity_1_3 not between 1 and 30
    or p_default_capacity_4_6 not between 1 and 30
    or p_default_capacity_7_9 not between 1 and 30
    or p_default_capacity_10_12 not between 1 and 30 then
    raise exception 'invalid_default_capacity';
  end if;

  update admin_platform_settings set
    default_session_duration_minutes = p_default_session_duration_minutes,
    makeup_monthly_limit = p_makeup_monthly_limit,
    pause_min_days = p_pause_min_days,
    pause_max_days = p_pause_max_days,
    booking_window_days = p_booking_window_days,
    quiet_hours_start = p_quiet_hours_start,
    quiet_hours_end = p_quiet_hours_end,
    support_email = p_support_email,
    support_phone = p_support_phone,
    registration_enabled = p_registration_enabled,
    seat_hold_hours = p_seat_hold_hours,
    attendance_lock_hours = p_attendance_lock_hours,
    default_capacity_1_3 = p_default_capacity_1_3,
    default_capacity_4_6 = p_default_capacity_4_6,
    default_capacity_7_9 = p_default_capacity_7_9,
    default_capacity_10_12 = p_default_capacity_10_12,
    updated_at = now(),
    updated_by = p_admin_user_id
  where id = true;
end;
$$;
revoke all on function public.admin_update_platform_settings(uuid, smallint, smallint, smallint, smallint, smallint, time, time, text, text, boolean, smallint, smallint, smallint, smallint, smallint, smallint) from public, anon, authenticated;
grant execute on function public.admin_update_platform_settings(uuid, smallint, smallint, smallint, smallint, smallint, time, time, text, text, boolean, smallint, smallint, smallint, smallint, smallint, smallint) to service_role;

-- =====================================================================================
-- SECTION 1 — Payment integrity index (instruction section 6) + base Admin OS tables
-- that may already exist (admin_actions confirmed present; teacher_applications /
-- contact_requests status unconfirmed -- all three use `if not exists`, safe either way)
-- =====================================================================================

-- يمنع أكثر من محاولة دفع Paylink واحدة "pending" لنفس الاشتراك في وقت واحد — يغلق Race
-- Condition بين خطوتي "بحث عن pending" و"إنشاء pending" في /api/payments/paylink/create
-- (راجع migrations/20260916_paylink_pending_uniqueness.sql لتفاصيل السبب).
create unique index if not exists uq_paylink_one_pending_per_subscription
on public.payments (subscription_id)
where provider = 'paylink' and status = 'pending';

create table if not exists teacher_applications(
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text not null,
  specialization text not null,
  years_experience smallint,
  cv_url text,
  status text not null default 'new' check (status in ('new','reviewing','shortlisted','rejected','accepted')),
  created_at timestamptz default now()
);
alter table teacher_applications enable row level security;

-- رسائل نموذج التواصل العام (/contact) — RLS مفعَّلة بلا policy عامة، service_role فقط
-- (src/app/api/contact). Supabase هو مصدر الحقيقة لحفظ الرسالة؛ إشعار البريد الاختياري
-- (Resend، إن وُجد RESEND_API_KEY) لا يُفشِل الحفظ أبدًا إن فشل هو نفسه.
create table if not exists contact_requests(
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  message text not null,
  status text not null default 'new' check (status in ('new','reviewing','closed')),
  created_at timestamptz default now()
);
alter table contact_requests enable row level security;

-- سجل تدقيق خفيف لتغييرات الإدارة الحساسة (سعة المجموعة، حالة التسجيل، إسناد المعلم) —
-- RLS مفعَّلة بلا policy عامة، service_role فقط عبر src/app/api/admin/**.
create table if not exists admin_actions(
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  old_value jsonb,
  new_value jsonb,
  reason text, -- سبب اختياري للعمليات الحساسة (معلم بديل، منح/إلغاء تعويض يدوي...)
  created_at timestamptz default now()
);
alter table admin_actions enable row level security;

-- =====================================================================================
-- SECTION 2 — cycles (confirmed MISSING in Production)
-- =====================================================================================

-- Phase 1 — كيان Cycle مستقل، لا جدول آخر يشير إليه بعد. RLS بلا policy عامة، service_role فقط.
create table if not exists cycles(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  registration_start date,
  registration_end date,
  enabled_grade_bands text[],
  status text not null default 'draft' check (status in ('draft','registration_open','in_progress','completed','archived')),
  created_at timestamptz default now(),
  created_by uuid references auth.users(id),
  check (end_date >= start_date),
  check (registration_start is null or registration_end is null or registration_start <= registration_end),
  check (registration_end is null or registration_end <= end_date)
);
alter table cycles enable row level security;

-- =====================================================================================
-- SECTION 3 — Explicit column additions that supabase/schema.sql folds into base table
-- definitions (see header note above) and would therefore silently no-op if this
-- migration relied on the base `create table if not exists` statements instead. Written
-- out explicitly here, matching each column's original historical migration exactly.
-- =====================================================================================

-- From 20260919_admins_role_backfill.sql -- confirmed MISSING in Production.
alter table admins
  add column if not exists role text not null default 'super_admin'
  check (role in ('super_admin','operations_manager','finance_admin','admin_support'));

-- From 20260921_phase2_commercial_model.sql -- confirmed MISSING in Production. Requires
-- `cycles` to already exist (Section 2 above), which is why this section runs after it.
alter table cohorts add column if not exists cycle_id uuid references cycles(id);

-- From 20260918_grade_exact_and_action_reason.sql -- status not confirmed by the
-- diagnostic evidence; safe to add either way.
alter table cohorts add column if not exists grade smallint check (grade between 1 and 12);

-- From 20260922_phase3_registration_capacity.sql -- confirmed MISSING in Production.
alter table subscriptions add column if not exists hold_expires_at timestamptz;

-- =====================================================================================
-- SECTION 4 — Cohort seat/capacity RPCs (cohort_occupied_seats, cohort_available_seats,
-- public_cohorts_catalog, admin_update_cohort_operations_atomic). Final versions only,
-- as consolidated in supabase/schema.sql. No platform_settings reference in this block.
-- =====================================================================================

-- دالة مركزية واحدة لحساب "المقاعد المحتسَبة فعليًا" — active، أو pending_payment مع (الاشتراك
-- حديث خلال 24 ساعة، أو محاولة دفع Paylink pending حديثة خلال 24 ساعة حتى لو الاشتراك نفسه
-- أقدم). تستخدمها كل الدوال أدناه بدل تكرار هذا الشرط في أربعة أماكن منفصلة.
create or replace function public.cohort_occupied_seats(p_cohort_id uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::integer
  from subscriptions s
  where s.cohort_id = p_cohort_id
    and (
      s.status = 'active'
      or (
        s.status = 'pending_payment'
        and (
          -- Phase 3: سجلات جديدة — hold_expires_at محدَّد صراحة وقت الإنشاء
          (s.hold_expires_at is not null and s.hold_expires_at > now())
          or
          -- سجلات قديمة (قبل Phase 3): hold_expires_at فارغة — نفس المنطق القديم حرفيًا،
          -- لا "حجز دائم" بمجرد فراغ hold_expires_at.
          (
            s.hold_expires_at is null
            and (
              s.created_at >= now() - interval '24 hours'
              or exists (
                select 1 from payments p
                where p.subscription_id = s.id
                  and p.provider = 'paylink'
                  and p.status = 'pending'
                  and p.created_at >= now() - interval '24 hours'
              )
            )
          )
        )
      )
    );
$$;
revoke all on function public.cohort_occupied_seats(uuid) from public, anon, authenticated;
grant execute on function public.cohort_occupied_seats(uuid) to service_role;

-- دالة آمنة لحساب المقاعد المتاحة في مجموعة، دون كشف صفوف الاشتراكات نفسها
create or replace function public.cohort_available_seats(p_cohort_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select c.capacity - public.cohort_occupied_seats(c.id)
  from cohorts c
  where c.id = p_cohort_id;
$$;
grant execute on function public.cohort_available_seats(uuid) to anon, authenticated;

-- دالة كتالوج عامة آمنة: أعمدة غير حساسة فقط. meeting_url مستبعد عمدًا — لا يظهر إلا
-- للمستخدم المصرح له والمرتبط فعليًا بالاشتراك/الجلسة عبر cohorts_of_own_children/cohorts_of_own_teacher
-- أو sessions.meeting_url المحمية بنفس المنطق.
create or replace function public.public_cohorts_catalog(p_product text default null)
returns table(
  id uuid,
  product text,
  plan_id text,
  grade_band text,
  title text,
  days_of_week smallint[],
  start_time time,
  end_time time,
  capacity smallint,
  seats_available integer
)
language sql
security definer
set search_path = public
as $$
  select
    c.id, c.product, c.plan_id, c.grade_band, c.title, c.days_of_week, c.start_time, c.end_time, c.capacity,
    (c.capacity - public.cohort_occupied_seats(c.id))::integer as seats_available
  from cohorts c
  where c.status = 'open' and (p_product is null or c.product = p_product);
$$;
grant execute on function public.public_cohorts_catalog(text) to anon, authenticated;

-- RPC إداري ذرّي: يستبدل نمط "JS يحسب occupied ثم update منفصل" (نافذة سباق نظرية) بمعاملة
-- واحدة — SELECT...FOR UPDATE يقفل صف المجموعة، ثم يحسب المقاعد ويرفض/يحدِّث داخل نفس القفل.
-- service_role فقط. المعاملات *_provided تميّز "لم يُرسَل" عن "أُرسِل كـnull فعليًا" (إزالة
-- meeting_url/teacher_id عمدًا هو NULL صالح، مختلف عن "لا تغيّر هذا الحقل").
create or replace function public.admin_update_cohort_operations_atomic(
  p_cohort_id uuid,
  p_capacity smallint default null,
  p_status text default null,
  p_teacher_id uuid default null,
  p_teacher_id_provided boolean default false,
  p_meeting_url text default null,
  p_meeting_url_provided boolean default false
)
returns table(
  old_capacity smallint,
  new_capacity smallint,
  old_status text,
  new_status text,
  old_teacher_id uuid,
  new_teacher_id uuid,
  old_meeting_url text,
  new_meeting_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cohort record;
  v_occupied integer;
  v_final_capacity smallint;
  v_final_status text;
  v_final_teacher_id uuid;
  v_final_meeting_url text;
begin
  select * into v_cohort from cohorts where id = p_cohort_id for update;
  if v_cohort is null then
    raise exception 'cohort_not_found';
  end if;

  v_final_capacity := coalesce(p_capacity, v_cohort.capacity);
  v_final_status := coalesce(p_status, v_cohort.status);
  v_final_teacher_id := case when p_teacher_id_provided then p_teacher_id else v_cohort.teacher_id end;
  v_final_meeting_url := case when p_meeting_url_provided then p_meeting_url else v_cohort.meeting_url end;

  if p_status is not null and p_status not in ('open', 'closed') then
    raise exception 'invalid_status';
  end if;
  if p_capacity is not null and (p_capacity < 1 or p_capacity > 20) then
    raise exception 'invalid_capacity';
  end if;

  v_occupied := public.cohort_occupied_seats(p_cohort_id);
  if v_final_capacity < v_occupied then
    raise exception 'capacity_below_occupied';
  end if;

  update cohorts set
    capacity = v_final_capacity,
    status = v_final_status,
    teacher_id = v_final_teacher_id,
    meeting_url = v_final_meeting_url
  where id = p_cohort_id;

  return query select
    v_cohort.capacity, v_final_capacity,
    v_cohort.status, v_final_status,
    v_cohort.teacher_id, v_final_teacher_id,
    v_cohort.meeting_url, v_final_meeting_url;
end;
$$;
revoke all on function public.admin_update_cohort_operations_atomic(uuid, smallint, text, uuid, boolean, text, boolean) from public, anon, authenticated;
grant execute on function public.admin_update_cohort_operations_atomic(uuid, smallint, text, uuid, boolean, text, boolean) to service_role;

-- =====================================================================================
-- SECTION 5 — Subscription snapshot/hold columns, status lifecycle, and the final
-- enroll_subscription_atomic (patched to read seat_hold_hours from the new
-- admin_platform_settings table instead of the legacy platform_settings table -- see
-- SECTION 0 above for why).
-- =====================================================================================

-- Phase 2 — دورة حياة الاشتراك: إضافة 'completed' فقط، بلا مساس بالحالات الخمس الحالية.
alter table subscriptions drop constraint if exists subscriptions_status_check;
alter table subscriptions add constraint subscriptions_status_check
  check (status in ('pending_payment','active','paused','cancelled','expired','completed'));

-- Phase 2 — لقطة سعر/باقة مجمَّدة وقت الاشتراك (أعمدة typed، لا JSONB — راجع تبرير الاختيار
-- بملف الهجرة supabase/migrations/20260921_phase2_commercial_model.sql وبالتقرير النهائي).
-- كل الأعمدة nullable — الاشتراكات القديمة تبقى NULL بلا أي تخمين لسعر تاريخي غير موثّق.
alter table subscriptions add column if not exists plan_snapshot_name text;
alter table subscriptions add column if not exists plan_snapshot_price_sar numeric(10,2);
alter table subscriptions add column if not exists plan_snapshot_sessions_per_month smallint;
alter table subscriptions add column if not exists plan_snapshot_days_per_week smallint;
alter table subscriptions add column if not exists plan_snapshot_captured_at timestamptz;

-- Phase 2 — overload جديد لـenroll_subscription_atomic (4 معاملات إضافية للقطة) — التوقيع
-- الأصلي (4 معاملات) يبقى معرَّفًا أعلى هذا الملف بلا تغيير، overload إضافي لا استبدال.
create or replace function public.enroll_subscription_atomic(
  p_child_id uuid,
  p_parent_id uuid,
  p_plan_id text,
  p_cohort_id uuid,
  p_plan_snapshot_name text,
  p_plan_snapshot_price_sar numeric,
  p_plan_snapshot_sessions_per_month smallint,
  p_plan_snapshot_days_per_week smallint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cohort record;
  v_taken integer;
  v_subscription_id uuid;
  v_seat_hold_hours smallint;
  v_hold_expires_at timestamptz;
begin
  select * into v_cohort from cohorts where id = p_cohort_id for update;
  if v_cohort is null then
    raise exception 'cohort_not_found';
  end if;
  if v_cohort.status != 'open' then
    raise exception 'cohort_not_open';
  end if;

  v_taken := public.cohort_occupied_seats(p_cohort_id);

  if v_taken >= v_cohort.capacity then
    raise exception 'cohort_full';
  end if;

  -- Phase 3: hold_expires_at يُحسَب مرة واحدة هنا فقط، ضمن نفس المعاملة الذرّية — لا خطوة
  -- منفصلة، لا إعادة حساب لاحقة. افتراضي آمن 24 ساعة لو platform_settings غير متاحة بعد.
  select seat_hold_hours into v_seat_hold_hours from admin_platform_settings where id = true;
  v_hold_expires_at := now() + make_interval(hours => coalesce(v_seat_hold_hours, 24));

  insert into subscriptions (
    child_id, parent_id, plan_id, cohort_id, status,
    plan_snapshot_name, plan_snapshot_price_sar, plan_snapshot_sessions_per_month,
    plan_snapshot_days_per_week, plan_snapshot_captured_at, hold_expires_at
  )
  values (
    p_child_id, p_parent_id, p_plan_id, p_cohort_id, 'pending_payment',
    p_plan_snapshot_name, p_plan_snapshot_price_sar, p_plan_snapshot_sessions_per_month,
    p_plan_snapshot_days_per_week, now(), v_hold_expires_at
  )
  returning id into v_subscription_id;

  return v_subscription_id;
end;
$$;

-- =====================================================================================
-- SECTION 6 — activate_subscription_atomic, payment_refunds (confirmed MISSING) and its
-- refund RPCs.
-- =====================================================================================

-- Phase 3 Critical Fix — تفعيل ذرّي (راجع migrations/20260923_phase3_atomic_activation_and_hold_race_fix.sql
-- للتوثيق الكامل). يعيد استخدام cohort_occupied_seats() كمصدر الحقيقة الوحيد، لا صيغة بديلة.
create or replace function public.activate_subscription_atomic(
  p_subscription_id uuid,
  p_start_date date,
  p_renewal_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub record;
  v_cohort record;
  v_occupied integer;
  v_target_counted boolean;
  v_effective_occupied integer;
begin
  select * into v_sub from subscriptions where id = p_subscription_id for update;
  if v_sub is null then
    return jsonb_build_object('ok', false, 'error', 'subscription_not_found');
  end if;

  if v_sub.status = 'active' then
    return jsonb_build_object('ok', true, 'already_active', true);
  end if;

  if v_sub.status != 'pending_payment' then
    return jsonb_build_object('ok', false, 'error', 'invalid_status');
  end if;

  if v_sub.cohort_id is null then
    return jsonb_build_object('ok', false, 'error', 'no_cohort');
  end if;

  select * into v_cohort from cohorts where id = v_sub.cohort_id for update;
  if v_cohort is null then
    return jsonb_build_object('ok', false, 'error', 'cohort_not_found');
  end if;

  v_occupied := public.cohort_occupied_seats(v_sub.cohort_id);

  v_target_counted := (
    (v_sub.hold_expires_at is not null and v_sub.hold_expires_at > now())
    or (
      v_sub.hold_expires_at is null
      and (
        v_sub.created_at >= now() - interval '24 hours'
        or exists (
          select 1 from payments p
          where p.subscription_id = v_sub.id
            and p.provider = 'paylink'
            and p.status = 'pending'
            and p.created_at >= now() - interval '24 hours'
        )
      )
    )
  );

  v_effective_occupied := v_occupied + (case when v_target_counted then 0 else 1 end);

  if v_effective_occupied > v_cohort.capacity then
    return jsonb_build_object('ok', false, 'error', 'cohort_full');
  end if;

  update subscriptions
  set status = 'active', start_date = p_start_date, renewal_date = p_renewal_date
  where id = p_subscription_id;

  return jsonb_build_object('ok', true, 'already_active', false);
end;
$$;
revoke all on function public.activate_subscription_atomic(uuid, date, date) from public, anon, authenticated;
grant execute on function public.activate_subscription_atomic(uuid, date, date) to service_role;

-- Phase 4 — دفتر الاسترداد (append-oriented) + RPC إكمال ذرّي. راجع
-- migrations/20260924_phase4_refunds.sql للشرح الكامل لكل قرار.
create table if not exists payment_refunds(
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete cascade,
  amount_sar numeric(10,2) not null check (amount_sar > 0),
  refund_type text not null check (refund_type in ('full','partial')),
  reason text not null,
  requires_entitlement_review boolean not null default false,
  provider_reference text,
  provider_status text,
  status text not null default 'requested' check (status in ('requested','processing','completed','failed','cancelled')),
  requested_by uuid not null references auth.users(id),
  requested_at timestamptz not null default now(),
  processed_by uuid references auth.users(id),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table payment_refunds enable row level security;
create index if not exists idx_payment_refunds_payment_id on payment_refunds(payment_id);

-- Phase 4 Correction — انتقال ذرّي نهائي لإلغاء/تعليم فشل استرداد لم يُكمَل بعد. يحل محل
-- نمط SELECT-then-UPDATE غير المحمي بقفل — يمنع كتابة سجل تدقيق كاذب لا يطابق حقيقة قاعدة
-- البيانات عند سباق حقيقي مع إكمال متزامن. لا تأثير مالي هنا (لا لمس لـpayments).
create or replace function public.transition_payment_refund_nonfinancial_atomic(
  p_refund_id uuid,
  p_target_status text,
  p_processed_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refund record;
begin
  if p_target_status not in ('failed', 'cancelled') then
    return jsonb_build_object('ok', false, 'error', 'invalid_target_status');
  end if;

  select * into v_refund from payment_refunds where id = p_refund_id for update;
  if v_refund is null then
    return jsonb_build_object('ok', false, 'error', 'refund_not_found');
  end if;

  if v_refund.status = 'completed' then
    return jsonb_build_object('ok', false, 'error', 'already_completed', 'old_status', v_refund.status);
  end if;

  if v_refund.status = p_target_status then
    return jsonb_build_object('ok', true, 'transitioned', false, 'already_terminal', true, 'old_status', v_refund.status, 'new_status', v_refund.status);
  end if;

  if v_refund.status not in ('requested', 'processing') then
    return jsonb_build_object('ok', false, 'error', 'invalid_refund_status', 'old_status', v_refund.status);
  end if;

  update payment_refunds
  set status = p_target_status,
      processed_by = p_processed_by,
      processed_at = now(),
      updated_at = now()
  where id = p_refund_id;

  return jsonb_build_object('ok', true, 'transitioned', true, 'already_terminal', false, 'old_status', v_refund.status, 'new_status', p_target_status);
end;
$$;
revoke all on function public.transition_payment_refund_nonfinancial_atomic(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.transition_payment_refund_nonfinancial_atomic(uuid, text, uuid) to service_role;

create or replace function public.complete_payment_refund_atomic(
  p_refund_id uuid,
  p_processed_by uuid,
  p_provider_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refund record;
  v_payment record;
  v_prior_completed numeric;
  v_new_total numeric;
begin
  select * into v_refund from payment_refunds where id = p_refund_id for update;
  if v_refund is null then
    return jsonb_build_object('ok', false, 'error', 'refund_not_found');
  end if;

  if v_refund.status = 'completed' then
    return jsonb_build_object('ok', true, 'already_completed', true);
  end if;

  if v_refund.status not in ('requested', 'processing') then
    return jsonb_build_object('ok', false, 'error', 'invalid_refund_status');
  end if;

  if p_provider_reference is null or btrim(p_provider_reference) = '' then
    return jsonb_build_object('ok', false, 'error', 'provider_reference_required');
  end if;

  select * into v_payment from payments where id = v_refund.payment_id for update;
  if v_payment is null then
    return jsonb_build_object('ok', false, 'error', 'payment_not_found');
  end if;

  if v_payment.status not in ('paid', 'partially_refunded') then
    return jsonb_build_object('ok', false, 'error', 'invalid_payment_status');
  end if;

  select coalesce(sum(amount_sar), 0) into v_prior_completed
  from payment_refunds
  where payment_id = v_payment.id and status = 'completed' and id != p_refund_id;

  if v_prior_completed + v_refund.amount_sar > v_payment.amount_sar then
    return jsonb_build_object('ok', false, 'error', 'exceeds_payment_amount');
  end if;

  update payment_refunds
  set status = 'completed',
      processed_by = p_processed_by,
      processed_at = now(),
      provider_reference = p_provider_reference,
      updated_at = now()
  where id = p_refund_id;

  v_new_total := v_prior_completed + v_refund.amount_sar;

  update payments
  set status = case
    when v_new_total >= v_payment.amount_sar then 'refunded'
    when v_new_total > 0 then 'partially_refunded'
    else v_payment.status
  end
  where id = v_payment.id;

  return jsonb_build_object('ok', true, 'already_completed', false, 'total_refunded', v_new_total);
end;
$$;
revoke all on function public.complete_payment_refund_atomic(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.complete_payment_refund_atomic(uuid, uuid, text) to service_role;

-- =====================================================================================
-- SECTION 7 — operational_exceptions, support_cases (both confirmed MISSING), their
-- transition/convert RPCs, and sync_operational_exceptions in its FINAL form only (the
-- tracked migration set defines an earlier version first and a final version later in
-- the same historical sequence -- only the final version is installed here, per
-- instruction section 3: "do not create obsolete intermediate states only to replace
-- them later in the same migration").
-- =====================================================================================

-- Phase 5 — Operations, Exceptions & Support. إضافي بالكامل. الاستثناءات وحالات الدعم ليست
-- مصدر حقيقة بديلاً — تُشير فقط لعمل تشغيلي حول truth موجود أصلًا (payments/subscriptions/
-- cohorts/sessions/refunds تبقى كما هي بلا أي تعديل تلقائي من أي دالة هنا).

-- (1) الاستثناءات التشغيلية
create table if not exists operational_exceptions(
  id uuid primary key default gen_random_uuid(),
  exception_type text not null check (exception_type in (
    'paid_not_active', 'stale_pending_payment', 'active_subscription_no_cohort',
    'open_cohort_no_teacher', 'upcoming_session_no_meeting_url',
    'completed_session_missing_attendance', 'refund_requires_entitlement_review',
    'late_paid_capacity_conflict', 'critical_customer_data_missing', 'pause_crosses_cycle_boundary'
  )),
  severity text not null check (severity in ('warning', 'critical')),
  status text not null default 'open' check (status in ('open', 'in_review', 'resolved')),
  title text not null,
  description text not null,
  parent_id uuid references parents(id),
  child_id uuid references children(id),
  subscription_id uuid references subscriptions(id),
  payment_id uuid references payments(id),
  refund_id uuid references payment_refunds(id),
  cohort_id uuid references cohorts(id),
  session_id uuid references sessions(id),
  assigned_to uuid references admins(id), -- هوية إدارية فعلية فقط، لا مستخدم auth عشوائي
  source_type text not null, -- اسم الجدول المصدر الأساسي لهذا الاستثناء (لمفتاح إزالة التكرار)
  source_id uuid not null,   -- معرّف الصف المصدر (لمفتاح إزالة التكرار)
  detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references admins(id),
  resolution_note text,
  metadata jsonb, -- سياق غير موثوق للعرض فقط (لا يُستخدَم أبدًا كمصدر قرار)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table operational_exceptions enable row level security;
-- بلا أي policy إطلاقًا — service_role فقط.

-- إزالة تكرار حتمية على مستوى القاعدة: لا يمكن وجود أكثر من استثناء "نشط" واحد (open أو
-- in_review) لنفس (exception_type, source_type, source_id) — فهرس فريد جزئي، لا يشمل
-- resolved، فيسمح بإنشاء "occurrence" جديد لاحقًا إن تكرَّرت نفس الحالة بعد حل حقيقي سابق،
-- مع الحفاظ على السجل التاريخي المُحلول كما هو تمامًا (لا حذف، لا إعادة كتابة).
create unique index if not exists idx_operational_exceptions_active_dedupe
  on operational_exceptions (exception_type, source_type, source_id)
  where status in ('open', 'in_review');

create index if not exists idx_operational_exceptions_status on operational_exceptions(status);
create index if not exists idx_operational_exceptions_assigned on operational_exceptions(assigned_to);

-- (2) حالات الدعم
create table if not exists support_cases(
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references parents(id),
  child_id uuid references children(id),
  subscription_id uuid references subscriptions(id),
  contact_request_id uuid references contact_requests(id),
  category text not null,
  priority text not null default 'normal' check (priority in ('normal', 'high')),
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved')),
  subject text not null,
  description text not null,
  assigned_to uuid references admins(id),
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references admins(id)
);
alter table support_cases enable row level security;

-- رسالة تواصل واحدة → حالة دعم واحدة كحد أقصى — يمنع تحويلًا مزدوجًا مصادفةً على مستوى القاعدة
-- نفسها (لا يعتمد فقط على تحقق طبقة التطبيق). NULL (حالة أُنشئت مباشرة بلا رسالة أصل) غير
-- مقيَّد بهذا الفهرس (فريد جزئي، يستثني NULL تلقائيًا في Postgres).
create unique index if not exists idx_support_cases_contact_request_unique
  on support_cases(contact_request_id) where contact_request_id is not null;

create index if not exists idx_support_cases_status on support_cases(status);

-- (3) انتقال ذرّي موحَّد للاستثناءات (تعيين مسؤول / تغيير حالة / حل) — نفس درس Phase 4:
-- التدقيق يجب أن يصف ما التزم فعليًا بقاعدة البيانات، لا افتراضًا متفائلًا على حالة قديمة.
create or replace function public.transition_operational_exception_atomic(
  p_exception_id uuid,
  p_action text, -- 'assign' | 'status' | 'resolve'
  p_actor uuid,
  p_assigned_to uuid default null,
  p_new_status text default null,
  p_resolution_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exc record;
  v_old_status text;
  v_old_assigned uuid;
begin
  select * into v_exc from operational_exceptions where id = p_exception_id for update;
  if v_exc is null then
    return jsonb_build_object('ok', false, 'error', 'exception_not_found');
  end if;

  v_old_status := v_exc.status;
  v_old_assigned := v_exc.assigned_to;

  if p_action = 'assign' then
    update operational_exceptions set assigned_to = p_assigned_to, updated_at = now() where id = p_exception_id;
    return jsonb_build_object('ok', true, 'changed', v_old_assigned is distinct from p_assigned_to, 'old_assigned_to', v_old_assigned, 'new_assigned_to', p_assigned_to);
  end if;

  if p_action = 'status' then
    if p_new_status not in ('open', 'in_review') then
      return jsonb_build_object('ok', false, 'error', 'invalid_target_status');
    end if;
    if v_exc.status = 'resolved' then
      return jsonb_build_object('ok', false, 'error', 'already_resolved');
    end if;
    if v_exc.status = p_new_status then
      return jsonb_build_object('ok', true, 'changed', false, 'old_status', v_old_status, 'new_status', p_new_status);
    end if;
    update operational_exceptions set status = p_new_status, updated_at = now() where id = p_exception_id;
    return jsonb_build_object('ok', true, 'changed', true, 'old_status', v_old_status, 'new_status', p_new_status);
  end if;

  if p_action = 'resolve' then
    if v_exc.status = 'resolved' then
      return jsonb_build_object('ok', true, 'changed', false, 'old_status', v_old_status, 'new_status', 'resolved');
    end if;
    if p_resolution_note is null or btrim(p_resolution_note) = '' then
      return jsonb_build_object('ok', false, 'error', 'resolution_note_required');
    end if;
    update operational_exceptions
    set status = 'resolved', resolved_at = now(), resolved_by = p_actor, resolution_note = p_resolution_note, updated_at = now()
    where id = p_exception_id;
    return jsonb_build_object('ok', true, 'changed', true, 'old_status', v_old_status, 'new_status', 'resolved');
  end if;

  return jsonb_build_object('ok', false, 'error', 'invalid_action');
end;
$$;
revoke all on function public.transition_operational_exception_atomic(uuid, text, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.transition_operational_exception_atomic(uuid, text, uuid, uuid, text, text) to service_role;

-- (4) نفس النمط الذرّي لحالات الدعم
create or replace function public.transition_support_case_atomic(
  p_case_id uuid,
  p_action text, -- 'assign' | 'status' | 'resolve'
  p_actor uuid,
  p_assigned_to uuid default null,
  p_new_status text default null,
  p_resolution_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case record;
  v_old_status text;
  v_old_assigned uuid;
begin
  select * into v_case from support_cases where id = p_case_id for update;
  if v_case is null then
    return jsonb_build_object('ok', false, 'error', 'case_not_found');
  end if;

  v_old_status := v_case.status;
  v_old_assigned := v_case.assigned_to;

  if p_action = 'assign' then
    update support_cases set assigned_to = p_assigned_to, updated_at = now() where id = p_case_id;
    return jsonb_build_object('ok', true, 'changed', v_old_assigned is distinct from p_assigned_to, 'old_assigned_to', v_old_assigned, 'new_assigned_to', p_assigned_to);
  end if;

  if p_action = 'status' then
    if p_new_status not in ('new', 'in_progress') then
      return jsonb_build_object('ok', false, 'error', 'invalid_target_status');
    end if;
    if v_case.status = 'resolved' then
      return jsonb_build_object('ok', false, 'error', 'already_resolved');
    end if;
    if v_case.status = p_new_status then
      return jsonb_build_object('ok', true, 'changed', false, 'old_status', v_old_status, 'new_status', p_new_status);
    end if;
    update support_cases set status = p_new_status, updated_at = now() where id = p_case_id;
    return jsonb_build_object('ok', true, 'changed', true, 'old_status', v_old_status, 'new_status', p_new_status);
  end if;

  if p_action = 'resolve' then
    if v_case.status = 'resolved' then
      return jsonb_build_object('ok', true, 'changed', false, 'old_status', v_old_status, 'new_status', 'resolved');
    end if;
    if p_resolution_note is null or btrim(p_resolution_note) = '' then
      return jsonb_build_object('ok', false, 'error', 'resolution_note_required');
    end if;
    update support_cases
    set status = 'resolved', resolved_at = now(), resolved_by = p_actor, resolution_note = p_resolution_note, updated_at = now()
    where id = p_case_id;
    return jsonb_build_object('ok', true, 'changed', true, 'old_status', v_old_status, 'new_status', 'resolved');
  end if;

  return jsonb_build_object('ok', false, 'error', 'invalid_action');
end;
$$;
revoke all on function public.transition_support_case_atomic(uuid, text, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.transition_support_case_atomic(uuid, text, uuid, uuid, text, text) to service_role;

-- (5) تحويل رسالة تواصل إلى حالة دعم — ذرّي، يعتمد على الفهرس الفريد أعلاه لمنع التكرار حتى
-- عند سباق حقيقي بين طلبَين متزامنَين لتحويل نفس الرسالة.
create or replace function public.convert_contact_request_to_support_case_atomic(
  p_contact_request_id uuid,
  p_category text,
  p_priority text,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact record;
  v_existing uuid;
  v_new_case_id uuid;
begin
  select * into v_contact from contact_requests where id = p_contact_request_id for update;
  if v_contact is null then
    return jsonb_build_object('ok', false, 'error', 'contact_request_not_found');
  end if;

  select id into v_existing from support_cases where contact_request_id = p_contact_request_id;
  if v_existing is not null then
    return jsonb_build_object('ok', true, 'already_converted', true, 'case_id', v_existing);
  end if;

  insert into support_cases (contact_request_id, category, priority, status, subject, description)
  values (p_contact_request_id, p_category, coalesce(p_priority, 'normal'), 'new', v_contact.full_name, v_contact.message)
  returning id into v_new_case_id;

  update contact_requests set status = 'reviewing' where id = p_contact_request_id;

  return jsonb_build_object('ok', true, 'already_converted', false, 'case_id', v_new_case_id);
end;
$$;
revoke all on function public.convert_contact_request_to_support_case_atomic(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.convert_contact_request_to_support_case_atomic(uuid, text, text, uuid) to service_role;
-- Phase 5 — دالة الفحص الحتمية الوحيدة. تُستدعى عند فتح/تحديث صفحة الاستثناءات ("تحديث
-- الفحص") — لا Cron مطلوب لصحتها بهذه المرحلة. Idempotent بالكامل: تُحدِّث last_detected_at
-- لأي استثناء "نشط" (open/in_review) لا يزال شرطه قائمًا، وتُدرِج صفًا جديدًا فقط حين لا يوجد
-- استثناء نشط لنفس (exception_type, source_type, source_id) — الفهرس الفريد الجزئي (migration
-- سابقة) هو الحارس الفعلي، لا هذه الدالة وحدها.
--
-- قرار تصميم موثَّق صراحة: استثناء "resolved" لا يُعاد فتحه تلقائيًا هنا أبدًا — لو الشرط
-- الأساسي لا يزال قائمًا بعد حل بشري، ستظهر مناسبة (occurrence) جديدة منفصلة عند التشغيل
-- التالي (بدل تجاهلها بصمت) — هذا مقصود: نتجنب "لوحة خضراء وهمية" (كما يحذّر البند 12) على
-- حساب تحمُّل احتمال ظهور مناسبة جديدة لمشكلة لم تُحَل فعليًا بعد رغم "الحل" السابق. السجل
-- التاريخي المُحلول نفسه لا يُمَس أو يُحذَف أبدًا.
--
-- صفر تعديل على أي جدول عمل رسمي (payments/subscriptions/cohorts/sessions/refunds) — الدالة
-- تقرأ منها فقط، وتكتب حصرًا إلى operational_exceptions.


-- =====================================================================================
-- SECTION 8 — Final sync_operational_exceptions, teacher activation lifecycle, cohort
-- transfer, subscription pause RPCs, makeup credit RPCs, readiness_blocker_overrides and
-- webhook_events tables (both confirmed MISSING), Cycle completion, and readiness
-- blocker override. Verbatim final-state content from supabase/schema.sql -- this range
-- contains no duplicate/superseded function definitions.
-- =====================================================================================


-- ===================================================================================
-- Phase 5 Part A refinement + Phase 6 operations — راجع migrations/20260927_phase5_part_a_refinement_and_phase6_operations.sql
-- للتعليقات التفصيلية الكاملة. مُلحَق هنا حرفيًا (create or replace يستبدل نسخة
-- sync_operational_exceptions الأقدم أعلاه بهذا الملف تلقائيًا عند تنفيذه بالتسلسل على تثبيت جديد).
-- ===================================================================================

-- Phase 5 Part A (تصحيح نهائي، ليس إعادة تصميم) + Phase 6 (إجراءات تشغيلية + Family 360).
-- إضافي بالكامل — لا حذف، لا إعادة تسمية، لا تعديل على أي عمود/جدول قائم بخلاف إضافة أعمدة
-- جديدة nullable أو بقيم افتراضية آمنة. صفر Backfill سلوكي يُغيِّر بيانات تاريخية موجودة.

-- ===================================================================================
-- PART A2 — ربط تكرار الاستثناءات (previous_exception_id / recurrence_group_key)
-- ===================================================================================
-- الهدف: يستطيع Family 360/تقارير لاحقة أن تُظهر "هذه الحالة حدثت من قبل" بدل مجرد صف معزول،
-- بلا أي مساس بالقاعدة الموثَّقة صراحة أن استثناء "resolved" لا يُعاد فتحه تلقائيًا أبدًا —
-- التاريخ المُحلول (status/resolved_at/resolved_by/resolution_note) يبقى كما هو تمامًا.
alter table operational_exceptions add column if not exists previous_exception_id uuid references operational_exceptions(id);
alter table operational_exceptions add column if not exists recurrence_group_key uuid;
create index if not exists idx_operational_exceptions_recurrence_group
  on operational_exceptions(recurrence_group_key) where recurrence_group_key is not null;

-- إعادة تعريف دالة الفحص الحتمية: نفس الفحوصات A-J حرفيًا بلا أي تغيير سلوكي عليها + خطوة
-- (K) جديدة تربط أي استثناء نشط (open/in_review) لا يزال بلا previous_exception_id بأحدث
-- استثناء "resolved" سابق لنفس (exception_type, source_type, source_id) إن وُجد. تعمل بأثر
-- رجعي آمن على صفوف موجودة أيضًا (idempotent: صف مربوط أصلًا لا يتغيّر — الشرط
-- previous_exception_id is null يستثنيه).
create or replace function public.sync_operational_exceptions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin

  -- (A) paid_not_active
  insert into operational_exceptions (
    exception_type, severity, title, description, parent_id, child_id, subscription_id,
    payment_id, cohort_id, source_type, source_id
  )
  select
    'paid_not_active', 'critical',
    'دفعة مدفوعة لكن الاشتراك غير نشط',
    'دفعة رقم ' || pay.id || ' بحالة "' || pay.status || '" لكن الاشتراك المرتبط بحالة "' || s.status || '" — يحتاج مراجعة تفعيل.',
    pay.parent_id, s.child_id, s.id, pay.id, s.cohort_id, 'payments', pay.id
  from payments pay
  join subscriptions s on s.id = pay.subscription_id
  where pay.status in ('paid', 'partially_refunded')
    and s.status not in ('active', 'completed')
  on conflict (exception_type, source_type, source_id) where status in ('open', 'in_review')
  do update set last_detected_at = now();

  -- (B) late_paid_capacity_conflict
  insert into operational_exceptions (
    exception_type, severity, title, description, parent_id, child_id, subscription_id,
    payment_id, cohort_id, source_type, source_id
  )
  select
    'late_paid_capacity_conflict', 'critical',
    'دفعة مدفوعة تأخَّرت وامتلأت المجموعة',
    'الاشتراك دُفِع فعليًا (دفعة ' || pay.id || ') لكن انتهى حجز المقعد وامتلأت المجموعة قبل التفعيل — يحتاج قرار مالي/تشغيلي يدوي، لا يُفعَّل تلقائيًا.',
    pay.parent_id, s.child_id, s.id, pay.id, s.cohort_id, 'subscriptions', s.id
  from subscriptions s
  join payments pay on pay.subscription_id = s.id and pay.status = 'paid'
  where s.status = 'pending_payment'
    and s.hold_expires_at is not null
    and s.hold_expires_at <= now()
  on conflict (exception_type, source_type, source_id) where status in ('open', 'in_review')
  do update set last_detected_at = now();

  -- (C) stale_pending_payment
  insert into operational_exceptions (
    exception_type, severity, title, description, parent_id, child_id, subscription_id, cohort_id,
    source_type, source_id
  )
  select
    'stale_pending_payment', 'warning',
    'محاولة تسجيل منتهية بلا دفع',
    'اشتراك pending_payment انتهى حجزه بلا أي دفعة مكتملة — مرشَّح لتعليمه منتهيًا إن لم يكن كذلك بالفعل.',
    s.parent_id, s.child_id, s.id, s.cohort_id, 'subscriptions', s.id
  from subscriptions s
  where s.status = 'pending_payment'
    and (
      (s.hold_expires_at is not null and s.hold_expires_at <= now())
      or (s.hold_expires_at is null and s.created_at < now() - interval '24 hours')
    )
    and not exists (select 1 from payments p where p.subscription_id = s.id and p.status = 'paid')
  on conflict (exception_type, source_type, source_id) where status in ('open', 'in_review')
  do update set last_detected_at = now();

  -- (D) active_subscription_no_cohort
  insert into operational_exceptions (
    exception_type, severity, title, description, parent_id, child_id, subscription_id,
    source_type, source_id
  )
  select
    'active_subscription_no_cohort', 'critical',
    'اشتراك نشط بلا مجموعة',
    'اشتراك نشط لكن بلا مجموعة مرتبطة — لا يمكن جدولة جلسات له بهذه الحالة.',
    s.parent_id, s.child_id, s.id, 'subscriptions', s.id
  from subscriptions s
  where s.status = 'active' and s.cohort_id is null
  on conflict (exception_type, source_type, source_id) where status in ('open', 'in_review')
  do update set last_detected_at = now();

  -- (E) open_cohort_no_teacher
  insert into operational_exceptions (
    exception_type, severity, title, description, cohort_id, source_type, source_id
  )
  select
    'open_cohort_no_teacher', 'critical',
    'مجموعة مفتوحة للتسجيل بلا معلم نشط',
    'المجموعة "' || c.title || '" حالتها مفتوحة للتسجيل لكن بلا معلم نشط مُسنَد.',
    c.id, 'cohorts', c.id
  from cohorts c
  where c.status = 'open'
    and (c.teacher_id is null or not exists (select 1 from teachers t where t.id = c.teacher_id and t.active = true))
  on conflict (exception_type, source_type, source_id) where status in ('open', 'in_review')
  do update set last_detected_at = now();

  -- (F) upcoming_session_no_meeting_url
  insert into operational_exceptions (
    exception_type, severity, title, description, cohort_id, session_id, source_type, source_id
  )
  select
    'upcoming_session_no_meeting_url', 'critical',
    'جلسة قريبة بلا رابط اجتماع',
    'جلسة مجدولة خلال 48 ساعة القادمة بلا meeting_url — الطلاب لن يستطيعوا الدخول.',
    s.cohort_id, s.id, 'sessions', s.id
  from sessions s
  where s.status = 'scheduled'
    and s.meeting_url is null
    and s.starts_at is not null
    and s.starts_at between now() and now() + interval '48 hours'
  on conflict (exception_type, source_type, source_id) where status in ('open', 'in_review')
  do update set last_detected_at = now();

  -- (G) completed_session_missing_attendance
  insert into operational_exceptions (
    exception_type, severity, title, description, cohort_id, session_id, source_type, source_id
  )
  select
    'completed_session_missing_attendance', 'warning',
    'جلسة مكتملة بلا حضور مسجَّل',
    'الجلسة اكتملت لكن لا يوجد أي سجل حضور مرتبط بها إطلاقًا.',
    s.cohort_id, s.id, 'sessions', s.id
  from sessions s
  where s.status = 'completed'
    and not exists (select 1 from attendance a where a.session_id = s.id)
  on conflict (exception_type, source_type, source_id) where status in ('open', 'in_review')
  do update set last_detected_at = now();

  -- (H) refund_requires_entitlement_review
  insert into operational_exceptions (
    exception_type, severity, title, description, payment_id, refund_id, source_type, source_id
  )
  select
    'refund_requires_entitlement_review', 'critical',
    'استرداد يحتاج مراجعة استحقاق تعليمي',
    'استرداد بمبلغ ' || r.amount_sar || ' ر.س يتطلب مراجعة Operations لتأثيره على الاستحقاق — لم يُغيَّر أي شيء تعليميًا تلقائيًا.',
    r.payment_id, r.id, 'payment_refunds', r.id
  from payment_refunds r
  where r.requires_entitlement_review = true
    and r.status in ('requested', 'processing', 'completed')
  on conflict (exception_type, source_type, source_id) where status in ('open', 'in_review')
  do update set last_detected_at = now();

  -- (I) critical_customer_data_missing
  insert into operational_exceptions (
    exception_type, severity, title, description, parent_id, source_type, source_id
  )
  select distinct
    'critical_customer_data_missing', 'critical',
    'ولي أمر بلا بريد إلكتروني لحساب نشط',
    'ولي الأمر بلا بريد إلكتروني مسجَّل — لا يمكنه تسجيل الدخول لمتابعة اشتراكه النشط.',
    p.id, 'parents', p.id
  from parents p
  join subscriptions s on s.parent_id = p.id and s.status = 'active'
  where p.email is null
  on conflict (exception_type, source_type, source_id) where status in ('open', 'in_review')
  do update set last_detected_at = now();

  -- (J) pause_crosses_cycle_boundary
  insert into operational_exceptions (
    exception_type, severity, title, description, subscription_id, cohort_id, source_type, source_id
  )
  select
    'pause_crosses_cycle_boundary', 'warning',
    'تجميد يتجاوز نهاية الدورة',
    'تجميد ينتهي بعد نهاية الدورة التشغيلية المرتبطة (' || cy.end_date || ') — يحتاج قرار Operations، لا تمديد تلقائي للدورة.',
    sp.subscription_id, c.id, 'subscription_pauses', sp.id
  from subscription_pauses sp
  join subscriptions s on s.id = sp.subscription_id
  join cohorts c on c.id = s.cohort_id
  join cycles cy on cy.id = c.cycle_id
  where sp.status in ('requested', 'approved', 'active')
    and c.cycle_id is not null
    and sp.end_date > cy.end_date
  on conflict (exception_type, source_type, source_id) where status in ('open', 'in_review')
  do update set last_detected_at = now();

  -- (K) Phase 5 Part A2 — ربط تكرار: أي استثناء نشط الآن بلا previous_exception_id، إن وُجدت
  -- له مناسبة "resolved" سابقة لنفس (exception_type, source_type, source_id)، يُربَط بأحدثها
  -- (الأحدث بـresolved_at). recurrence_group_key يرث مفتاح المناسبة السابقة إن كانت هي نفسها
  -- جزءًا من سلسلة أطول أصلًا (coalesce)، أو يبدأ سلسلة جديدة بمعرّف المناسبة السابقة نفسه.
  -- صفر مساس بأي عمود تاريخي على المناسبة "resolved" نفسها — تحديث واحد فقط على المناسبة
  -- النشطة الجديدة.
  update operational_exceptions ne
  set previous_exception_id = prev.id,
      recurrence_group_key = coalesce(prev.recurrence_group_key, prev.id)
  from lateral (
    select pe.id, pe.recurrence_group_key
    from operational_exceptions pe
    where pe.exception_type = ne.exception_type
      and pe.source_type = ne.source_type
      and pe.source_id = ne.source_id
      and pe.status = 'resolved'
      and pe.id <> ne.id
    order by pe.resolved_at desc nulls last
    limit 1
  ) prev
  where ne.status in ('open', 'in_review')
    and ne.previous_exception_id is null;

  return 1;
end;
$$;
revoke all on function public.sync_operational_exceptions() from public, anon, authenticated;
grant execute on function public.sync_operational_exceptions() to service_role;

-- ===================================================================================
-- PART B1 — تفعيل المعلم (Teacher Activation Lifecycle)
-- ===================================================================================
-- "طلب مقبول" (teacher_applications.status='accepted') لا يعني "معلم نشط" — لا نُنشئ صف
-- teachers تلقائيًا عند القبول (كان هذا سلوكًا ضمنيًا غير موجود أصلًا؛ نُضيفه الآن كخطوة
-- إدارية صريحة منفصلة). application_id يربط صف المعلم الناتج بطلبه الأصلي — بلا تعديل على
-- teacher_applications.status نفسه أو قيده (يبقى 'accepted' كما هو، التفعيل حالة مشتقة من
-- وجود/غياب صف teachers مرتبط، لا حالة جديدة على enum الطلب).
alter table teachers add column if not exists application_id uuid references teacher_applications(id);
alter table teachers add column if not exists activated_by uuid references auth.users(id);
alter table teachers add column if not exists activated_at timestamptz;
create unique index if not exists idx_teachers_application_unique
  on teachers(application_id) where application_id is not null;

create or replace function public.activate_teacher_from_application_atomic(
  p_application_id uuid,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app record;
  v_existing_teacher_id uuid;
  v_new_teacher_id uuid;
begin
  select * into v_app from teacher_applications where id = p_application_id for update;
  if v_app is null then
    return jsonb_build_object('ok', false, 'error', 'application_not_found');
  end if;
  if v_app.status <> 'accepted' then
    return jsonb_build_object('ok', false, 'error', 'application_not_accepted');
  end if;

  select id into v_existing_teacher_id from teachers where application_id = p_application_id;
  if v_existing_teacher_id is not null then
    -- Idempotent: تفعيل سابق فعلي لنفس الطلب — لا صف ثانٍ، لا خطأ صاخب لضغطة مزدوجة.
    return jsonb_build_object('ok', true, 'already_active', true, 'teacher_id', v_existing_teacher_id);
  end if;

  insert into teachers (full_name, active, application_id, activated_by, activated_at)
  values (v_app.full_name, true, p_application_id, p_actor, now())
  returning id into v_new_teacher_id;

  return jsonb_build_object('ok', true, 'already_active', false, 'teacher_id', v_new_teacher_id);
end;
$$;
revoke all on function public.activate_teacher_from_application_atomic(uuid, uuid) from public, anon, authenticated;
grant execute on function public.activate_teacher_from_application_atomic(uuid, uuid) to service_role;

-- ===================================================================================
-- PART B2 — نقل مجموعة ذرّي (Cohort Transfer)
-- ===================================================================================
-- نفس صف/مرحلة/دورة فقط، آمن السعة عبر cohort_occupied_seats() (مصدر الحقيقة الوحيد — لا
-- صيغة موازية)، لا Overbooking أبدًا. الجلسات والحضور التاريخية لا تُمَس إطلاقًا — مرتبطة
-- بـcohort_id الخاص بها وقت إنشائها (sessions.cohort_id)، والنقل هنا يُغيِّر
-- subscriptions.cohort_id فقط، فتبقى كل جلسة/حضور ماضٍ يشير إلى المجموعة القديمة كما حدث
-- فعليًا بالتاريخ الحقيقي. توليد الجلسات القادمة (خارج نطاق هذه الدالة) يتبع cohort_id
-- الجديد تلقائيًا بمجرد تحديثه هنا.
create or replace function public.transfer_subscription_cohort_atomic(
  p_subscription_id uuid,
  p_new_cohort_id uuid,
  p_actor uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub record;
  v_old_cohort record;
  v_new_cohort record;
  v_occupied integer;
begin
  if p_reason is null or btrim(p_reason) = '' then
    return jsonb_build_object('ok', false, 'error', 'reason_required');
  end if;

  select * into v_sub from subscriptions where id = p_subscription_id for update;
  if v_sub is null then
    return jsonb_build_object('ok', false, 'error', 'subscription_not_found');
  end if;
  if v_sub.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'subscription_not_active');
  end if;
  if v_sub.cohort_id is null then
    return jsonb_build_object('ok', false, 'error', 'subscription_has_no_current_cohort');
  end if;
  if v_sub.cohort_id = p_new_cohort_id then
    return jsonb_build_object('ok', false, 'error', 'same_cohort');
  end if;

  -- قفل المجموعتين بترتيب ثابت (حسب id نصيًا) — يمنع Deadlock مع تحويل معاكس متزامن
  -- (اشتراك آخر يُنقَل من p_new_cohort_id إلى v_sub.cohort_id في نفس اللحظة).
  if v_sub.cohort_id::text < p_new_cohort_id::text then
    perform 1 from cohorts where id = v_sub.cohort_id for update;
    perform 1 from cohorts where id = p_new_cohort_id for update;
  else
    perform 1 from cohorts where id = p_new_cohort_id for update;
    perform 1 from cohorts where id = v_sub.cohort_id for update;
  end if;

  select * into v_old_cohort from cohorts where id = v_sub.cohort_id;
  select * into v_new_cohort from cohorts where id = p_new_cohort_id;
  if v_new_cohort is null then
    return jsonb_build_object('ok', false, 'error', 'target_cohort_not_found');
  end if;
  if v_new_cohort.status not in ('open', 'full') then
    return jsonb_build_object('ok', false, 'error', 'target_cohort_not_open');
  end if;
  if v_new_cohort.grade_band is distinct from v_old_cohort.grade_band then
    return jsonb_build_object('ok', false, 'error', 'grade_band_mismatch');
  end if;
  if v_old_cohort.grade is not null and v_new_cohort.grade is not null and v_old_cohort.grade <> v_new_cohort.grade then
    return jsonb_build_object('ok', false, 'error', 'grade_mismatch');
  end if;
  if v_old_cohort.cycle_id is distinct from v_new_cohort.cycle_id then
    return jsonb_build_object('ok', false, 'error', 'cycle_mismatch');
  end if;

  v_occupied := public.cohort_occupied_seats(p_new_cohort_id);
  if v_occupied >= v_new_cohort.capacity then
    return jsonb_build_object('ok', false, 'error', 'target_cohort_full');
  end if;

  update subscriptions set cohort_id = p_new_cohort_id where id = p_subscription_id;

  return jsonb_build_object('ok', true, 'old_cohort_id', v_sub.cohort_id, 'new_cohort_id', p_new_cohort_id);
end;
$$;
revoke all on function public.transfer_subscription_cohort_atomic(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.transfer_subscription_cohort_atomic(uuid, uuid, uuid, text) to service_role;

-- ===================================================================================
-- PART B3 — إدارة التجميد (سياسة 7-28 يومًا، بلا تداخل، تجاوز الدورة يُرصَد لا يُصحَّح تلقائيًا)
-- ===================================================================================
-- إنشاء تجميد من الإدارة مباشرة كـ'approved' (لا مرحلة 'requested' وسيطة — الإدارة تُنشئه
-- بقرار مباشر، بخلاف الطلب من ولي الأمر عبر Workflow الموجود أصلًا الذي يبقى بلا أي تغيير
-- هنا). السياسة (7-28 يوم) تُمرَّر من الخادم (platform_settings عبر getRuntimeSettings())،
-- لا تُشفَّر هنا رقميًا لتبقى قابلة للتعديل من الإعدادات دون Migration جديدة.
create or replace function public.admin_create_subscription_pause_atomic(
  p_subscription_id uuid,
  p_start_date date,
  p_end_date date,
  p_reason text,
  p_actor uuid,
  p_min_days integer,
  p_max_days integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub record;
  v_days integer;
  v_overlap boolean;
  v_pause_id uuid;
begin
  if p_reason is null or btrim(p_reason) = '' then
    return jsonb_build_object('ok', false, 'error', 'reason_required');
  end if;
  if p_end_date < p_start_date then
    return jsonb_build_object('ok', false, 'error', 'invalid_date_range');
  end if;

  select * into v_sub from subscriptions where id = p_subscription_id for update;
  if v_sub is null then
    return jsonb_build_object('ok', false, 'error', 'subscription_not_found');
  end if;
  if v_sub.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'subscription_not_active');
  end if;

  v_days := (p_end_date - p_start_date) + 1;
  if v_days < p_min_days or v_days > p_max_days then
    return jsonb_build_object('ok', false, 'error', 'pause_duration_out_of_policy', 'days', v_days, 'min_days', p_min_days, 'max_days', p_max_days);
  end if;

  -- لا تداخل مع أي تجميد آخر لنفس الاشتراك لا يزال ذا أثر فعلي (requested/approved/active) —
  -- completed/rejected/cancelled لا تُحتسَب (لا أثر فعلي متبقٍ لها).
  select exists(
    select 1 from subscription_pauses sp
    where sp.subscription_id = p_subscription_id
      and sp.status in ('requested', 'approved', 'active')
      and sp.start_date <= p_end_date
      and sp.end_date >= p_start_date
  ) into v_overlap;
  if v_overlap then
    return jsonb_build_object('ok', false, 'error', 'overlapping_pause');
  end if;

  insert into subscription_pauses (subscription_id, requested_by, start_date, end_date, reason, status, reviewed_by, reviewed_at)
  values (p_subscription_id, p_actor, p_start_date, p_end_date, p_reason, 'approved', p_actor, now())
  returning id into v_pause_id;

  -- نفس منطق review_subscription_pause() الموجود أصلًا لطلبات ولي الأمر (Phase 1 Correction):
  -- تمديد renewal_date بعدد أيام التجميد — لا نُكرِّر صيغة مختلفة لنفس الحساب.
  if v_sub.renewal_date is not null then
    update subscriptions set renewal_date = v_sub.renewal_date + v_days where id = p_subscription_id;
  end if;

  return jsonb_build_object('ok', true, 'pause_id', v_pause_id, 'days', v_days);
end;
$$;
revoke all on function public.admin_create_subscription_pause_atomic(uuid, date, date, text, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_create_subscription_pause_atomic(uuid, date, date, text, uuid, integer, integer) to service_role;

-- إلغاء تجميد لم يبدأ فعليًا بعد (start_date لا يزال بالمستقبل) — يعكس تمديد renewal_date إن
-- كان هذا التجميد بالذات قد مدَّده (نفس عدد الأيام المحسوب وقت الإنشاء)، فلا يبقى تمديد "يتيم"
-- بلا تجميد فعلي يبرره. تجميد status='active' (بدأ فعليًا) خارج نطاق هذه الدالة عمدًا — عكسه
-- يحتاج قرارًا تشغيليًا مختلفًا (جلسات ربما تأثرت فعلًا)، لا إلغاء بضغطة واحدة.
create or replace function public.admin_cancel_subscription_pause_atomic(
  p_pause_id uuid,
  p_actor uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pause record;
  v_sub record;
  v_days integer;
begin
  if p_reason is null or btrim(p_reason) = '' then
    return jsonb_build_object('ok', false, 'error', 'reason_required');
  end if;

  select * into v_pause from subscription_pauses where id = p_pause_id for update;
  if v_pause is null then
    return jsonb_build_object('ok', false, 'error', 'pause_not_found');
  end if;
  if v_pause.status <> 'approved' then
    return jsonb_build_object('ok', false, 'error', 'pause_not_cancellable');
  end if;
  if v_pause.start_date <= current_date then
    return jsonb_build_object('ok', false, 'error', 'pause_already_started');
  end if;

  select * into v_sub from subscriptions where id = v_pause.subscription_id for update;

  update subscription_pauses set status = 'cancelled', reviewed_by = p_actor, reviewed_at = now() where id = p_pause_id;

  v_days := (v_pause.end_date - v_pause.start_date) + 1;
  if v_sub is not null and v_sub.renewal_date is not null then
    update subscriptions set renewal_date = v_sub.renewal_date - v_days where id = v_sub.id;
  end if;

  return jsonb_build_object('ok', true, 'reverted_days', v_days);
end;
$$;
revoke all on function public.admin_cancel_subscription_pause_atomic(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_cancel_subscription_pause_atomic(uuid, uuid, text) to service_role;

-- ===================================================================================
-- Phase 6 Correction Pass — makeup credit monthly-limit + atomic cancel. راجع
-- migrations/20260928_phase6_makeup_credit_correction.sql للتعليقات الكاملة.
-- ===================================================================================

-- Phase 6 Correction Pass — منح رصيد التعويض الإداري كان يتجاوز السقف الشهري المعتمَد
-- (platform_settings.makeup_monthly_limit) صراحة، والإلغاء كان "اقرأ ثم حدِّث ثم دقِّق" بلا قفل
-- ذرّي (نفس درس Phase 4/5 حرفيًا). إضافي بالكامل — لا حذف، لا تعديل على أي عمود/جدول قائم.

-- ===================================================================================
-- (1) إصدار رصيد تعويض إداري ذرّي — يُطبِّق السقف الشهري المعتمَد فعليًا، بلا استثناء صامت
-- ===================================================================================
-- نطاق القفل: طفل + شهر تقويمي حالي (Advisory Lock عابر للمعاملة — يُحرَّر تلقائيًا عند
-- commit/rollback، لا حاجة لتحريره يدويًا). لا صف "عدّاد شهري" فعلي بالجدول لنقفله — القفل
-- الاستشاري هو الأداة الصحيحة هنا بالضبط لتسلسل "اعدّ ثم أدرِج" بين طلبَين متزامنَين لنفس
-- الطفل بنفس الشهر، يمنع limit+1 بنيويًا (لا "افحص العدد من العميل ثم أدرِج" — العدّ والإدراج
-- داخل نفس القفل المعاملي الواحد هنا).
--
-- الحالات المحتسَبة ضد السقف الشهري: available + reserved + used + expired — أي كل شيء عدا
-- cancelled. القرار: السقف الشهري يحكم *حجم الإصدار* خلال الشهر، لا قابلية الاستخدام الحالية —
-- رصيد انتهت صلاحيته بلا استخدام ظل صادرًا فعليًا خلال ذلك الشهر ولا يُعيد فتح حصة إضافية.
-- فقط الإلغاء الإداري الصريح (cancelled) يُعتبَر تراجعًا كاملًا عن الإصدار نفسه، فيُستثنى من
-- العدّ. reserved غير مكتوبة من أي مسار حاليًا (حالة محجوزة للمستقبل) — احتُسِبت بنفس منطق
-- available احترازيًا (التزام معلَّق لم يُلغَ بعد).
create or replace function public.admin_issue_makeup_credit_atomic(
  p_child_id uuid,
  p_subscription_id uuid,
  p_source_session_id uuid,
  p_reason text,
  p_expires_at timestamptz,
  p_issued_by uuid,
  p_monthly_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_child record;
  v_month_count integer;
  v_new_id uuid;
begin
  if p_reason is null or btrim(p_reason) = '' then
    return jsonb_build_object('ok', false, 'error', 'reason_required');
  end if;

  select id into v_child from children where id = p_child_id;
  if v_child is null then
    return jsonb_build_object('ok', false, 'error', 'child_not_found');
  end if;

  -- قفل استشاري معاملي بنطاق (الطفل × الشهر التقويمي الحالي) — يُسلسِل أي طلبَي إصدار إداري
  -- متزامنَين لنفس الطفل بنفس الشهر؛ الثاني ينتظر حتى تلتزم/تتراجع معاملة الأول قبل أن يعدّ.
  perform pg_advisory_xact_lock(hashtext(p_child_id::text || to_char(now(), 'YYYY-MM')));

  select count(*) into v_month_count
  from makeup_credits
  where child_id = p_child_id
    and status in ('available', 'reserved', 'used', 'expired')
    and issued_at >= date_trunc('month', now())
    and issued_at < date_trunc('month', now()) + interval '1 month';

  if v_month_count >= p_monthly_limit then
    return jsonb_build_object('ok', false, 'error', 'monthly_limit_reached', 'count', v_month_count, 'limit', p_monthly_limit);
  end if;

  begin
    insert into makeup_credits (
      child_id, subscription_id, source_session_id, source_type, reason, status, issued_by, expires_at
    )
    values (
      p_child_id, p_subscription_id, p_source_session_id, 'manual_admin', p_reason, 'available', p_issued_by, p_expires_at
    )
    returning id into v_new_id;
  exception
    when unique_violation then
      -- نفس (source_session_id, child_id) موجود فعلًا — الحماية البنيوية القائمة (Phase 1) ضد
      -- إصدار رصيدين لنفس (الطفل، الجلسة المصدر) نفسها، لا منطق جديد مُكرَّر هنا.
      return jsonb_build_object('ok', false, 'error', 'duplicate_source_session');
  end;

  return jsonb_build_object('ok', true, 'id', v_new_id, 'count_after', v_month_count + 1, 'limit', p_monthly_limit);
end;
$$;
revoke all on function public.admin_issue_makeup_credit_atomic(uuid, uuid, uuid, text, timestamptz, uuid, integer) from public, anon, authenticated;
grant execute on function public.admin_issue_makeup_credit_atomic(uuid, uuid, uuid, text, timestamptz, uuid, integer) to service_role;

-- ===================================================================================
-- (2) إلغاء رصيد تعويض إداري ذرّي — يقفل الصف قبل أي قرار، يُعيد "تغيَّر فعليًا؟" صريحة
-- ===================================================================================
-- نفس درس Phase 4/5: لا نكتب تدقيق "إلغاء" إلا إذا التزم التغيير فعليًا بقاعدة البيانات. إعادة
-- محاولة إلغاء نفس الرصيد (سباق حقيقي بين ضغطتين، أو إعادة إرسال شبكية) لا تُنتِج حدث تدقيق
-- "إلغاء" مزدوجًا كاذبًا — v_changed=false تُعاد بهدوء بدل خطأ صاخب، لكن الاستدعاء لا يُسجِّل
-- شيئًا بذاته (الـAPI route هو من يقرر تسجيل التدقيق فقط عند changed=true).
create or replace function public.admin_cancel_makeup_credit_atomic(
  p_credit_id uuid,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credit record;
begin
  select * into v_credit from makeup_credits where id = p_credit_id for update;
  if v_credit is null then
    return jsonb_build_object('ok', false, 'error', 'credit_not_found');
  end if;

  if v_credit.source_type <> 'manual_admin' then
    return jsonb_build_object('ok', false, 'error', 'not_manual_admin_credit');
  end if;

  if v_credit.status = 'used' then
    return jsonb_build_object('ok', false, 'error', 'credit_already_used');
  end if;

  if v_credit.status = 'cancelled' then
    -- Idempotent: إلغاء مُكرَّر لنفس الرصيد المُلغى فعلًا — نجاح هادئ بلا تغيير فعلي، لا خطأ.
    return jsonb_build_object('ok', true, 'changed', false);
  end if;

  if v_credit.status <> 'available' then
    return jsonb_build_object('ok', false, 'error', 'not_cancellable_status', 'status', v_credit.status);
  end if;

  update makeup_credits set status = 'cancelled' where id = p_credit_id and status = 'available';

  return jsonb_build_object('ok', true, 'changed', true);
end;
$$;
revoke all on function public.admin_cancel_makeup_credit_atomic(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_cancel_makeup_credit_atomic(uuid, uuid) to service_role;

-- ===================================================================================
-- Phase 7 — appended from migrations/20260929_phase7_readiness_and_system_health.sql
-- ===================================================================================
-- ===================================================================================
-- Phase 7 — مركز جاهزية التشغيل والصحة التشغيلية
-- ===================================================================================
-- مبدأ أساسي مُلزِم (نص الطلب): "Readiness is derived from system truth. Do not store fake
-- 'ready' flags that can become stale." — لذلك لا جدول "readiness_status" هنا إطلاقًا. الجاهزية
-- تُشتَق حيًّا كل مرة من operational_exceptions (المصدر الحالي الوحيد لاكتشاف المشاكل التشغيلية
-- منذ Phase 5 — sync_operational_exceptions() أعلى هذا الملف) + فحوصات إضافية بسيطة (اتصال
-- Supabase، وجود إعداد Paylink بنيويًا) تُنفَّذ من src/lib/readiness.ts وقت الطلب، لا تُخزَّن.
--
-- الجدولان هنا إضافيان بحتان (append-only سجلّات، لا تخزين حالة جاهزية):
-- (1) readiness_blocker_overrides — تجاوز إداري صريح لعائق تشغيلي محدَّد (ليس كل العوائق قابلة
--     للتجاوز — التصنيف overrideable/non-overrideable في src/lib/readiness.ts وحده، لا هنا).
-- (2) webhook_events — سجل استقبال Webhook مبسَّط (البند 7.10) — Observability فقط، لا يُستخدَم
--     أبدًا كمصدر حقيقة دفع (المصدر الوحيد يبقى verifyAndActivatePaylinkPayment عبر Paylink
--     getInvoice مباشرة — هذا الجدول لا يُقرَأ من أي منطق تفعيل/دفع إطلاقًا).

create table if not exists readiness_blocker_overrides(
  id uuid primary key default gen_random_uuid(),
  -- blocker_key: لعوائق مشتقَّة من صف operational_exceptions محدَّد = نص uuid ذلك الصف
  -- (تطابق 1:1، أبسط مفتاح ممكن ويبقى صالحًا طالما الصف نفسه لم يُحل بعد). لعوائق دورة تشغيلية
  -- (Cycle completion) = 'cycle:<cycle_id>:<reason_code>'. غير مُقيَّد بـFK عمدًا — العائق نفسه
  -- (exception/cycle) له دورة حياة مستقلة، والتجاوز سجل تاريخي منفصل حتى لو زال العائق لاحقًا.
  blocker_key text not null,
  reason text not null,
  overridden_by uuid not null references admins(id),
  overridden_at timestamptz not null default now(),
  -- active=false يعني هذا التجاوز أُلغي/استُبدِل — لا حذف أبدًا (سجل تاريخي)، فقط عدم اعتبار
  -- فعّالًا بعد الآن. لا واجهة إلغاء تجاوز بهذه الجولة (خارج النطاق) — العمود موجود للمستقبل
  -- ولضمان صحة الفهرس الفريد الجزئي أدناه بلا حاجة لهجرة إضافية لاحقًا.
  active boolean not null default true
);
alter table readiness_blocker_overrides enable row level security;
-- بلا أي policy — service_role فقط، طابع كل جدول تدقيق/إدارة حسّاس بهذا المشروع.

-- لا يمكن وجود أكثر من تجاوز "فعّال" واحد لنفس blocker_key في نفس اللحظة — يمنع تكرار
-- سجلّات تجاوز متطابقة عبر ضغطات متزامنة على نفس العائق.
create unique index if not exists idx_readiness_overrides_active_unique
  on readiness_blocker_overrides(blocker_key) where active = true;
create index if not exists idx_readiness_overrides_key on readiness_blocker_overrides(blocker_key);

create table if not exists webhook_events(
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'paylink',
  event_type text not null, -- مثل 'payment_status_update' — من حقل orderStatus/الحدث الوارد فقط، بلا أي payload خام
  payment_reference text, -- transactionNo/merchantOrderNumber فقط (لا مبالغ ولا بيانات بطاقة أبدًا)
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  success boolean,
  error_code text,
  error_message text, -- رسالة مُطهَّرة (Sanitized) فقط — لا أي جزء من رأس Authorization أو أسرار
  created_at timestamptz not null default now()
);
alter table webhook_events enable row level security;
create index if not exists idx_webhook_events_received_at on webhook_events(received_at desc);

-- ===================================================================================
-- (3) إكمال دورة تشغيلية ذرّيًا — لا مسار إكمال Cycle كان موجودًا إطلاقًا قبل هذه الهجرة
-- (تأكَّد بالتدقيق: /api/admin/cycles/route.ts يحوي POST إنشاء فقط، بلا أي PATCH/status
-- transition). هذه الدالة هي المسار الوحيد لتغيير status إلى 'completed' — تفرض بوابة فحص
-- خادميّة قبل أي التزام (البند 7.7)، لا تعتمد على الواجهة إطلاقًا.
--
-- تصنيف العوائق هنا:
--  - "مالية/حقيقة مزوِّد" (تعارض دفع/تفعيل حرج، أو استرداد يحتاج مراجعة استحقاق) — عائق **غير
--    قابل للتجاوز** من هذه الدالة إطلاقًا، حتى مع p_override=true (نص صريح بالطلب: "Do NOT
--    override financial/provider truth").
--  - "تشغيلية" (حضور جلسات مكتملة غير مسجَّل، استثناء حرج آخر مرتبط بالدورة لا علاقة مالية
--    مباشرة له) — قابلة للتجاوز فقط بـp_override=true + p_override_reason غير فارغ، ويُسجَّل
--    ذلك بوضوح بالنتيجة المُعادة (override_applied) ليكتب الـAPI route تدقيقًا صريحًا.
create or replace function public.complete_cycle_atomic(
  p_cycle_id uuid,
  p_actor uuid,
  p_override boolean default false,
  p_override_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle record;
  v_attendance_gap_count integer;
  v_financial_conflict_count integer;
  v_refund_review_count integer;
  v_other_critical_count integer;
  v_blocking_financial jsonb := '[]'::jsonb;
  v_blocking_operational jsonb := '[]'::jsonb;
begin
  select * into v_cycle from cycles where id = p_cycle_id for update;
  if v_cycle is null then
    return jsonb_build_object('ok', false, 'error', 'cycle_not_found');
  end if;

  if v_cycle.status = 'completed' then
    return jsonb_build_object('ok', true, 'changed', false, 'already_completed', true);
  end if;

  if v_cycle.status = 'archived' then
    return jsonb_build_object('ok', false, 'error', 'cycle_archived');
  end if;

  -- (أ) حضور جلسات مكتملة لمجموعات هذه الدورة غير مسجَّل إطلاقًا — تشغيلي، قابل للتجاوز.
  select count(*) into v_attendance_gap_count
  from sessions s
  join cohorts c on c.id = s.cohort_id
  where c.cycle_id = p_cycle_id
    and s.status = 'completed'
    and not exists (select 1 from attendance a where a.session_id = s.id);

  -- (ب) تعارض دفع/تفعيل حرج فعلي مرتبط بمجموعات هذه الدورة — مالي، غير قابل للتجاوز أبدًا هنا.
  select count(*) into v_financial_conflict_count
  from operational_exceptions oe
  join cohorts c on c.id = oe.cohort_id
  where c.cycle_id = p_cycle_id
    and oe.exception_type in ('paid_not_active', 'late_paid_capacity_conflict')
    and oe.status in ('open', 'in_review');

  -- (ج) استرداد يحتاج مراجعة استحقاق تعليمي مرتبط بمجموعات هذه الدورة — مالي/استحقاق، غير قابل للتجاوز.
  select count(*) into v_refund_review_count
  from operational_exceptions oe
  join payment_refunds r on r.id = oe.refund_id
  join payments pay on pay.id = r.payment_id
  join subscriptions sub on sub.id = pay.subscription_id
  join cohorts c on c.id = sub.cohort_id
  where c.cycle_id = p_cycle_id
    and oe.exception_type = 'refund_requires_entitlement_review'
    and oe.status in ('open', 'in_review');

  -- (د) أي استثناء حرج آخر مرتبط مباشرة بمجموعة من هذه الدورة (غير المصنَّف أعلاه) — تشغيلي، قابل للتجاوز.
  select count(*) into v_other_critical_count
  from operational_exceptions oe
  join cohorts c on c.id = oe.cohort_id
  where c.cycle_id = p_cycle_id
    and oe.severity = 'critical'
    and oe.status in ('open', 'in_review')
    and oe.exception_type not in ('paid_not_active', 'late_paid_capacity_conflict');

  if v_financial_conflict_count > 0 then
    v_blocking_financial := v_blocking_financial || jsonb_build_object('code', 'financial_activation_conflict', 'count', v_financial_conflict_count);
  end if;
  if v_refund_review_count > 0 then
    v_blocking_financial := v_blocking_financial || jsonb_build_object('code', 'refund_entitlement_review', 'count', v_refund_review_count);
  end if;
  if v_attendance_gap_count > 0 then
    v_blocking_operational := v_blocking_operational || jsonb_build_object('code', 'unresolved_attendance', 'count', v_attendance_gap_count);
  end if;
  if v_other_critical_count > 0 then
    v_blocking_operational := v_blocking_operational || jsonb_build_object('code', 'critical_exception', 'count', v_other_critical_count);
  end if;

  -- عوائق مالية موجودة → رفض دائمًا، بصرف النظر عن p_override إطلاقًا (لا استثناء).
  if jsonb_array_length(v_blocking_financial) > 0 then
    return jsonb_build_object(
      'ok', false, 'error', 'blocked', 'blocked', true,
      'financial_reasons', v_blocking_financial, 'operational_reasons', v_blocking_operational,
      'overridable', false
    );
  end if;

  -- عوائق تشغيلية فقط، بلا تجاوز صالح (p_override=false أو سبب فارغ) → رفض قابل للتجاوز.
  if jsonb_array_length(v_blocking_operational) > 0 and not (p_override and p_override_reason is not null and length(trim(p_override_reason)) > 0) then
    return jsonb_build_object(
      'ok', false, 'error', 'blocked', 'blocked', true,
      'financial_reasons', '[]'::jsonb, 'operational_reasons', v_blocking_operational,
      'overridable', true
    );
  end if;

  update cycles set status = 'completed' where id = p_cycle_id;

  return jsonb_build_object(
    'ok', true, 'changed', true,
    'override_applied', jsonb_array_length(v_blocking_operational) > 0,
    'operational_reasons_overridden', v_blocking_operational
  );
end;
$$;
revoke all on function public.complete_cycle_atomic(uuid, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.complete_cycle_atomic(uuid, uuid, boolean, text) to service_role;

-- ===================================================================================
-- (4) تجاوز عائق جاهزية عام (غير خاص بإكمال دورة) — Super Admin فقط (يُفرَض من requirePermission
-- بطبقة الـAPI، لا من هنا). التصنيف overrideable/non-overrideable يُحسَم بـsrc/lib/readiness.ts
-- قبل استدعاء هذه الدالة أصلًا — الدالة نفسها لا "ترفض" عائقًا تقنيًا لأنها لا تعرف التصنيف،
-- فقط تُسجِّل التجاوز المطلوب. idempotent: تجاوز مُكرَّر لنفس blocker_key الفعّال حاليًا لا يُنشئ صفًا مزدوجًا.
create or replace function public.override_readiness_blocker_atomic(
  p_blocker_key text,
  p_reason text,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_id uuid;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'reason_required');
  end if;

  select id into v_existing_id from readiness_blocker_overrides
  where blocker_key = p_blocker_key and active = true
  limit 1;

  if v_existing_id is not null then
    return jsonb_build_object('ok', true, 'changed', false, 'already_overridden', true, 'override_id', v_existing_id);
  end if;

  insert into readiness_blocker_overrides(blocker_key, reason, overridden_by)
  values (p_blocker_key, trim(p_reason), p_actor)
  returning id into v_existing_id;

  return jsonb_build_object('ok', true, 'changed', true, 'override_id', v_existing_id);
end;
$$;
revoke all on function public.override_readiness_blocker_atomic(text, text, uuid) from public, anon, authenticated;
grant execute on function public.override_readiness_blocker_atomic(text, text, uuid) to service_role;

-- ===================================================================================

-- =====================================================================================
-- SECTION 9 — admins.active / admins.pending_email (confirmed MISSING: active; the
-- pending_email/user_id-nullable statements ride along from the same historical
-- migration and are safe/idempotent regardless), admin role-change / active-toggle RPCs,
-- post-lock attendance override RPC, and admin_update_plan_atomic.
-- =====================================================================================

-- Phase 8 — appended from migrations/20260930_phase8_admin_users_and_governance.sql
-- ===================================================================================
-- ===================================================================================
-- Phase 8 — إدارة المستخدمين الإداريين (8.1) + إكمال حوكمة الحضور بعد القفل (8.13)
-- ===================================================================================

-- (1) توسيع جدول admins — إضافية بحتة، بلا مساس بأي صف حالي. active افتراضيًا true (كل حساب
-- إداري موجود اليوم نشط فعليًا — لا قفل مفاجئ لأي حساب حالي عند تطبيق هذه الهجرة).
alter table admins add column if not exists active boolean not null default true;
-- pending_email: تُستخدَم فقط أثناء تدفّق الدعوة (قبل أن يُكمِل المستخدم الدعوة عبر Supabase Auth
-- ويُصبح له user_id فعلي) — تسمح بعرض "دعوة قيد الانتظار لهذا البريد" بالواجهة دون أي user_id مؤقت وهمي.
alter table admins add column if not exists pending_email text;
alter table admins alter column user_id drop not null; -- كان unique فقط أصلًا بلا not null صراحة، لكن نتأكد صراحة: صف "دعوة معلَّقة" بلا user_id حتى تُقبَل الدعوة.

-- ===================================================================================
-- (2) تغيير دور إداري ذرّيًا — يحمي عدم بقاء صفر Super Admin نشط أبدًا (البند 8.1/8.16 صراحة).
-- نقفل الجدول بالكامل هنا (for update بلا شرط على admins) — عمدًا: هذا جدول صغير جدًا عمليًا
-- (عدد الإداريين محدود)، وقفل الجدول كاملًا أبسط وأضمن من أي منطق ترتيب صفوف لمنع Race شامل
-- بين تغييرين متزامنين قد يُفرغان معًا آخر Super Admin دون أن يرى أي منهما الآخر — قرار مُوثَّق
-- صراحة بالتقرير كمفاضلة مقصودة (تبعات أداء صفرية عمليًا لحجم هذا الجدول).
create or replace function public.admin_change_role_atomic(
  p_target_admin_id uuid,
  p_new_role text,
  p_actor uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target record;
  v_active_super_admins integer;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'reason_required');
  end if;
  if p_new_role not in ('super_admin','operations_manager','finance_admin','admin_support') then
    return jsonb_build_object('ok', false, 'error', 'invalid_role');
  end if;

  -- قفل الجدول بالكامل لمدة هذه المعاملة القصيرة — يمنع أي تغيير دور/تفعيل متزامن آخر من
  -- القراءة قبل التزامنا، فيضمن حساب v_active_super_admins أدناه دقيقًا دائمًا.
  lock table admins in share row exclusive mode;

  select * into v_target from admins where id = p_target_admin_id;
  if v_target is null then
    return jsonb_build_object('ok', false, 'error', 'admin_not_found');
  end if;

  if v_target.role = p_new_role then
    return jsonb_build_object('ok', true, 'changed', false, 'old_role', v_target.role, 'new_role', p_new_role);
  end if;

  -- إن كان الهدف Super Admin نشط حاليًا وسيُغادِر هذا الدور، تأكَّد أن غيره سيبقى.
  if v_target.role = 'super_admin' and v_target.active = true then
    select count(*) into v_active_super_admins from admins where role = 'super_admin' and active = true and id <> p_target_admin_id;
    if v_active_super_admins = 0 then
      return jsonb_build_object('ok', false, 'error', 'last_super_admin_protected');
    end if;
  end if;

  update admins set role = p_new_role where id = p_target_admin_id;

  return jsonb_build_object('ok', true, 'changed', true, 'old_role', v_target.role, 'new_role', p_new_role);
end;
$$;
revoke all on function public.admin_change_role_atomic(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_change_role_atomic(uuid, text, uuid, text) to service_role;

-- ===================================================================================
-- (3) تفعيل/تعطيل حساب إداري ذرّيًا — نفس حماية آخر Super Admin نشط عند التعطيل.
create or replace function public.admin_set_active_atomic(
  p_target_admin_id uuid,
  p_active boolean,
  p_actor uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target record;
  v_active_super_admins integer;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'reason_required');
  end if;

  lock table admins in share row exclusive mode;

  select * into v_target from admins where id = p_target_admin_id;
  if v_target is null then
    return jsonb_build_object('ok', false, 'error', 'admin_not_found');
  end if;

  if v_target.active = p_active then
    return jsonb_build_object('ok', true, 'changed', false);
  end if;

  if p_active = false and v_target.role = 'super_admin' then
    select count(*) into v_active_super_admins from admins where role = 'super_admin' and active = true and id <> p_target_admin_id;
    if v_active_super_admins = 0 then
      return jsonb_build_object('ok', false, 'error', 'last_super_admin_protected');
    end if;
  end if;

  -- حماية إضافية: لا يمكن للمستخدم تعطيل حسابه الخاص (يمنع قفل ذاتي بالخطأ بلا وعي، ويمنع
  -- سيناريو "آخر Super Admin يُعطِّل نفسه" حتى لو مرّ فحص العدّ أعلاه بسباق نظري ضيق جدًا).
  if p_active = false and v_target.id = p_actor then
    return jsonb_build_object('ok', false, 'error', 'cannot_deactivate_self');
  end if;

  update admins set active = p_active where id = p_target_admin_id;

  return jsonb_build_object('ok', true, 'changed', true);
end;
$$;
revoke all on function public.admin_set_active_atomic(uuid, boolean, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_set_active_atomic(uuid, boolean, uuid, text) to service_role;

-- ===================================================================================
-- (4) 8.13 — تصحيح حضور إداري بعد القفل. Operations (attendance.manage — يملكها بالفعل
-- operations_manager وsuper_admin فقط، لا Finance ولا Support، مطابق تمامًا للمطلوب) فقط،
-- سبب إلزامي، تدقيق كامل بالقيمة القديمة/الجديدة. upsert مباشر (لا RPC قفل معقَّد — تصحيح
-- يدوي نادر جدًا واقعيًا، لا سيناريو تزامن حقيقي يستحق قفل صف كامل هنا؛ قرار مُوثَّق بالتقرير).
create or replace function public.admin_override_attendance_atomic(
  p_session_id uuid,
  p_child_id uuid,
  p_new_status text,
  p_new_reason text,
  p_actor uuid,
  p_override_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_status text;
  v_old_reason text;
  v_reason_to_store text;
begin
  if p_override_reason is null or length(trim(p_override_reason)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'reason_required');
  end if;
  if p_new_status not in ('present','absent','late','excused') then
    return jsonb_build_object('ok', false, 'error', 'invalid_status');
  end if;
  if not exists (select 1 from sessions where id = p_session_id) then
    return jsonb_build_object('ok', false, 'error', 'session_not_found');
  end if;

  -- سبب الغياب يُخزَّن فقط لحالة absent (مطابقة تمامًا لمنطق /api/session-report/submit
  -- الحالي — لا قاعدة جديدة مختلفة هنا).
  v_reason_to_store := case when p_new_status = 'absent' then p_new_reason else null end;

  select status, reason into v_old_status, v_old_reason
  from attendance where session_id = p_session_id and child_id = p_child_id for update;

  insert into attendance (session_id, child_id, status, reason, marked_by)
  values (p_session_id, p_child_id, p_new_status, v_reason_to_store, null)
  on conflict (session_id, child_id) do update set status = excluded.status, reason = excluded.reason;

  return jsonb_build_object(
    'ok', true, 'changed', true,
    'old_status', v_old_status, 'old_reason', v_old_reason,
    'new_status', p_new_status, 'new_reason', v_reason_to_store
  );
end;
$$;
revoke all on function public.admin_override_attendance_atomic(uuid, uuid, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_override_attendance_atomic(uuid, uuid, text, text, uuid, text) to service_role;

-- ===================================================================================
-- Phase 9 pre-correction — appended from migrations/20261001_phase9_pre_correction_plan_mutation_and_capacity_defaults.sql
-- ===================================================================================
-- ===================================================================================
-- Phase 9 pre-correction pass — item (2) و(3) من التصحيح المطلوب قبل إغلاق Phase 7/8.
-- ===================================================================================
-- لا شيء هنا يُغيِّر سلوك سعة المجموعات الحالية (capacity على كل صف cohorts مستقل ومخزَّن،
-- لا مرجع حيّ لـplatform_settings) ولا يمس أي لقطة (plan_snapshot_*) على أي اشتراك حالي —
-- كلاهما تصحيح مسار *إنشاء لاحق* فقط، لا هجرة بيانات تاريخية إطلاقًا.

-- ===================================================================================
-- (1) تحديث باقة (plan) ذرّيًا مع سجل تدقيق دقيق — لا مسار تعديل باقة (سعر/جلسات/أيام/تفعيل)
-- كان موجودًا إطلاقًا قبل هذه الهجرة (الباقات حتى الآن تُدار فقط عبر INSERT داخل ملفات
-- migrations مباشرة). يقفل صف الباقة قبل أي قرار، ويُعيد "تغيَّر فعليًا؟" صريحة — نفس درس
-- Phase 4/5/6: لا تدقيق "تحديث" إلا إذا التزم التغيير فعليًا بقاعدة البيانات (لا SELECT قديم ثم
-- UPDATE منفصل قد يفشل بصمت).
--
-- تنبيه صريح مهم: هذه الدالة لا تلمس subscriptions.plan_snapshot_* إطلاقًا (لا UPDATE، لا حتى
-- SELECT) — لقطة كل اشتراك قائم تبقى كما التُقِطت وقت التسجيل، بصرف النظر عمّا يحدث للباقة
-- لاحقًا. سعر/شروط جديدة تؤثر فقط على تسجيلات مستقبلية تلتقط لقطة جديدة عبر enroll_subscription_atomic
-- (لقطة السعر تُؤخَذ من قيمة plans.price_sar وقت التسجيل نفسه، لا مرجع حيّ لاحق).
create or replace function public.admin_update_plan_atomic(
  p_plan_id text,
  p_name text default null,
  p_name_provided boolean default false,
  p_price_sar numeric default null,
  p_price_provided boolean default false,
  p_sessions_per_month smallint default null,
  p_sessions_provided boolean default false,
  p_days_per_week smallint default null,
  p_days_provided boolean default false,
  p_active boolean default null,
  p_active_provided boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan record;
  v_final_name text;
  v_final_price numeric;
  v_final_sessions smallint;
  v_final_days smallint;
  v_final_active boolean;
begin
  select * into v_plan from plans where id = p_plan_id for update;
  if v_plan is null then
    return jsonb_build_object('ok', false, 'error', 'plan_not_found');
  end if;

  v_final_name := case when p_name_provided then p_name else v_plan.name end;
  v_final_price := case when p_price_provided then p_price_sar else v_plan.price_sar end;
  v_final_sessions := case when p_sessions_provided then p_sessions_per_month else v_plan.sessions_per_month end;
  v_final_days := case when p_days_provided then p_days_per_week else v_plan.days_per_week end;
  v_final_active := case when p_active_provided then p_active else v_plan.active end;

  if p_name_provided and (v_final_name is null or length(trim(v_final_name)) = 0) then
    return jsonb_build_object('ok', false, 'error', 'invalid_name');
  end if;
  if p_price_provided and v_final_price is not null and v_final_price <= 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_price');
  end if;
  if p_sessions_provided and v_final_sessions is not null and v_final_sessions <= 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_sessions');
  end if;
  if p_days_provided and v_final_days is not null and v_final_days <= 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_days');
  end if;

  if v_final_name = v_plan.name and v_final_price is not distinct from v_plan.price_sar
    and v_final_sessions is not distinct from v_plan.sessions_per_month
    and v_final_days is not distinct from v_plan.days_per_week
    and v_final_active = v_plan.active then
    return jsonb_build_object('ok', true, 'changed', false);
  end if;

  update plans set
    name = v_final_name,
    price_sar = v_final_price,
    sessions_per_month = v_final_sessions,
    days_per_week = v_final_days,
    active = v_final_active
  where id = p_plan_id;

  return jsonb_build_object(
    'ok', true, 'changed', true,
    'old_value', jsonb_build_object('name', v_plan.name, 'price_sar', v_plan.price_sar, 'sessions_per_month', v_plan.sessions_per_month, 'days_per_week', v_plan.days_per_week, 'active', v_plan.active),
    'new_value', jsonb_build_object('name', v_final_name, 'price_sar', v_final_price, 'sessions_per_month', v_final_sessions, 'days_per_week', v_final_days, 'active', v_final_active)
  );
end;
$$;
revoke all on function public.admin_update_plan_atomic(text, text, boolean, numeric, boolean, smallint, boolean, smallint, boolean, boolean, boolean) from public, anon, authenticated;
grant execute on function public.admin_update_plan_atomic(text, text, boolean, numeric, boolean, smallint, boolean, smallint, boolean, boolean, boolean) to service_role;

-- =====================================================================================
-- End of reconciliation. Nothing below this line.
-- =====================================================================================

commit;
