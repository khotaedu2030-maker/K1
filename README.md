# K1 — KHOTA V2.1

نفس هيكلة V2 (خُطى متابعة/English/قدرات + لوحات) + إصلاحات الجولة الثانية
حسب المراجعة، بنفس ترتيبها (1 → 11).

## ما تم في هذه الجولة

| # | البند | الحالة |
|---|---|---|
| 1 | Bug فعلي: `id: number` بينما أسئلة Business نصية (`"business-1"`...) | ✅ أُصلح — `QuestionId = number \| string` في `src/lib/level-test/data.ts` |
| 2 | إجابات اختبار المستوى مكشوفة في المتصفح | ✅ نُقل بنك الأسئلة بالكامل إلى `src/lib/level-test/` (server-only) + `src/app/api/level-test/*`. المتصفح لا يستقبل الآن إلا السؤال الحالي بلا `answer`، ويُكشف الحل الصحيح لسؤال واحد فقط بعد الإجابة عليه (سلوك اختبار طبيعي) |
| 3 | جداول ناقصة + RLS غير مفعّل | ✅ أُضيفت `attendance`, `daily_tasks`, `learning_profiles`, `payments`, `teacher_availability` + دالة `cohort_available_seats`. RLS **مفعّل على كل الجداول** مع أضيق سياسات ذاتية ممكنة (ولي الأمر يرى بياناته وأبناءه فقط، الكتالوج العام مقروء للجميع). سياسات الإدارة/المعلمين الكاملة لم تُبنَ بعد عمدًا (تحتاج نظام أدوار Auth كامل) |
| 4 | لا يوجد Auth | ✅ تسجيل دخول فعلي بـ OTP عبر الجوال (`/login`) باستخدام Supabase Auth. **يتطلب تفعيل مزوّد SMS (Twilio مثلًا) من لوحة Supabase حتى يصل الرمز فعليًا** |
| 5 | صف/باقة/فترة تظهر كـ IDs داخلية | ✅ صفحة التسجيل تعرض الآن نص عربي كامل (الصف بالكلمات، اسم الباقة، الأيام الفعلية، الوقت) بدل `khota-3` و`evening-2` |
| 6 | قرار الأيام الفعلي للباقات غير موجود | ✅ `plans.day_patterns` في قاعدة البيانات (مثل: الأحد+الثلاثاء)، و`/motabaa/plans` أصبحت تجلب **مجموعات (cohorts) حقيقية** بأيامها ووقتها ومقاعدها المتبقية بدل "فترة" مجردة |
| 6b | Seat availability | ✅ دالة SQL آمنة `cohort_available_seats()` (لا تكشف صفوف الاشتراكات) + تحقق مضاعف من توفر المقعد عند التسجيل الفعلي في `/api/enroll` |
| 7 | السعر Hardcoded في React | ✅ يُقرأ الآن من `plans.price_sar` في قاعدة البيانات، لا يوجد رقم سعر مكتوب في الكود |
| 7b | مزوّد دفع حقيقي | ⛔ **لم يُربط** — `/api/payment/confirm` نقطة تكامل جاهزة بمكانها الصحيح مع تعليق TODO واضح، بديل "تأكيد تجريبي" ظاهر للمستخدم بوضوح أنه غير حقيقي. يحتاج قرارك بمزوّد الدفع (Moyasar/Tap/HyperPay...) |
| 8 | تفعيل الاشتراك | ✅ `/api/payment/confirm` يفعّل الاشتراك (`status: active`) بعد تأكيد الدفع، ويُنشئ سطر `payments` |
| 9 | Parent Dashboard | ✅ `/parent` يقرأ الآن بيانات حقيقية (مهام، توصيات) لولي الأمر المسجّل دخوله عبر RLS — يعرض شاشة "سجّل الدخول" إن لم يكن هناك جلسة |
| 10 | Teacher Dashboard | ✅ `/teacher` يقرأ جلسات اليوم الحقيقية للمعلم المسجّل دخوله |
| 11 | Admin Dashboard | ✅ `/admin` يقرأ أرقامًا حقيقية مجمّعة من القاعدة. ⚠️ **بلا حارس صلاحيات (RBAC) بعد** — أي شخص لديه رابط الصفحة يراها حاليًا، موضّح بشارة تحذير داخل الصفحة نفسها |

## بقي مفتوحًا عمدًا (خارج ما طُلب أو يحتاج قرارك)
- مزوّد الدفع الفعلي (بند 7ب).
- RBAC حقيقي لـ `/admin` و`/teacher` (تحقق أن المستخدم فعلًا أدمن/معلم، وليس مجرد "مسجّل دخول").
- سياسات RLS الكاملة لأدوار الإدارة والمعلمين (حاليًا الوصول الذاتي فقط + قراءة الكتالوج العام).
- الشعار (`src/components/Logo.tsx`) — مثبَّت الآن كشعار رسمي معتمد بقرارك.

## التشغيل
1. انسخ `.env.example` إلى `.env.local`، وأضف:
   - `NEXT_PUBLIC_SUPABASE_URL` و`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (تُستخدم في المتصفح — عامة وآمنة).
   - `SUPABASE_SERVICE_ROLE_KEY` (**سيرفر فقط** — لا NEXT_PUBLIC، لا تضعها أبدًا في كود يصل المتصفح).
2. نفّذ `supabase/schema.sql` بالكامل على مشروع Supabase فعلي (فيه كل الجداول + RLS + الدوال).
3. لتجربة `/motabaa/plans` فعليًا، أضف بيانات cohorts تجريبية بـ `status='open'` مرتبطة بـ `plans`.
4. لتفعيل تسجيل الدخول (`/login`)، فعّل مزوّد Phone/SMS من إعدادات Auth في Supabase.
5. `npm install` ثم `npm run dev` (يحتاج إنترنت أول مرة لتحميل خطوط Cairo/Poppins عبر next/font).
6. `npm run lint` ثم `npm run build`.

## ملاحظات من V2 (لا تزال سارية)
- `bookings` القديم لا يُحذف من قاعدة البيانات.
- لا تضع أي secret/service_role key في المتصفح — كل استخدام لـ `supabase-admin.ts` محصور بملفات `src/app/api/**` و Server Components فقط.

---

## V2.2 — منظومة ما بعد الدفع الحية (Post-Payment & Operating Engine)

| # | البند | الملفات | ملاحظات |
|---|---|---|---|
| 1 | تزويد كامل بعد الدفع | `api/payment/confirm/route.ts` | يفعّل الاشتراك بتواريخ محسوبة، يعيد التحقق من المقعد، يولّد جلسات الشهر الأول فعليًا مربوطة برابط القاعة. الطفل/الاشتراك/المجموعة تُنشأ عند enroll (تصميم V2 الأصلي، يعطي نفس النتيجة بترتيب أدق) |
| 2 | Smart Lobby | `parent/schedule/*`, `api/attendance/mark` | زر حقيقي بعدّاد تنازلي حي، يتفعّل قبل 10 دقائق، يسجّل الحضور بتفويض من الخادم لا من المتصفح، ثم يفتح رابط القاعة |
| 3 | Daily Pulse + Upsell | `parent/page.tsx`, `parent/recommendations/*`, `api/recommendations/request` | بطاقة الإنجاز تُقرأ من `daily_pulse_reports`؛ زر طلب التقوية يكتب في `premium_requests` وتقفل التوصية تلقائيًا |
| 4 | تقرير المعلم | `teacher/session-report/*`, `api/session-report/submit` | نموذج فعلي لكل طالب في الجلسة، يكتب `daily_pulse_reports` ويُنشئ `recommendations` تلقائيًا عند تفعيل "يحتاج جلسة فردية" |
| 5 | Schema Patch | `supabase/schema.sql` | `meeting_url` على cohorts/sessions + سياسات RLS كانت ناقصة تمامًا للمعلم ولجلسات/مجموعات أبناء ولي الأمر (بدونها V2.1 كانت ستُرجع فارغة رغم الكود الصحيح) |

### رابط القاعة (Meeting URL)
لا يوجد تكامل API حي مع Zoom/Teams (يحتاج مفاتيح ومزوّد لم يُحدَّد). التصميم المُنفَّذ: رابط قاعة **ثابت لكل مجموعة** يُدخله الأدمن يدويًا في `cohorts.meeting_url`، ويُنسخ تلقائيًا لكل جلسة عند توليدها. هذا تصميم إنتاجي صالح فعليًا لمنصات بحجم خُطى، وليس Placeholder — لكنه غير موجود له واجهة إدخال في `/admin` بعد (الإدخال حاليًا مباشرة في قاعدة البيانات فقط).

---

## KHOTA Product Architecture V3 (Phase 1 + Phase 2)

### Phase 1 — Stabilize
| بند | الحالة |
|---|---|
| تنظيف `level-test/engine.ts` | ✅ **اكتشاف حرج أثناء الفحص**: كان الملف يحتوي فعليًا المكوّن الكامل `LevelTestInner` (React hooks + JSX) بسبب خطأ في نقطة القص في الجولة الماضية — كان سيكسر البناء فورًا. أُزيل بالكامل؛ الملف الآن 211 سطرًا، دوال صرفة فقط (`getNextDifficulty`, `chooseNextQuestion`, `estimateLevel`) |
| QuestionId: number \| string | ✅ كان مُصلحًا مسبقًا من الجولة السابقة، تم التأكد بالفحص |
| npm run lint / npm run build | ⛔ **لم يُنفَّذ فعليًا** — بيئة التنفيذ هنا بلا اتصال إنترنت (تأكدت بمحاولة `npm install` فعلية، رجعت `403 Forbidden` على `registry.npmjs.org`)، ولا `node_modules` مثبّتة. الاستعاضة عنه بفحص استاتيكي يدوي: توازن الأقواس/الأقواس المعقوفة في كل ملف TS/TSX (83 ملفًا)، والتأكد أن كل ملف يستخدم React hooks يحمل `"use client"`. **هذا ليس بديلاً عن tsc/eslint/next build الحقيقية** — شغّلها عندك محليًا بعد `npm install` قبل أي نشر فعلي |

### Phase 2 — Core KHOTA Product (منفَّذ في هذه الجولة)
| # | الميزة | أين | ملاحظة |
|---|---|---|---|
| 5 | KHOTA Method | `/motabaa/how-it-works`, `teacher/session-report`, تعليقات `api/session-report/submit` | الخطوات الست (Scan→Prioritize→Guide→Reinforce→Prepare→Report) مبنية داخل منطق نموذج تقرير الجلسة الفعلي، وليست نصًا تسويقيًا فقط |
| 6 | Baseline Assessment | جدول `assessments` (append-only) + `/teacher/assessment` + `api/assessment/submit` | لا يُستبدل تقييم سابق أبدًا؛ `assessment_type`: baseline/monthly_review/manual_review |
| 7 | Weekly Goals | جدول `weekly_goals` + `/teacher/goals` + `api/goals/submit` + بطاقة في `/parent` | المعلم ينشئ/يحدّث الحالة؛ ولي الأمر يرى الهدف الحالي فقط في هذه الجولة (عرض الطالب المبسّط ضمن Phase 3 لاحقًا) |
| 8 | Progress Engine | جدول `child_progress_snapshots` + `/parent/reports` | Snapshot يُنشأ فقط من تقييم فعلي (لا أرقام وهمية) — مقياس 1-5 داخلي، موضّح صراحة في الواجهة أنه "ليس قياسًا معياريًا" |
| 9 | KHOTA Independence Score | جدول `independence_assessments` + `src/lib/independence.ts` (المعادلة معزولة في دالة قابلة للتغيير) + بطاقة في `/parent` | `total_score` يُحسب **على الخادم فقط** داخل `api/assessment/submit`، لا يصل أي منطق حساب للمتصفح |
| 10 | Tomorrow Ready | توسيع `daily_pulse_reports` (`materials_ready`, `tomorrow_test_status`, `remaining_review`, `readiness_status`) + قسم كامل في `SessionReportForm.tsx` + عرض في `/parent` | لم نكسر الحقل القديم `tomorrow_readiness` — بقي كـ fallback نصي |
| 11 | Weekly Parent Digest | `/parent/reports/weekly` | **مُولَّد بالكامل من استعلامات حقيقية عند كل طلب** (حضور، مهام، هدف الأسبوع، أقوى/أضعف تقدم من الـ snapshots، الاستقلالية، تاريخ الجاهزية، آخر توصية) — لا يُخزَّن كنص ثابت، تمامًا كما طُلب |

### اكتشاف RLS إضافي أثناء البناء
لم تكن هناك أي سياسة تسمح للمعلم بقراءة `subscriptions` إطلاقًا — كانت ستُرجع فارغة في `/teacher/students` و`/teacher/session-report` رغم صحة الكود. أُضيفت `subscriptions_of_own_teacher`.

### لم يُنفَّذ بعد (Phase 3 + Phase 4 — بانتظار جولة تالية)
اتّبعتُ قاعدتك الخاصة "لا تنتقل لمرحلة تالية إذا الحالية غير مستقرة" — وبما أن Phase 2 بهذا الحجم (4 جداول جديدة + 6 صفحات + 5 API routes) لم تُختبر ببناء حقيقي، أفضّل تسليمها كوحدة قابلة للمراجعة بدل إضافة Phase 3/4 فوقها دفعة واحدة:
- **Student Space** (`/student/*`) — لم يُبنَ.
- **Safe Messaging** (`message_threads`/`messages` + `/parent/messages` + `/teacher/messages`) — لم يُبنَ.
- **Mobile navigation (Hamburger menu)** — لم يُبنَ؛ لا يزال `nav` يختفي على الجوال بدون بديل (مشكلة معروفة من مراجعة سابقة، لم تُحل بعد).
- **Teacher Quality foundation** (`teacher_quality_metrics` + `/admin/teachers`) — لم يُبنَ.
- **Absence/Makeup/Pause** (`makeup_credits`, `subscription_pauses`) — لم يُبنَ.
- **Auth roles foundation نظيف + route protection/middleware** — الأدوار حاليًا تُحدَّد بالفحص المباشر (`teachers.user_id`/`parents.user_id`) داخل كل صفحة/route على حدة، وهو صحيح أمنيًا (Server-side دائمًا)، لكنه ليس middleware مركزيًا كما طلبت في البند 13.
- **/api/payment/confirm** — لم أضِف Guard صريح لمنعه في production بعد (البند 16) — لا يزال بحاجة لذلك.

