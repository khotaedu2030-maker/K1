# KHOTA Creative Direction Report

## شفافية أولى (مهمة)
لا تتوفر لي أداة توليد صور فعلية في هذه البيئة. لم أتظاهر بتوليد أي صورة جديدة. الهوية البصرية
هنا مبنية بالكامل على: (أ) الصور الفوتوغرافية الخمس الحقيقية الموجودة أصلًا في المشروع
(`khota-hero-family`, `khota-primary`, `khota-middle`, `khota-secondary`, `khota-parent`) —
مُستخدَمة الآن بجرأة (Full-bleed، Split-screen، أحجام ضخمة) بدل كونها صورًا صغيرة داخل بطاقات،
و(ب) نظام Art Direction أصلي بـCSS/SVG بالكامل. أي صورة إضافية حقيقية مطلوبة مستقبلًا (مشاهد
جديدة، زوايا مختلفة) مُسجَّلة أدناه كـ"Assets خارجية مطلوبة".

## Creative Concept
**"كل خطوة تُبنى على التي قبلها."** خُطى ليست مدرسة ولا تطبيق أطفال — هي الشريك الهادئ الذي
يحوّل فوضى ما بعد المدرسة إلى مسار واضح. اللغة البصرية: عائلة سعودية معاصرة حقيقية (لا Stock
مبتذل)، مساحات سوداء/بيضاء جريئة، ولمسات Teal/Gold محسوبة لا مبعثرة.

## Visual DNA — المفهوم الموقَّع
اكتشفت أثناء العمل أن **شعار خُطى نفسه أصلًا "درج متصاعد بأربع خطوات"** (`LogoMark` في
`Logo.tsx`) — بنيت عليه بدل اختراع مفهوم منفصل:
1. **Step Motif** (`.step-motif`): أربعة أعمدة صغيرة متصاعدة الارتفاع، صدى مباشر لشكل الشعار،
   تظهر كفاصل هادئ متكرر في كل صفحة رئيسية (Hero، Login، /start، Checkout) — بصمة واحدة بدل
   زخرفة عشوائية.
2. **Step-Cut Frame** (`.step-frame`): كل صورة رئيسية في الموقع لها زاوية واحدة مرتفعة
   الاستدارة بشكل غير متماثل (120px بدل الزوايا الأربع المتساوية) — شكل صورة موقَّع، لا مستطيل
   عادي، يظهر في كل قسم Split-screen.
3. **Brand Line**: خط قطري قصير بتدرّج Teal→Gold، استخدام نادر ومتحكَّم به كفاصل.

## Art Direction — الصفحة الرئيسية (إعادة بناء كاملة، لا Patch)
الترتيب الجديد: **Hero Full-bleed** (الصورة الحقيقية تملأ الشاشة، Overlay غامق للتباين،
Typography عملاقة `clamp(42px,7.5vw,92px)`، هيدر شفاف فوقها يتحوّل لصلب عند التمرير) → شريط
أرقام حقيقية → **بيان غامق ممتلئ** (جملة واحدة، لا صورة، مساحة تنفّس) → رحلة KHOTA Method (6
خطوات) → **Split-screen مزدوج** (صورة طالب + نص، ثم نص + صورة والد بترتيب معكوس — تنويع
حقيقي لا تكرار) → **Stage Picker تفاعلي** (Tabs تُغيّر الصورة والنص خلفها فعليًا — دمج
Navigation+Content+Photography كما طُلب حرفيًا، وليس 4 بطاقات) → **Product Showcase بطبقات
متراكبة** (لوحة رئيسية + بطاقة عائمة فوقها) → 3 خطوات البدء → **Final Brand Moment** غامق قبل
الفوتر مباشرة. هذا Rhythm حقيقي، لا "Section→Cards→Section→Cards".

## أقسام جديدة/مُعاد بناؤها
`StagePicker.tsx` (جديد بالكامل) • Hero (إعادة بناء من الصفر) • قسمَا Split-screen (جديدان) •
Product Showcase (طبقات بدل صورة مسطّحة) • Final Brand Moment (جديد) • Header (وضع شفاف
اختياري) • `/motabaa` (Split-screen بدل نص فقط) • `/start` (تبسيط + Step Motif) • `/login`
(Step Motif) • Checkout/Payment (Step Motif داخل اللوحة الملخَّصة) • Parent Dashboard (منطقة
ترحيب بتدرّج غامق بدل نص عادي).

