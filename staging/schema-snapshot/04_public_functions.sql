-- Staging only. Database function DEFINITIONS from prod catalog, not data.
-- Validate EXECUTE grants independently before exposing any API endpoint.
BEGIN;
SET LOCAL check_function_bodies = off;
CREATE OR REPLACE FUNCTION public.activate_subscription_atomic(p_subscription_id uuid, p_start_date date, p_renewal_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.activate_subscription_manual_atomic(p_subscription_id uuid, p_start_date date, p_renewal_date date)
 RETURNS TABLE(ok boolean, already_active boolean, payment_id uuid, error_code text)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_sub record;
  v_plan_price numeric(10,2);
  v_existing_payment_id uuid;
  v_new_payment_id uuid;
begin
  select * into v_sub from public.subscriptions where id = p_subscription_id for update;

  if v_sub is null then
    return query select false, false, null::uuid, 'subscription_not_found'::text;
    return;
  end if;

  if v_sub.status in ('paused', 'cancelled', 'expired') then
    return query select false, false, null::uuid, 'invalid_status'::text;
    return;
  end if;

  if v_sub.status = 'active' then
    select id into v_existing_payment_id
    from public.payments
    where subscription_id = p_subscription_id and provider = 'manual-dev' and status = 'paid'
    limit 1;

    if v_existing_payment_id is not null then
      -- مفعَّل بالفعل عبر manual-dev تحديدًا — نجاح idempotent بلا أي كتابة إضافية.
      return query select true, true, v_existing_payment_id, null::text;
      return;
    end if;

    -- مفعَّل فعليًا، لكن ليس عبر manual-dev (على الأرجح Paylink) — لا نُنشئ دفعة يدوية بأثر
    -- رجعي لعملية لم تُنفَّذ عبر هذا المسار؛ تعارض واضح بدل نجاح أو كتابة مزيَّفة.
    return query select false, false, null::uuid, 'active_without_manual_payment'::text;
    return;
  end if;

  if v_sub.status <> 'pending_payment' then
    -- دفاعي فقط — كل حالات subscriptions.status المعروفة مُغطاة أعلاه صراحةً.
    return query select false, false, null::uuid, 'invalid_status'::text;
    return;
  end if;

  if p_start_date is null or p_renewal_date is null then
    return query select false, false, null::uuid, 'missing_dates'::text;
    return;
  end if;

  select price_sar into v_plan_price from public.plans where id = v_sub.plan_id;

  insert into public.payments (
    subscription_id, parent_id, amount_sar, status, provider, provider_ref, paid_at
  ) values (
    p_subscription_id, v_sub.parent_id, coalesce(v_plan_price, 0), 'paid', 'manual-dev', null, now()
  )
  returning id into v_new_payment_id;

  update public.subscriptions
  set status = 'active', start_date = p_start_date, renewal_date = p_renewal_date
  where id = p_subscription_id;

  return query select true, false, v_new_payment_id, null::text;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.activate_teacher_from_application_atomic(p_application_id uuid, p_actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.admin_cancel_makeup_credit_atomic(p_credit_id uuid, p_actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.admin_cancel_subscription_pause_atomic(p_pause_id uuid, p_actor uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.admin_change_role_atomic(p_target_admin_id uuid, p_new_role text, p_actor uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.admin_create_subscription_pause_atomic(p_subscription_id uuid, p_start_date date, p_end_date date, p_reason text, p_actor uuid, p_min_days integer, p_max_days integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.admin_issue_makeup_credit_atomic(p_child_id uuid, p_subscription_id uuid, p_source_session_id uuid, p_reason text, p_expires_at timestamp with time zone, p_issued_by uuid, p_monthly_limit integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.admin_override_attendance_atomic(p_session_id uuid, p_child_id uuid, p_new_status text, p_new_reason text, p_actor uuid, p_override_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.admin_set_active_atomic(p_target_admin_id uuid, p_active boolean, p_actor uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.admin_update_cohort_operations_atomic(p_cohort_id uuid, p_capacity smallint DEFAULT NULL::smallint, p_status text DEFAULT NULL::text, p_teacher_id uuid DEFAULT NULL::uuid, p_teacher_id_provided boolean DEFAULT false, p_meeting_url text DEFAULT NULL::text, p_meeting_url_provided boolean DEFAULT false)
 RETURNS TABLE(old_capacity smallint, new_capacity smallint, old_status text, new_status text, old_teacher_id uuid, new_teacher_id uuid, old_meeting_url text, new_meeting_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.admin_update_plan_atomic(p_plan_id text, p_name text DEFAULT NULL::text, p_name_provided boolean DEFAULT false, p_price_sar numeric DEFAULT NULL::numeric, p_price_provided boolean DEFAULT false, p_sessions_per_month smallint DEFAULT NULL::smallint, p_sessions_provided boolean DEFAULT false, p_days_per_week smallint DEFAULT NULL::smallint, p_days_provided boolean DEFAULT false, p_active boolean DEFAULT NULL::boolean, p_active_provided boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.admin_update_platform_settings(p_admin_user_id uuid, p_default_session_duration_minutes smallint, p_makeup_monthly_limit smallint, p_pause_min_days smallint, p_pause_max_days smallint, p_booking_window_days smallint, p_quiet_hours_start time without time zone, p_quiet_hours_end time without time zone, p_support_email text, p_support_phone text, p_registration_enabled boolean, p_seat_hold_hours smallint, p_attendance_lock_hours smallint, p_default_capacity_1_3 smallint, p_default_capacity_4_6 smallint, p_default_capacity_7_9 smallint, p_default_capacity_10_12 smallint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.cohort_available_seats(p_cohort_id uuid)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.capacity - public.cohort_occupied_seats(c.id)
  from cohorts c
  where c.id = p_cohort_id;
$function$
;

CREATE OR REPLACE FUNCTION public.cohort_occupied_seats(p_cohort_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.complete_cycle_atomic(p_cycle_id uuid, p_actor uuid, p_override boolean DEFAULT false, p_override_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.complete_payment_refund_atomic(p_refund_id uuid, p_processed_by uuid, p_provider_reference text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.consume_api_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
 RETURNS TABLE(allowed boolean, remaining integer, retry_after_seconds integer)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_expires_at timestamptz;
  v_count integer;
begin
  if p_key is null
    or length(p_key) < 1
    or length(p_key) > 160
    or p_key !~ '^[a-z0-9:_-]+$'
    or p_limit is null
    or p_limit < 1
    or p_limit > 100000
    or p_window_seconds is null
    or p_window_seconds < 1
    or p_window_seconds > 86400
  then
    return query select false, 0, 1;
    return;
  end if;

  v_window_start := to_timestamp(
    (floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds)::double precision
  );

  v_expires_at := v_window_start + p_window_seconds * interval '1 second';

  insert into public.api_rate_limits as current_bucket (
    key,
    window_start,
    count,
    expires_at,
    created_at,
    updated_at
  )
  values (
    p_key,
    v_window_start,
    1,
    v_expires_at,
    v_now,
    v_now
  )
  on conflict (key, window_start) do update
    set count = case
          when current_bucket.count < 2147483647
            then current_bucket.count + 1
          else current_bucket.count
        end,
        expires_at = excluded.expires_at,
        updated_at = clock_timestamp()
  returning current_bucket.count into v_count;

  return query
  select
    v_count <= p_limit,
    greatest(p_limit - v_count, 0),
    greatest(
      1,
      ceil(extract(epoch from (v_expires_at - clock_timestamp())))::integer
    );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.convert_contact_request_to_support_case_atomic(p_contact_request_id uuid, p_category text, p_priority text, p_actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_cohort_days_match_plan()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_expected_days smallint;
begin
  if new.plan_id is null then
    return new; -- مجموعات بلا خطة مرتبطة (English/قدرات القديمة) خارج نطاق هذا التحقق
  end if;

  select days_per_week into v_expected_days from plans where id = new.plan_id;

  if v_expected_days is not null and array_length(new.days_of_week, 1) is distinct from v_expected_days then
    raise exception 'cohort_days_mismatch: هذه المجموعة أيامها (%) لا تطابق عدد أيام باقتها (%) — راجع days_of_week وplan_id',
      coalesce(array_length(new.days_of_week, 1), 0), v_expected_days;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.enroll_subscription_atomic(p_child_id uuid, p_parent_id uuid, p_plan_id text, p_cohort_id uuid, p_plan_snapshot_name text, p_plan_snapshot_price_sar numeric, p_plan_snapshot_sessions_per_month smallint, p_plan_snapshot_days_per_week smallint)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.enroll_subscription_atomic(p_child_id uuid, p_parent_id uuid, p_plan_id text, p_cohort_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.override_readiness_blocker_atomic(p_blocker_key text, p_reason text, p_actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.public_cohorts_catalog(p_product text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, product text, plan_id text, grade_band text, title text, days_of_week smallint[], start_time time without time zone, end_time time without time zone, capacity smallint, seats_available integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    c.id, c.product, c.plan_id, c.grade_band, c.title, c.days_of_week, c.start_time, c.end_time, c.capacity,
    (c.capacity - public.cohort_occupied_seats(c.id))::integer as seats_available
  from cohorts c
  where c.status = 'open' and (p_product is null or c.product = p_product);
$function$
;

CREATE OR REPLACE FUNCTION public.redeem_makeup_credit(p_credit_id uuid, p_session_id uuid, p_child_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.request_recommendation_session_atomic(p_recommendation_id uuid, p_parent_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_child_parent_id uuid;
  v_child_name text;
  v_full_name text;
  v_phone text;
  v_subject text;
  v_reason text;
  v_status text;
  v_request_id uuid;
BEGIN
  SELECT
    c.parent_id,
    c.first_name,
    p.full_name,
    p.phone,
    r.subject,
    r.reason,
    r.status
  INTO
    v_child_parent_id,
    v_child_name,
    v_full_name,
    v_phone,
    v_subject,
    v_reason,
    v_status
  FROM public.recommendations AS r
  LEFT JOIN public.children AS c ON c.id = r.child_id
  LEFT JOIN public.parents AS p ON p.id = c.parent_id
  WHERE r.id = p_recommendation_id
  FOR UPDATE OF r;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'recommendation_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_child_parent_id IS DISTINCT FROM p_parent_id THEN
    RAISE EXCEPTION 'recommendation_not_owned' USING ERRCODE = 'P0001';
  END IF;

  IF v_status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'recommendation_not_open' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.premium_requests (
    product,
    full_name,
    phone,
    goal,
    status,
    source_recommendation_id
  )
  VALUES (
    'motabaa',
    v_full_name,
    v_phone,
    'جلسة تقوية فردية لـ'
      || CASE
           WHEN COALESCE(v_child_name, '') <> ''
             THEN ' ' || v_child_name
           ELSE ''
         END
      || ' — '
      || COALESCE(v_subject, '')
      || ': '
      || v_reason,
    'new',
    p_recommendation_id
  )
  RETURNING id INTO v_request_id;

  UPDATE public.recommendations
  SET status = 'actioned'
  WHERE id = p_recommendation_id;

  RETURN v_request_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.review_subscription_pause(p_pause_id uuid, p_decision text, p_reviewer uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.submit_assessment(p_child_id uuid, p_teacher_id uuid, p_assessment_type text, p_reading_level text, p_writing_spelling_level text, p_mathematics_level text, p_english_level text, p_focus_level text, p_independence_level text, p_teacher_notes text, p_task_management smallint, p_task_initiation smallint, p_help_seeking smallint, p_task_completion smallint, p_time_organization smallint, p_independence_total numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.sync_operational_exceptions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.transfer_subscription_cohort_atomic(p_subscription_id uuid, p_new_cohort_id uuid, p_actor uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.transition_operational_exception_atomic(p_exception_id uuid, p_action text, p_actor uuid, p_assigned_to uuid DEFAULT NULL::uuid, p_new_status text DEFAULT NULL::text, p_resolution_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.transition_payment_refund_nonfinancial_atomic(p_refund_id uuid, p_target_status text, p_processed_by uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.transition_support_case_atomic(p_case_id uuid, p_action text, p_actor uuid, p_assigned_to uuid DEFAULT NULL::uuid, p_new_status text DEFAULT NULL::text, p_resolution_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
COMMIT;
