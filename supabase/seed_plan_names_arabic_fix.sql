-- =========================================================
-- KHOTA — Plan Names Arabic-First Fix
-- supabase/seed_plan_names_arabic_fix.sql
-- =========================================================
-- ⚠️ ملف منفصل، غير مُشغَّل تلقائيًا — يحتاج تشغيلك اليدوي في Supabase.
--
-- المشكلة: plans.name لخطط Focus Room مخزَّنة فعليًا في القاعدة كـ"Focus Room — يومان أسبوعيًا"
-- إلخ — إنجليزي مباشرة داخل اسم الخطة، يظهر للمستخدم حرفيًا في بطاقة الخطة. هذا Data، وليس نصًا
-- في الكود، ولذلك لا يمكن إصلاحه بتعديل الواجهة وحدها.
--
-- الإصلاح: نفس أسماء خُطى متابعة تمامًا (الانطلاقة/الأساسية/المكثفة) — نوع الخدمة (خُطى متابعة
-- أو غرفة التركيز) يظهر بشكل منفصل في الواجهة عبر product الفعلي، لا داخل اسم الخطة نفسه.
-- upsert بنفس نمط الملف الأصلي (on conflict do update) — لا تغيير في id/price/days_per_week/
-- sessions_per_month/product — الاسم فقط.

insert into plans (id, product, name, sessions_per_month, days_per_week, day_patterns, price_sar, active) values
  ('focus-2', 'focus_room', 'الانطلاقة', 8, 2, array['الأحد+الثلاثاء','الاثنين+الأربعاء'], 399, true),
  ('focus-3', 'focus_room', 'الأساسية', 12, 3, array['الأحد+الاثنين+الأربعاء'], 529, true),
  ('focus-4', 'focus_room', 'المكثفة', 16, 4, array['الأحد إلى الأربعاء'], 679, true)
on conflict (id) do update set
  name = excluded.name;
  -- عمدًا: لا نلمس sessions_per_month/days_per_week/day_patterns/price_sar/active/product هنا،
  -- فقط الاسم — أي تغيير آخر على هذه الخطط يبقى في seed_pilot_wave1.sql الأصلي كمصدر الحقيقة.
