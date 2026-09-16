-- منع أكثر من محاولة دفع Paylink واحدة "pending" لنفس الاشتراك في وقت واحد.
-- يُغلق Race Condition حقيقي بين خطوتي "البحث عن pending" و"إنشاء pending" في
-- /api/payments/paylink/create (عمليتان منفصلتان في التطبيق، لا ذرّية بينهما بدون هذا القيد) —
-- طلبان متزامنان كانا قادرين على إنشاء فاتورتين لنفس الاشتراك.
--
-- Idempotent: create ... if not exists يجعل إعادة تشغيل هذه الهجرة آمنة.
-- لا تغيير على أي عمود أو جدول أو RLS — فهرس فريد جزئي (partial unique index) فقط.

create unique index if not exists uq_paylink_one_pending_per_subscription
on public.payments (subscription_id)
where provider = 'paylink' and status = 'pending';
