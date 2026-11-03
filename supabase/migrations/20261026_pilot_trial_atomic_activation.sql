-- KHOTA: scoped no-fee pilot grant. The procedure is deliberately not a
-- "manual payment": no payment row, provider reference, or paid status is made.
-- Requires service_role caller and ALSO checks the recorded active super_admin.
-- Every mutation (sessions, subscription, audit) commits or rolls back together.
create or replace function public.activate_pilot_trial_atomic(
  p_subscription_id uuid,
  p_admin_user_id uuid,
  p_reason text,
  p_start_date date,
  p_renewal_date date,
  p_sessions jsonb
)
returns table (
  ok boolean,
  already_active boolean,
  error_code text,
  sessions_created integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sub public.subscriptions%rowtype;
  v_cohort public.cohorts%rowtype;
  v_plan public.plans%rowtype;
  v_rows integer;
  v_bad integer;
  v_pilots integer;
  v_seats integer;
  v_now date := (now() at time zone 'Asia/Riyadh')::date;
begin
  -- Advisory transaction lock serializes the global 20-student trial quota.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('khota_pilot_trial_max_20'));

  if not exists(
    select 1 from public.admins a where a.user_id = p_admin_user_id
      and a.active = true and a.role = 'super_admin'
  ) then
    return query select false,false,'not_authorized'::text,0; return;
  end if;
  if p_reason is null or length(trim(p_reason)) < 20 or length(p_reason) > 500 then
    return query select false,false,'invalid_reason'::text,0; return;
  end if;

  select * into v_sub from public.subscriptions where id=p_subscription_id for update;
  if not found then
    return query select false,false,'not_found'::text,0; return;
  end if;
  if v_sub.status='active' then
    if exists(select 1 from public.admin_actions a where a.action='pilot_trial_activation'
      and a.entity_type='subscription' and a.entity_id=p_subscription_id::text) then
      return query select true,true,null::text,0; return;
    end if;
    return query select false,false,'already_active_non_pilot'::text,0; return;
  end if;
  if v_sub.status is distinct from 'pending_payment' then
    return query select false,false,'invalid_status'::text,0; return;
  end if;
  if v_sub.hold_expires_at is not null and v_sub.hold_expires_at <= now() then
    return query select false,false,'expired_hold'::text,0; return;
  end if;
  if v_sub.cohort_id is null or v_sub.child_id is null then
    return query select false,false,'missing_cohort_child'::text,0; return;
  end if;
  if not exists(select 1 from public.children ch where ch.id=v_sub.child_id
    and ch.parent_id=v_sub.parent_id) then
    return query select false,false,'child_parent_mismatch'::text,0; return;
  end if;

  select * into v_cohort from public.cohorts where id=v_sub.cohort_id for update;
  if not found or v_cohort.status <> 'open' then
    return query select false,false,'cohort_unavailable'::text,0; return;
  end if;
  select * into v_plan from public.plans where id=v_sub.plan_id;
  if not found or v_plan.active is distinct from true
    or v_plan.id is distinct from v_cohort.plan_id or v_plan.product <> 'motabaa'
    or v_cohort.product <> v_plan.product
    or coalesce(v_plan.days_per_week,-1) <> coalesce(array_length(v_cohort.days_of_week,1),0) then
    return query select false,false,'invalid_plan'::text,0; return;
  end if;
  if v_cohort.teacher_id is null or not exists(
    select 1 from public.teachers t where t.id=v_cohort.teacher_id and t.active=true
  ) then
    return query select false,false,'teacher_not_ready'::text,0; return;
  end if;
  if v_cohort.meeting_url is null or v_cohort.meeting_url !~
    '^https://(teams\.microsoft\.com|teams\.live\.com)/' then
    return query select false,false,'teams_link_missing'::text,0; return;
  end if;

  select count(*) into v_pilots from public.admin_actions a
    where a.action='pilot_trial_activation' and a.entity_type='subscription';
  if v_pilots >= 20 then
    return query select false,false,'pilot_quota_full'::text,0; return;
  end if;
  select public.cohort_available_seats(v_sub.cohort_id) into v_seats;
  if v_seats is null or v_seats < 0 then
    return query select false,false,'cohort_full'::text,0; return;
  end if;

  if p_start_date <> v_now or p_renewal_date is null
    or p_renewal_date <= p_start_date or p_renewal_date > p_start_date + 32
    or jsonb_typeof(p_sessions) is distinct from 'array'
    or jsonb_array_length(p_sessions) not between 1 and 20 then
    return query select false,false,'invalid_schedule'::text,0; return;
  end if;

  with records as (
    select * from jsonb_to_recordset(p_sessions) as j(
      cohort_id uuid,teacher_id uuid,session_date date,
      starts_at timestamptz,ends_at timestamptz,meeting_url text,status text
    )
  )
  select count(*) into v_bad from records r where
    r.cohort_id is distinct from v_sub.cohort_id
    or r.teacher_id is distinct from v_cohort.teacher_id
    or r.status is distinct from 'scheduled'
    or r.meeting_url is distinct from v_cohort.meeting_url
    or r.starts_at is null or r.ends_at is null
    or r.ends_at <= r.starts_at
    or r.session_date is distinct from (r.starts_at at time zone 'Asia/Riyadh')::date
    or r.session_date < p_start_date or r.session_date > p_renewal_date
    or (r.starts_at at time zone 'Asia/Riyadh')::time <> v_cohort.start_time
    or (r.ends_at at time zone 'Asia/Riyadh')::time <> v_cohort.end_time
    or not (extract(isodow from (r.starts_at at time zone 'Asia/Riyadh'))::int
      = any(v_cohort.days_of_week));

  if v_bad > 0 then
    return query select false,false,'invalid_schedule_rows'::text,0; return;
  end if;
  select count(*) into v_rows from (
    select distinct j.starts_at
    from jsonb_to_recordset(p_sessions) as j(starts_at timestamptz)
  ) uniq;
  if v_rows <> jsonb_array_length(p_sessions) then
    return query select false,false,'duplicate_schedule'::text,0; return;
  end if;

  -- All writes below are part of the same PostgreSQL transaction.
  insert into public.sessions
    (cohort_id,teacher_id,session_date,starts_at,ends_at,meeting_url,status)
  select j.cohort_id,j.teacher_id,j.session_date,j.starts_at,j.ends_at,j.meeting_url,j.status
  from jsonb_to_recordset(p_sessions) as j(
    cohort_id uuid,teacher_id uuid,session_date date,
    starts_at timestamptz,ends_at timestamptz,meeting_url text,status text
  )
  on conflict (cohort_id,starts_at) do nothing;

  update public.subscriptions
    set status='active',start_date=p_start_date,renewal_date=p_renewal_date,
        hold_expires_at=null
    where id=p_subscription_id and status='pending_payment';

  if not found then
    raise exception 'Concurrent pilot subscription state conflict';
  end if;

  insert into public.admin_actions
    (admin_user_id,action,entity_type,entity_id,old_value,new_value,reason)
  values (
    p_admin_user_id,'pilot_trial_activation','subscription',p_subscription_id::text,
    jsonb_build_object('status','pending_payment'),
    jsonb_build_object('status','active','entitlement','free_pilot_trial',
      'paid',false,'start_date',p_start_date,'renewal_date',p_renewal_date,
      'scheduled_sessions',jsonb_array_length(p_sessions)),
    trim(p_reason)
  );

  return query select true,false,null::text,jsonb_array_length(p_sessions);
end;
$$;

-- Fail closed at the Data API. Only our server's service_role client can RPC.
revoke all on function public.activate_pilot_trial_atomic(uuid,uuid,text,date,date,jsonb)
  from public,anon,authenticated;
grant execute on function public.activate_pilot_trial_atomic(uuid,uuid,text,date,date,jsonb)
  to service_role;
