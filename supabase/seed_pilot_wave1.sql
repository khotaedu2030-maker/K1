-- =========================================================
-- KHOTA V3 — Pilot Wave 1 Seed
-- supabase/seed_pilot_wave1.sql
-- =========================================================
-- الهدف: تجهيز بيانات تشغيلية حقيقية لأول موجة Pilot (خُطى متابعة + Focus Room) —
-- أسعار، مجموعات، جداول — بلا تغيير على فلسفة المنتج أو المعمارية.
--
-- آمن للتشغيل أكثر من مرة (Idempotent):
--  - تحديث الخطط عبر upsert (on conflict) — لا يُكرِّر صفوفًا.
--  - إدراج المجموعات عبر insert ... where not exists (بحسب العنوان) — لا يُكرِّر مجموعات
--    عند إعادة تشغيل هذا الملف على نفس القاعدة.
--  - لا drop table، لا حذف لأي بيانات غير مذكورة صراحةً أدناه، لا لمس لـ bookings القديم.

-- ---------- A + B + C + D) الخطط: الأسعار التشغيلية المؤقتة للبايلوت + تفعيلها ----------
-- ملاحظة: هذه أسعار Pilot تشغيلية مؤقتة كما أرسلتها، وليست تسعيرًا تجاريًا نهائيًا معتمَدًا.
insert into plans (id, product, name, sessions_per_month, days_per_week, day_patterns, price_sar, active) values
  ('khota-2', 'motabaa', 'الانطلاقة', 8, 2,
    array['الأحد+الثلاثاء','الاثنين+الأربعاء'], 399, true),
  ('khota-3', 'motabaa', 'الأساسية', 12, 3,
    array['الأحد+الاثنين+الأربعاء'], 529, true),
  ('khota-4', 'motabaa', 'المكثفة', 16, 4,
    array['الأحد إلى الأربعاء'], 679, true),
  ('focus-2', 'focus_room', 'Focus Room — يومان أسبوعيًا', 8, 2,
    array['الأحد+الثلاثاء','الاثنين+الأربعاء'], 399, true),
  ('focus-3', 'focus_room', 'Focus Room — 3 أيام أسبوعيًا', 12, 3,
    array['الأحد+الاثنين+الأربعاء'], 529, true),
  ('focus-4', 'focus_room', 'Focus Room — 4 أيام أسبوعيًا', 16, 4,
    array['الأحد إلى الأربعاء'], 679, true)
on conflict (id) do update set
  name = excluded.name,
  sessions_per_month = excluded.sessions_per_month,
  days_per_week = excluded.days_per_week,
  day_patterns = excluded.day_patterns,
  price_sar = excluded.price_sar,
  active = excluded.active;

-- ---------- Removal بيانات اختبار محدَّدة فقط (لا شيء آخر) ----------
delete from cohorts
where title = 'مجموعة اختبار خُطى — الصفوف 1–3'
   or slot_code = 'TEST-1630';

-- ---------- B) مجموعات Wave 1 التشغيلية ----------
-- الأحد إلى الأربعاء فقط. teacher_id و meeting_url = NULL عمدًا (لا معلمين وهميين، لا روابط
-- وهمية) — status='open' بالرغم من ذلك، فتظهر في الكتالوج العام وتقبل تسجيلًا فعليًا؛
-- استضافة الجلسات الفعلية تحتاج ربط معلم ورابط قاعة لاحقًا قبل أول جلسة حقيقية (Pre-Flight).
--
-- الحجم: ~28 مقعدًا إجمالًا، بثقل أكبر للابتدائي (18 من 28) ومجموعة واحدة لكل من
-- المتوسط والثانوي — يطابق تصميم Wave 1 المتدرِّج (24-30 مقعدًا، Primary-heavy).

insert into cohorts (product, plan_id, grade_band, title, capacity, days_of_week, start_time, end_time, status)
select 'motabaa', 'khota-2', '1-3', 'خُطى متابعة 1-3 — المجموعة A', 3, array[0,2]::smallint[], '16:30', '17:30', 'open'
where not exists (select 1 from cohorts where title = 'خُطى متابعة 1-3 — المجموعة A');

insert into cohorts (product, plan_id, grade_band, title, capacity, days_of_week, start_time, end_time, status)
select 'motabaa', 'khota-3', '1-3', 'خُطى متابعة 1-3 — المجموعة B', 3, array[0,1,3]::smallint[], '17:45', '18:45', 'open'
where not exists (select 1 from cohorts where title = 'خُطى متابعة 1-3 — المجموعة B');

insert into cohorts (product, plan_id, grade_band, title, capacity, days_of_week, start_time, end_time, status)
select 'motabaa', 'khota-2', '4-6', 'خُطى متابعة 4-6 — المجموعة A', 4, array[1,3]::smallint[], '16:30', '17:30', 'open'
where not exists (select 1 from cohorts where title = 'خُطى متابعة 4-6 — المجموعة A');

insert into cohorts (product, plan_id, grade_band, title, capacity, days_of_week, start_time, end_time, status)
select 'motabaa', 'khota-3', '4-6', 'خُطى متابعة 4-6 — المجموعة B', 4, array[0,1,3]::smallint[], '17:45', '18:45', 'open'
where not exists (select 1 from cohorts where title = 'خُطى متابعة 4-6 — المجموعة B');

insert into cohorts (product, plan_id, grade_band, title, capacity, days_of_week, start_time, end_time, status)
select 'motabaa', 'khota-4', '4-6', 'خُطى متابعة 4-6 — المجموعة C', 4, array[0,1,2,3]::smallint[], '19:00', '20:00', 'open'
where not exists (select 1 from cohorts where title = 'خُطى متابعة 4-6 — المجموعة C');

insert into cohorts (product, plan_id, grade_band, title, capacity, days_of_week, start_time, end_time, status)
select 'focus_room', 'focus-3', '7-9', 'Focus Room 7-9 — المجموعة A', 5, array[0,1,3]::smallint[], '17:45', '18:45', 'open'
where not exists (select 1 from cohorts where title = 'Focus Room 7-9 — المجموعة A');

insert into cohorts (product, plan_id, grade_band, title, capacity, days_of_week, start_time, end_time, status)
select 'focus_room', 'focus-3', '10-12', 'Focus Room 10-12 — المجموعة A', 5, array[0,1,3]::smallint[], '19:00', '20:00', 'open'
where not exists (select 1 from cohorts where title = 'Focus Room 10-12 — المجموعة A');

-- ---------- ملخص Wave 1 (للمراجعة اليدوية فقط — بلا أثر على قاعدة البيانات) ----------
-- 1-3: مجموعتان × 3 مقاعد = 6
-- 4-6: ثلاث مجموعات × 4 مقاعد = 12
-- 7-9: مجموعة واحدة × 5 مقاعد = 5
-- 10-12: مجموعة واحدة × 5 مقاعد = 5
-- الإجمالي: 7 مجموعات، 28 مقعدًا (18 ابتدائي + 10 Focus Room)
