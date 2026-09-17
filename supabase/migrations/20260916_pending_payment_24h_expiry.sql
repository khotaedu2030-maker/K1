-- انتهاء صلاحية حجز المقعد لاشتراكات pending_payment بعد 24 ساعة — يتوافق مع إلغاء Paylink
-- التلقائي لفواتير Pending بعد نفس المدة. قبل هذه الهجرة، محاولة تسجيل مهجورة (مُلئ النموذج،
-- لم يُكمَل الدفع) كانت تحجز مقعدًا إلى الأبد بلا أي انتهاء صلاحية.
--
-- لا تغيير على active subscriptions إطلاقًا. Idempotent عبر create or replace.
-- هذه الهجرة تُحدِّث الدوال الثلاث فقط — لا تغيير على أي جدول أو بيانات.

create or replace function public.cohort_available_seats(p_cohort_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select c.capacity - count(s.id)
  from cohorts c
  left join subscriptions s
    on s.cohort_id = c.id
    and (s.status = 'active' or (s.status = 'pending_payment' and s.created_at >= now() - interval '24 hours'))
  where c.id = p_cohort_id
  group by c.capacity;
$$;

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
    (c.capacity - count(s.id) filter (
      where s.status = 'active' or (s.status = 'pending_payment' and s.created_at >= now() - interval '24 hours')
    ))::integer as seats_available
  from cohorts c
  left join subscriptions s on s.cohort_id = c.id
  where c.status = 'open' and (p_product is null or c.product = p_product)
  group by c.id;
$$;

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
    where cohort_id = p_cohort_id
      and (status = 'active' or (status = 'pending_payment' and created_at >= now() - interval '24 hours'));

  if v_taken >= v_cohort.capacity then
    raise exception 'cohort_full';
  end if;

  insert into subscriptions (child_id, parent_id, plan_id, cohort_id, status)
  values (p_child_id, p_parent_id, p_plan_id, p_cohort_id, 'pending_payment')
  returning id into v_subscription_id;

  return v_subscription_id;
end;
$$;
