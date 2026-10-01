-- دالة RPC ذرّية واحدة تُنفِّذ تفعيل الاشتراك اليدوي (manual-dev، مسار Dev-only في
-- /api/payment/confirm) بالكامل داخل معاملة Postgres واحدة: قفل صف الاشتراك، التحقق من حالته،
-- إدخال سجل الدفع، وتحديث حالة الاشتراك — إمّا تنجح كل الخطوات معًا أو يحدث ROLLBACK كامل
-- تلقائيًا. تستبدل هذه الدالة ثنائية "تحديث الاشتراك" ثم "إدخال الدفع" المنفصلة سابقًا في
-- src/lib/activate-subscription.ts، التي كانت تسمح نظريًا بفشل الخطوة الثانية بعد نجاح الأولى
-- (اشتراك active بلا أي سجل دفع، ولا طريقة لاحقة لإصلاحه تلقائيًا لمسار manual-dev تحديدًا، إذ
-- لا paymentId معروفًا يُصالَح به كما في مسار Paylink).
--
-- أمان الصلاحيات (SECURITY INVOKER وليس DEFINER — قرار مقصود، ليس إغفالًا):
-- EXECUTE مقصور على service_role فقط (مُلغًى صراحة عن public/anon/authenticated أدناه).
-- service_role هو نفسه من ينفّذ اليوم .update()/.insert() المباشرَين على نفس هذين الجدولين من
-- TypeScript (عبر createSupabaseAdminClient())، أي أنه يملك فعليًا صلاحيات DML مباشرة كافية على
-- subscriptions/payments بدون أي SECURITY DEFINER. لا توجد هنا حاجة موثَّقة لتشغيل الدالة
-- بصلاحيات مالكها (عادة دور أعلى امتيازًا من service_role نفسه) — استخدام SECURITY DEFINER هنا
-- كان سيُضيف سطح هجوم (تصعيد صلاحيات) دون أي فائدة وظيفية فعلية، فاستُبعِد عمدًا.
-- search_path يُضبَط صراحةً + كل الأسماء مؤهَّلة بـ public. صراحة دفاعًا إضافيًا مستقلًا عن ذلك.

create or replace function public.activate_subscription_manual_atomic(
  p_subscription_id uuid,
  p_start_date date,
  p_renewal_date date
)
returns table (
  ok boolean,
  already_active boolean,
  payment_id uuid,
  error_code text
)
language plpgsql
set search_path = pg_catalog, public
as $$
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
$$;

revoke all on function public.activate_subscription_manual_atomic(uuid, date, date)
from public, anon, authenticated;
grant execute on function public.activate_subscription_manual_atomic(uuid, date, date)
to service_role;
