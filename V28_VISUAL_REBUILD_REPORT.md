# KHOTA V28 — Editorial Visual Rebuild Report

## 1) Executive Summary
نفّذت إعادة بناء بصري حقيقي (بنيوي لا CSS فقط) للصفحة الرئيسية بالكامل + `/motabaa` +
`/motabaa/how-it-works` + `/about` + `/teachers` + `/teach-with-khota` + Header، بمعمارية
تحريرية (صور كبيرة فعلية، Split غير متماثل 60/40، شبكة مراحل 2×2 بالحجم الحقيقي، بيانات
تحريرية بلا بطاقات) بدل نمط "بطاقة تلو بطاقة" السابق. حافظت على `/motabaa/plans`،
Enrollment/Payment، وكل صفحات Parent/Teacher/Student/Admin **كما هي دون لمس** — عمدًا، مبرَّر
بالقسم 8 أدناه.

## 2) Routes Changed (بنيويًا فعليًا)
`/`, `/motabaa`, `/motabaa/how-it-works`, `/about`, `/teachers`, `/teach-with-khota`, + Header/
MobileNav/Shell (مشتركة عبر كل الموقع).

## 3) Homepage — Section-by-Section
1. **Hero سينمائي**: `khota-hero.webp` full-bleed حقيقي (`min-height:86vh`)، تدرّج قراءة غامق
   من الأسفل، النص فوق الصورة مباشرة — لا بطاقة عائمة تحصرها.
2. **بيان المشكلة**: قسم تحريري بلا صورة، طباعة كبيرة (`clamp(30px,4.5vw,50px)`)، بلا بطاقات.
3. **كيف تفكر خُطى**: تسلسل نصّي 4 خطوات بخط فاصل رفيع (`.progression`) — لا بطاقات متساوية.
4. **المراحل الأربع**: شبكة 2×2 فعلية (`.grade-grid`) بالصور الأربع كاملة الحجم مع تدرّج نص
   فوقها مباشرة — لا بطاقات صغيرة.
5. **الجلسة**: Split 60/40 مع `khota-live-session.webp`.
6. **ولي الأمر**: Split 40/60 معكوس الاتجاه (الصورة يسار هذه المرة) مع `khota-progress.webp`.
7. **المعلمون**: Split 60/40 مع `khota-teacher.webp`.
8. **الخطط**: بطاقات — **مسموحة هنا صراحة** (مقارنة وظيفية فعلية بين 3 خطط).
9. **الثقة/الخصوصية**: شريط نصّي هادئ بلا أيقونات دائرية متكررة.
10. **CTA ختامي**: `khota-about.webp` سينمائي بتراكب غامق (`.cta-cinematic`).

## 4) Image Mapping Table
| Route | Section | Image | Display Mode | Mobile Behavior |
|---|---|---|---|---|
| `/` | Hero | `khota-hero.webp` | Full-bleed cinematic | يبقى full-bleed، `min-height` يقل لـ78vh |
| `/` | المراحل (×4) | `khota-grade-{1-3,4-6,7-9,10-12}.webp` | شبكة 2×2 (panels) | تتكدّس عمودًا 1 عمود |
| `/` | الجلسة | `khota-live-session.webp` | Split 60/40 | يتكدّس عموديًا، الصورة أولًا |
| `/` | ولي الأمر | `khota-progress.webp` | Split 40/60 | يتكدّس عموديًا |
| `/` | المعلمون | `khota-teacher.webp` | Split 60/40 | يتكدّس عموديًا |
| `/` | CTA ختامي | `khota-about.webp` | Full-bleed + تراكب غامق | يبقى full-bleed |
| `/motabaa` | Hero | `khota-grade-4-6.webp` | Cinematic (72vh) | كما هو، أقصر |
| `/motabaa` | الجلسة | `khota-live-session.webp` | Split 60/40 | يتكدّس |
| `/motabaa` | المراحل | 4 صور المراحل | شبكة 2×2 | يتكدّس |
| `/motabaa` | ولي الأمر | `khota-parent-experience.webp` | Split 40/60 | يتكدّس |
| `/motabaa/how-it-works` | أثناء الجلسة | `khota-live-session.webp` | Split 60/40 | يتكدّس |
| `/motabaa/how-it-works` | بعد الجلسة | `khota-progress.webp` | Split 40/60 | يتكدّس |
| `/about` | Hero | `khota-parent-experience.webp` | Split 60/40 | يتكدّس |
| `/about` | CTA ختامي | `khota-about.webp` | Cinematic (50vh) | يبقى full-bleed |
| `/teachers` | Hero | `khota-teacher.webp` | Cinematic (68vh) | كما هو |
| `/teach-with-khota` | Hero | `khota-teacher.webp` | Cinematic (56vh) | كما هو |
| `/start` | Split (بدون تغيير) | `khota-hero.webp` | Split 50/50 | يتكدّس |
| `/login`, `/contact` | Split (بدون تغيير من جولات سابقة) | `khota-parent-experience.webp` | Split 50/50 | يتكدّس |

