-- ==========================================================================
-- 1) دالة مركزية واحدة لحساب "المقاعد المحتسَبة فعليًا" لمجموعة — بدل تكرار نفس المنطق في
-- أربعة أماكن (الدوال الثلاث + Admin route). صيغة الاحتساب النهائية:
--   status = 'active'
--   أو
--   status = 'pending_payment' AND (
--     created_at >= now() - 24h   -- الاشتراك نفسه حديث
--     OR EXISTS payment paylink pending حديث لهذا الاشتراك  -- محاولة دفع فعلية لا تزال جارية
--     حتى لو كان الاشتراك نفسه أقدم من 24 ساعة (مثلًا: تسجيل قديم، محاولة دفع جديدة أُنشئت أمس)
--   )
-- ==========================================================================
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
    );
$$;
revoke all on function public.cohort_occupied_seats(uuid) from public, anon, authenticated;
grant execute on function public.cohort_occupied_seats(uuid) to service_role;
-- ملاحظة: SECURITY DEFINER يجعلها تعمل بصلاحية مالكها بصرف النظر عمّن يستدعيها من الأدوار
-- المسموحة أعلاه، وهي لا تكشف بيانات — نتيجة عددية فقط.

-- ==========================================================================
-- 2) الدوال الثلاث الحالية — مُعدَّلة لتستخدم cohort_occupied_seats بدل تكرار الشرط.
-- ==========================================================================

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

  v_taken := public.cohort_occupied_seats(p_cohort_id);

  if v_taken >= v_cohort.capacity then
    raise exception 'cohort_full';
  end if;

  insert into subscriptions (child_id, parent_id, plan_id, cohort_id, status)
  values (p_child_id, p_parent_id, p_plan_id, p_cohort_id, 'pending_payment')
  returning id into v_subscription_id;

  return v_subscription_id;
end;
$$;

-- ==========================================================================
-- 3) RPC إداري ذرّي جديد — يستبدل نمط "JS يحسب occupied ثم update منفصل" (فيه نافذة سباق
-- نظرية بين القراءة والكتابة) بمعاملة واحدة: SELECT ... FOR UPDATE يقفل صف المجموعة فعليًا،
-- ثم يحسب المقاعد ويرفض/يحدِّث داخل نفس القفل — لا تسجيل متزامن يمكن أن "يفلت" بين الخطوتين.
-- service_role فقط (REVOKE من anon/authenticated) — الاستدعاء حصرًا من API بعد requireAdmin().
-- ==========================================================================
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

  -- الحساب والقفل معًا داخل نفس المعاملة — هذا هو الإصلاح الفعلي لسباق التسجيل المتزامن.
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