### Environment variables جديدة
لا شيء جديد — نفس `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY`.

---

## V3.1 — Stabilization & Security Patch

**لا Features جديدة في هذه الجولة — تثبيت وأمان فقط، بلا إعادة تصميم لأي صفحة.**

### الملفات المعدَّلة
| ملف | التغيير |
|---|---|
| `src/lib/level-test/engine.ts` | (أ) استيراد `levelNames` القيمي كان ناقصًا — أُصلح. (ب) `a.id - b.id` غير صالح لـ `string` IDs — استُبدل بـ `String(a.id).localeCompare(String(b.id))` |
| `src/app/api/level-test/start/route.ts` | يُنشئ صفًا في `level_test_sessions` بدل الاعتماد على حالة العميل |
| `src/app/api/level-test/submit/route.ts` | إعادة تصميم كاملة: يقبل فقط `sessionId/questionId/selectedIndex`، يعيد بناء `history`/`answeredIds`/`targetDifficulty` من `level_test_answers` في كل طلب، يتحقق أن السؤال المُجاب مطابق لحالة الجلسة عند الخادم قبل قبوله |
| `src/app/english/level-test/page.tsx` | إزالة `history`/`answeredIds`/`targetDifficulty` من حالة العميل نهائيًا؛ إضافة `sessionId` وعداد `answeredCount` للعرض فقط (تجميلي، غير موثوق) |
| `supabase/schema.sql` | جداول `level_test_sessions`/`level_test_answers` (RLS مفعّل بلا أي policy — service_role فقط) • حذف `cohorts_public_read` واستبدالها بدالة `public_cohorts_catalog()` (SECURITY DEFINER، أعمدة آمنة فقط، بلا meeting_url) • دالة `submit_assessment()` معاملة ذرّية واحدة • `revoke` صريح على `submit_assessment` من public/anon/authenticated |
| `src/lib/independence.ts` | `calculateIndependenceScore` يرفض الآن أي مدخل غير صالح عبر `validateIndependenceInputs` (عدد صحيح 1-5 إلزاميًا) + `isValidLevelOrNull` / `isValidAssessmentType` |
| `src/app/api/assessment/submit/route.ts` | Input validation صريح لكل حقل قبل أي كتابة؛ 3 عمليات `insert` منفصلة استُبدلت بنداء واحد لـ `submit_assessment()` RPC |
| `src/app/motabaa/plans/page.tsx` | يستدعي `public_cohorts_catalog()` بدل SELECT مباشر على `cohorts` |
| `src/app/api/payment/confirm/route.ts` | Guard صريح: `403` فوري إذا `NODE_ENV === "production"`، مع تعليق يوضّح تدفق الإنتاج الصحيح (Webhook موقّع → verify signature → verify amount → mark paid → activate → create sessions) |

### كيف أصبحت حالة اختبار المستوى Server-owned
العميل يرسل الحد الأدنى المطلق (`sessionId`, `questionId`, `selectedIndex`) فقط. الخادم:
1. يرفض أي `questionId` لا يطابق `current_question_id` المخزَّن في `level_test_sessions` لهذه الجلسة تحديدًا.
2. يمنع إعادة الإجابة على نفس السؤال عبر قيد `unique(session_id, question_id)` في قاعدة البيانات (رفض 409 عند التكرار).
3. يعيد بناء `history`/`answeredIds` بالكامل من `level_test_answers` (وليس مما أرسله العميل) قبل حساب الصعوبة التالية أو المستوى النهائي.

### كيف أُغلق تسريب meeting_url
RLS تحمي الصفوف لا الأعمدة — أي policy عامة على `cohorts` كانت ستكشف `meeting_url` لأي طلب REST مباشر بمفتاح anon (المضمّن أصلًا في حزمة المتصفح)، بغضّ النظر عن اختيار أعمدة كود Next.js. الحل: حذف `cohorts_public_read` نهائيًا، واستبدالها بدالة `public_cohorts_catalog()` (SECURITY DEFINER) تُرجع أعمدة آمنة محدَّدة فقط. `meeting_url` يبقى مرئيًا حصرًا عبر `sessions`/`cohorts` المحمية بسياسات `..._of_own_children`/`..._of_own_teacher` (المستخدم المصرَّح له والمرتبط فعليًا بالاشتراك/الجلسة).

### كيف أصبحت كتابة Assessment ذرّية
دالة `submit_assessment()` (plpgsql، `SECURITY DEFINER`) تنفّذ الإدخالات الثلاثة (assessment + independence_assessment + progress_snapshot) داخل جسم دالة واحد — أي خطأ في أي إدراج يُفشل الدالة بالكامل تلقائيًا (ROLLBACK ضمني لأي معاملة PL/pgSQL فاشلة)، فلا تبقى كتابة جزئية. الصلاحية محجوبة عن anon/authenticated عبر `revoke` صريح — لا يستدعيها إلا route الخادم بعد تحقق الملكية.

### كيف حُمي /api/payment/confirm
`403` فوري إذا `NODE_ENV === "production"`، مع تعليق صريح أن تفعيل الدفع في الإنتاج يجب أن يأتي **فقط** من Webhook موقّع من مزوّد دفع حقيقي (لم يُربط أي مزوّد بعد — بانتظار قرارك).

### ما لم أستطع اختباره بسبب npm 403
لم أُنفّذ `npm run lint` أو `npm run build` فعليًا — لا يوجد اتصال إنترنت في هذه البيئة (تأكدت بمحاولة `npm install` حقيقية رجعت `403 Forbidden`). بدلًا من ذلك نفّذت فحصًا استاتيكيًا أدق شمل: توازن الأقواس عبر كل ملف TS/TSX (83 ملفًا) • بحثًا شاملًا عن افتراضات `QuestionId` الرقمية (لا يوجد سوى الموضع الذي أصلحته) • فحص كل ملف بلا `"use client"` بحثًا عن hooks مسرَّبة (لا يوجد) • فحص كل ملف `"use client"` بحثًا عن استيراد وحدات server-only مثل `supabase-admin`/`level-test/data` (لا يوجد) • تأكيد أن `SUPABASE_SERVICE_ROLE_KEY` لا يظهر إلا في `supabase-admin.ts` • تأكيد عدم وجود أي policy عامة متبقية على `cohorts` • تأكيد أن كل route كتابة يتحقق من الهوية (فيما عدا `level-test/*` و`enroll` المصمَّمين عمدًا كميزات ضيوف Guest، لكن كلاهما يتحقق من كل معرّف يصله مقابل قاعدة البيانات الفعلية قبل أي كتابة).
**هذا ليس بديلاً عن `tsc`/`eslint`/`next build` حقيقية — شغّلها محليًا قبل أي نشر.**

---

## V3.2 — Product/UX Review (تقرير المسؤول عن المنتج)

**لم أنفّذ كل نقطة حرفيًا — نفّذت ما رأيته الأعلى قيمة فعليًا لمنتج قابل للإطلاق، ضمن حجم معقول لجولة واحدة.**

### 1) ما الذي غيّرته ولماذا

| التغيير | لماذا |
|---|---|
| **Hamburger menu حقيقي** (`MobileNav.tsx`) | كانت `nav{display:none}` على الجوال **بلا أي بديل** — أي زائر جوال (الغالبية العظمى لأولياء الأمور) يفقد الوصول لـ"خُطى متابعة/English/قدرات" تمامًا. هذا أعلى أولوية طلبتها صراحةً، وكان معطوبًا فعليًا منذ أول مراجعة ولم يُصلَح قط رغم ذكره 3 مرات سابقًا |
| **RBAC حقيقي على `/admin`** | اكتشفت أن `/admin/page.tsx` **لم يكن لديه أي تحقق هوية إطلاقًا** — أي شخص لديه الرابط يرى أرقام تسجيلات واشتراكات حقيقية. أضفت جدول `admins` + تحقّق فعلي (وليس فقط إخفاء زر) + `middleware.ts` يمنع الوصول لـ`/parent`, `/teacher`, `/admin` بلا جلسة تسجيل دخول من الأساس، على مستوى الـ Route نفسه قبل أي كود صفحة |
| **إعادة ترتيب `/english`** | الصفحة كانت تعرض فقط "أطفال/بالغون"، ودفن التدريب الفردي والمجموعات والاختبار خطوة إضافية. الآن الصفحة تقود بالثلاث طرق الفعلية (اختبار مستوى ← الأنسب أولًا، برامج جماعية، فردي)، والفئة العمرية تصبح فلتر ثانوي — يطابق طلبك "لك حرية تحديد الترتيب بناءً على أفضل منطق منتج" |
| **إصلاح `/english/kids`** | لم يكن فيها أي رابط للتدريب الفردي إطلاقًا رغم وجوده في `/english/adults` — فجوة حقيقية اكتشفتها بالفحص، وليست تكهنًا |
| **`/teacher/schedule` من placeholder إلى حقيقي** | كانت "قيد التطوير" رغم أن `/teacher` الرئيسية أصلًا تعرض جلسات اليوم — الفجوة الحقيقية كانت غياب "الأسبوع كاملًا"، فبنيتها بنفس نمط `/parent/schedule` الموجود أصلًا (بلا تكرار منطق جديد) |

### 2) ما الذي أبقيته كما هو ولماذا

- **بنية الموقع العامة** (Home → Motabaa كمنتج أساسي، English/قدرات كذراعي نمو، `/start` كنقطة قرار موحّدة) — هذه بالفعل الرحلة الصحيحة Home → فهم → اختيار → تفاصيل → تسجيل → بوابة، ولا داعي لصفحة `/booking` أو `/training` منفصلة تكرر ما يفعله `/start` + `/motabaa/enroll` أصلًا.
- **تدفق الحجز/الدفع** (`/motabaa/plans` → `/motabaa/enroll` → `/motabaa/enroll/payment`) — بسيط وواضح فعليًا (3 خطوات، لا نماذج طويلة)، ويستخدم Supabase الحالي بلا تكرار بيانات. لم أجد نسخة أبسط منطقيًا تستحق إعادة البناء.
- **بنية الـ Dashboards** (ولي الأمر: بطاقة إنجاز + هدف الأسبوع + استقلالية أولًا، ثم روابط التفاصيل؛ المعلم: جلسات اليوم أولًا؛ الأدمن: KPIs أولًا) — هذا أصلًا "أهم شيء أولًا وليس قائمة خصائص" كما طلبت، من الجولات السابقة. لم أُعِد هيكلتها.
- **الهوية البصرية** (الألوان، Cairo/Poppins، الشعار، RTL) — لم أُغيّر أي شيء فيها، فقط أضفت كلاسات CSS جديدة للقائمة المنسدلة ضمن نفس نظام المتغيرات.

### 3) ما قررت عدم تنفيذه ولماذا

