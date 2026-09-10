# KHOTA V29 — Final Report

## 1) What you changed
- نظام Design Tokens رسمي (spacing scale، z-index scale، transition duration/easing موحَّدة،
  عرض container مرفوع لـ1360px).
- إصلاح bug حقيقي بالهيدر الشفاف: كان `position:absolute` يجعله يختفي أثناء أول 60px تمرير
  (لأن absolute لا يلتصق بالـviewport). أُعيد التصميم بالكامل (sticky ثابت من البداية + سحب
  الـHero للأعلى بـmargin-top سالب) بدل تبديل position بين fixed/sticky الذي كان سيسبّب Layout
  Shift حقيقي عند التمرير — اكتُشفت هذه المشكلة الثانية أثناء محاولة الإصلاح الأول، لا افتراضًا.
- Mobile Drawer: لم يكن له scroll lock ولا transition حقيقي (ظهور/اختفاء فوري). أُضيف قفل تمرير
  الصفحة، حركة انزلاق حقيقية (350-500ms)، إغلاق بـEscape، وإعادة التركيز للزر عند الإغلاق.
- تفكيك الصفحة الرئيسية و`/motabaa` و`/about` و`/motabaa/how-it-works` إلى مكوّنات مشتركة
  (`GradeGrid`, `EditorialSplit`) بدل تكرار نفس الترميز حرفيًا في كل ملف.

## 2) Files created
`src/components/GradeGrid.tsx`, `src/components/EditorialSplit.tsx`.

## 3) Files modified
`src/app/globals.css` (design tokens + إصلاح الهيدر) • `src/app/page.tsx` (إعادة هيكلة
بالمكوّنات الجديدة) • `src/app/motabaa/page.tsx` (نفس الشيء) • `src/app/about/page.tsx` •
`src/app/motabaa/how-it-works/page.tsx` • `src/components/MobileNav.tsx` (scroll lock + حركة
حقيقية + كيبورد).

## 4) Main design improvements
حاوية أوسع (1360px بدل 1180px) لمساحة تحريرية أكبر على الشاشات الكبيرة، هيدر شفاف يعمل بصحة
بدون قفزة بصرية، حركة Drawer احترافية، تقليل تكرار الكود عبر مكوّنات مشتركة حقيقية (ليست إعادة
تصميم بصري جديدة — البنية التحريرية 10-مشاهد من الجولة السابقة محفوظة كما هي).

## 5) Functionality preserved
`diff` حرفي مُعاد على منطق الفلترة الكامل في `PlansSelector.tsx` — **مطابق تمامًا**. صفر لمس
لـ`api/`, Supabase, RLS, RPC, الأسعار، `grade-config.ts`. تحقّق `find` فعلي: 8 ملفات فقط
انلمست هذه الجولة، كلها UI/CSS.

## 6) Responsive/RTL work completed
إصلاح الهيدر تحديدًا كان مشكلة تظهر فقط أثناء التمرير (سلوك، لا تخطيط ساكن) — لا علاقة مباشرة
بـRTL. Drawer الجوال يستخدم `right:0`+`translateX` (اتجاه انزلاق صحيح هندسيًا بصرف النظر عن
RTL/LTR). **لم تُختبَر أي من هذه التغييرات بصريًا حيًّا على أي مقاس** — لا متصفح متاح في هذه
البيئة بأي جولة من هذا المشروع بالكامل.

## 7) Accessibility/performance improvements
Drawer: `role="dialog"`, `aria-modal`, `aria-hidden` ديناميكي، إغلاق بـEscape، إعادة تركيز
للزر عند الإغلاق (لم يكن أيّ من هذا موجودًا قبل هذه الجولة). `prefers-reduced-motion` مُطبَّق
الآن عالميًا (قاعدة CSS واحدة تُلغي كل الحركات، بدل الاعتماد على كل مكوّن يطبّقها بنفسه).
Performance: صفر مكتبات جديدة، صفر Client Component إضافي غير ضروري (GradeGrid/EditorialSplit
مكوّنات خادم عادية).

## 8) Build result
**FAIL** — `next: not found`، نتيجة مباشرة لفشل `npm install` (`403 Forbidden`، بيئة بلا وصول
شبكة، نفس القيد في كل جولة من هذا المشروع منذ البداية، أُعيدت المحاولة تحديدًا لهذه الجولة).

## 9) Tests performed
`npx tsc --noEmit` نُفِّذ فعليًا (3287 سطر، الغالبية "Cannot find module" نتيجة غياب
`node_modules` — Environment issue موثَّق لا خطأ كود؛ صفر implicit-any جديد بملفات هذه الجولة).
`npm run lint`: **FAIL** — `eslint: not found` (نفس سبب `npm install`). فحص آلي شامل: توازن
الأقواس عبر كل ملفات TS/TSX (سليم)، صفر مرجع صورة معلَّق، صفر رابط داخلي مكسور، `diff` حرفي على
منطق الخطط. **لم يُشغَّل المشروع فعليًا ولا التُقطت أي Screenshots** — لا بيئة تشغيل/متصفح
متاحة هنا.

## 10) Missing production assets
لا شيء جديد — نفس الأصول العشرة المعتمدة من جولات سابقة كافية وكلها مُستخدَمة.

## 11) أي مشكلة حقيقية ما زالت تحتاج تدخلًا يدويًا
- **تشغيل `npm install`/`tsc`/`build`/`lint`/Visual QA فعليًا على بيئة بوصول شبكة ومتصفح
  حقيقي (جهازك)** — هذا التأكيد النهائي الوحيد المتبقي تقنيًا، ولم يكن ممكنًا في أي جولة من هذا
  المشروع حتى الآن.
- إصلاح الهيدر (position bug) **مكتوب ومنطقي سليم نظريًا** لكن غير مُختبَر بصريًا حيًّا — يستحق
  فحصًا بصريًا أولويًا عندك تحديدًا لأنه يمس سلوك تمرير فعلي، لا مجرد تخطيط ساكن.
