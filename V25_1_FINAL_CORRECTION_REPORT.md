# KHOTA V25.1 — Final Correction Report

## 1) الملفات المعدَّلة
`next.config.ts` (استعادة إعداد Turbopack root) • `tsconfig.json` (إضافة `skipLibCheck`) •
`src/lib/supabase-server.ts` (type annotation واحد، صفر منطق) •
`src/app/motabaa/grades-1-3/page.tsx`، `src/app/motabaa/grades-4-6/page.tsx` (محتوى + تحديث
للنظام البصري الحالي).

## 2) Regressions أُصلحت
- **`next.config.ts` كان فارغًا فعليًا** (تحقّقت بفتح الملف، لا افتراض) — أعدت إعداد
  Turbopack root بالضبط كما طلبت.
- **`tsconfig.json` لم يكن يحتوي `skipLibCheck` إطلاقًا** — أضفته.
- **`src/lib/supabase-server.ts`**: خطأ implicit-any حقيقي على معامل الكوكيز (نفس فئة الخطأ
  الذي أصلحته بـ`middleware.ts` بجولة سابقة، لكن هذا الملف تحديدًا فاتني وقتها) — اكتشفته
  الآن بتشغيل `tsc` فعليًا، أصلحته بإضافة نوع صريح فقط، بحثت للتأكد عدم وجود نسخة أخرى منه
  بالمشروع (نظيف الآن).

