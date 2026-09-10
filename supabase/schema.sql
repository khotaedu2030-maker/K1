-- =========================================================
-- KHOTA V2 — schema.sql
-- =========================================================
create extension if not exists pgcrypto;

-- =========================================================
-- MIGRATION — V3 Multi-Stage Grade Expansion (تطبيق على قاعدة قائمة، بلا فقدان بيانات)
-- =========================================================
-- شغّل هذه الكتلة فقط على مشروع Supabase حي يحتوي بيانات فعلية بالفعل بقيود 1-6/1-3/4-6
-- القديمة. على تثبيت جديد بالكامل، تجاهلها — تعريفات الجداول أدناه في هذا الملف تعكس الحالة
-- النهائية أصلًا. كل بيانات children.grade و cohorts.grade_band الحالية (1-6، 1-3/4-6) تبقى
-- صالحة تمامًا تحت القيود الموسَّعة أدناه — هذا توسيع نطاق فقط، وليس تضييقًا، فلا خطر على
-- أي صف موجود.
--
-- alter table children drop constraint if exists children_grade_check;
-- alter table children add constraint children_grade_check check (grade between 1 and 12);
--
-- alter table plans drop constraint if exists plans_product_check;
-- alter table plans add constraint plans_product_check
--   check (product in ('motabaa','english','qudurat','focus_room'));
--
-- alter table cohorts drop constraint if exists cohorts_grade_band_check;
-- alter table cohorts add constraint cohorts_grade_band_check
--   check (grade_band in ('1-3','4-6','7-9','10-12'));
--
-- ملاحظة: أسماء القيود أعلاه (`..._check`) هي التسمية التلقائية القياسية لـ Postgres لقيد
-- CHECK معرَّف Inline كما في هذا الملف. تحقّق من الاسم الفعلي في مشروعك عبر:
--   select conname from pg_constraint where conrelid = 'children'::regclass;
-- قبل التنفيذ إن كان قد أُعيد تسميته يدويًا في وقت سابق.

-- ---------- الجداول الأساسية (من V1) ----------
create table if not exists parents(
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null,
  phone text not null,
  email text,
  created_at timestamptz default now()
);

create table if not exists children(
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  first_name text not null,
  birth_date date,
  grade smallint not null check(grade between 1 and 12),
  school_name text,
  learning_notes text,
  created_at timestamptz default now()
);

create table if not exists plans(
  id text primary key,
  product text not null check(product in('motabaa','english','qudurat','focus_room')),
  name text not null,
  sessions_per_month smallint,
  days_per_week smallint,
  -- أنماط الأيام الفعلية المتاحة لهذه الباقة (وليست مجرد "3 أيام" مجهولة)
  day_patterns text[] default '{}',
  price_sar numeric(10,2),
  active boolean default true
);

insert into plans (id, product, name, sessions_per_month, days_per_week, day_patterns, price_sar, active) values
  ('khota-2','motabaa','الانطلاقة',8,2, array['الأحد+الثلاثاء','الاثنين+الأربعاء'], null, true),
  ('khota-3','motabaa','الأساسية',12,3, array['الأحد+الاثنين+الأربعاء'], null, true),
  ('khota-4','motabaa','المكثفة',16,4, array['الأحد إلى الأربعاء'], null, true)
on conflict(id) do update set day_patterns = excluded.day_patterns;

-- Focus Room (7-12) — الحد الأدنى من الخطط اللازم فقط لربط الـCohorts بها. لا تسعير تجاري
-- معتمد بعد: price_sar = null، وactive = false عمدًا حتى يُعتمَد السعر — هذا يمنع ظهورها في
-- الكتالوج العام (plans_public_read: using(active=true)) ويمنع /api/enroll من قبول اشتراك بها
-- (يتحقق من plan.active) — أي لا اشتراك عام ذاتي الخدمة ممكن بها حتى تُفعَّل يدويًا لاحقًا.
-- أيام Focus Room الفعلية (day_patterns) لم تُقرَّر تشغيليًا بعد، فتُركت فارغة عمدًا — وليست
-- اختراعًا لجدولة غير معتمدة.
insert into plans (id, product, name, sessions_per_month, days_per_week, day_patterns, price_sar, active) values
  ('focus-2','focus_room','Focus Room — يومان أسبوعيًا',8,2, '{}', null, false),
  ('focus-3','focus_room','Focus Room — 3 أيام أسبوعيًا',12,3, '{}', null, false),
  ('focus-4','focus_room','Focus Room — 4 أيام أسبوعيًا',16,4, '{}', null, false)
on conflict(id) do nothing;

create table if not exists teachers(
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id),
  full_name text not null,
  active boolean default true
);