- **صفحة `/courses` منفصلة** — رفضتها عمدًا: "الدورة" في نموذج خُطى هي نفسها "المجموعة/البرنامج" (`/english/programs`, `/qudurat/programs`) — صفحة منفصلة لنفس المفهوم تُربك بدل أن توضّح، وتخالف تعليمتك "لا تُنشئ صفحة لمجرد أنها ذُكرت سابقًا".
- **إعادة تصميم Dashboards من الصفر** — الأساس موجود وصحيح فعليًا (أهم شيء أولًا)؛ إعادة بنائها الآن مخاطرة غير مبرَّرة على كود يعمل دون فائدة واضحة تُذكر.
- **بناء صفحات `/admin/*` الفرعية التسع بالكامل** — لا تزال placeholders. بناء 9 صفحة إدارية كاملة (طلاب/أولياء أمور/معلمون/مجموعات/جداول/برامج/اشتراكات/مدفوعات/تقارير) بجودة "لا اختصارات" يتجاوز حجم جولة واحدة معقولة إلى جانب كل ما سبق — تنفيذها الآن كان سيعني إما تسرّعًا رديئًا أو تجاهل باقي الأولويات الأهم (Mobile + RBAC) التي طلبتها كأولوية عليا صراحة.
- **إعادة تصميم بصري شامل (Spacing/Typography/Cards)** — لم أجد ضعفًا بصريًا حقيقيًا يستحق تدخلًا الآن يفوق قيمة إصلاح Mobile Nav/RBAC الحرجين؛ التصميم الحالي متسق ونظيف ضمن حدود الهوية.
- **دمج/حذف مسارات موجودة** — راجعت الخريطة الكاملة (49 مسارًا)، لم أجد تكرارًا حقيقيًا يستحق الحذف بعد إصلاح فجوة `/teacher/schedule` و`/english/kids` أعلاه.
- **`npm install`/`npm run build` فعليًا** — نفس القيد التقني من الجولات السابقة: لا اتصال إنترنت في هذه البيئة (403 مؤكد فعليًا). نفّذت فحصًا استاتيكيًا: توازن الأقواس عبر 85 ملفًا، تأكيد عدم استيراد وحدات server-only داخل أي `"use client"`، تأكيد وجود `middleware.ts` وصحة بنيته — **وهذا ليس بديلًا عن بناء حقيقي**، يجب تشغيله محليًا.

### 4) مقترحاتي كمرحلة لاحقة (بالأولوية)

1. **بناء صفحات `/admin/*` الفرعية فعليًا** — تحديدًا `/admin/students` و`/admin/subscriptions` (الأعلى استخدامًا يوميًا تشغيليًا).
2. **`/parent/children`, `/parent/subscriptions`, `/parent/payments`** — أقل إلحاحًا من الأدمن لأن أهم بياناتها معروضة أصلًا في اللوحة الرئيسية، لكنها تستحق نسخة حقيقية قبل الإطلاق.
3. **واجهة إدخال `meeting_url` من `/admin`** بدل الإدخال المباشر في قاعدة البيانات (نقطة معلّقة من الجولة السابقة).
4. **اختبار Mobile حقيقي على أجهزة فعلية** (حجم اللمس، تمرير الجداول العريضة كـ`.kpi`/`.dashboard-grid` عند الشاشات الضيقة جدًا) — بنيت القائمة المنسدلة، لكن لم أراجع كل Table/Dashboard بصريًا على شاشة 375px فعليًا.
5. **مراجعة بصرية مركّزة** (Typography scale، إيقونات بدل الشارات النصية في الأماكن المتكررة) إذا أردت رفع الإحساس "الجاهز للإطلاق" بصريًا بعد استقرار الوظائف.

---

## Phase 3A — Student Experience

### 1) ما الذي بنيته
مساحة طالب كاملة (`/student/today`, `/tasks`, `/schedule`, `/progress`, `/achievements`) بـ Shell مستقل تمامًا (bottom nav، بدون أي رابط لولي الأمر/معلم/أدمن)، وآلية "Student Mode" آمنة تحوّل جلسة ولي الأمر نفسها إلى وضع مقيَّد لطفل واحد محدَّد.

### 2) أهم قرارات UX ولماذا
- **بطاقة الجلسة الذكية بأربع حالات** (مبكر جدًا / عدّاد تنازلي / زر نابض كبير "دخول الآن" / "تمت ✓") — نفّذتها بنفس منطق `SessionJoinButton` الموجود لولي الأمر، لكن بلغة وحجم مناسبين للطفل.
- **"مهامي" تُملأ تلقائيًا من تقرير المعلم نفسه** — بدل بناء نظام إسناد مهام جديد (توسّع غير مبرَّر)، جعلت المواد المُنجزة في `session-report` تتحوّل تلقائيًا لمهام "مكتملة"، و`remaining_review` (Tomorrow Ready الموجودة أصلًا) تتحوّل لمهمة "معلَّقة" غدًا — بيانات حقيقية من أول تقرير معلم، بلا واجهة معلم جديدة إطلاقًا.
- **الإنجازات محسوبة من سلوك حقيقي** (نسبة حضور ≥75%، كل مهام الأسبوع منجزة، هدف محقَّق، استقلالية تصاعدية، مهمة قراءة منجزة) — لا Points، ولا وسام بلا معنى، والأوسمة غير المحقَّقة تظهر بتحفيز ("قريب! 💪") لا بإحساس فشل.
- **دمجت `/student` كنقطة دخول بمنطق توجيه** بدل صفحة مستقلة بمحتوى مكرَّر — إذا لا توجد جلسة طالب نشطة يوجّه لصفحة توضيحية بدل صفحة فارغة.
- **لم أبنِ تطبيقين منفصلين للفئتين العمريتين** — نفس الصفحات والمكوّنات، مع `isJuniorGrade(grade)` يتحكم في حجم الخط/البطاقات وكمية النص المعروض فقط (`.student-junior` كلاس CSS واحد).

### 3) الملفات الجديدة (24)
`supabase/schema.sql` (تعديل، انظر أدناه) • `src/lib/student-mode.ts`, `student-mode-constants.ts` • `src/components/StudentShell.tsx`, `ExitStudentMode.tsx` • `src/app/student/{page,today/{page,StudentSessionCard},tasks/{page,TaskList},schedule/page,progress/page,achievements/page}.tsx` • `src/app/api/student-mode/{enter,exit/request-otp,exit/verify}/route.ts` • `src/app/api/student/{tasks/toggle,attendance/mark}/route.ts` • `src/app/parent/children/{page,EnterStudentModeButton}.tsx` (كانت placeholder)

### 4) الملفات المعدَّلة
`src/middleware.ts` (حماية `/student` + منع الوصول لـ`/parent`,`/teacher`,`/admin` أثناء Student Mode) • `src/app/api/session-report/submit/route.ts` (توليد `daily_tasks` تلقائيًا) • `src/app/globals.css` (نظام تصميم كامل لمساحة الطالب)

### 5) Database Migration
جدول واحد جديد فقط: `student_mode_sessions` (id, parent_user_id, child_id, expires_at, active) — RLS مفعّل بلا أي policy (service_role فقط، بنفس نمط `level_test_sessions`). **لا جداول أخرى جديدة** — أُعيد استخدام `children`, `sessions`, `attendance`, `daily_tasks`, `weekly_goals`, `daily_pulse_reports`, `child_progress_snapshots`, `independence_assessments`, `subscriptions` كما هي بالكامل.

### 6) كيف طُبِّق Student Mode والصلاحيات
الطفل بلا هوية Supabase Auth مستقلة، فحدود الأمان الحقيقية هي: (أ) **جدول capability session عشوائي** (`student_mode_sessions`) — كوكي httpOnly يحمل معرّف الجلسة فقط، لا `childId` أبدًا. (ب) **كل صفحة/route تحت `/student/**` يشتق `childId` حصرًا من `getActiveStudentSession()`** التي تتحقق: الكوكي موجود ← الجلسة نشطة وغير منتهية ← `parent_user_id` يطابق `auth.uid()` الحالي فعليًا. (ج) بنيت **API منفصلة لمساحة الطالب** (`/api/student/attendance/mark`, `/api/student/tasks/toggle`) بدل إعادة استخدام نظائرها لولي الأمر — اكتشفت أثناء البناء أن إعادة الاستخدام كانت ستسمح لطالب A بلمس بيانات أخيه B (كلاهما "تابع لنفس ولي الأمر" من ناحية RLS، لكن ليس كلاهما "الطفل النشط في هذه الجلسة تحديدًا"). (د) **`middleware.ts`** يمنع الوصول لـ`/parent`,`/teacher`,`/admin` بمجرد وجود كوكي Student Mode — على مستوى الـ Route قبل أي كود صفحة، وليس بإخفاء واجهة. (هـ) **الخروج يتطلب إعادة تحقق فعلية**: إرسال OTP لجوال ولي الأمر المسجَّل في قاعدة البيانات (وليس رقمًا يُدخله المستخدم الحالي) عبر `supabase.auth.signInWithOtp`/`verifyOtp` الموجودة أصلًا — لا كلمة مرور مخزَّنة، لا مصادقة جديدة مخترَعة.

### 7) الفرق بين 1–3 و4–6
عبر `isJuniorGrade(grade) = grade <= 3` نفس المكوّنات بالضبط، مع: بطاقات وأزرار وخط أكبر (`.student-junior` في CSS)، نص أقل (`/student/schedule` يخفي اسم المعلم/المجموعة للصغار، `/student/today` يستخدم صيغة "شنو أسوي اليوم؟" بدل "المهمة الأهم")، تشجيع إيموجي أكبر بدل نص طويل.

### 8) نتائج اختبارات الصلاحيات (Quality Gate 1-5، تحقّق معماري)
| # | الاختبار | كيف تحقّق |
|---|---|---|
| 1 | ولي الأمر يدخل لطفله الصحيح | `/api/student-mode/enter` يتحقق `child.parent_id === parent.id` قبل إنشاء الجلسة |
| 2-4 | Student Mode لا يصل لـParent/Teacher/Admin | `middleware.ts` يعيد التوجيه فورًا عند وجود كوكي Student Mode، بصرف النظر عن الرابط المكتوب يدويًا |
| 5 | Student A لا يقرأ بيانات B | كل استعلام يستخدم `session.childId` من `getActiveStudentSession()` حصرًا؛ `/api/student/*` تتحقق أن أي سجل (task/attendance) يخص هذا الـ`childId` تحديدًا قبل أي كتابة |
| 11 | Refresh لا يكسر الجلسة | الحالة بالكامل في كوكي httpOnly + صف DB، لا React state — كل طلب يعيد التحقق من الصفر |
| 12 | العودة آمنة | OTP إلزامي قبل تعطيل الجلسة، وليس ضغطة واحدة |

### 9) نتيجة npm run build
**لم أستطع تشغيله فعليًا** — نفس القيد التقني من كل الجولات السابقة: هذه البيئة بلا اتصال إنترنت (تأكدت سابقًا بمحاولة `npm install` حقيقية رجعت 403). بدلًا منه نفّذت فحصًا استاتيكيًا شمل: توازن الأقواس عبر 103 ملفات TS/TSX (كلها متوازنة) • تأكيد عدم استيراد أي وحدة server-only (`supabase-admin`, `supabase-server`, `student-mode`) داخل أي ملف `"use client"` • تأكيد عدم وجود React hooks خارج ملفات `"use client"` • حل مشكلة حقيقية اكتشفتها بنفسي أثناء البناء: استيراد `student-mode.ts` (يحمل `server-only` + `next/headers`) داخل `middleware.ts` (Edge runtime) كان سيُدخل مخاطرة توافق حقيقية — فصلتها لملف `student-mode-constants.ts` خفيف الاستيراد قبل أن تتحول لمشكلة. **هذا ليس بديلًا عن build حقيقي — شغّله عندك فورًا كخطوة أولى.**

### 10) ما أقترح نقله لـ Phase 3B (لم أنفّذه الآن)
- **Child PIN / Quick Access** — البنية جاهزة (`student_mode_sessions` لا تفترض آلية دخول محدَّدة)، لكن لم أبنِه كما طلبت صراحةً.
- **Safe Messaging, Payment Gateway, Teams API, Notifications** — خارج حدود Phase 3A كما حدَّدت.
- **اختبار Mobile فعلي على 375/390/430px وiPad** — بنيت CSS مبنية على مبادئ Mobile-first (bottom nav، بطاقات كبيرة، لا جداول Desktop)، لكن لم أُعاينها بصريًا على أجهزة حقيقية لعدم توفر بيئة تصيير هنا.
- **واجهة Desktop مخصَّصة لمساحة الطالب** — حاليًا نفس التصميم المحوَّر للجوال يُعرض على Desktop بعرض متمركز 720px، وهو مقبول وظيفيًا لكن غير مُحسَّن بصريًا لشاشة كبيرة (لم يكن أولوية بناءً على "ابدأ من تجربة الطفل على الهاتف").
- **مؤشر تصاعد تدريجي (Independence Ladder)** — فكرة محتملة لجعل واجهة الصفوف 4-6 "تُفتح" تدريجيًا كلما زادت استقلالية الطالب الفعلية (من `independence_assessments`)، بدل أن تكون ثابتة حسب الصف فقط — أراها تخدم الهدف التربوي المذكور في طلبك لكنها تستحق نقاشًا منفصلًا قبل البناء.

---

## Phase 3A Security Stabilization + Phase 3B — Safe Institutional Messaging

### 1) إصلاحات Phase 3A الأمنية (كلها مؤكَّدة بالفحص قبل الإصلاح، وليست افتراضية)