## 3) الصفحات التي عُدِّل تصميمها فعليًا
`/motabaa/grades-1-3` و`/motabaa/grades-4-6` — كانتا تستخدمان بنية `.hero`/`.dark` القديمة من
قبل كل جولات إعادة التصميم، وطلبت مراجعة `grades-1-3` تحديدًا. `grades-1-3` كانت تصف الصف
1-3 بإطار "تدريس مواد" (قراءة/كتابة/رياضيات/**إنجليزية أولية**) بدل إطار "متابعة بعد المدرسة"
الحالي — أعدت كتابة النص بإطار المتابعة/التنظيم/الاستقلالية المتّسق مع باقي المنتج، وحدَّثت كلا
الصفحتين للنظام البصري الحالي (`.section`/`.title`/`.lead`).

**ملاحظة مهمة**: كلمة "الإنجليزية" في `parent/reports`، `parent/reports/weekly`،
`teacher/assessment/AssessmentForm.tsx` **فحصتها ولم أغيّرها عمدًا** — هي واحدة من ست فئات
تقييم عادية (قراءة، إملاء، رياضيات، **إنجليزية**، تركيز، استقلالية)، وليست وصفًا للمنتج كخدمة
تدريس إنجليزي. هذا استخدام مختلف تمامًا عن مشكلة `grades-1-3`، تحققت من السياق الكامل قبل
القرار بدل الحذف الأعمى.

## 4) الصفحات التي رُوجعت ولم تحتج تعديلًا
`/`, `/start`, `/motabaa`, `/motabaa/how-it-works`, `/motabaa/plans`, `/motabaa/enroll`,
`/motabaa/enroll/payment`, `/about`, `/teachers`, `/teach-with-khota`, `/help`, `/contact`,
`/parent`, `/parent/schedule` — راجعتها بجولات سابقة (تصميم/صور/نصوص)، وتحقّقت هذه الجولة أنها
خالية من الأنماط الغامقة القديمة (`.statement`/`.brand-moment`/`var(--n)` كخلفية) عبر بحث آلي
شامل، بلا نتائج. **لم تُفحَص سطرًا بسطر من جديد هذه الجولة تحديدًا** بمعيار "Premium Aramco-level"
— هذا يحتاج مراجعة بصرية حية غير متاحة هنا.

`/parent/children`, `/parent/subscriptions`, `/parent/messages`, صفحات Teacher/Student/Admin
الأساسية: تحقّقت آليًا أنها **خالية من الأنماط الغامقة القديمة** (بحث شامل، صفر نتائج) وتستخدم
نظام التصميم المشترك (`.dashcard`, ألوان الهوية). **لم تُعَد صياغة تركيبتها البصرية بعمق هذه
الجولة** — هذا يتجاوز نطاق "Correction Pass" ويحتاج جولة تصميم مخصَّصة لو أردته لاحقًا.

## 5) Image → Page/Section Mapping
لم يتغيّر عن الجولة السابقة (V25) — نفس الأدوار العشرة، تحقّقت أن كل مرجع صورة بالكود يطابق
ملفًا فعليًا موجودًا (بحث آلي، صفر مرجع معلَّق):
01 Hero → `khota-hero.webp` (الرئيسية، `/motabaa`, `/start`) • 02 Grades 1–3 →
`khota-grade-1-3.webp` • 03 Grades 4–6 → `khota-grade-4-6.webp` • 04 Grades 7–9 →
`khota-grade-7-9.webp` • 05 Grades 10–12 → `khota-grade-10-12.webp` • 06 Parent Experience →
`khota-parent-experience.webp` (`/login`, `/contact`, `/motabaa`) • 07 Teachers →
`khota-teacher.webp` (`/teachers`, `/teach-with-khota`) • 08 Live Session →
`khota-live-session.webp` (`/motabaa/how-it-works`) • 09 Parent Progress →
`khota-progress.webp` • 10 About/CTA → `khota-about.webp`.

## 6) Legacy Routes المتبقية ولماذا
`/english/*` و`/qudurat/*` — تحقّقت آليًا (بحث شامل عبر `src/components` وكل صفحات public
الحالية) أن **صفر رابط** يشير إليها من أي مكان بالرحلة الحالية، مستبعدة من `sitemap.ts` (قائمة
صريحة لا تحتوي عليها) ومحجوبة صراحة في `robots.ts`. لم تُحذَف — تحوي بيانات/منطقًا تشغيليًا قد
يُحتاج لاحقًا، وحذفها ليس مطلوبًا صراحة.

## 7) نتيجة npm install
**FAIL** — `403 Forbidden` على `registry.npmjs.org` (بيئة بلا وصول شبكة، نفس القيد في كل جولة
من هذا المشروع منذ البداية، أعدت المحاولة تحديدًا لهذه الجولة).

## 8) نتيجة npx tsc --noEmit
**نُفِّذ فعليًا** (3358 سطر أخطاء، انخفضت من 3362 بعد إصلاح `supabase-server.ts`). الغالبية
الساحقة "Cannot find module next/…"/"@supabase/…"/"Cannot find name 'process'" — نتيجة مباشرة
لغياب `node_modules` (Environment issue موثَّق، ليس خطأ كود). **الأخطاء الحقيقية بكودنا التي
أمكن تمييزها وإصلاحها: 1 (implicit-any في `supabase-server.ts`)** — لا يمكن الجزم بعدم وجود
غيرها المحجوب خلف ضجيج "Cannot find module" الهائل بلا تثبيت حزم فعلي.

## 9) نتيجة npm run build
**FAIL** — `next: not found` (نتيجة مباشرة لفشل `npm install`، لا `node_modules`).

## 10) نتيجة ESLint
**FAIL** — `eslint: not found` (نفس السبب).

## 11) Launch Blockers حقيقية متبقية
- **تشغيل `npm install`/`tsc`/`build`/`lint` فعليًا على بيئة بوصول شبكة** (جهازك) — التأكيد
  النهائي الوحيد المتبقي تقنيًا.
- **صور القصّ/التجاوب لم تُختبَر بصريًا حيًّا** على أي مقاس (375/430/768/1440) — لا متصفح متاح.
- **مراجعة بصرية "Premium" عميقة** لصفحات Teacher/Student/Admin وبقية صفحات Parent — لم تُنفَّذ
  بعمق هذه الجولة (Correction Pass محدود النطاق عمدًا، ليست جولة تصميم كاملة).
- اعتماديات خارجية سابقة بلا تغيير: مزوّد SMS/OTP، بوابة دفع حقيقية، معلمون/روابط اجتماعات
  فعلية، تفعيل نطاق `khota.sa` فعليًا على DNS/استضافة.