-- تأسيس RBAC حقيقي للأدمن — كانت /admin بلا أي حارس صلاحيات إطلاقًا قبل هذا الباتش
create table if not exists admins(
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id),
  full_name text not null,
  created_at timestamptz default now()
);
alter table admins enable row level security;
-- بلا أي policy إطلاقًا: لا anon ولا authenticated يقرأ هذا الجدول — service_role فقط
-- (يُستخدم حصرًا داخل src/app/admin/** للتحقق من الصلاحية، عبر supabase-server ثم مطابقة يدوية)
create policy "admins_self_select" on admins for select using (auth.uid() = user_id);

create table if not exists cohorts(
  id uuid primary key default gen_random_uuid(),
  product text not null,
  plan_id text references plans(id),
  title text not null,
  teacher_id uuid references teachers(id),
  grade_band text check(grade_band in('1-3','4-6','7-9','10-12')), -- 1-3/4-6: motabaa (Guided). 7-9/10-12: Focus Room. NULL: English/قدرات/غير محدَّد.
  capacity smallint not null,
  days_of_week smallint[] default '{}', -- 0=Sun..6=Sat
  slot_code text,
  meeting_url text, -- رابط القاعة الدائم للمجموعة (Zoom/Teams)، يُنسخ لكل جلسة عند توليدها
  start_time time not null,
  end_time time not null,
  start_date date,
  end_date date,
  status text default 'draft' check(status in('draft','open','full','closed'))
);

-- P0: يفرض أن أيام أي مجموعة مرتبطة بخطة تطابق دائمًا عدد أيام تلك الخطة (plans.days_per_week) —
-- بدون هذا، مجموعة بأيام أكثر من خطتها قد تُظهر لولي الأمر جلسات لا تخص اشتراكه الفعلي.
create or replace function public.enforce_cohort_days_match_plan()
returns trigger
language plpgsql
as $$
declare
  v_expected_days smallint;
begin
  if new.plan_id is null then
    return new;
  end if;
  select days_per_week into v_expected_days from plans where id = new.plan_id;
  if v_expected_days is not null and array_length(new.days_of_week, 1) is distinct from v_expected_days then
    raise exception 'cohort_days_mismatch: هذه المجموعة أيامها (%) لا تطابق عدد أيام باقتها (%) — راجع days_of_week وplan_id',
      coalesce(array_length(new.days_of_week, 1), 0), v_expected_days;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_cohort_days_match_plan on cohorts;
create trigger trg_enforce_cohort_days_match_plan
  before insert or update of days_of_week, plan_id on cohorts
  for each row execute function public.enforce_cohort_days_match_plan();

create table if not exists subscriptions(
  id uuid primary key default gen_random_uuid(),
  child_id uuid references children(id) on delete cascade,
  parent_id uuid not null references parents(id) on delete cascade,
  plan_id text not null references plans(id),
  cohort_id uuid references cohorts(id),
  status text default 'pending_payment' check(status in('pending_payment','active','paused','cancelled','expired')),
  start_date date,
  renewal_date date,
  created_at timestamptz default now()
);

create table if not exists sessions(
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references cohorts(id) on delete cascade,
  teacher_id uuid references teachers(id),
  session_date date not null,
  starts_at timestamptz,
  ends_at timestamptz,
  meeting_url text, -- نسخة من رابط قاعة المجموعة وقت توليد الجلسة
  status text default 'scheduled' check(status in('scheduled','completed','cancelled')),
  unique (cohort_id, starts_at) -- يمنع توليد جلسات مكرَّرة لنفس المجموعة/الموعد من أي مصدر
);

create table if not exists daily_pulse_reports(
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,
  teacher_id uuid references teachers(id),
  tasks_completed text[] default '{}',
  independence_rating smallint check(independence_rating between 1 and 5),
  focus_rating smallint check(focus_rating between 1 and 5),
  tomorrow_readiness text,
  teacher_note text,
  needs_specialist boolean default false,
  focus_subject text,
  created_at timestamptz default now(),
  unique(session_id, child_id)
);

create table if not exists recommendations(
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  teacher_id uuid references teachers(id),
  subject text,
  reason text not null,
  status text default 'open' check(status in('open','actioned','dismissed')),
  created_at timestamptz default now()
);

create table if not exists premium_requests(
  id uuid primary key default gen_random_uuid(),
  product text not null,
  full_name text,
  phone text not null,
  goal text,
  preferred_schedule text,
  status text default 'new' check(status in('new','contacted','converted','closed')),
  created_at timestamptz default now()
);

-- Legacy bookings من V1 غير محذوف عمدًا.

-- ---------- جداول جديدة (V2 — كانت ناقصة عن الهيكل التشغيلي) ----------

create table if not exists attendance(
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,
  status text not null default 'present' check(status in('present','absent','late','excused')),
  marked_by uuid references teachers(id),
  created_at timestamptz default now(),
  unique(session_id, child_id)
);

create table if not exists daily_tasks(
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  title text not null,
  subject text,
  status text not null default 'pending' check(status in('pending','done','needs_review')),
  due_date date,
  created_at timestamptz default now()
);

create table if not exists learning_profiles(
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null unique references children(id) on delete cascade,
  strengths text,
  weak_subjects text[] default '{}',
  parent_notes text,
  upcoming_tests text,
  updated_at timestamptz default now()
);

create table if not exists payments(
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  parent_id uuid not null references parents(id) on delete cascade,
  amount_sar numeric(10,2) not null,
  status text not null default 'pending' check(status in('pending','paid','failed','refunded')),
  provider text,        -- اسم مزوّد الدفع (Moyasar/Tap/HyperPay/...) — يُحدَّد لاحقًا
  provider_ref text,    -- مرجع العملية عند المزوّد
  paid_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists teacher_availability(
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  day_of_week smallint not null check(day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  active boolean default true
);

-- ---------- V3 Phase 2: منهجية KHOTA — طبقة القياس والمتابعة المستمرة ----------

-- التقييم التأسيسي/الدوري — سجل تاريخي لا يُستبدل أبدًا (append-only)
create table if not exists assessments(
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  assessment_date date not null default current_date,
  reading_level text check(reading_level in('needs_support','age_appropriate','advanced')),
  writing_spelling_level text check(writing_spelling_level in('needs_support','age_appropriate','advanced')),
  mathematics_level text check(mathematics_level in('needs_support','age_appropriate','advanced')),
  english_level text check(english_level in('needs_support','age_appropriate','advanced')),
  focus_level text check(focus_level in('needs_support','age_appropriate','advanced')),
  independence_level text check(independence_level in('needs_support','age_appropriate','advanced')),
  teacher_notes text,
  assessment_type text not null check(assessment_type in('baseline','monthly_review','manual_review')),
  teacher_id uuid references teachers(id),
  created_at timestamptz default now()
);

-- خطوة هذا الأسبوع
create table if not exists weekly_goals(
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  week_start date not null,
  title text not null,
  description text,
  category text,
  status text not null default 'active' check(status in('active','achieved','partially_achieved','carried_forward','cancelled')),
  progress smallint default 0 check(progress between 0 and 100),
  created_by_teacher_id uuid references teachers(id),
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- Progress Engine: نقاط تتبع دورية (Snapshots) — لا درجات وهمية، تُنشأ فقط من تقييمات فعلية
create table if not exists child_progress_snapshots(
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  snapshot_date date not null default current_date,
  reading_score smallint check(reading_score between 1 and 5),
  writing_spelling_score smallint check(writing_spelling_score between 1 and 5),
  mathematics_score smallint check(mathematics_score between 1 and 5),
  english_score smallint check(english_score between 1 and 5),
  focus_score smallint check(focus_score between 1 and 5),
  independence_score smallint check(independence_score between 1 and 5),
  source text not null, -- 'baseline' | 'monthly_review' | 'independence_assessment' | 'manual'
  notes text,
  created_by uuid references teachers(id),
  created_at timestamptz default now()
);

-- KHOTA Independence Score
create table if not exists independence_assessments(
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  assessment_date date not null default current_date,
  task_management smallint not null check(task_management between 1 and 5),
  task_initiation smallint not null check(task_initiation between 1 and 5),
  help_seeking smallint not null check(help_seeking between 1 and 5),
  task_completion smallint not null check(task_completion between 1 and 5),
  time_organization smallint not null check(time_organization between 1 and 5),
  total_score numeric(6,2) not null, -- يُحسب على الخادم فقط (src/lib/independence.ts) وليس هنا
  teacher_id uuid references teachers(id),
  notes text,
  created_at timestamptz default now()
);

-- معاملة واحدة ذرّية لتقييم كامل (أكاديمي + استقلالية + نقطة تتبع تقدّم).
-- إمّا تنجح الكتابات الثلاث معًا أو تفشل كلها (ROLLBACK تلقائي عند أي خطأ داخل الدالة).
-- SECURITY DEFINER لتجاوز RLS من داخل الدالة نفسها فقط — لكن EXECUTE محجوبة عن anon/authenticated
-- عمدًا أدناه؛ لا يستدعيها إلا route الخادم (src/app/api/assessment/submit) عبر service_role،
-- بعد أن يتحقق الـ route نفسه أن المعلم يملك هذا الطالب فعلًا ضمن مجموعاته.
create or replace function public.submit_assessment(
  p_child_id uuid,
  p_teacher_id uuid,
  p_assessment_type text,
  p_reading_level text,
  p_writing_spelling_level text,
  p_mathematics_level text,
  p_english_level text,
  p_focus_level text,
  p_independence_level text,
  p_teacher_notes text,
  p_task_management smallint,
  p_task_initiation smallint,
  p_help_seeking smallint,
  p_task_completion smallint,
  p_time_organization smallint,
  p_independence_total numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assessment_id uuid;
  v_reading_score smallint;
  v_writing_score smallint;
  v_math_score smallint;
  v_english_score smallint;
  v_focus_score smallint;
  v_independence_score smallint;
begin
  insert into assessments(
    child_id, teacher_id, assessment_type, reading_level, writing_spelling_level,
    mathematics_level, english_level, focus_level, independence_level, teacher_notes
  ) values (
    p_child_id, p_teacher_id, p_assessment_type, p_reading_level, p_writing_spelling_level,
    p_mathematics_level, p_english_level, p_focus_level, p_independence_level, p_teacher_notes
  ) returning id into v_assessment_id;

  if p_task_management is not null then
    insert into independence_assessments(
      child_id, teacher_id, task_management, task_initiation, help_seeking, task_completion,
      time_organization, total_score
    ) values (
      p_child_id, p_teacher_id, p_task_management, p_task_initiation, p_help_seeking,
      p_task_completion, p_time_organization, p_independence_total
    );
  end if;

  v_reading_score := case p_reading_level when 'needs_support' then 2 when 'age_appropriate' then 3 when 'advanced' then 5 else null end;
  v_writing_score := case p_writing_spelling_level when 'needs_support' then 2 when 'age_appropriate' then 3 when 'advanced' then 5 else null end;
  v_math_score := case p_mathematics_level when 'needs_support' then 2 when 'age_appropriate' then 3 when 'advanced' then 5 else null end;
  v_english_score := case p_english_level when 'needs_support' then 2 when 'age_appropriate' then 3 when 'advanced' then 5 else null end;
  v_focus_score := case p_focus_level when 'needs_support' then 2 when 'age_appropriate' then 3 when 'advanced' then 5 else null end;
  v_independence_score := case
    when p_independence_total is not null then round(p_independence_total / 100 * 5)
    else (case p_independence_level when 'needs_support' then 2 when 'age_appropriate' then 3 when 'advanced' then 5 else null end)
  end;

  insert into child_progress_snapshots(
    child_id, reading_score, writing_spelling_score, mathematics_score, english_score,
    focus_score, independence_score, source, created_by
  ) values (
    p_child_id, v_reading_score, v_writing_score, v_math_score, v_english_score,
    v_focus_score, v_independence_score, p_assessment_type, p_teacher_id
  );

  return v_assessment_id;
end;
$$;
revoke all on function public.submit_assessment(
  uuid, uuid, text, text, text, text, text, text, text, text,
  smallint, smallint, smallint, smallint, smallint, numeric
) from public, anon, authenticated;

-- Tomorrow Ready: توسيع daily_pulse_reports الحالي بدل استبداله (لا نكسر البيانات الحالية)
alter table daily_pulse_reports add column if not exists materials_ready boolean;
alter table daily_pulse_reports add column if not exists tomorrow_test_status text;
alter table daily_pulse_reports add column if not exists remaining_review text;
alter table daily_pulse_reports add column if not exists readiness_status text
  check(readiness_status in('ready','needs_light_review','needs_attention'));

-- ---------- Phase 4: Operations & Policies ----------
-- توسيع الحضور والجلسات بدل جداول موازية (إعادة استخدام حقيقي، لا تكرار بيانات)
alter table attendance add column if not exists reason text
  check(reason in('excused','unexcused','exceptional_approved'));
  -- ذات معنى فقط عندما status='absent'؛ لا قيمة له في present/late

alter table sessions add column if not exists cancelled_by text
  check(cancelled_by in('teacher','platform'));
  -- من تسبّب بالإلغاء عندما status='cancelled' — يفرّق بين مسؤولية المعلم/خُطى وبين غياب الطالب
alter table sessions add column if not exists makeup_eligible boolean not null default false;
  -- علم صريح على أي جلسة يمكن حجزها كتعويض — وليس ربطًا باسم يوم مثل "الخميس"؛ الإدارة تغيّر
  -- اليوم/الوقت/المجموعة بتغيير هذا العلم على الجلسات المناسبة، بلا أي تعديل كود.

-- رصيد الحصة التعويضية — دورة حياة كاملة وقابلة للتتبع
create table if not exists makeup_credits(
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  subscription_id uuid references subscriptions(id) on delete set null,
  source_session_id uuid references sessions(id) on delete set null,
  source_type text not null check(source_type in('student_absence','teacher_cancellation','platform_cancellation','manual_admin')),
  reason text,
  status text not null default 'available' check(status in('available','reserved','used','expired','cancelled')),
  issued_by uuid references auth.users(id),
  issued_at timestamptz default now(),
  expires_at timestamptz,
  redeemed_session_id uuid references sessions(id) on delete set null,
  redeemed_at timestamptz,
  unique(source_session_id, child_id) -- يمنع إصدار رصيدين لنفس (الطفل، جلسة الغياب/الإلغاء) بنيويًا
);
create index if not exists makeup_credits_child_idx on makeup_credits(child_id, status);

-- طلب تجميد الاشتراك — Workflow بحالة صريحة، وليس تعديلًا مباشرًا من ولي الأمر
create table if not exists subscription_pauses(
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  start_date date not null,
  end_date date not null,
  reason text,
  status text not null default 'requested' check(status in('requested','approved','rejected','active','completed','cancelled')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  check(end_date >= start_date)
);
create index if not exists subscription_pauses_sub_idx on subscription_pauses(subscription_id, status);

-- استرداد رصيد تعويضي كمعاملة ذرّية مقفولة بـ row-lock — يمنع الاستخدام المزدوج عند
-- الضغط المتكرر أو طلبات متزامنة على نفس الرصيد أو آخر مقعد في الجلسة.
create or replace function public.redeem_makeup_credit(p_credit_id uuid, p_session_id uuid, p_child_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credit record;
  v_session record;
  v_capacity integer;
  v_enrolled_count integer;
  v_used_makeup_count integer;
  v_child_already_enrolled boolean;
  v_total_occupied integer;
begin
  select * into v_credit from makeup_credits where id = p_credit_id for update;
  if v_credit is null then raise exception 'credit_not_found'; end if;
  if v_credit.child_id != p_child_id then raise exception 'credit_not_owned'; end if;
  if v_credit.status != 'available' then raise exception 'credit_not_available'; end if;
  if v_credit.expires_at is not null and v_credit.expires_at < now() then raise exception 'credit_expired'; end if;

  -- قفل صف الجلسة نفسها هو ما يسلسل أي طلبات متزامنة على نفس الجلسة — الطلب الثاني ينتظر
  -- حتى يُنهي الأول معاملته، فيرى العدد المحدَّث الصحيح قبل أن يقرر.
  select * into v_session from sessions where id = p_session_id for update;
  if v_session is null then raise exception 'session_not_found'; end if;
  if not v_session.makeup_eligible then raise exception 'session_not_eligible'; end if;
  if v_session.status != 'scheduled' then raise exception 'session_not_bookable'; end if;

  select capacity into v_capacity from cohorts where id = v_session.cohort_id;

  -- السعة الفعلية = الطلاب النشطون المسجَّلون أصلًا في هذه المجموعة + مقاعد التعويض المستخدَمة
  -- على هذه الجلسة تحديدًا فعلًا — وليس مقاعد التعويض وحدها كما كان سابقًا (كان يسمح بحجز
  -- مقاعد تعويض حتى امتلاء cohorts.capacity بالكامل بمعزل عن الطلاب الأصليين، أي Overbooking حقيقي).
  select count(*) into v_enrolled_count
    from subscriptions
    where cohort_id = v_session.cohort_id and status = 'active';

  select exists(
    select 1 from subscriptions
    where cohort_id = v_session.cohort_id and status = 'active' and child_id = p_child_id
  ) into v_child_already_enrolled;

  select count(*) into v_used_makeup_count
    from makeup_credits
    where redeemed_session_id = p_session_id and status = 'used';

  v_total_occupied := v_enrolled_count + v_used_makeup_count;
  -- لا نُضيف مقعدًا جديدًا للطفل إن كان أصلًا عضوًا نشطًا في نفس المجموعة (تجنّب Double-count)
  if not v_child_already_enrolled then
    v_total_occupied := v_total_occupied + 1;
  end if;

  if v_total_occupied > v_capacity then
    raise exception 'session_full';
  end if;

  update makeup_credits set status = 'used', redeemed_session_id = p_session_id, redeemed_at = now()
    where id = p_credit_id;
end;
$$;
revoke all on function public.redeem_makeup_credit(uuid, uuid, uuid) from public, anon, authenticated;

-- ---------- Seat Race Condition Fix ----------
-- التسجيل السابق كان "افحص المقاعد المتاحة → أدرج اشتراكًا" كخطوتين منفصلتين في TypeScript —
-- غير ذرّي: طلبان متزامنان على آخر مقعد قد ينجحان معًا فيتجاوز عدد المسجَّلين سعة المجموعة.
-- هذه الدالة تقفل صف المجموعة نفسها (for update)، فتُسلسِل أي محاولات تسجيل متزامنة عليها،
-- ثم تعيد فحص المقاعد من الصفر داخل نفس القفل قبل الإدراج — بنفس نمط redeem_makeup_credit
-- أعلاه تمامًا. لا تُستدعى إلا من /api/enroll بعد كل التحققات الأخرى (الصف، تطابق المرحلة،
-- حالة المجموعة، توافق الباقة).
create or replace function public.enroll_subscription_atomic(
  p_child_id uuid,
  p_parent_id uuid,
  p_plan_id text,
  p_cohort_id uuid
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
begin
  select * into v_cohort from cohorts where id = p_cohort_id for update;
  if v_cohort is null then
    raise exception 'cohort_not_found';
  end if;
  if v_cohort.status != 'open' then
    raise exception 'cohort_not_open';
  end if;

  select count(*) into v_taken
    from subscriptions
    where cohort_id = p_cohort_id and status in ('active', 'pending_payment');

  if v_taken >= v_cohort.capacity then
    raise exception 'cohort_full';
  end if;

  insert into subscriptions (child_id, parent_id, plan_id, cohort_id, status)
  values (p_child_id, p_parent_id, p_plan_id, p_cohort_id, 'pending_payment')
  returning id into v_subscription_id;

  return v_subscription_id;
end;
$$;
revoke all on function public.enroll_subscription_atomic(uuid, uuid, text, uuid) from public, anon, authenticated;

-- اعتماد/رفض طلب التجميد كمعاملة ذرّية واحدة: تحديث حالة الطلب وتمديد renewal_date (عند
-- الاعتماد) داخل نفس الدالة — لا يمكن أن ينجح أحدهما ويفشل الآخر (Rollback كامل تلقائي عند
-- أي خطأ). كانتا سابقًا عمليتين منفصلتين في كود الـ route، وهي بالضبط الحالة الممنوعة:
-- pause=approved بينما renewal_date لم تُمدَّد.
create or replace function public.review_subscription_pause(p_pause_id uuid, p_decision text, p_reviewer uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pause record;
  v_subscription record;
  v_duration_days integer;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'invalid_decision';
  end if;

  select * into v_pause from subscription_pauses where id = p_pause_id for update;
  if v_pause is null then raise exception 'pause_not_found'; end if;
  if v_pause.status != 'requested' then raise exception 'already_reviewed'; end if;

  select * into v_subscription from subscriptions where id = v_pause.subscription_id for update;
  if v_subscription is null then raise exception 'subscription_not_found'; end if;

  update subscription_pauses
    set status = p_decision, reviewed_by = p_reviewer, reviewed_at = now()
    where id = p_pause_id;

  if p_decision = 'approved' and v_subscription.renewal_date is not null then
    v_duration_days := (v_pause.end_date - v_pause.start_date) + 1;
    update subscriptions
      set renewal_date = v_subscription.renewal_date + v_duration_days
      where id = v_subscription.id;
  end if;
end;
$$;
revoke all on function public.review_subscription_pause(uuid, text, uuid) from public, anon, authenticated;

alter table makeup_credits enable row level security;
alter table subscription_pauses enable row level security;

-- ولي الأمر: قراءة فقط لأرصدة/طلبات تجميد أبنائه — لا كتابة مباشرة من المتصفح إطلاقًا
create policy "makeup_credits_of_own_children" on makeup_credits for select using (
  child_id in (select id from children where parent_id in (select id from parents where user_id = auth.uid()))
);
create policy "pauses_of_own_subscriptions" on subscription_pauses for select using (
  subscription_id in (
    select id from subscriptions where parent_id in (select id from parents where user_id = auth.uid())
  )
);
-- المعلم لا يقرأ رصيد التعويض أو التجميد إطلاقًا (لا حاجة تشغيلية له لذلك) — لا سياسة له هنا عمدًا.
-- كل الكتابة (إصدار/استرداد الرصيد، طلب/اعتماد التجميد) عبر API بمفتاح service_role بعد
-- تحقق كامل من العلاقة الفعلية — بنفس نمط بقية المشروع.
-- قناة مؤسسية مقيَّدة (ولي أمر ↔ معلم مسؤول عن الطفل تحديدًا) — ليست Chat عامة. كل Thread
-- يرتبط بعلاقة تسجيل فعلية حقيقية (طفل ← اشتراك فعّال ← مجموعة ← معلمها)، يُعاد التحقق منها
-- من الخادم عند الإنشاء، وليس مجرد IDs يرسلها العميل.
create table if not exists message_threads(
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  teacher_user_id uuid not null references auth.users(id) on delete cascade,
  cohort_id uuid references cohorts(id),
  status text not null default 'open' check(status in('open','closed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(child_id, teacher_user_id)
);

create table if not exists messages(
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references message_threads(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id),
  sender_role text not null check(sender_role in('parent','teacher')),
  body text not null check(char_length(body) > 0 and char_length(body) <= 4000),
  created_at timestamptz default now(),
  read_at timestamptz
);
create index if not exists messages_thread_idx on messages(thread_id, created_at);

alter table message_threads enable row level security;
alter table messages enable row level security;

-- قراءة فقط لأطراف المحادثة تحديدًا — لا Admin ضمنيًا، ولا مستخدم غير موثَّق
create policy "threads_of_parent" on message_threads for select using (parent_user_id = auth.uid());
create policy "threads_of_teacher" on message_threads for select using (teacher_user_id = auth.uid());
create policy "messages_of_thread_parent" on messages for select using (
  thread_id in (select id from message_threads where parent_user_id = auth.uid())
);
create policy "messages_of_thread_teacher" on messages for select using (
  thread_id in (select id from message_threads where teacher_user_id = auth.uid())
);

-- سياسة ضيقة إضافية: ولي الأمر يحتاج رؤية اسم المعلم في قائمة محادثاته فقط — وليس أي معلم آخر
create policy "teachers_visible_to_messaging_parents" on teachers for select using (
  user_id in (select teacher_user_id from message_threads where parent_user_id = auth.uid())
);

-- لا سياسات INSERT/UPDATE من المتصفح على message_threads/messages عمدًا: إنشاء المحادثة،
-- إرسال الرسالة، وتحديث read_at كلها عبر src/app/api/messages/** بعد إعادة تحقق كاملة من
-- العلاقة الفعلية (Parent → Child → Enrollment → Cohort → Teacher) على الخادم — تمامًا كنمط
-- /api/enroll و/api/session-report/submit الحاليين.

-- ---------- V3.1 Stabilization: حالة اختبار المستوى تصبح Server-owned بالكامل ----------
-- المتصفح لا يعود مصدر الحقيقة لـ history/answeredIds/targetDifficulty — الخادم يعيد بناءها
-- من هذين الجدولين في كل طلب submit، ولا يثق بأي شيء غير sessionId/questionId/selectedIndex.
create table if not exists level_test_sessions(
  id uuid primary key default gen_random_uuid(),
  track_id text not null check(track_id in('general','schools','business')),
  current_question_id text not null,
  target_difficulty smallint not null default 2,
  max_questions smallint not null,
  status text not null default 'active' check(status in('active','finished')),
  created_at timestamptz default now(),
  finished_at timestamptz
);

create table if not exists level_test_answers(
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references level_test_sessions(id) on delete cascade,
  question_id text not null,
  selected_index smallint not null,
  correct boolean not null,
  difficulty smallint not null,
  skill text not null,
  answered_at timestamptz default now(),
  unique(session_id, question_id) -- يمنع إعادة الإجابة على نفس السؤال داخل نفس الجلسة (replay)
);

-- RLS مفعّل بلا أي policy إطلاقًا: ممنوع تمامًا من anon/authenticated (SELECT/INSERT/UPDATE كلها).
-- الوصول الوحيد المسموح به service_role عبر src/app/api/level-test/* فقط.
alter table level_test_sessions enable row level security;
alter table level_test_answers enable row level security;

-- ---------- Phase 3A: Student Mode ----------
-- الطالب ليس له هوية Supabase Auth مستقلة (لا بريد/كلمة مرور). "مساحة الطالب" هي جلسة المتصفح
-- نفسها لولي الأمر، لكن مقيّدة بـ capability session عشوائية يتحقق منها الخادم في كل طلب —
-- لا نثق أبدًا بـ childId قادم من العميل؛ يُشتق فقط من هذا الجدول.
create table if not exists student_mode_sessions(
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,
  created_at timestamptz default now(),
  expires_at timestamptz not null,
  active boolean not null default true
);
-- RLS مفعّل بلا أي policy عامة — service_role فقط، بنفس نمط level_test_sessions أعلاه،
-- باستثناء سياسة قراءة ذاتية ضيقة تحتاجها middleware.ts للتحقق من صلاحية الجلسة بجلسة ولي
-- الأمر نفسها (بلا حاجة لـservice_role على Edge runtime) — قراءة الصف الخاص بك فقط، لا كتابة.
alter table student_mode_sessions enable row level security;
create policy "student_session_self_read" on student_mode_sessions for select using (auth.uid() = parent_user_id);
-- ملاحظة معمارية لمستقبل Child PIN: هذا الجدول لا يفترض آلية الدخول (OTP ولي الأمر اليوم) —
-- أي آلية دخول مستقبلية (PIN مثلًا) يمكنها إنشاء صف هنا بنفس الشكل دون أي تغيير على /student/*.

-- دالة آمنة لحساب المقاعد المتاحة في مجموعة، دون كشف صفوف الاشتراكات نفسها
create or replace function public.cohort_available_seats(p_cohort_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select c.capacity - count(s.id)
  from cohorts c
  left join subscriptions s
    on s.cohort_id = c.id and s.status in ('active','pending_payment')
  where c.id = p_cohort_id
  group by c.capacity;
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
    (c.capacity - count(s.id) filter (where s.status in ('active','pending_payment')))::integer as seats_available
  from cohorts c
  left join subscriptions s on s.cohort_id = c.id
  where c.status = 'open' and (p_product is null or c.product = p_product)
  group by c.id;
$$;
grant execute on function public.public_cohorts_catalog(text) to anon, authenticated;

-- =========================================================
-- Row Level Security — مفعّلة على كل الجداول من الآن (fail-closed)
-- =========================================================
alter table parents enable row level security;
alter table children enable row level security;
alter table plans enable row level security;
alter table teachers enable row level security;
alter table cohorts enable row level security;
alter table subscriptions enable row level security;
alter table sessions enable row level security;
alter table daily_pulse_reports enable row level security;
alter table recommendations enable row level security;
alter table premium_requests enable row level security;
alter table attendance enable row level security;
alter table daily_tasks enable row level security;
alter table learning_profiles enable row level security;
alter table payments enable row level security;
alter table teacher_availability enable row level security;

-- ---------- سياسات أساسية للوصول الذاتي + الكتالوج العام فقط ----------
-- (سياسات الإدارة والمعلمين الكاملة تُبنى لاحقًا مع نظام الأدوار Roles الكامل — بند Auth المتقدم)

-- كتالوج عام: أي زائر يقرأ الباقات (بيانات غير حساسة، مثل قائمة أسعار)
create policy "plans_public_read" on plans for select using (active = true);

-- ⚠️ V3.1: لا توجد سياسة SELECT عامة على جدول cohorts نفسه — RLS تحمي الصفوف وليس الأعمدة،
-- وأي سياسة عامة على الجدول كاملًا كانت ستكشف meeting_url لأي طلب مباشر لـ REST API بمفتاح anon
-- العام (المضمّن أصلًا في حزمة المتصفح)، بغضّ النظر عمّا يختاره كود Next.js من أعمدة.
-- الكتالوج العام يمر حصرًا عبر public_cohorts_catalog() أدناه، التي تُرجع أعمدة آمنة فقط.

-- ولي الأمر يدير صف نفسه فقط
create policy "parents_self_select" on parents for select using (auth.uid() = user_id);
create policy "parents_self_update" on parents for update using (auth.uid() = user_id);
create policy "parents_self_insert" on parents for insert with check (auth.uid() = user_id);

-- ولي الأمر يدير أبناءه فقط
create policy "children_of_own_parent" on children for all using (
  parent_id in (select id from parents where user_id = auth.uid())
) with check (
  parent_id in (select id from parents where user_id = auth.uid())
);

-- ولي الأمر يقرأ اشتراكاته وتقاريره ومهامه وحضوره فقط (قراءة فقط من المتصفح)
create policy "subscriptions_of_own_parent" on subscriptions for select using (
  parent_id in (select id from parents where user_id = auth.uid())
);
create policy "daily_pulse_of_own_children" on daily_pulse_reports for select using (
  child_id in (select id from children where parent_id in (select id from parents where user_id = auth.uid()))
);
create policy "attendance_of_own_children" on attendance for select using (
  child_id in (select id from children where parent_id in (select id from parents where user_id = auth.uid()))
);
create policy "daily_tasks_of_own_children" on daily_tasks for select using (
  child_id in (select id from children where parent_id in (select id from parents where user_id = auth.uid()))
);
create policy "learning_profiles_of_own_children" on learning_profiles for select using (
  child_id in (select id from children where parent_id in (select id from parents where user_id = auth.uid()))
);
create policy "recommendations_of_own_children" on recommendations for select using (
  child_id in (select id from children where parent_id in (select id from parents where user_id = auth.uid()))
);
create policy "payments_of_own_parent" on payments for select using (
  parent_id in (select id from parents where user_id = auth.uid())
);

-- ملاحظة مهمة: لا توجد سياسة INSERT/UPDATE على subscriptions أو payments من المتصفح عمدًا.
-- إنشاء/تفعيل الاشتراك والدفع يتم فقط عبر route handlers على الخادم باستخدام service_role key
-- (src/app/api/enroll و src/app/api/payment/confirm) — تمامًا كما كان موثّقًا في enroll/page.tsx الأصلية.

-- ---------- V2.2: سياسات المعلم (كانت الجداول التالية محظورة عليه بالكامل بعد تفعيل RLS) ----------
create policy "teachers_self_select" on teachers for select using (auth.uid() = user_id);

create policy "sessions_of_own_teacher" on sessions for select using (
  teacher_id in (select id from teachers where user_id = auth.uid())
);

create policy "cohorts_of_own_teacher" on cohorts for select using (
  teacher_id in (select id from teachers where user_id = auth.uid())
);

create policy "children_of_teacher_sessions" on children for select using (
  id in (
    select s.child_id from subscriptions s
    join cohorts c on c.id = s.cohort_id
    where c.teacher_id in (select id from teachers where user_id = auth.uid())
  )
);

create policy "subscriptions_of_own_teacher" on subscriptions for select using (
  cohort_id in (select id from cohorts where teacher_id in (select id from teachers where user_id = auth.uid()))
);

-- ---------- V2.2: ولي الأمر يقرأ جلسات ومجموعة أبنائه (لم تكن موجودة قبل هذا الباتش) ----------
create policy "sessions_of_own_children" on sessions for select using (
  cohort_id in (
    select cohort_id from subscriptions
    where parent_id in (select id from parents where user_id = auth.uid())
  )
);

create policy "cohorts_of_own_children" on cohorts for select using (
  id in (
    select cohort_id from subscriptions
    where parent_id in (select id from parents where user_id = auth.uid())
  )
);

-- جلسات التعويض قد تُستضاف في مجموعة لا يشترك فيها الطفل أصلًا (فترة/مجموعة تعويض مخصَّصة) —
-- أي مستخدم موثَّق (وليس anon) يرى فقط الجلسات المعلَّمة صراحةً makeup_eligible، لا كل الجلسات.
create policy "makeup_eligible_sessions_visible_to_authenticated" on sessions for select using (
  makeup_eligible = true and auth.uid() is not null
);

-- ---------- V3 Phase 2: RLS لجداول منهجية KHOTA ----------
alter table assessments enable row level security;
alter table weekly_goals enable row level security;
alter table child_progress_snapshots enable row level security;
alter table independence_assessments enable row level security;

-- ولي الأمر: قراءة فقط لبيانات أبنائه في كل جداول المتابعة الجديدة
create policy "assessments_of_own_children" on assessments for select using (
  child_id in (select id from children where parent_id in (select id from parents where user_id = auth.uid()))
);
create policy "weekly_goals_of_own_children" on weekly_goals for select using (
  child_id in (select id from children where parent_id in (select id from parents where user_id = auth.uid()))
);
create policy "progress_snapshots_of_own_children" on child_progress_snapshots for select using (
  child_id in (select id from children where parent_id in (select id from parents where user_id = auth.uid()))
);
create policy "independence_of_own_children" on independence_assessments for select using (
  child_id in (select id from children where parent_id in (select id from parents where user_id = auth.uid()))
);

-- المعلم: قراءة فقط لطلاب مجموعاته (نفس نمط children_of_teacher_sessions أعلاه)
create policy "assessments_of_teacher_students" on assessments for select using (
  child_id in (
    select s.child_id from subscriptions s join cohorts c on c.id = s.cohort_id
    where c.teacher_id in (select id from teachers where user_id = auth.uid())
  )
);
create policy "weekly_goals_of_teacher_students" on weekly_goals for select using (
  child_id in (
    select s.child_id from subscriptions s join cohorts c on c.id = s.cohort_id
    where c.teacher_id in (select id from teachers where user_id = auth.uid())
  )
);
create policy "progress_snapshots_of_teacher_students" on child_progress_snapshots for select using (
  child_id in (
    select s.child_id from subscriptions s join cohorts c on c.id = s.cohort_id
    where c.teacher_id in (select id from teachers where user_id = auth.uid())
  )
);
create policy "independence_of_teacher_students" on independence_assessments for select using (
  child_id in (
    select s.child_id from subscriptions s join cohorts c on c.id = s.cohort_id
    where c.teacher_id in (select id from teachers where user_id = auth.uid())
  )
);

-- لا سياسات INSERT/UPDATE من المتصفح على أي من هذه الجداول عمدًا — الكتابة عبر
-- /api/assessment/submit و /api/goals/submit فقط (service_role، بعد تحقق أن المعلم فعلًا
-- يملك هذا الطالب ضمن مجموعاته)، بنفس نمط /api/session-report/submit الحالي.