**كل الصور العشر مُستخدَمة فعليًا** (تحقّق `grep` مباشر لكل ملف — لا صورة يتيمة). `object-position`
مضبوط يدويًا لكل موضع حسب محتوى الصورة الفعلي، لا `center` عام موحَّد.

## 5) Arabic UX Changes
- CTA الأساسي بالهيدر: "سجّل الآن" → **"ابدأ مع خُطى"** (Header + MobileNav).
- قائمة التنقّل: "المراحل الدراسية"→"المراحل"، إزالة "تواصل معنا" من الهيدر الرئيسي (تبسيط
  حسب القائمة المقترحة)، إضافة "كيف تعمل خُطى" كرابط مباشر.
- نصوص Homepage/`motabaa`/`about`/`teachers` جديدة بالكامل، مطابقة للصياغات المطلوبة حرفيًا
  حيث حُدِّدت ("بعد المدرسة، تبدأ خُطى"، "أنت قريب من تقدّمه...").
- بحث شامل عن: رحلة تعليمية، استكشف، تجربة تعليمية متكاملة، حلول مبتكرة، نحو مستقبل أفضل —
  **صفر نتائج**. "Focus Room" الوحيد المتبقي بالكود تعليق برمجي داخلي غير ظاهر للمستخدم.

## 6) Responsive Changes
كل الأنماط الجديدة (`hero-editorial-v28`, `.split-60/.split-40`, `.grade-grid`,
`.progression`, `.cta-cinematic`, `.trust-strip`) لها `@media(max-width:850px)` صريحة تحوّل
التركيبة لعمود واحد فعليًا (ليست ضغطًا للـDesktop) — موثَّقة بالكود. **لم تُختبَر بصريًا حيًّا
على أي مقاس** — لا متصفح متاح في هذه البيئة بأي جولة من هذا المشروع.

