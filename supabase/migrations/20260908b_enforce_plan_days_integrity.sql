-- =========================================================
-- Migration: 20260908b_enforce_plan_days_integrity
-- P0: Plan → Days → Sessions scope
-- =========================================================
-- ROOT CAUSE (حقيقي، وليس افتراضيًا): كل جلسة تُولَّد من cohorts.days_of_week مباشرة
-- (/api/payment/confirm)، ولوحة ولي الأمر تعرض كل جلسات cohort الاشتراك (cohort_id فقط).
-- هذا صحيح ومتّسق **فقط إذا** كان cohorts.days_of_week يطابق دائمًا عدد أيام plans.days_per_week
-- الخاصة بنفس المجموعة — لكن **لا يوجد أي قيد أو تحقق يفرض هذا التطابق** في أي مكان. لو أُنشئت
-- مجموعة (يدويًا أو ببيانات مستقبلية) بـ plan_id يشير لخطة يومين لكن days_of_week=4 أيام،
-- سيرى ولي الأمر فعليًا 4 أيام رغم اشتراكه بخطة يومين — بالضبط السيناريو الموصوف.
--
-- الحل المختار (الأقل تغييرًا، الأكثر توافقًا): بما أن المعمارية الحالية أصلًا "مجموعة واحدة =
-- خطة واحدة محدَّدة" (لا مجموعة مشتركة بين عدة خطط)، الإصلاح الصحيح هو **فرض هذا التطابق فعليًا**
-- بدل الاعتماد الضمني عليه — وليس بناء علاقة subscription↔schedule جديدة (تغيير معماري أكبر
-- غير ضروري للنموذج الحالي). cohorts.days_of_week (بعد فرض التطابق) يبقى مصدر الحقيقة الوحيد
-- والآمن لجدول أي اشتراك، لأنه الآن مضمون التطابق مع خطته دائمًا.

create or replace function public.enforce_cohort_days_match_plan()
returns trigger
language plpgsql
as $$
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
$$;

drop trigger if exists trg_enforce_cohort_days_match_plan on cohorts;
create trigger trg_enforce_cohort_days_match_plan
  before insert or update of days_of_week, plan_id on cohorts
  for each row execute function public.enforce_cohort_days_match_plan();

-- تحقق فوري من كل بيانات Pilot الحالية — إن فشل هذا الاستعلام (نتيجة غير فارغة)، هناك مجموعة
-- فعلية غير متطابقة الآن ويجب إصلاحها يدويًا قبل الاعتماد على هذا القيد؛ الاستعلام هنا للمراجعة
-- فقط ولا يُغيّر أي بيانات.
-- select c.id, c.title, c.days_of_week, p.days_per_week
-- from cohorts c join plans p on p.id = c.plan_id
-- where array_length(c.days_of_week,1) is distinct from p.days_per_week;