| # | الثغرة | التأكيد | الإصلاح |
|---|---|---|---|
| 1 | `/api/student/attendance/mark` يقبل أي `sessionId` بلا تحقق من الانتماء الفعلي | ✅ أكَّدت: الكود كان يجلب أي صف `sessions` بالـ id فقط، بلا أي شرط على `cohort_id` | يتحقق الآن من السلسلة الكاملة: اشتراكات الطفل الفعّالة → مجموعاتها (`cohort_id`) → أن الجلسة المطلوبة تتبع فعليًا إحدى هذه المجموعات، وإلا 403 قبل أي كتابة أو إرجاع `meeting_url` |
| 2 | Exit Gate يُرسل رقم الجوال الكامل للعميل، ويثق بـ`phone` القادم منه عند التحقق | ✅ أكَّدت: `request-otp` كان يُرجع `phone` صراحةً في الـJSON، و`verify` كان يقبله من الجسم | `request-otp` يُرجع `maskedPhone` فقط الآن. `verify` يقبل `code` فقط؛ الخادم يشتق رقم الجوال من جلسة الطالب النشطة → الطفل → ولي الأمر → `parents.phone` |
| 3 | لا يوجد Guard مركزي يمنع Student Mode من استدعاء APIs حساسة | لم يكن موجودًا إطلاقًا سابقًا | `isStudentModeAllowedApiPath()` في `student-mode-constants.ts` (allowlist صريحة: `/api/student/*`, `/api/student-mode/exit/*`) + تطبيقها في `middleware.ts` على كل مسار `/api/*` أثناء Student Mode نشطة — أي شيء آخر يُرفض 403 قبل الوصول لأي route handler |
| 4 | كوكي Student Mode قديمة/غير صالحة تحبس ولي الأمر خارج `/parent` للأبد | لم تكن هناك آلية تنظيف | `middleware.ts` يتحقق الآن فعليًا من صلاحية الجلسة بقاعدة البيانات (نشطة + غير منتهية + تخص المستخدم الحالي) — وليس فقط وجود الكوكي؛ عند عدم الصلاحية يمسحها فورًا من الاستجابة |

**قرار معماري إضافي غير مطلوب صراحةً:** أضفت سياسة RLS ضيقة `student_session_self_read` (ولي الأمر يقرأ صف جلسته الخاصة فقط) لأن `middleware.ts` يعمل على Edge runtime بجلسة المستخدم نفسها (JWT عادي)، ولا يصح استخدام `service_role` هناك — بدون هذه السياسة كان التحقق الحقيقي من صلاحية الجلسة في middleware مستحيلًا تقنيًا.

### 2) الملفات الجديدة (Phase 3B)
`src/lib/messaging-config.ts` (Quiet Hours مركزي) • `src/components/MessageThread.tsx` (مشترك بين ولي الأمر والمعلم) • `src/app/api/messages/{thread,send,read}/route.ts` • `src/app/parent/messages/{page,StartThreadButton,[threadId]/page}.tsx` • `src/app/teacher/messages/{page,[threadId]/page}.tsx`

### 3) الملفات المعدَّلة
`src/middleware.ts` (إعادة تصميم كامل — تحقق فعلي من الجلسة + Guard الـ API) • `src/lib/student-mode-constants.ts` (+`isStudentModeAllowedApiPath`) • `src/app/api/student/attendance/mark/route.ts`, `src/app/api/student-mode/exit/{request-otp,verify}/route.ts`, `src/components/ExitStudentMode.tsx` (إصلاحات 1-2 أعلاه) • `supabase/schema.sql` • `src/app/globals.css` (تصميم الرسائل) • `src/app/parent/page.tsx`, `src/app/teacher/page.tsx` (رابط "الرسائل")

### 4) Database Migration
جدولان جديدان فقط + سياسة RLS واحدة على جدول موجود مسبقًا:
- `message_threads`, `messages` (تفاصيلهما أدناه)
- `student_mode_sessions`: إضافة `create policy "student_session_self_read" ... for select using (auth.uid() = parent_user_id)`

**لا حذف أو تعديل مدمّر على أي جدول قائم.**

### 5) جداول Messaging النهائية
```sql
message_threads(id, child_id, parent_user_id, teacher_user_id, cohort_id, status, created_at, updated_at)
  unique(child_id, teacher_user_id)  -- محادثة واحدة لكل ثنائي (طفل، معلم) — تبسيط مقصود

messages(id, thread_id, sender_user_id, sender_role, body, created_at, read_at)
```
استخدمت `parent_user_id`/`teacher_user_id` (مباشرة إلى `auth.users`) بدل `parents.id`/`teachers.id` تحديدًا لأن كل سياسات RLS تعتمد على `auth.uid()` مباشرة — مطابقة تامة بلا joins إضافية في كل سياسة.

### 6) RLS policies المضافة
`threads_of_parent`, `threads_of_teacher` (قراءة فقط لطرفَي المحادثة) • `messages_of_thread_parent`, `messages_of_thread_teacher` • `teachers_visible_to_messaging_parents` (سياسة ضيقة إضافية: ولي الأمر يرى اسم معلم له معه محادثة فقط — لا أي معلم آخر؛ كانت `teachers` محجوبة عن ولي الأمر بالكامل سابقًا). **لا سياسة Admin** — لم تُطلب صراحةً، تُركت غير موجودة عمدًا ("Explicit ومقصود لا ضمني"). **لا سياسات INSERT/UPDATE من المتصفح إطلاقًا** — كل كتابة عبر API فقط.

### 7) Server-side Authorization
كل عملية حساسة تعيد التحقق من الصفر بلا ثقة بأي معرّف من العميل:
- **إنشاء Thread**: `childId`+`cohortId` من العميل، لكن التحقق الفعلي: `child.parent_id === parent.id` ← اشتراك فعّال بهذا الـcohort تحديدًا ← `cohort.teacher_id` ← `teacher.user_id` — أربع خطوات تحقق متسلسلة قبل أي إدراج.
- **إرسال رسالة**: `thread.parent_user_id`/`teacher_user_id` الفعليان من قاعدة البيانات (وليس أي دور يدّعيه العميل) يحددان `sender_role`.
- **تحديد كمقروء**: نفس التحقق من الطرفين قبل أي `UPDATE`.

### 8) Quiet Hours implementation
إعداد مركزي واحد (`src/lib/messaging-config.ts`): `{timezone: "Asia/Riyadh", startHour: 20, endHour: 8}`. `isQuietHoursNow()` يدعم النطاق العابر لمنتصف الليل. **لا يمنع الإرسال أبدًا** — `/api/messages/send` يحفظ الرسالة طبيعيًا دائمًا، ويُرجع `quietHours:true` + النص التوضيحي فقط للعرض، بلا أي علاقة بمنطق القبول/الرفض — تصميم جاهز لربط Notifications/SLA لاحقًا من نفس المكان دون تغيير منطق الإرسال.

### 9) نتيجة Negative Security Tests (تحقّق معماري لكل حالة)
جميع الحالات الـ12 المطلوبة تحققت هيكليًا (تفصيل كامل بالكود لكل حالة). أهم ملاحظة صادقة: **صفحات** `/parent/messages/[threadId]` و`/teacher/messages/[threadId]` عند طلب محادثة لا تخص المستخدم تُرجع "غير متاحة" بحالة HTTP 200 (RLS تُرجع صفًا فارغًا فتُعرض رسالة، بنفس نمط `/admin` الحالي في المشروع) — **وليس 403 حرفيًا كصفحة**؛ لا تسريب بيانات فعليًا (هذا هو المهم)، لكن الحالة النصية للاختبار تختلف عن الـ API routes التي تُرجع 403 صريحة دائمًا.

### 10) نتيجة npm run build
**لم أستطع تشغيله فعليًا** — نفس القيد التقني من كل الجولات: هذه البيئة بلا اتصال إنترنت (403 مؤكَّد فعليًا من محاولة `npm install` سابقًا). فحص استاتيكي بديل نُفِّذ: توازن الأقواس عبر 113 ملف TS/TSX (كلها متوازنة) • لا استيراد لوحدات server-only داخل أي `"use client"` (شمل الملفات الجديدة) • لا React hooks خارج ملفات `"use client"` • `SUPABASE_SERVICE_ROLE_KEY` ما زال حصرًا في `supabase-admin.ts`. **هذا ليس بديلًا عن build حقيقي.**

### 11) قرارات معمارية اتخذتها بشكل مختلف ولماذا
- **لا Split View على Desktop** — استخدمت نمط "قائمة → صفحة محادثة منفصلة" (`/parent/messages` → `/parent/messages/[id]`) على كل الأحجام بدل Split View مخصَّص لـ Desktop، لتفادي طبقة تعقيد UI إضافية (حالة "أي محادثة مفتوحة" في الشاشة نفسها) مقابل فائدة محدودة، خصوصًا أن التركيز الصريح كان Mobile First.
- **جدول واحد فقط للمحادثة لكل (طفل، معلم)** بدل مواضيع/Threads متعددة لكل ثنائي — إذا درّس نفس المعلم نفس الطفل في أكثر من مجموعة، تبقى محادثة واحدة (يُحدَّث `cohort_id` لآخر سياق). قرار تبسيطي مقصود يمنع صناديق بريد مكرّرة لنفس العلاقة.
- **عرضت "ولي أمر [اسم الطفل]" للمعلم بدل اسم ولي الأمر الشخصي** — تجنّبًا لإضافة سياسة RLS جديدة تمنح المعلم قراءة جدول `parents`، ولأن "Child Context بوضوح" (المطلوب صراحةً) لا يحتاج فعليًا اسم ولي الأمر الشخصي.
- **حد أمني معروف لم يُطلب حله الآن**: بما أن Student Mode يستخدم JWT ولي الأمر نفسه (تصميم Phase 3A الأصلي المعتمد)، فإن RLS وحدها لا تستطيع تمييز "المتصفح في وضع الطالب" عن ولي الأمر نفسه لو استُدعيت Supabase REST API مباشرة متجاوزةً middleware/الواجهة تمامًا (سيناريو متقدّم يتطلب فتح Devtools ومعرفة تقنية). طبقة التطبيق (middleware + APIs + RLS للأدوار المختلفة) تمنع هذا في كل مسار استخدام طبيعي، لكن الإغلاق الكامل يتطلب هوية Supabase Auth منفصلة فعليًا للطالب — تغيير معماري جذري لم أنفّذه بلا إذن صريح كما طلبت، وأقترحه لبند Phase 3C إذا رأيته يستحق الأولوية.

---

# KHOTA Product Architecture V3

هذا القسم توثيق معماري دائم — يُقرأ لفهم كيف يعمل النظام، وليس سجل تغييرات. (سجلات التغييرات لكل مرحلة موجودة أعلاه في هذا الملف.)

## دورة حياة العميل

```
Visitor
  → Parent Authentication (Supabase Auth Phone OTP — src/app/login)
  → Child (children table, ينشئه ولي الأمر عبر /motabaa/enroll)
  → Enrollment / Subscription (subscriptions.status: pending_payment → active)
  → Cohort (المجموعة الفعلية: أيام، وقت، معلم، سعة)
  → Student Mode (اختياري — ولي الأمر يدخل مساحة طالب مقيَّدة لطفل واحد)
  → Session (تُولَّد تلقائيًا شهريًا من days_of_week الخاصة بالـ Cohort)
  → Attendance (يسجّلها الطالب بنفسه عبر "دخول الجلسة"، ويؤكدها/يصححها المعلم في تقرير الجلسة)
  → Tasks / Goals (daily_tasks تُشتق تلقائيًا من تقرير المعلم؛ weekly_goals يضعها المعلم يدويًا)
  → Daily Pulse / Session Report (توثيق الجلسة + Tomorrow Ready + الحضور + رصيد التعويض عند الحاجة)
  → Progress (child_progress_snapshots، مشتقة من تقييمات فعلية فقط)
  → Achievements (محسوبة ديناميكيًا من سلوك حقيقي، لا تُخزَّن كوسام ثابت)
  → Safe Messaging (قناة مقيَّدة بعلاقة تسجيل فعلية حالية، وليست Chat عامة)
  → Absence (attendance.reason: excused / unexcused / exceptional_approved)
  → Makeup (makeup_credits: دورة حياة كاملة، استرداد ذرّي عبر RPC)
  → Subscription Pause (Workflow اعتماد صريح: requested → approved/rejected)
  → Teacher Quality (Scorecard مؤشرات منفصلة، لا رقم واحد)
  → Admin Operations (كتالوجات، مراجعة تجميد، تنبيهات نصاب المجموعات)
```

## Roles و Authorization Model

أربعة أدوار، ولا واحد منها "role" مخزَّن كحقل بسيط في جدول مستخدمين — كل دور جدول مستقل مرتبط بـ`auth.users(id)`:

