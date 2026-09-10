-- =========================================================
-- Migration: 20260908_fix_duplicate_sessions
-- ROOT CAUSE: /api/payment/confirm يولّد جلسات شهر كامل لكل اشتراك يُفعَّل. الحماية الوحيدة
-- كانت "لا تُعِد التوليد لنفس الاشتراك إن كان active بالفعل" — لكن عندما يشترك طفلان مختلفان
-- (اشتراكان مختلفان) في نفس المجموعة (نفس cohort_id)، كل تأكيد دفع منفصل يُولِّد شهرًا كاملًا
-- من جلسات تلك المجموعة من جديد، فتتكرر كل جلسات الشهر (وليس تاريخًا واحدًا عشوائيًا) — يطابق
-- تمامًا العرض المُلاحَظ (8 سبتمبر، 13، 15، 4 أكتوبر، 6 أكتوبر... كلها مكرَّرة معًا).
-- لا يوجد قيد UNIQUE على (cohort_id, starts_at) كان يمنع هذا من الأساس.
-- =========================================================

-- ---------- 1) حذف آمن للتكرار الحالي فقط ----------
-- يُبقي دائمًا على صف واحد لكل (cohort_id, starts_at). لا يحذف أي صف مرتبط فعليًا بأي بيانات
-- حقيقية (حضور، تقرير جلسة، رصيد تعويض) — إن وُجد أي ارتباط على أي نسخة من الزوج المكرَّر،
-- تُترك كل نسخه كما هي بلا حذف (تحتاج مراجعة يدوية بدل حذف آلي قد يُفقد بيانات حقيقية).
with ranked as (
  select
    s.id,
    s.cohort_id,
    s.starts_at,
    row_number() over (partition by s.cohort_id, s.starts_at order by s.id) as rn,
    exists(select 1 from attendance a where a.session_id = s.id) as has_attendance,
    exists(select 1 from daily_pulse_reports p where p.session_id = s.id) as has_pulse,
    exists(select 1 from makeup_credits m where m.source_session_id = s.id or m.redeemed_session_id = s.id) as has_credit
  from sessions s
  where s.starts_at is not null
),
safe_duplicates as (
  select id from ranked
  where rn > 1 and not has_attendance and not has_pulse and not has_credit
)
delete from sessions where id in (select id from safe_duplicates);

-- ---------- 2) منع التكرار مستقبلًا على مستوى القاعدة نفسها ----------
-- ملاحظة: إن تبقّى أي زوج (cohort_id, starts_at) مكرَّر بعد الخطوة أعلاه (لأن له بيانات حقيقية
-- مرتبطة بأكثر من نسخة)، هذا القيد سيفشل عمدًا — إشارة صريحة تستدعي مراجعة يدوية لتلك الحالة
-- تحديدًا، وليس تجاهلًا صامتًا.
alter table sessions drop constraint if exists sessions_cohort_starts_unique;
alter table sessions add constraint sessions_cohort_starts_unique unique (cohort_id, starts_at);
