-- اختبار تكاملي آمن لـ public.activate_subscription_manual_atomic() — بالكامل داخل
-- BEGIN...ROLLBACK، لا يترك أي بيانات أو تغييرات دائمة، ولا يلمس أي صف حقيقي موجود (كل البيانات
-- التجريبية هنا جديدة تمامًا بمعرّفات عشوائية، ثم تُلغى بالكامل في نهاية الملف).
--
-- للتشغيل اليدوي فقط على بيئة dev/staging (SQL Editor أو psql) — لم يُطبَّق هنا ولن يُطبَّق على
-- Supabase الحية ضمن هذه المهمة. أي RAISE EXCEPTION أدناه يعني فشل الاختبار؛ "COMMIT" غير
-- موجود إطلاقًا في هذا الملف عمدًا — فقط ROLLBACK، حتى لو نجحت كل الفحوص.

begin;

-- ---------- 1–4: التفعيل العادي، إعادة المحاولة، والتحقق من كل شرط ----------
do $$
declare
  v_parent_id uuid;
  v_plan_id text := 'test-manual-dev-plan-' || replace(gen_random_uuid()::text, '-', '');
  v_plan_price numeric(10,2) := 123.45;
  v_subscription_id uuid;
  v_result record;
  v_sub_status text;
  v_payment_count int;
begin
  -- بيانات تجريبية بالحد الأدنى الإلزامي فقط: parent + plan + subscription (بلا cohort_id —
  -- الدالة الذرّية لا تقرأ/تكتب cohorts أو sessions إطلاقًا، فلا حاجة لها هنا).
  insert into public.parents (full_name, phone)
  values ('RPC Test Parent', '0500000000')
  returning id into v_parent_id;

  insert into public.plans (id, product, name, price_sar, active)
  values (v_plan_id, 'motabaa', 'RPC Test Plan', v_plan_price, true);

  insert into public.subscriptions (parent_id, plan_id, status)
  values (v_parent_id, v_plan_id, 'pending_payment')
  returning id into v_subscription_id;

  -- (2) استدعاء الدالة الذرّية على اشتراك pending_payment
  select * into v_result
  from public.activate_subscription_manual_atomic(v_subscription_id, current_date, (current_date + interval '1 month')::date)
  limit 1;

  -- (3) التحقق من كل شرط مطلوب
  if not v_result.ok then
    raise exception 'test1 FAILED: expected ok=true on first activation, got %', v_result;
  end if;
  if v_result.already_active then
    raise exception 'test1 FAILED: expected already_active=false on first activation';
  end if;
  if v_result.payment_id is null then
    raise exception 'test1 FAILED: expected a non-null payment_id on first activation';
  end if;

  select status into v_sub_status from public.subscriptions where id = v_subscription_id;
  if v_sub_status is distinct from 'active' then
    raise exception 'test1 FAILED: expected subscription status=active, got %', v_sub_status;
  end if;

  select count(*) into v_payment_count from public.payments where subscription_id = v_subscription_id;
  if v_payment_count <> 1 then
    raise exception 'test1 FAILED: expected exactly 1 payment row, found %', v_payment_count;
  end if;

  perform 1 from public.payments
  where subscription_id = v_subscription_id
    and provider = 'manual-dev'
    and status = 'paid'
    and amount_sar = v_plan_price;
  if not found then
    raise exception 'test1 FAILED: payment row does not match expected provider=manual-dev / status=paid / amount_sar=%', v_plan_price;
  end if;

  raise notice 'test1 PASS: pending_payment -> active + exactly one manual-dev paid payment matching plan price';

  -- (4) إعادة الاستدعاء على نفس الاشتراك — يجب أن يعيد already_active=true بلا أي كتابة إضافية
  select * into v_result
  from public.activate_subscription_manual_atomic(v_subscription_id, current_date, (current_date + interval '1 month')::date)
  limit 1;

  if not v_result.ok or not v_result.already_active then
    raise exception 'test2 FAILED: expected ok=true already_active=true on retry, got %', v_result;
  end if;

  select count(*) into v_payment_count from public.payments where subscription_id = v_subscription_id;
  if v_payment_count <> 1 then
    raise exception 'test2 FAILED: payment count changed on retry (expected still 1, got %)', v_payment_count;
  end if;

  raise notice 'test2 PASS: retry after success -> already_active=true, payment count unchanged';

  -- (5) active بلا سجل manual-dev مدفوع (مثلًا فُعِّل عبر Paylink أو مسار آخر) — تعارض صريح،
  -- لا دفعة يدوية بأثر رجعي.
  declare
    v_sub_active_no_manual_id uuid;
  begin
    insert into public.subscriptions (parent_id, plan_id, status)
    values (v_parent_id, v_plan_id, 'active')
    returning id into v_sub_active_no_manual_id;

    select * into v_result
    from public.activate_subscription_manual_atomic(v_sub_active_no_manual_id, current_date, (current_date + interval '1 month')::date)
    limit 1;

    if v_result.ok or v_result.error_code is distinct from 'active_without_manual_payment' then
      raise exception 'test3 FAILED: expected ok=false error_code=active_without_manual_payment, got %', v_result;
    end if;

    select count(*) into v_payment_count from public.payments where subscription_id = v_sub_active_no_manual_id;
    if v_payment_count <> 0 then
      raise exception 'test3 FAILED: a retroactive payment row was fabricated, count=%', v_payment_count;
    end if;
  end;
  raise notice 'test3 PASS: active without manual-dev payment -> explicit conflict, no retroactive payment created';

  -- (6) paused / cancelled / expired — كلها مرفوضة دائمًا بـinvalid_status
  declare
    v_sub_paused_id uuid;
    v_sub_cancelled_id uuid;
    v_sub_expired_id uuid;
  begin
    insert into public.subscriptions (parent_id, plan_id, status) values (v_parent_id, v_plan_id, 'paused')
      returning id into v_sub_paused_id;
    select * into v_result from public.activate_subscription_manual_atomic(v_sub_paused_id, current_date, (current_date + interval '1 month')::date) limit 1;
    if v_result.ok or v_result.error_code is distinct from 'invalid_status' then
      raise exception 'test4(paused) FAILED: expected ok=false error_code=invalid_status, got %', v_result;
    end if;

    insert into public.subscriptions (parent_id, plan_id, status) values (v_parent_id, v_plan_id, 'cancelled')
      returning id into v_sub_cancelled_id;
    select * into v_result from public.activate_subscription_manual_atomic(v_sub_cancelled_id, current_date, (current_date + interval '1 month')::date) limit 1;
    if v_result.ok or v_result.error_code is distinct from 'invalid_status' then
      raise exception 'test4(cancelled) FAILED: expected ok=false error_code=invalid_status, got %', v_result;
    end if;

    insert into public.subscriptions (parent_id, plan_id, status) values (v_parent_id, v_plan_id, 'expired')
      returning id into v_sub_expired_id;
    select * into v_result from public.activate_subscription_manual_atomic(v_sub_expired_id, current_date, (current_date + interval '1 month')::date) limit 1;
    if v_result.ok or v_result.error_code is distinct from 'invalid_status' then
      raise exception 'test4(expired) FAILED: expected ok=false error_code=invalid_status, got %', v_result;
    end if;
  end;
  raise notice 'test4 PASS: paused/cancelled/expired all rejected with error_code=invalid_status';