| الدور | كيف يُحدَّد | أين |
|---|---|---|
| Parent | صف في `parents` حيث `user_id = auth.uid()` | كل صفحة `/parent/**` |
| Teacher | صف في `teachers` حيث `user_id = auth.uid()` | كل صفحة `/teacher/**` |
| Admin | صف في `admins` حيث `user_id = auth.uid()` | كل صفحة `/admin/**` — **RBAC حقيقي أُضيف في V3.2** (لم يكن موجودًا قبلها) |
| Student | **ليس دورًا في Auth إطلاقًا** — انظر "Student Mode" أدناه | `/student/**` |

**لا يُحدَّد أي دور من قيمة يرسلها العميل مطلقًا** — كل تحقق دور يستعلم قاعدة البيانات مباشرة بمفتاح `service_role` (server-only) أو عبر RLS بجلسة المستخدم.

## RLS Approach

القاعدة الثابتة عبر كل جدول جديد منذ V2.1: **RLS مفعّلة دائمًا، وتُمنح سياسات SELECT ضيقة "لبياناتك أنت فقط"، ولا تُمنح أي سياسة INSERT/UPDATE من المتصفح للجداول التشغيلية/الحساسة إطلاقًا.** كل كتابة حساسة (تسجيل، دفع، تقرير جلسة، تقييم، رسالة، رصيد تعويض، تجميد) تمر عبر `src/app/api/**` بمفتاح `service_role`، بعد إعادة تحقق كاملة من العلاقة الفعلية في كود الـ route نفسه — RLS تمنع التسريب عبر REST API مباشر، والـ API تمنع الالتفاف على منطق العمل.

استثناءات موثَّقة صراحة حيث RLS لا تكفي وحدها:
- `student_mode_sessions`: سياسة قراءة ذاتية واحدة فقط (`student_session_self_read`) لأن `middleware.ts` يعمل على Edge runtime بجلسة المستخدم العادية، لا `service_role`.
- `public_cohorts_catalog()` / `cohort_available_seats()`: دوال `SECURITY DEFINER` بدل سياسة عامة على الجدول — لأن RLS تحمي **الصفوف** لا **الأعمدة** (كانت ستكشف `meeting_url` لأي طلب REST مباشر بمفتاح anon العام).

## Student Mode — Security Boundary (موثَّق بوضوح، غير حل نهائي)

**Student Mode يستخدم حاليًا JWT ولي الأمر نفسه، مع تقييد على مستوى التطبيق (Application-level restricted session) — وليس هوية Supabase Auth مستقلة للطالب.**

الحماية الفعلية طبقتان:
1. **Capability session عشوائية** (`student_mode_sessions` + كوكي httpOnly) — كل صفحة/API تحت `/student/**` تشتق `child_id` منها حصرًا، لا من أي مدخل من العميل.
2. **`middleware.ts`** يمنع الوصول لـ`/parent`,`/teacher`,`/admin` ولأي `/api/*` غير مُدرجة صراحةً في allowlist (`isStudentModeAllowedApiPath`) أثناء الجلسة نشطة — على مستوى الـ Route قبل أي كود صفحة.

**الحد المعروف (Known V3 Security Boundary):** بما أن الـJWT الفعلي هو جلسة ولي الأمر، فإن استدعاء Supabase REST API مباشرة (متجاوزًا التطبيق كليًا عبر Devtools) نظريًا لا يزال ممكنًا لمستخدم تقني متقدّم، لأن RLS وحدها لا تميّز "المتصفح في وضع الطالب" عن ولي الأمر نفسه. **الإغلاق الكامل لهذه الفجوة يتطلب هوية Auth مستقلة فعليًا للطالب — تغيير معماري لم يُنفَّذ في V3 بلا إذن صريح، ومُوثَّق هنا كـ Future Hardening candidate (Phase 3C أو لاحقًا).**

## Messaging Relationship Model

محادثة واحدة لكل زوج (`child_id`, `teacher_user_id`) — إذا درّس نفس المعلم نفس الطفل في أكثر من برنامج، تبقى محادثة واحدة. الصلاحية **تُعاد** التحقق منها في كل عملية حساسة عبر `authorizeMessageThreadAccess()` (وليس فقط عند الإنشاء): إذا انتهى الاشتراك، أو انتقل الطفل لمجموعة أخرى، أو تغيّر معلم المجموعة — تتحول المحادثة تلقائيًا إلى **Historical/Read-only** (قراءة مسموحة دائمًا، إرسال ممنوع، برسالة توضيحية للمستخدم). لا يرث معلم جديد محادثة قديمة تلقائيًا — أي علاقة (طفل، معلم) جديدة تُنشئ صفًا جديدًا بالكامل.

## Makeup Policy

- **الغياب غير المبرَّر لا يولّد رصيدًا تلقائيًا أبدًا** — قرار منتج صريح في `src/lib/policies.ts`، وليس تفصيلًا تقنيًا.
- **السقف الشهري (رصيدان) يُطبَّق فقط على الغياب الناتج عن الطالب نفسه** — إلغاء المعلم/المنصة/قرار إداري صريح لا يخضع له إطلاقًا.
- **جلسات التعويض** تُحدَّد بعلم `sessions.makeup_eligible` صريح، وليس ربطًا باسم يوم — الإدارة تغيّر اليوم/الوقت/المجموعة بتغيير هذا العلم فقط.
- **الاسترداد ذرّي** عبر `redeem_makeup_credit()` (Postgres RPC بـ `for update` row-lock) — يمنع الاستخدام المزدوج عند الضغط المتكرر أو الطلبات المتزامنة.

## Pause Policy

القرار المعتمد في V3: **تجميد معتمَد = تعليق الخدمة + تمديد تاريخ التجديد بنفس عدد أيام التجميد، بلا رصيد تعويض إضافي** (تجنّبًا لتعويض مزدوج — الطالب اختار التوقف). أقصى مدة 7 أيام، لا تجميد متداخل، لا تجميد بأثر رجعي — كل القيم في `PAUSE_POLICY`. الاعتماد يدوي من الإدارة (`requested → approved/rejected`)، وليس تلقائيًا.

## Teacher Scorecard — Formulas

| المؤشر | الصيغة | الفترة |
|---|---|---|
| الالتزام | `completed / (completed + cancelled_by_teacher)` — الإلغاء التشغيلي (platform) مستبعد كليًا من المعادلة | آخر 30 يومًا |
| دقة تسليم التقرير | نسبة الجلسات المكتملة التي رُفع تقريرها خلال `SCORECARD_POLICY.REPORT_SLA_HOURS` (24 ساعة افتراضيًا) من نهاية الجلسة | آخر 30 يومًا |
| مجموعات مسندة | `count(cohorts where teacher_id = T)` | حاليًا |
| طلاب نشطون | `count(distinct child_id)` من اشتراكات فعّالة في مجموعاته | حاليًا |

**لا رقم واحد مجمَّع.** Status (`Healthy`/`Attention`/`Critical`/`Insufficient data`) مشتق من عتبات موثَّقة في كود الصفحة نفسه (`deriveStatus`)، قابلة للتعديل لاحقًا متى توفّرت Policy أوزان واضحة.

## Quiet Hours Configuration

إعداد مركزي واحد (`src/lib/messaging-config.ts`): `{timezone: "Asia/Riyadh", startHour: 20, endHour: 8}`. لا يمنع الإرسال أبدًا — يُرجع علمًا للعرض فقط، جاهز لربط Notifications/SLA لاحقًا من نفس المكان.

---

## Final V3 Report — Messaging Patch + Phase 4 (Operations & Policies)

### 1) Phase 3B Authorization Patch
`authorizeMessageThreadAccess()` (`src/lib/messaging-authorization.ts`) — Guard مركزي يُعاد استدعاؤه في **كل** عملية حساسة (فتح محادثة، إرسال، تحديد كمقروء)، لا فقط عند الإنشاء. يتحقق أن العلاقة **لا تزال قائمة الآن**: ولي الأمر لا يزال مالك الطفل فعليًا، والمعلم لا يزال معلم مجموعة للطفل فيها اشتراك فعّال. عند انتهاء العلاقة: القراءة تبقى متاحة دائمًا (Historical)، الإرسال يُرفض بـ409 برسالة توضيحية.

### 2) Absence Policy النهائية
`src/lib/policies.ts` — الغياب غير المبرَّر لا يولّد رصيدًا أبدًا؛ المبرَّر والاستثنائي المعتمد فقط يولّدان رصيدًا؛ السقف الشهري (رصيدان) لا يُطبَّق على إلغاء المعلم/المنصة. مصدر واحد للقرار، مستدعى من `issueMakeupCreditIfEligible()` فقط.

### 3) Makeup Credit Lifecycle
`available → reserved(ضمنيًا داخل المعاملة) → used | expired | cancelled`. كل رصيد قابل للتتبع بالكامل (`child_id`, `subscription_id`, `source_session_id`, `source_type`, `reason`, `issued_by`, `issued_at`, `expires_at`, `redeemed_session_id`, `redeemed_at`). Double-issuance ممنوع بنيويًا بقيد `unique(source_session_id, child_id)`. Double-redemption ممنوع بمعاملة `for update` row-lock داخل `redeem_makeup_credit()`.

### 4) Monthly Limit
مطبَّق حصرًا على `source_type = 'student_absence'` عبر `isMonthlyCapApplicable()`. إلغاء المعلم/المنصة يصدر رصيدًا لكل الطلاب المسجَّلين فعليًا في `/api/session/cancel` بلا أي فحص سقف.

### 5) Makeup Booking Flow
`/parent/schedule` يعرض رصيدًا متاحًا + جلسات `makeup_eligible=true` القادمة → زر "استخدم الرصيد هنا" → `/api/makeup/redeem` → RPC ذرّية. **قرار تصميم صريح**: لا نتحقق أن جلسة التعويض تخص نفس مجموعة الطفل الأصلية — أي جلسة معلَّمة `makeup_eligible` متاحة لأي رصيد صالح (تمامًا كمفهوم "مجموعة تعويض مشتركة" الذي وصفته).

### 6) Subscription Pause Workflow
`requested → approved/rejected` (لا أتمتة لـ`active/completed` — يحتاج Scheduler غير متوفر في هذه المعمارية Next.js-only، موثَّق كقيد أدناه). الاعتماد يمدّد `renewal_date` بعدد أيام التجميد فورًا. القيود الأربعة (مدة ≤7، لا تداخل، لا رجعية، اشتراك فعّال) كلها Server-side قبل الإدراج.

### 7) Teacher Scorecard Formulas
موثَّقة بالكامل في قسم "KHOTA Product Architecture V3" أعلاه — أربعة مؤشرات منفصلة + Status مشتق من عتبات موثَّقة، بلا رقم مجمَّع واحد.

### 8) Single-Student Cohort Alert
`/admin/groups` — من `subscriptions.status='active'` الحالية فقط (وليس التاريخ الكامل)، تنبيه بصري فقط، لا دمج تلقائي.

### 9) الملفات الجديدة (24)
`src/lib/{messaging-authorization,policies,makeup-credits}.ts` • `src/app/api/{session/cancel,makeup/redeem,subscription-pause/request,subscription-pause/review}/route.ts` • `src/app/parent/schedule/RedeemCreditCard.tsx` • `src/app/parent/subscriptions/PauseRequestForm.tsx` • `src/app/admin/subscriptions/{page,ReviewButtons}.tsx`

### 10) الملفات المعدَّلة
`src/app/api/messages/{send,read}/route.ts`, `src/components/MessageThread.tsx`, `src/app/{parent,teacher}/messages/[threadId]/page.tsx` (Part 0) • `supabase/schema.sql` • `src/app/api/session-report/submit/route.ts` + `SessionReportForm.tsx` (الحضور + سبب الغياب) • `src/app/parent/schedule/page.tsx` (فائتة + أرصدة) • `src/app/admin/{teachers,groups}/page.tsx` (من placeholder إلى حقيقي)

### 11) Database Migrations
جدولان جديدان (`makeup_credits`, `subscription_pauses`) + توسيع `attendance`(+`reason`) و`sessions`(+`cancelled_by`, +`makeup_eligible`) + دالة `redeem_makeup_credit()`. **لا حذف أو تعديل مدمّر على أي جدول قائم.**

### 12) RLS Policies المضافة
`makeup_credits_of_own_children`, `pauses_of_own_subscriptions` (قراءة فقط) • `makeup_eligible_sessions_visible_to_authenticated` (اكتُشفت الحاجة إليها أثناء البناء — بدونها كانت صفحة حجز التعويض ستُرجع فارغة دائمًا للوالدين) • لا سياسة معلم على `makeup_credits`/`subscription_pauses` عمدًا (لا حاجة تشغيلية).

### 13) Constraints / Idempotency
`unique(source_session_id, child_id)` على `makeup_credits` (منع Double Credit) + `upsert ... ignoreDuplicates` في كود الإصدار (طبقة حماية ثانية) • `for update` row-lock داخل `redeem_makeup_credit()` (منع Double Redemption عند التزامن الحقيقي، وليس فقط فحص قبل الكتابة) • `unique(child_id, teacher_user_id)` على `message_threads` (منع صناديق بريد مكرَّرة).

