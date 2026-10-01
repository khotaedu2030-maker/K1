-- يمنع أكثر من سجل دفع "paid" واحد بمزوّد manual-dev لنفس الاشتراك — يغلق Race Condition حقيقي
-- بين طلبين متزامنين لـ /api/payment/confirm (مسار Dev-only للتأكيد اليدوي) كانا قادرين سابقًا
-- على إنشاء سجلّي payments مدفوعين لنفس الاشتراك، لأن الإدخال كان غير مشروط بأي نتيجة ذرّية.
--
-- الحماية الفعلية من السباق انتقلت إلى src/lib/activate-subscription.ts عبر التحقق من عدد
-- الصفوف المتأثرة فعليًا بتحديث subscriptions.status (pending_payment → active، ذرّي بقفل صف
-- Postgres + إعادة تقييم WHERE عند التعارض). هذا القيد هنا خط دفاع أخير على مستوى القاعدة
-- نفسها، وليس بديلًا عن ذلك التحقق ولا اعتمادًا على فحص read-then-insert وحده.
--
-- لا يمس هذا الملف دفع Paylink الحقيقي (provider='paylink') بأي شكل — الفهرس مقصور صراحة على
-- provider='manual-dev'.

-- ---------- فحص آمن قبل إضافة القيد: لا يحذف ولا يدمج أي بيانات ----------
-- إن وُجدت بيانات manual-dev مكرَّرة فعليًا من قبل (بسبب هذا الخلل قبل إصلاحه)، نوقف الهجرة هنا
-- برسالة واضحة تُسمّي الاشتراكات المتأثرة تحديدًا، بدل فشل عام غامض من Postgres أو حذف/دمج صامت.
-- المراجعة اليدوية لهذه الحالات (إن وُجدت) مسؤولية منفصلة متعمَّدة بعد هذه الهجرة، وليست جزءًا
-- منها.
do $$
declare
  v_dupes text;
begin
  select string_agg(subscription_id::text, ', ')
  into v_dupes
  from (
    select subscription_id
    from public.payments
    where provider = 'manual-dev' and status = 'paid'
    group by subscription_id
    having count(*) > 1
  ) d;

  if v_dupes is not null then
    raise exception
      'manual_payment_idempotency: duplicate manual-dev paid payments exist for subscription_id(s): %. راجع هذه الصفوف يدويًا (ما الزائد فعليًا؟ هل تحتاج دمجًا أو حذفًا بعد تحقّق بشري؟) قبل إعادة تطبيق هذه الهجرة — لم تُحذف أو تُدمَج أي بيانات تلقائيًا هنا.',
      v_dupes;
  end if;
end $$;

create unique index if not exists uq_manual_dev_one_paid_per_subscription
on public.payments (subscription_id)
where provider = 'manual-dev' and status = 'paid';