end;
$$;

-- ---------- 7: فحص بنيوي للصلاحيات عبر الكتالوج — بلا SET ROLE، لا يعتمد على من يُشغِّل الملف ----------
do $$
declare
  v_func_oid oid;
  v_anon_has boolean;
  v_authenticated_has boolean;
  v_service_role_has boolean;
begin
  select p.oid into v_func_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'activate_subscription_manual_atomic';

  if v_func_oid is null then
    raise exception 'permissions test FAILED: function public.activate_subscription_manual_atomic not found — هل طُبِّقت migrations/20261102_manual_payment_activate_atomic.sql؟';
  end if;

  select has_function_privilege('anon', v_func_oid, 'EXECUTE') into v_anon_has;
  select has_function_privilege('authenticated', v_func_oid, 'EXECUTE') into v_authenticated_has;
  select has_function_privilege('service_role', v_func_oid, 'EXECUTE') into v_service_role_has;

  if v_anon_has then
    raise exception 'permissions test FAILED: anon يملك EXECUTE على الدالة (يجب ألا يملكها)';
  end if;
  if v_authenticated_has then
    raise exception 'permissions test FAILED: authenticated يملك EXECUTE على الدالة (يجب ألا يملكها)';
  end if;
  if not v_service_role_has then
    raise exception 'permissions test FAILED: service_role لا يملك EXECUTE على الدالة (يجب أن يملكها)';
  end if;

  raise notice 'test5 PASS: anon/authenticated بلا EXECUTE، service_role يملك EXECUTE';
  raise notice '=== ALL ASSERTIONS PASSED ===';
end;
$$;

-- لا COMMIT إطلاقًا في هذا الملف — كل البيانات أعلاه (parent/plan/subscriptions/payments
-- التجريبية) تُلغى هنا نهائيًا، بصرف النظر عن نجاح كل الفحوص أعلاه أو فشلها.
rollback;