## Assets المُستخدَمة (لا اختراع)
الصور الخمس الحقيقية أُعيد توزيعها بأدوار أوضح: `khota-hero-family` → Hero الرئيسي فقط الآن
(استخدام واحد قوي، لا تكرار) • `khota-primary` → Split-screen الطالب + Stage Picker (1-3, 4-6) •
`khota-middle` → `/motabaa` Hero + Stage Picker (7-9) • `khota-secondary` → Stage Picker
(10-12) • `khota-parent` → Split-screen ولي الأمر.

### Assets خارجية مطلوبة لاحقًا (موثَّقة صراحةً، لا اختراع)
مشهد إضافي لـ"طالب متوسط/ثانوي بزاوية مختلفة" لتفادي تكرار نفس الصورة بين Stage Picker وأقسام
أخرى مستقبلًا لو زاد عدد الأقسام المصوَّرة.

## Motion System
`Reveal` (موجود مسبقًا) موسَّع الاستخدام عبر كل الأقسام الجديدة. Header يتحوّل من شفاف لصلب
بانسيابية عند التمرير فوق 60px (Hero فقط). Stage Picker يبدّل الصورة/النص فوريًا عند اختيار
مرحلة (تبديل بسيط ومباشر، لا Crossfade معقّد — قرار مقصود للبساطة والأداء). كل الحركة تحترم
`prefers-reduced-motion` (قاعدة موجودة مسبقًا في `.reveal` ومُطبَّقة على الإضافات الجديدة).

## Responsive Approach
`.split-screen` يتكدّس عموديًا تحت 850px (صورة 340px ثابتة الارتفاع فوق النص). `.stage-picker`
يقلّل الحشو والارتفاع الأدنى على الجوال. `.hero-editorial` يقلّل `min-height` قليلًا على الجوال
مع الحفاظ على الصورة كاملة الشاشة. **لم يُختبَر بصريًا فعليًا على أي جهاز حقيقي** — لا متصفح
متاح في هذه البيئة، هذا استنتاج CSS منطقي فقط.

## Accessibility Considerations
Stage Picker: أزرار Tabs بـ`role="tablist"`/`role="tab"`/`aria-selected` صحيحة دلاليًا. الهيدر
الشفاف يحافظ على تباين نص أبيض واضح فوق Overlay غامق مصمَّم خصيصًا لذلك. Skip Link والـ
`role="alert"` من الجولة السابقة لم يُمسّا. **لم يُجرَ تدقيق تباين شامل جديد**.

## Files Changed (12 ملفًا، صفر لمس لأي API/schema/منطق مُقفَل — تحقّق فعلي عبر find)
`src/app/globals.css` (نظام Visual DNA كامل) • `src/app/page.tsx` (إعادة بناء) •
`src/components/{Header,Shell,StagePicker(جديد)}.tsx` • `src/app/motabaa/page.tsx` •
`src/app/start/page.tsx` • `src/app/login/page.tsx` • `src/app/motabaa/plans/
PlansSelector.tsx` (لمسة بصرية فقط) • `src/app/motabaa/enroll/EnrollForm.tsx` •
`src/app/motabaa/enroll/payment/PaymentClient.tsx` • `src/app/parent/schedule/
ParentDashboardHeader.tsx`.

**إثبات فعلي لا وعد**: قارنت `submit()` في `EnrollForm.tsx` و`confirm()` في `PaymentClient.tsx`
بـ`diff` حرفي — **مطابقان تمامًا** لما كانا عليه قبل هذه الجولة. `scripts/qa-plan-days.mjs`
شُغِّل فعليًا (PASS) للتأكد أن منطق Plan/Days لم يتأثر.

## Build Result
**لم أستطع تأكيده فعليًا** — نفس القيد الشبكي المتكرر في كل جولة من هذا المشروع (`403
Forbidden` على `npm install`، بيئة بلا وصول إنترنت). فحصت توازن الأقواس آليًا عبر **كل** ملفات
TS/TSX في المشروع (سليم). هذا ليس بديلًا عن Build حقيقي — يحتاج تشغيلك على بيئة بوصول شبكة فعلي.

## اختبار Design Quality (القسم 27، بصدق)
لو أُخفي شعار خُطى: الآن يوجد Step Motif متكرر مقصود، Step-Cut Frame موقَّع على كل صورة، وHero
Full-bleed بدل بطاقة — هذه ليست عناصر Template عام قابلة للاستبدال بأي علامة أخرى بسهولة. لكن
بصدق: هذا حكم شخصي يستحق مراجعتك البصرية الفعلية بعد تشغيل المشروع — لا أستطيع رؤية الناتج
المُصيَّر فعليًا في هذه البيئة، فقط الكود المكتوب.