### 14) نتائج Negative Security Tests (تحقّق معماري لكل حالة، 18 حالة)
جميعها مغطّاة هيكليًا بالكود أعلاه. أهم ثلاث ملاحظات صادقة:
- حالات Pause رقم 9-13 والـMakeup رقم 1-8: كلها مُنفَّذة كفحوصات صريحة قبل أي كتابة (انظر الأكواد). لم أُشغّل اختبارات آلية فعلية (لا بيئة تشغيل).
- Messaging 16-17 (المعلم السابق لا يرسل / Historical لا تقبل رسائل): مؤكَّدة معماريًا عبر `authorizeMessageThreadAccess`.
- Student Mode 18 (لا يستدعي Operations APIs): محقَّقة تلقائيًا لأن `/api/makeup/*`, `/api/subscription-pause/*`, `/api/session/cancel` غير مُدرجة في allowlist الموجود من V3.1 — **لم يحتج أي تعديل جديد**.

### 15) نتيجة lint
`package.json` يحتوي `"lint": "eslint"`. جرَّبته فعليًا: `sh: 1: eslint: not found` — الحزمة غير مثبَّتة (لا `node_modules`)، ولا يمكن تثبيتها (لا إنترنت). **لم أدّعِ نتيجة لم تُنفَّذ.**

### 16) نتيجة npm run build
جرَّبته فعليًا: `sh: 1: next: not found` لنفس السبب. أعدت تأكيد فشل `npm install` أيضًا (`403 Forbidden` من `registry.npmjs.org`، طازج من هذه الجولة تحديدًا). فحص استاتيكي بديل: توازن الأقواس عبر 123 ملف TS/TSX (كلها متوازنة)، لا استيراد server-only داخل أي `"use client"`، لا React hooks خارج ملفات العميل، `SUPABASE_SERVICE_ROLE_KEY` حصرًا في `supabase-admin.ts`. **هذا فحص يدوي وليس بديلًا عن build حقيقي.**

### 17) Known V3 Limitations (صريحة، ليست أعذارًا)
- **Student Mode Security Boundary** — موثَّق بالتفصيل في قسم Architecture أعلاه؛ يحتاج هوية Auth مستقلة للطالب لإغلاق كامل، لم يُنفَّذ بلا إذن.
- **Pause Lifecycle** — `requested/approved/rejected` مُنفَّذة بالكامل؛ `active/completed` التلقائية تحتاج Scheduler (cron) غير موجود في هذه المعمارية Next.js-only.
- **Makeup capacity check** مبسَّط — يحسب فقط عدد الأرصدة المستخدَمة على نفس الجلسة مقابل `cohorts.capacity`، ولا يجمع العدد الفعلي للطلاب الأصليين المسجَّلين في تلك الجلسة تحديدًا (تعقيد إضافي لم يُطلب بدقة كافية لتنفيذه الآن).
- **لا اختبارات آلية فعلية نُفِّذت** — كل التحقق أعلاه معماري (قراءة الكود)، وليس تشغيلًا حقيقيًا لسيناريوهات الاختراق.
- **`/admin/subscriptions`, `/admin/groups`, `/admin/teachers`** فقط من بين 9 صفحات `/admin/*` الفرعية أصبحت حقيقية؛ الباقي (طلاب، أولياء أمور، معلمون، جداول، برامج، مدفوعات، تقارير) لا تزال placeholders من V2.

### 18) ما الذي أصبح جاهزًا للاختبار التجريبي (Pilot)
✅ التسجيل والدفع (Dev-only) → الاشتراك → توليد الجلسات ✅ مساحة الطالب الكاملة بأمانها الأساسي ✅ تقرير المعلم مع الحضور والغياب المصنَّف ✅ التوصيات والترقية ✅ التواصل المؤسسي بصلاحية مُعاد التحقق منها باستمرار ✅ رصيد التعويض من الإصدار للاسترداد الآمن ✅ طلب التجميد واعتماده اليدوي ✅ Scorecard المعلمين وتنبيه نصاب المجموعات.

⛔ **قبل Pilot فعلي حقيقي (وليس بيئة تطوير)**: يجب تشغيل `npm install && npm run build` بيئة حقيقية وإصلاح أي خطأ يظهر (لم يُختبر هنا إطلاقًا) — هذا هو الفجوة الوحيدة غير المُغلقة بين هذا التسليم وجاهزية Pilot فعلية.

---

## V3 — FINAL FREEZE (Pilot Candidate)

**V3 Feature-Frozen.** الإصلاحات الثلاثة الحرجة الأخيرة قبل الـPilot: (1) `/api/attendance/mark` يتحقق الآن من السلسلة الكاملة `subscription.cohort_id === session.cohort_id`، (2) `redeem_makeup_credit()` يحسب السعة الفعلية (طلاب نشطون + تعويض مستخدَم) لا مقاعد التعويض وحدها، (3) اعتماد التجميد وتمديد `renewal_date` أصبحا معاملة PostgreSQL ذرّية واحدة (`review_subscription_pause()`). التفاصيل الكاملة والتحقق مقابل كل حالة اختبار في تقرير التسليم. أي تحسين غير حرج تم توثيقه في `POST_PILOT_BACKLOG.md` ولم يُنفَّذ.

---

# Founder Decision — Pilot Scope (Critical Review)

**ملاحظة شفافية مهمة قبل أي شيء آخر:** لا يوجد في سجل هذا المشروع أي "Founder Decision Memo" سابق يقترح Pilot بثلاث مراحل (Primary+Middle+Secondary) بنموذج 1-3/4-6/7-9/10-12. هذا القرار لم يُتّخذ فعليًا في أي جولة سابقة موثَّقة هنا. بدل التظاهر بمراجعة قرار غير موجود، هذا القسم هو المراجعة والقرار الفعليان، من الصفر، مبنيان على الكود الحقيقي.

## المراجعة النقدية

**1) هل 24 طالبًا على 3 مراحل يعطون Signal مفيدة؟** لا. 8 طلاب لكل شريحة تحت ضجيج (Noise) عالٍ جدًا — لا يمكن التمييز بين نجاح/فشل حقيقي وصدفة إحصائية. الأسوأ: الشريحتان الجديدتان (متوسط/ثانوي) قيمتهما التعليمية **غير مُثبَتة أصلًا** (فرضية، لا حتى Signal أولي)، بينما شريحة الابتدائي (خُطى متابعة) هي الفرضية الأنضج في المشروع بالكامل. اختبار الفرضية الناضجة والفرضيتين الخاميتين في نفس الجولة، بنفس الموارد التشغيلية المحدودة (معلمون، دعم، انتباه إداري)، يُضعف قراءة الثلاثة معًا.

**2) هل تقسيم 1-3/4-6/7-9/10-12 بأربع "أوضاع" منتج صحيح؟** جزئيًا. الفحص الفعلي للكود يُظهر: الفرق بين 1-3 و4-6 في هذا المشروع **سطحي وحقيقي** في آنٍ واحد — سطحي لأن المحرك الأساسي (Sessions/Reports/Goals/Independence) **متطابق تمامًا** بين الفئتين، لا فرق سوى سعة المجموعة (3 مقابل 4) وحجم الخط/البطاقات في واجهة الطالب (`isJuniorGrade`). حقيقي لأنه تمييز رخيص التكلفة ومنطقي (طفل 7 سنوات يحتاج بطاقات أكبر ونصًا أقل من طفل 11 سنة) — **وليس Legacy عشوائيًا**، لكنه أيضًا ليس "نموذج منتج" منفصل يستحق اسمًا مختلفًا؛ إنه تفصيل UI/سعة داخل نفس النموذج.

أما "Study Management" (7-9) و"Accountability Study Room" (10-12) فمختلفتان جوهريًا عن "متابعة" — القيمة المقترحة ليست "مساعدة في الواجب" بل "مساءلة/تركيز مستقل"، وهذا يغيّر شكل الجلسة نفسها (المعلم لا يعلّم مادة، بل يراقب/يوجّه بشكل خفيف جدًا). **أربع تسميات منفصلة لهذا التدرّج مبالغ فيها** — التمييز الحقيقي الوحيد الذي يستحق بناءً مختلفًا هو بين نمطين: **دعم تعليمي موجَّه** (1-6، الحالي، بلا تغيير) و**غرفة تركيز مستقلة** (7+، جديد ومفترَض). أوصي بنمطين لا أربعة.

**3) هل يعمل المحرك الحالي لمتوسط/ثانوي بتعديلات بسيطة؟** نعم للبنية التحتية (Sessions/Attendance/Cohorts/Enrollment لا تفترض شيئًا عن المحتوى الأكاديمي، فقط عن الجدولة والحضور). لا لـ"KHOTA Method" كما هو مكتوب حاليًا — خطوتا Guide وReinforce مبنيتان على افتراض "مساعدة أكاديمية"، ولاستخدامهما مع "غرفة تركيز" يحتاجان إعادة صياغة (توجيه تحديد الأولويات بدل التعليم، بلا "تثبيت مهارة") — تعديل نص ومنطق جلسة، **وليس Schema جديدًا**.

## الاقتصاد التشغيلي (بأرقام الفرضية المعطاة فقط، بلا اختراع)

بافتراض: معلم = 70 ريال/ساعة، جلسة = ساعة واحدة (50 تعليم + 10 تقرير)، خُطى 3 = 12 جلسة/شهر، مجموعة 1-3 بسعة 3، وسعر افتراضي 520 ريال/شهر (رقمك أنت، لم أخترعه):

| الحالة | الإيراد/شهر | تكلفة المعلم/شهر | الهامش |
|---|---|---|---|
| مجموعة ممتلئة (3/3) | 3×520 = 1,560 | 12×70 = 840 | **46%** — بالكاد فوق الهدف |
| مقعدان فقط (2/3) | 2×520 = 1,040 | 840 (ثابتة — المعلم يتقاضى أجره بصرف النظر عن العدد) | **19%** — أقل من نصف الهدف |

**هذا النموذج هش فعلًا، بالضبط كما توقعت.** الهامش 46% محسوب في **أفضل سيناريو ممكن نظريًا**: امتلاء كامل، صفر جلسات تعويض، صفر رسوم بوابة دفع (عادة 2-3%+ في السعودية)، صفر وقت إداري إضافي خارج الـ10 دقائق المدفوعة. أي احتكاك واحد فقط — مقعد فارغ، جلسة تعويض واحدة، رسوم دفع — يدفع الهامش تحت الهدف بسهولة، وفقدان مقعد واحد من ثلاثة (وهو سيناريو مرجّح جدًا في بداية أي Pilot) يهوي بالهامش لأقل من النصف.

**ما يجب قياسه فعليًا في الـPilot (لا افتراضه):** معدل الامتلاء الفعلي لكل مجموعة أسبوعيًا، معدل استخدام أرصدة التعويض لكل طالب شهريًا، الوقت الفعلي الذي يقضيه المعلم في التقرير (هل 10 دقائق كافية فعلًا أم رقم نظري؟)، ورسوم بوابة الدفع الفعلية بعد اختيار مزوّد.

## فرضية المتوسط/الثانوي — إعادة صياغة أقوى

بدل "مساءلة" عامة (رسالة تسويقية تبدو كمراقبة والدَين، يرفضها المراهق غريزيًا)، أقترح: **"غرفة التركيز" (Focus Room)** — جلسة عمل مستقلة منظَّمة (Body Doubling): تحديد 2-3 أهداف في أول دقيقتين، وقت عمل صامت مع "حضور" غير متدخل، وتأمل ختامي (ماذا أنجزت؟). هذه ظاهرة تحفّز نفسها فعليًا عند المراهقين (شعبية محتوى "Study With Me" على يوتيوب/تويتش دليل حقيقي على رغبة ذاتية، وليست افتراضًا نظريًا) — رسالة "أبي أركّز قبل الاختبار" مختلفة جذريًا عن "أمي تبي تتأكد إني ذاكرت".

## Outcome لكل شريحة (ما يلاحظه ولي الأمر بعد أسبوع)

- **الابتدائي (الحالي، بلا تغيير):** "صار يعرف وش عليه بكرة بدون ما أسأل" — مطابق تمامًا لحقل Tomorrow Ready الموجود فعليًا في الكود.
- **غرفة التركيز (مقترح، غير مبني الآن):** "صار يبدأ مذاكرته بمبادرة منه، مو بملاحقتي له."

## القرار النهائي

**لا أثبت قرار الإطلاق الثلاثي المتزامن — لأنه غير موجود أصلًا، ولأنني لو خُيِّرت الآن بين تنفيذه أو بديل أبسط، لن أختاره.**

### قراري: **Primary-only Pilot (24 طالبًا، الصفوف 1-6، النموذج الحالي بلا تغيير) + مسار اكتشاف صغير غير رسمي لـ"غرفة التركيز" (3-5 طلاب متوسط/ثانوي، مجاني أو رمزي، بلا بنية تحتية جديدة، بلا قياس رسمي ضمن الـPilot المُسجَّل)**

