-- تشخيصي فقط — قراءة بحتة، لا يعدّل أي بيانات، لم يُنفَّذ تلقائيًا.
-- يعرض كل رقم جوال له أكثر من صف parent واحد، مع تفاصيل كل صف لتقييم الحالة قبل أي قرار
-- (دمج يدوي، أو إضافة unique index على phone لاحقًا بعد التأكد من نظافة البيانات).

select
  p.phone,
  count(*)                                   as duplicate_rows,
  count(*) filter (where p.user_id is not null) as linked_rows,
  array_agg(p.id order by p.created_at)      as parent_ids,
  array_agg(p.user_id order by p.created_at) as user_ids,
  array_agg(p.created_at order by p.created_at) as created_ats,
  sum((select count(*) from children c where c.parent_id = p.id))      as total_children,
  sum((select count(*) from subscriptions s where s.parent_id = p.id)) as total_subscriptions,
  sum((select count(*) from payments pay where pay.parent_id = p.id))  as total_payments
from parents p
group by p.phone
having count(*) > 1
order by count(*) desc, p.phone;
