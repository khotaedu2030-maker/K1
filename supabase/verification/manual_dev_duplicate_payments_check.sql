-- تشخيصي فقط — قراءة بحتة، لا يعدّل أي بيانات، لم يُنفَّذ تلقائيًا.
-- يعرض أي اشتراك له أكثر من سجل دفع واحد مُسجَّل "paid" بمزوّد manual-dev (مسار Dev-only
-- اليدوي في /api/payment/confirm)، قبل تطبيق migrations/20261101_manual_payment_idempotency.sql
-- التي تضيف قيدًا فريدًا يمنع هذا مستقبلًا. شغّل هذا أولًا على أي بيئة قبل تطبيق تلك الهجرة.

select
  p.subscription_id,
  count(*)                                       as duplicate_paid_rows,
  array_agg(p.id order by p.created_at)          as payment_ids,
  array_agg(p.amount_sar order by p.created_at)  as amounts_sar,
  array_agg(p.paid_at order by p.created_at)     as paid_ats,
  sum(p.amount_sar)                              as total_amount_sar
from public.payments p
where p.provider = 'manual-dev' and p.status = 'paid'
group by p.subscription_id
having count(*) > 1
order by count(*) desc, p.subscription_id;
