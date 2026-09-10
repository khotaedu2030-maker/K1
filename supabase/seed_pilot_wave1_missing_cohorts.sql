-- =========================================================
-- KHOTA — Missing Cohorts Fix (Plan Flow Root Cause)
-- supabase/seed_pilot_wave1_missing_cohorts.sql
-- =========================================================
-- ⚠️ ملف منفصل، غير مُشغَّل تلقائيًا — يحتاج تشغيلك اليدوي في Supabase.
--
-- ROOT CAUSE (مؤكَّد بفحص فعلي للبيانات، لا افتراض): seed_pilot_wave1.sql الأصلي زرع 7 مجموعات
-- فقط، ولم تكن تغطي كل تركيبة (plan × grade_band) الممكنة. تحديدًا:
--
--   1) plan=khota-4 (المكثفة، 4 أيام) — لا توجد أي مجموعة له في band '1-3'.
--      (موجودة فقط في band '4-6' — cohort C الحالية)
--   2) plan=focus-2 (Focus Room يومان) — لا توجد أي مجموعة له إطلاقًا (لا في 7-9 ولا 10-12).
--   3) plan=focus-4 (Focus Room 4 أيام) — لا توجد أي مجموعة له إطلاقًا (لا في 7-9 ولا 10-12).
--
-- هذا يفسّر تمامًا لماذا خطة 3 أيام (khota-3 وfocus-3) هي الوحيدة التي "تعمل دائمًا" لكل
-- المراحل، بينما 2 و4 أيام يعملان جزئيًا (motabaa) أو لا يعملان إطلاقًا (Focus Room) — الكود
-- نفسه (RPC + الفلترة) سليم بالكامل، لا يوجد Cohort مطابق فعليًا لهذه التركيبات في القاعدة.
--
-- كل مجموعة أدناه: days_of_week بالطول الصحيح المطابق لـplans.days_per_week (يمر عبر قيد
-- enforce_cohort_days_match_plan الموجود بالفعل — لا تحايل عليه ولا تعديل له).
-- teacher_id و meeting_url = NULL عمدًا (نفس نمط بقية Wave 1 — تُستكمَل من /admin/groups لاحقًا).
-- آمن للتشغيل أكثر من مرة (where not exists بحسب العنوان، كنمط بقية الملف الأصلي).

-- ---------- 1) khota-4 (4 أيام) لـband 1-3 ----------
insert into cohorts (product, plan_id, grade_band, title, capacity, days_of_week, start_time, end_time, status)
select 'motabaa', 'khota-4', '1-3', 'خُطى متابعة 1-3 — المجموعة C', 3, array[0,1,2,3]::smallint[], '19:00', '20:00', 'open'
where not exists (select 1 from cohorts where title = 'خُطى متابعة 1-3 — المجموعة C');

-- ---------- 2) focus-2 (يومان) لـband 7-9 و10-12 ----------
insert into cohorts (product, plan_id, grade_band, title, capacity, days_of_week, start_time, end_time, status)
select 'focus_room', 'focus-2', '7-9', 'Focus Room 7-9 — المجموعة B', 5, array[0,2]::smallint[], '16:30', '17:30', 'open'
where not exists (select 1 from cohorts where title = 'Focus Room 7-9 — المجموعة B');

insert into cohorts (product, plan_id, grade_band, title, capacity, days_of_week, start_time, end_time, status)
select 'focus_room', 'focus-2', '10-12', 'Focus Room 10-12 — المجموعة B', 5, array[0,2]::smallint[], '16:30', '17:30', 'open'
where not exists (select 1 from cohorts where title = 'Focus Room 10-12 — المجموعة B');

-- ---------- 3) focus-4 (4 أيام) لـband 7-9 و10-12 ----------
insert into cohorts (product, plan_id, grade_band, title, capacity, days_of_week, start_time, end_time, status)
select 'focus_room', 'focus-4', '7-9', 'Focus Room 7-9 — المجموعة C', 5, array[0,1,2,3]::smallint[], '19:00', '20:00', 'open'
where not exists (select 1 from cohorts where title = 'Focus Room 7-9 — المجموعة C');

insert into cohorts (product, plan_id, grade_band, title, capacity, days_of_week, start_time, end_time, status)
select 'focus_room', 'focus-4', '10-12', 'Focus Room 10-12 — المجموعة C', 5, array[0,1,2,3]::smallint[], '19:00', '20:00', 'open'
where not exists (select 1 from cohorts where title = 'Focus Room 10-12 — المجموعة C');

-- بعد التشغيل، كل تركيبة (plan × grade_band) الست عشرة الممكنة (motabaa: 2 خطط أساسيتين ×
-- 2 مرحلتين × ... إلخ) تملك مجموعة واحدة على الأقل — راجع scripts/qa-plan-days.mjs محدَّثًا
-- أدناه للتحقق الآلي بعد التشغيل.