## 7) Product-Flow Pages Changed
**لا شيء** — `/motabaa/plans`, `/motabaa/enroll`, `/motabaa/enroll/payment` لم تُلمَس هذه
الجولة، بالضبط كما طلبت (القسم 12/13: "DO NOT apply Aramco/editorial layout blindly here...
Premium checkout style... Do not add unnecessary photography"). تحققت أن `formatCohortDisplayName()`
("المجموعة (أ)") ومنطق الفلترة الكامل في `PlansSelector.tsx` **لا يزالان سليمين** (`diff` حرفي
+ فحص استخدام مباشر).

## 8) ما لم يُغيَّر عمدًا، ولماذا
- **`/motabaa/plans`, Enrollment, Payment**: Product UI وظيفي، تعليمات صريحة بعدم فرض الأسلوب
  التحريري عليها.
- **Parent/Teacher/Student/Admin routes بالكامل**: تحقّقت آليًا أنها خالية من الأنماط الغامقة
  القديمة (بحث شامل، صفر نتائج) وتستخدم نظام التصميم المشترك أصلًا — لم تُعَد صياغتها بصريًا
  هذه الجولة تحديدًا لأن التعليمات صريحة بعدم تحويلها لأسلوب تسويقي تحريري، وهي بالفعل Product
  UI بسيطة ومتّسقة من جولات سابقة.
- **`/help`, `/contact`, `/privacy`, `/terms`**: لم تُذكَر بالقائمة صراحة هذه الجولة، لم تُلمَس.
- **Supabase/RLS/RPC/enrollment/payment logic/prices/grade-config**: صفر لمس — القاعدة الصارمة،
  وتحقّق `diff` يثبت ذلك فعليًا لا وعدًا.

## 9) TypeScript Result
**نُفِّذ فعليًا** (`npx tsc --noEmit`) — 3334 سطر أخطاء، الغالبية الساحقة "Cannot find module
next/…"/"@supabase/…" نتيجة غياب `node_modules` (بيئة بلا شبكة، Environment issue موثَّق لا خطأ
كود). لم يظهر أي implicit-any جديد بملفات هذه الجولة. **لا يمكن تأكيد TypeScript نظيف فعليًا
بدون تثبيت الحزم على جهازك.**

## 10) Build Result
**FAIL** — `next: not found`، نتيجة مباشرة لفشل `npm install` (`403 Forbidden`، نفس القيد
الشبكي في كل جولة من هذا المشروع منذ البداية، أعدت المحاولة تحديدًا لهذه الجولة).

## 11) Lint Result
**FAIL** — `eslint: not found`، نفس السبب.

## 12) Remaining External Launch Blockers
- تشغيل `npm install`/`tsc`/`build`/`lint` فعليًا على بيئة بوصول شبكة (جهازك) للتأكيد النهائي.
- معاينة بصرية حية على 375/430/768/1440 — لا متصفح متاح هنا.
- مزوّد SMS/OTP إنتاجي، بوابة دفع حقيقية، معلمون/روابط اجتماعات فعلية، تفعيل `khota.sa` فعليًا
  على DNS/استضافة — بلا تغيير عن الجولات السابقة.

## 13) الملفات المعدَّلة (القائمة الكاملة)
`src/app/page.tsx` (إعادة بناء كاملة) • `src/app/motabaa/page.tsx` (إعادة بناء) •
`src/app/motabaa/how-it-works/page.tsx` (إعادة بناء) • `src/app/about/page.tsx` (إعادة بناء) •
`src/app/teachers/page.tsx` (إعادة بناء) • `src/app/teach-with-khota/page.tsx` (إعادة بناء) •
`src/components/{Header,MobileNav,Shell,nav-links}.tsx/ts` (استعادة سلوك الهيدر الشفاف +
قائمة تنقّل جديدة) • `src/app/globals.css` (نظام تحريري جديد: `hero-editorial-v28`,
`.split-60/.split-40`, `.progression`, `.grade-grid`, `.editorial-statement`,
`.cta-cinematic`, `.trust-strip`).

## 14) Known Limitations
- **لا معاينة بصرية حية إطلاقًا** — كل قرارات الـcrop/التباين اعتمدت على فحص الصور الأصلية
  يدويًا (`view` tool) وقياس تقريبي للنسب، لا معاينة فعلية في متصفح لأي جولة من هذا المشروع.
- شبكة المراحل 2×2 الجديدة (`.grade-grid`) عنصر بصري جديد لم يُستخدَم من قبل بهذا المشروع —
  المنطق المتجاوب مكتوب ومنطقي لكن غير مُختبَر حيًّا كما هو الحال مع كل شيء آخر هنا.
- Header الشفاف الجديد (`transparent`) أُعيد تفعيله على 4 صفحات (`/`, `/motabaa`, `/teachers`,
  `/teach-with-khota`) — التحقق من أن النص يبقى مقروءًا فوق كل صورة Hero يعتمد على تدرّج CSS
  (`linear-gradient` غامق من الأسفل) لا معاينة فعلية.