**لماذا:** الفرضية الأنضج (خُطى متابعة) تستحق Signal نظيف بـ24 طالبًا كاملة، لا 8. الفرضيتان الأخريان غير مُثبَتتين حتى على مستوى "هل يريد أي مراهق هذا أصلًا؟" — بناء نظام تسجيل وتسعير وCohorts كاملة لفرضية غير مُختبرة نظريًا (مجرد نقاش) قبل التحقق الرخيص أولًا هو بالضبط الخطأ الذي حذّرتَ منه ("لا تختبر متغيرات كثيرة معًا"). الاكتشاف الصغير غير الرسمي (محادثات + تجربة مجانية لعدد قليل جدًا) يختبر الفرضية الأخطر (هل يريدها المراهق نفسه) بأقل تكلفة ممكنة، دون تخفيف تركيز الفريق عن الـPilot الرئيسي.

**الأثر على تعليماتك الأصلية:** بما أن القرار لم يعد توسيع رسمي، **لا حاجة لإخفاء English/Qudurat من الملاحة** (كانت تلك التعليمة تحل مشكلة ازدحام ملاحة ناتجة عن 4 مراحل جديدة — هذه المشكلة لم تعد قائمة). **لا حاجة لجداول grade_levels/education_stages** (الفحص الفعلي أثبت أن القيد الحالي `children.grade between 1 and 6` يكفي تمامًا لهذا القرار). **لا Focus Timer، لا Dark UI، لا Subject Tutoring** — كلها غير مبنية، مطابق لتعليماتك حتى في ظل قراري المختلف.

## Pilot Design (24 طالبًا، Primary فقط)

- **الفئة:** الصفوف 1-6، النموذج الحالي (خُطى 2/3/4).
- **السعة:** 3 لكل مجموعة (1-3)، 4 لكل مجموعة (4-6) — بلا تغيير.
- **ما نقيسه أسبوعيًا:** معدل الامتلاء الفعلي لكل مجموعة، معدل استخدام رصيد التعويض، عدد جلسات الإلغاء (معلم/منصة)، الوقت الفعلي لكتابة التقرير (استبيان بسيط للمعلم بعد كل جلسة أول أسبوعين)، Independence Score trend، Weekly Goal achievement rate.
- **إشارات النجاح/الفشل (لا عتبة واحدة ساذجة):**
  - **Product failure**: الطالب يحضر لكن Independence Score لا يتحسن + ولي الأمر لا يبلّغ عن تغيّر ملموس في المنزل رغم انتظام الحضور.
  - **Operational failure**: الحضور جيد، الأهل راضون، لكن هامش المجموعة أقل من 30% بسبب مقاعد فارغة/تعويضات كثيرة — يعني المنتج يعمل، التشغيل لا يصمد.
  - **Acquisition failure**: صعوبة تعبئة المجموعات أصلًا (لا عدد كافٍ من التسجيلات) رغم عدم وجود شكوى من المسجَّلين — مشكلة تسويق/قناة وصول، ليست مشكلة منتج.

## Pre-Flight Checklist (قبل أول طالب حقيقي)

1. `npm install && npm run build` على بيئة حقيقية — لم يُختبر فعليًا في أي جولة سابقة.
2. اختيار مزوّد دفع فعلي وربط رسومه الحقيقية في حساب الهامش (لا يزال `manual-dev`).
3. تفعيل مزوّد SMS (Twilio) في Supabase لتشغيل OTP فعليًا.
4. إدخال `meeting_url` الفعلي لكل Cohort (لا واجهة إدارية بعد — إدخال مباشر بقاعدة البيانات).
5. تحديد رقم `price_sar` فعلي في `plans` (لا يزال null).
6. استبيان معلم مبسَّط لقياس الوقت الفعلي للتقرير أول أسبوعين (لسد فجوة "10 دقائق نظرية").

---

# V3 Multi-Stage Pilot — Implementation Report (Post-GO)

## 1) الملفات المعدَّلة والجديدة (21)

**جديد (1):** `src/lib/grade-config.ts` — الإعداد المركزي الوحيد لبنية الصفوف (`GradeBand`, `GRADE_BANDS`, `resolveGradeBand`, `getToneLevel`, `getGradeLabelArabic`, `parseAndValidateGrade`). بلا تسعير، بلا مدة جلسة، بلا جدولة، بلا قواعد تجديد — بالضبط كما حدَّدت.

**معدَّل (20):**
| الملف | التغيير |
|---|---|
| `supabase/schema.sql` | Migration: `children.grade` → 1-12، `cohorts.grade_band` → 4 قيم، `plans.product` → +`focus_room` |
| `src/app/api/enroll/route.ts` | **الإصلاح الأهم**: استخدام `gradeNumber` الفعلي بدل `body.grade` الخام في الإدراج (كان Bug حقيقي)، + تحقق `resolveGradeBand(grade)===cohort.grade_band`، + تحقق `cohort.status='open'`، + تحقق توافق الباقة/المنتج |
| `src/app/motabaa/enroll/page.tsx` | يستخدم `getGradeLabelArabic`/`parseAndValidateGrade` المركزيين بدل خريطة 1-6 محلية |
| `src/app/motabaa/plans/PlansSelector.tsx` | `resolveGradeBand()` بدل `grade<=3` inline |
| `src/lib/student-mode-constants.ts`, `student-mode.ts` | إزالة `isJuniorGrade` الثنائي، استبداله بـ`getToneLevel` الثلاثي المركزي |
| `src/components/StudentShell.tsx` + 5 صفحات `/student/*` | Tone ثلاثي (junior/standard/focus)؛ تعديل نصّي فقط في نقطتين واضحتين (تحية الهيدر، عبارة "استمر هيك!") لطبقة focus — بلا مكوّنات أو تصميم جديد |
| `src/components/Header.tsx`, `MobileNav.tsx`, `Footer.tsx` | إزالة روابط English/قدرات (الكود والمسارات باقية بلا حذف) |
| `src/app/page.tsx` | إعادة كتابة كاملة حول منتج واحد (خُطى متابعة) بدل "ثلاثة أذرع" |
| `src/app/start/page.tsx` | من مخيِّر 3 مسارات إلى CTA واحد لمتابعة |
| `src/app/layout.tsx`, `contact/page.tsx`, `help/page.tsx`, `teach-with-khota/page.tsx` | إزالة ذكر English/قدرات من meta description وصفحات التسويق/الدعم العامة |

## 2) Database Migration

مُطبَّقة داخل `schema.sql` بصيغتين: (أ) تعريفات الجداول النهائية (لتثبيت جديد بالكامل)، (ب) كتلة `ALTER ... DROP/ADD CONSTRAINT` صريحة معلَّقة بتعليقات للتطبيق الآمن على قاعدة قائمة، مع تنبيه صريح للتحقق من اسم القيد الفعلي (`pg_constraint`) قبل التنفيذ إن اختلف. **لا فقدان بيانات ممكن** — التوسيع فقط (1-6→1-12)، كل قيمة قديمة صالحة تلقائيًا تحت القيد الجديد.

## 3) نتائج الاختبار (تحقّق معماري من الكود، لا تشغيل فعلي)

| # | الاختبار | النتيجة |
|---|---|---|
| grade 2, 5, 8, 11 | صالحة | ✅ `parseAndValidateGrade` تقبلها، `resolveGradeBand` تُرجع 1-3/4-6/7-9/10-12 بالترتيب |
| grade 0 | مرفوض | ✅ `numericValue < MIN_GRADE` |
| grade 13 | مرفوض | ✅ `numericValue > MAX_GRADE` |
| grade 11 + cohort `grade_band='1-3'` | مرفوض | ✅ `/api/enroll`: `cohort.grade_band !== requestedBand` → 409 |
| cohort ممتلئة | مرفوض | ✅ لم يتغيّر — `cohort_available_seats` RPC (من V3.1) |
| cohort `status != 'open'` | مرفوض | ✅ **جديد هذه الجولة** — لم يكن يُتحقَّق منه إطلاقًا سابقًا، ثغرة حقيقية أُغلقت |
| public cohort response لا يكشف `meeting_url` | مؤكَّد | ✅ فحصت `public_cohorts_catalog()` — لا تغيير مطلوب، لم تكن تكشفه أصلًا وتعمل تلقائيًا مع `focus_room` |
| English/قدرات غير ظاهرة بالتنقل العام | مؤكَّد | ✅ Header/MobileNav/Footer/Home/Start/meta description — كلها مفحوصة ومُعدَّلة |
| Routes القديمة لا تزال موجودة | مؤكَّد | ✅ `/english`, `/qudurat` بكامل ملفاتهما — لم يُحذف أي ملف |
| Student Mode tone مناسب لكل band | جزئي | ✅ نقطتان واضحتان عُدِّلتا لـfocus (تحية، عبارة)؛ باقي النصوص محايدة أصلًا بالفحص (emoji خفيفة، لا لغة طفولية صريحة) |

**فراغ صادق:** هذه تحقّقات بقراءة الكود، لا تشغيل E2E فعلي — لا بيئة تشغيل متاحة هنا.

## 4) Frozen Features (ما أخفيناه بلا حذف)

`/english`, `/qudurat` بكامل الكود والمسارات — غير مرتبطة من أي تنقّل أو تسويق عام، لكنها تعمل بالكامل لمن يصل إليها برابط مباشر.

## 5) Known Risks

- **الاقتصاد**: هامش الابتدائي هش (موثَّق سابقًا)؛ اقتصاد Focus Room **افتراضي بالكامل** (سعة 5 الآن كما طلبت، لم تُختبر تشغيليًا).
- **Tone Focus**: عدّلت أوضح نقطتين فقط؛ مراجعة أعمق للنبرة تحتاج ملاحظات فعلية من طلاب Wave 1 الحقيقيين.
- **لا اختبار E2E فعلي** نُفِّذ — كل التحقق أعلاه قراءة كود.
- **لا بيانات Focus Room مُدخَلة بعد** — يحتاج الأدمن إنشاء cohorts يدويًا (`product='focus_room'`, `grade_band='7-9'|'10-12'`, `capacity=5`) قبل أي تسجيل فعلي.

## 6) lint / build

**لم يُشغَّلا فعليًا** — `sh: 1: eslint: not found` / `sh: 1: next: not found` (لا `node_modules`)، و`npm install` أعاد `403 Forbidden` من `registry.npmjs.org` طازجًا من هذه الجولة تحديدًا. **لم أدّعِ نجاحًا.**

## 7) Pre-Flight Checklist المحدَّث

كل بنود الجولات السابقة (دفع، SMS، meeting_url، أسعار) + **جديد لهذه الجولة**:
7. تشغيل كتلة الـMigration على قاعدة Supabase الحية فعليًا والتحقق من نجاحها.
8. إنشاء أول Cohort(s) لـFocus Room يدويًا (سعة 5) قبل فتح تسجيل Wave 1 له.
9. تشغيل `npm install && npm run lint && npm run build` على بيئة حقيقية — لم يُختبر هنا إطلاقًا.

---

# V3 Patch — Focus Room Seed Plans + Migration File + Seat Race Fix

## 3) Focus Room Seed Plans
`focus-2`/`focus-3`/`focus-4` (2/3/4 أيام أسبوعيًا) في جدول `plans` الموجود — لا جدول جديد. **`price_sar = null`، `active = false` عمدًا**: يمنع الظهور في `plans_public_read` (RLS العامة) ويمنع `/api/enroll` من قبول اشتراك بها (يتحقق من `plan.active`) — **غير قابلة للشراء العام فعليًا حتى تُفعَّل يدويًا بعد اعتماد السعر**. `day_patterns` تُركت فارغة عمدًا — الأيام الفعلية لم تُقرَّر تشغيليًا، ولم أخترعها.

## 7) Migration File
`supabase/migrations/20260906_multi_stage_support.sql` — يحتوي **فقط** ما طُلب: توسيع `children.grade`، `cohorts.grade_band`، `plans.product`، Seed خطط Focus Room، ودالة `enroll_subscription_atomic`. `schema.sql` محدَّث ليعكس نفس الحالة النهائية (كلا الملفين متطابقان الآن في الأثر).

**`cohorts.capacity`: لا تغيير.** فحصت العمود فعليًا — `smallint not null` بلا أي `CHECK` من الأساس، فالسعات 3/4/5 (وأي قيمة مستقبلية مثل 6) صالحة بالفعل بلا قيد يمنعها. لم أضف سقفًا صناعيًا (8 أو غيره) لعدم وجود سبب تقني يستدعيه.

## 8) Seat Race Condition — **تم إصلاحها ضمن هذا الـPatch (ليست Blocker)**

فحصت المسار الفعلي: كان "تحقق مقاعد عبر RPC للقراءة فقط" ثم `.insert()` منفصل تمامًا في TypeScript — **غير ذرّي فعليًا**، بالضبط كما وصفت. الإصلاح ممكن بدون إعادة هيكلة كبيرة لأن نفس نمط القفل (`for update`) مُستخدَم أصلًا في `redeem_makeup_credit` من جولة سابقة — طبّقت نفس النمط هنا:

