-- تشخيصي فقط — قراءة بحتة، لا يعدّل أي بيانات، لم يُنفَّذ تلقائيًا.
-- يوضّح لماذا تظهر مجموعة معيَّنة "مكتملة" — بنفس المنطق الفعلي المُحدَّث لدالة
-- cohort_available_seats بعد هجرة 20260916_pending_payment_24h_expiry.sql (active، أو
-- pending_payment خلال آخر 24 ساعة فقط)، مع تفصيل كل اشتراك على حدة.

-- 1) ملخص لكل مجموعة: السعة، عدد المحتسَب فعليًا (بعد قاعدة 24 ساعة)، المقاعد المتاحة.
select
  c.id                          as cohort_id,
  c.title,
  c.grade_band,
  c.product,
  c.status,
  c.capacity,
  count(s.id) filter (where s.status = 'active' or (s.status = 'pending_payment' and s.created_at >= now() - interval '24 hours')) as counted_subscriptions,
  count(s.id) filter (where s.status = 'active')                                                                                    as active_subscriptions,
  count(s.id) filter (where s.status = 'pending_payment' and s.created_at >= now() - interval '24 hours')                           as pending_payment_within_24h,
  count(s.id) filter (where s.status = 'pending_payment' and s.created_at < now() - interval '24 hours')                            as pending_payment_older_than_24h,
  c.capacity - count(s.id) filter (where s.status = 'active' or (s.status = 'pending_payment' and s.created_at >= now() - interval '24 hours')) as seats_available
from cohorts c
left join subscriptions s on s.cohort_id = c.id
group by c.id, c.title, c.grade_band, c.product, c.status, c.capacity
order by seats_available asc, c.title;

-- 2) تفصيل كل اشتراك pending_payment أقدم من 24 ساعة تحديدًا — هذه لم تعد تُحتسَب ضد السعة
-- بعد الهجرة (بمجرد تطبيقها)، لكنها لا تزال بحالة pending_payment بقاعدة البيانات نفسها إلى
-- أن يُحدِّثها أحد المسارات (مثل /api/payments/paylink/create) أو SQL التنظيف اليدوي المنفصل.
select
  s.id                as subscription_id,
  s.cohort_id,
  c.title             as cohort_title,
  s.parent_id,
  p.full_name         as parent_name,
  p.email,
  s.created_at,
  now() - s.created_at as age
from subscriptions s
join cohorts c on c.id = s.cohort_id
join parents p on p.id = s.parent_id
where s.status = 'pending_payment' and s.created_at < now() - interval '24 hours'
order by s.created_at asc;
