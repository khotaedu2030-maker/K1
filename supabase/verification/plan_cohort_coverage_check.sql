-- =========================================================
-- KHOTA — Plan × Grade-Band Coverage Verification
-- supabase/verification/plan_cohort_coverage_check.sql
-- =========================================================
-- استعلام قراءة فقط (بلا أي كتابة) — شغّله في Supabase SQL Editor للتحقق الفعلي من أن كل
-- تركيبة (product × plan_id × grade_band) الاثنتي عشرة المطلوبة تملك مجموعة واحدة على الأقل
-- بحالة 'open'. النتيجة المتوقَّعة: 12 صفًا بالضبط (أو أكثر لو وُجدت مجموعات إضافية)، بلا NULL
-- في عمود cohort_title لأي تركيبة.

with required_combinations(product, plan_id, grade_band) as (
  values
    ('motabaa','khota-2','1-3'), ('motabaa','khota-3','1-3'), ('motabaa','khota-4','1-3'),
    ('motabaa','khota-2','4-6'), ('motabaa','khota-3','4-6'), ('motabaa','khota-4','4-6'),
    ('focus_room','focus-2','7-9'), ('focus_room','focus-3','7-9'), ('focus_room','focus-4','7-9'),
    ('focus_room','focus-2','10-12'), ('focus_room','focus-3','10-12'), ('focus_room','focus-4','10-12')
)
select
  rc.product,
  rc.plan_id,
  rc.grade_band,
  c.id as cohort_id,
  c.title as cohort_title,
  c.days_of_week,
  c.start_time,
  c.end_time,
  c.status,
  c.capacity,
  case when c.id is null then '❌ MISSING — يحتاج seed' else '✅ موجودة' end as coverage_status
from required_combinations rc
left join cohorts c
  on c.product = rc.product
  and c.plan_id = rc.plan_id
  and c.grade_band = rc.grade_band
  and c.status = 'open'
order by rc.product, rc.grade_band, rc.plan_id;

-- تلخيص سريع: عدد التركيبات المفقودة (يجب أن يكون 0 بعد تشغيل ملفات seed الإصلاح)
-- select count(*) as missing_combinations from ( ... نفس الاستعلام أعلاه ... ) x where cohort_id is null;