**`enroll_subscription_atomic()`**: تقفل صف المجموعة (`for update`) → تُعيد فحص `count(subscriptions where status in ('active','pending_payment'))` من الصفر داخل القفل → تُدرج الاشتراك فقط إن كان العدد أقل من `capacity` — كل ذلك في معاملة Postgres واحدة. أي طلب تسجيل متزامن ثانٍ على نفس المجموعة يُحجَب حتى يُنهي الأول معاملته، فيرى العدد المحدَّث الصحيح.

`/api/enroll` الآن: يحتفظ بفحص `cohort_available_seats` كرسالة UX سريعة فقط (ليست نقطة الحماية)، ثم يستدعي `enroll_subscription_atomic` كخطوة الحماية الفعلية الوحيدة.

**لا Pre-Flight Blocker هنا** — تم الإصلاح ضمن البنية الحالية دون إعادة معمارية.

## الملفات المعدَّلة/الجديدة هذا الـPatch
- **جديد**: `supabase/migrations/20260906_multi_stage_support.sql`
- **معدَّل**: `supabase/schema.sql` (Seed + RPC الجديدة)، `src/app/api/enroll/route.ts` (استدعاء RPC الذرّي بدل الإدراج المباشر)

## lint / build
لم يُشغَّلا فعليًا — نفس السبب التقني (`eslint: not found`, `next: not found`، لا `node_modules`). فحص استاتيكي: توازن الأقواس (125 ملفًا) + سلامة كتل `$$`/`begin`/`end` في `schema.sql` (6 دوال، 4 منها plpgsql) — كلها متطابقة.

---

# V3 Multi-Stage Pilot — Round 2 (R2): UI End-to-End Completion

## 1) PlansSelector.tsx
موسَّعة إلى 1-12، معروضة في 4 مجموعات مرئية باستخدام `GRADE_BANDS` المركزية مباشرة (لا تكرار بيانات) — عنوان كل مجموعة `labelAr` من `grade-config.ts`، وكل زر صف يعرض `getGradeLabelArabic(g)` (مثال: "الثاني متوسط") بدل الرقم المجرَّد.

## 2) `/motabaa/plans/page.tsx`
يجلب الآن `plans` لمنتجَي `motabaa` و`focus_room` معًا (`in('product', [...])`)، و`public_cohorts_catalog(p_product: null)` (كل المنتجات) مفلترة لهذين الاثنين فقط. **أزلت فلتر `active=true` عمدًا من الجلب** — بدونها، باقات Focus Room (المُعلَّمة `active=false` بانتظار اعتماد السعر) لن تظهر إطلاقًا في واجهة الاستكشاف، وسيتوقف مسار "الوصول إلى اختيار Cohort" المطلوب صراحةً في نقطة 6. **الحماية الفعلية لم تتغيّر**: `/api/enroll` وحده يتحقق من `plan.active` قبل قبول أي اشتراك فعلي — هذا فرق بين "عرض الخيار" و"قبول الشراء"، والعميل لا يحمي شيئًا هنا كما طلبت.

ربط المنتج بالمرحلة (`productForBand`) وُضع محليًا داخل `PlansSelector.tsx` عمدًا، وليس داخل `grade-config.ts` — لأنه ربط كتالوجي/تجاري، والملف المركزي مخصَّص لبنية الصف نفسها فقط (كما حدَّدت أنت في الجولة السابقة: بلا تسعير ولا تفاصيل تجارية).

## 3) Public Copy
`src/app/page.tsx` (الشعار + سطر الثقة + وصف الباقات)، `src/app/start/page.tsx`، `src/app/motabaa/page.tsx` (الوصف الرئيسي + سطر الثقة) — كلها الآن "من الأول الابتدائي إلى الثالث الثانوي" بدل "الصفوف 1–6"، مع توضيح "متابعة وتأسيس للابتدائي، وتنظيم وتركيز للمتوسط والثانوي" في `/motabaa`.

## 4) `/motabaa`
أُزيلت بطاقتا "الصفوف 1–3" / "الصفوف 4–6" (كانتا تحصران المسار في مرحلتين فقط) واستُبدلتا ببطاقة واحدة "اختر صف طفلك والباقة" تُوجِّه مباشرة إلى `/motabaa/plans` — **بلا صفحات جديدة**، كما طلبت. `motabaa/grades-1-3` و`motabaa/grades-4-6` لم تُحذَفا (لا حذف Features)، فقط لم تعودا مرتبطتين كخيارَين حصريَّين من الصفحة الرئيسية.

## 5) grade-config.ts — إزالة الـFallback الصامت
`getToneLevel()` و`getGradeLabelArabic()` تفشلان الآن بوضوح (`throw`) خارج 1-12، بنفس نمط `resolveGradeBand()` تمامًا — لا `?? "standard"`، لا `?? String(grade)`. كل نقاط الاستدعاء الحالية (6 ملفات مساحة الطالب + صفحة التسجيل) تستدعيها فقط بعد التأكد من صلاحية القيمة أصلًا (من قاعدة البيانات أو بعد `parseAndValidateGrade`)، فلا حاجة لـ`try/catch` إضافي في أي منها.

## 6) Manual Verification — تتبّع فعلي منفَّذ (Python، منطق مطابق حرفيًا لـgrade-config.ts)

```
grade  2 -> grade_band=1-3    -> product=motabaa
grade  5 -> grade_band=4-6    -> product=motabaa
grade  8 -> grade_band=7-9    -> product=focus_room
grade 11 -> grade_band=10-12  -> product=focus_room
```

**صادق بوضوح:** هذا تتبّع منطقي منفَّذ فعليًا (Python) لنفس دوال `grade-config.ts` حرفيًا — وليس تشغيلًا حيًا في متصفح real. تأكدت أن الآلية (الفلترة حسب المنتج، عرض "السعر يُعلن قريبًا"، بناء رابط `/motabaa/enroll?grade=8&cohort=...`) صحيحة بالكود. **لكن**: لا توجد بعد أي Cohort فعلية بـ`product='focus_room'` في قاعدة البيانات (البند السابق طلب Seed للخطط فقط، لا المجموعات) — فخطوة "3. المجموعة" ستُظهر حاليًا "لا توجد مجموعات مفتوحة" لأي صف 7-12 حتى ينشئ الأدمن أول Cohort فعليًا (موجود أصلًا في Pre-Flight Checklist من جولة سابقة). المسار الكامل حتى صفحة التسجيل الفعلية يحتاج هذه الخطوة اليدوية أولًا — هذا ليس Bug، بل تسلسل تشغيلي طبيعي.

## 7) Race Condition Edge Case — Cleanup بسيط، لا إعادة معمارية
إذا فشل `enroll_subscription_atomic` بعد إنشاء `child` (مثلًا امتلأ المقعد في نفس اللحظة)، يُحذَف صف الطفل فورًا (`children.delete()`) — آمن لأنه أُنشئ للتو في نفس الطلب ولا يشير إليه أي سجل آخر بعد. **لا تُحذَف بيانات ولي الأمر** (قد تكون موجودة مسبقًا لأطفال آخرين). لم ألمس `Migration`/`RPC` — لم أجد فيهما Bug حقيقيًا يستدعي ذلك.

## الملفات المعدَّلة (8) — لا ملفات جديدة
`src/lib/grade-config.ts`، `src/app/motabaa/plans/PlansSelector.tsx`، `src/app/motabaa/plans/page.tsx`، `src/app/motabaa/page.tsx`، `src/app/page.tsx`، `src/app/start/page.tsx`، `src/app/api/enroll/route.ts`

## lint / build
لم يُشغَّلا فعليًا — نفس القيد التقني (`eslint`/`next` غير مثبَّتين، لا `node_modules`). فحص استاتيكي: توازن الأقواس عبر كل ملفات TS/TSX (سليم) + تتبّع منطقي مُنفَّذ فعليًا (أعلاه) بدل ادّعاء تشغيل حي غير متوفر.

---

# V3 — Pre-Launch Operations Patch (Pilot Wave 1)

## ما تم تنفيذه

1. **`supabase/seed_pilot_wave1.sql`** (جديد) — أسعار تشغيلية حقيقية (399/529/679 ر.س) لكل من motabaa وfocus_room، تفعيل الخطتين (`active=true`)، `day_patterns` كما حدَّدت، 7 مجموعات Wave 1 فعلية (تفصيل أدناه)، حذف مجموعة الاختبار المحدَّدة إن وُجدت. **Idempotent بالكامل**: الخطط عبر `upsert`، المجموعات عبر `insert ... where not exists` — تشغيله عدة مرات لا يُكرِّر شيئًا.
2. **`/api/enroll`**: أضفت رفضًا صريحًا لأي باقة `price_sar IS NULL` (409) — طبقة أمان إضافية بعد اعتماد الأسعار.
3. **فجوة حقيقية أصلحتها**: السعر لم يكن يظهر في شاشتَي التسجيل والدفع إطلاقًا رغم استخدامه داخليًا في `payments.amount_sar` — الآن يظهر بوضوح في ملخص `/motabaa/enroll` وكرقم بارز في `/motabaa/enroll/payment` قبل زر التأكيد.
4. راجعت `/api/enroll` سطرًا بسطر مقابل كل نقطة في قائمتك (12 نقطة) — كلها موجودة فعليًا (تفصيل الأسطر في الرد).
5. راجعت `public_cohorts_catalog()` و`/motabaa/plans` — لا `meeting_url`، لا نصوص "1-6" قديمة، لا روابط English/Qudurat.

## Pilot Seed Summary

| Band | Product | مجموعات | سعة كل مجموعة | إجمالي المقاعد |
|---|---|---|---|---|
| 1-3 | motabaa | 2 | 3 | 6 |
| 4-6 | motabaa | 3 | 4 | 12 |
| 7-9 | focus_room | 1 | 5 | 5 |
| 10-12 | focus_room | 1 | 5 | 5 |
| **الإجمالي** | | **7 مجموعات** | | **28 مقعدًا** |

جميعها: الأحد-الأربعاء، `teacher_id=NULL`، `meeting_url=NULL`، `status='open'` (تظهر في الكتالوج وتقبل تسجيلًا فعليًا فورًا).

## Validation — منفَّذ فعليًا (Python trace + محاولة build حقيقية)

```
grade  2 -> band=1-3    product=motabaa
grade  5 -> band=4-6    product=motabaa
grade  8 -> band=7-9    product=focus_room
grade 11 -> band=10-12  product=focus_room
grade  0 -> REJECTED
grade 13 -> REJECTED
grade 11 + cohort 1-3 -> band mismatch -> 409
grade  2 + focus_room cohort -> band mismatch -> 409 (focus_room cohorts لا تحمل أبدًا grade_band='1-3')
```
كل ما سبق تتبّع منطقي حقيقي (Python) لنفس دوال `grade-config.ts` و`/api/enroll` حرفيًا.

**npm install / build**: حاولتهما فعليًا هذه الجولة أيضًا — `npm install` رجع `403 Forbidden` (نفس قيد الشبكة من كل جولة)، ونتيجة لذلك `eslint`/`next` غير موجودين محليًا لتشغيل lint/build. **لم أدّعِ نجاحًا لم يحدث هنا** — أنت من أكَّد نجاحهما فعليًا على جهازك في رسالتك السابقة، وهذا ما اعتمدت عليه.

## فجوة صادقة: `package-lock.json`
**غير موجود في هذه الحزمة** — لم يُنشأ قط في بيئتي (لأن `npm install` لم ينجح هنا إطلاقًا طوال المشروع بسبب حجب الشبكة). أنت أنشأته فعليًا عندك عند تشغيل `npm install` الناجح — إن أردت تضمينه في الحزمة التالية، أرسله لي وسأدرجه، أو استخدم نسختك المحلية منه مباشرة فوق هذه الحزمة (لن يتعارض مع أي شيء هنا).

## Frozen / لم يُلمَس
`bookings` القديم، لا `drop table`، لا حذف بيانات غير مجموعة الاختبار المحدَّدة صراحةً. لا Focus Timer، لا Gamification، لا Dark Mode، لا صفحات جديدة، لا V4.

## Blockers حقيقية متبقية
- **لا معلمين حقيقيين مرتبطين بأي مجموعة بعد** (`teacher_id=NULL` بالتصميم) — يجب ربط معلم فعلي بكل مجموعة قبل أول جلسة حقيقية.
- **لا `meeting_url` فعلي بعد** لأي مجموعة — يجب إدخاله يدويًا قبل أول جلسة.
- **لا `package-lock.json`** في هذه الحزمة (موضَّح أعلاه) — أدرجه من نسختك المحلية.
- **مزوّد دفع حقيقي غير مربوط** (متوقَّع ومقبول بحسب تعليماتك — "لا تربط مزود دفع حقيقي الآن").
