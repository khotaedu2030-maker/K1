-- =========================================================
-- Migration: 20260906_multi_stage_support
-- KHOTA V3 — دعم Multi-Stage Pilot (Focus Room 7-12) + إصلاح Seat Race Condition
-- =========================================================
-- آمن للتطبيق على قاعدة قائمة ببيانات فعلية: كل قيمة grade/grade_band/product حالية
-- (1-6، 1-3/4-6، motabaa/english/qudurat) تبقى صالحة تمامًا تحت القيود الموسَّعة أدناه —
-- هذا توسيع نطاق فقط، لا تضييق، فلا خطر على أي صف موجود مسبقًا.
--
-- ملاحظة: أسماء القيود أدناه (`..._check`) هي التسمية التلقائية القياسية لـ Postgres لقيد
-- CHECK معرَّف Inline. تحقّق من الاسم الفعلي في مشروعك قبل التنفيذ إن اختلف:
--   select conname from pg_constraint where conrelid = 'children'::regclass;

-- ---------- 1) توسيع نطاق الصفوف: children.grade من 1-6 إلى 1-12 ----------
alter table children drop constraint if exists children_grade_check;
alter table children add constraint children_grade_check check (grade between 1 and 12);

-- ---------- 2) توسيع مراحل المجموعات: cohorts.grade_band بإضافة 7-9 و10-12 ----------
alter table cohorts drop constraint if exists cohorts_grade_band_check;
alter table cohorts add constraint cohorts_grade_band_check
  check (grade_band in ('1-3', '4-6', '7-9', '10-12'));

-- ---------- 3) إضافة منتج جديد: plans.product بإضافة focus_room ----------
alter table plans drop constraint if exists plans_product_check;
alter table plans add constraint plans_product_check
  check (product in ('motabaa', 'english', 'qudurat', 'focus_room'));

-- ---------- 4) cohorts.capacity ----------
-- لا قيد CHECK موجود أصلًا على هذا العمود (smallint not null فقط، بلا حد أعلى/أدنى) —
-- السعات المعتمدة حاليًا (1-3=3، 4-6=4، 7-12=5 افتراضيًا) صالحة بالفعل بلا أي تعديل.
-- لا يوجد سبب تقني موثَّق لإضافة سقف صناعي (مثل 8) الآن — تُرك العمود كما هو عمدًا.

-- ---------- 5) Seed: خطط Focus Room الأساسية (بلا تسعير معتمد) ----------
-- price_sar = null، active = false عمدًا: يمنع الظهور في الكتالوج العام (plans_public_read)
-- ويمنع /api/enroll من قبول اشتراك بها حتى يُعتمَد السعر ويُفعَّل الحقل يدويًا لاحقًا.
insert into plans (id, product, name, sessions_per_month, days_per_week, day_patterns, price_sar, active) values
  ('focus-2', 'focus_room', 'Focus Room — يومان أسبوعيًا', 8, 2, '{}', null, false),
  ('focus-3', 'focus_room', 'Focus Room — 3 أيام أسبوعيًا', 12, 3, '{}', null, false),
  ('focus-4', 'focus_room', 'Focus Room — 4 أيام أسبوعيًا', 16, 4, '{}', null, false)
on conflict (id) do nothing;

-- ---------- 6) إصلاح Seat Race Condition ----------
-- المسار السابق: "افحص المقاعد المتاحة (SELECT) → أدرج اشتراكًا (INSERT)" كخطوتين منفصلتين
-- في كود التطبيق — غير ذرّي. هذه الدالة تُنفِّذ الاثنين كوحدة معاملة واحدة، مع قفل صف
-- المجموعة (for update) يُسلسِل أي طلبات تسجيل متزامنة عليها قبل إعادة فحص المقاعد.
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
