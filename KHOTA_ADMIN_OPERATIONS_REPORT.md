# خُطى | KHOTA — Admin Operations: Group Capacity & Registration Control

## ملخص صادق
اكتشفت واعترف بخطأ حقيقي سويته بنفسي: أول `str_replace` على `admin/groups/page.tsx` طابق
موقعًا مكررًا وأنشأ JSX مكسورًا (وسم `<CohortOperationsForm` بلا إغلاق، مكرر). اكتشفته عبر
`tsc` الفعلي (لا افتراضًا)، وأصلحته بالكامل قبل المتابعة — موثَّق أدناه.

## الملفات المُنشأة (3)
`src/lib/require-admin.ts` (helper مركزي جديد) •
`src/app/staff/login/page.tsx` • `src/components/AuthForm.tsx` (منطق OTP/الأدوار المشترك،
استُخرِج من `/login` لتفادي تكرار كود أمني حسّاس بصفحتين).

## الملفات المُعدَّلة (6)
`admin/groups/page.tsx` (السعة/الحالة المشتقة + العد بصيغة 24 ساعة الموحَّدة) •
`admin/groups/CohortOperationsForm.tsx` (+حقلا السعة والحالة) •
`api/admin/cohort-operations/route.ts` (السعة/الحالة + Audit Log، عبر requireAdmin) •
`api/teacher-applications/update-status/route.ts` (يستخدم requireAdmin الآن) •
`login/page.tsx` (مبسَّطة، تستخدم AuthForm) • `Footer.tsx` (رابط "دخول فريق خُطى").

## migration جديدة
`20260916_admin_actions_log.sql` — جدول `admin_actions` فقط (RLS بلا policy عامة)، لم تُطبَّق تلقائيًا.

## A) إدارة المجموعة
السعة والحالة (open/closed فقط — لا "full" تُختار يدويًا) قابلتان للتعديل من `/admin/groups`
عبر `requireAdmin()` المركزي. "المسجلون: X من Y" و"المقاعد المتاحة" تُحسَب بنفس صيغة 24 ساعة
الفعلية المستخدَمة بكل مكان آخر (اكتشفت أن عدّ الصفحة القديم كان يحتسب `active` فقط، غير
متطابق مع منطق السعة الحقيقي — صحّحته).

## B) FULL تلقائي
`registrationLabel(status, seatsAvailable)`: closed→"التسجيل مغلق"، seats≤0→"مكتملة"،
غير ذلك→"متاحة". **لا قيمة تُخزَّن أو تُختار يدويًا لـ"مكتملة"** — مشتقة بالكامل من السعة الفعلية.
**اكتشفت وأصلحت فجوة**: الصفحة كانت تستثني المجموعات `closed` من العرض كليًا
(`.neq("status","closed")`) — يعني الأدمن ما كان يقدر يجد مجموعة مغلقة لإعادة فتحها. غيّرتها
لـ`.in("status",["open","closed"])`.

## C) أمان تقليل السعة
`/api/admin/cohort-operations`: يحسب العدد المحتسَب فعليًا بنفس صيغة الدوال الثلاث، يرفض 409
بالرسالة الحرفية "لا يمكن تقليل السعة عن عدد المسجلين الحاليين." Server-side بالكامل — لا
اعتماد على تعطيل حقل بالواجهة فقط.

## D) الصلاحيات — إجابة السؤال المباشر
**نعم، كل admins الحاليين Full Admin** — تحقّقت من `schema.sql` مباشرة: جدول `admins` بلا أي
عمود role/permission إطلاقًا، فكل صف فيه صلاحية كاملة بالتعريف. **توصيتي للتطوير اللاحق**: إضافة
عمود `role text default 'full_admin'` (nullable-safe، migration بسيطة آمنة) عندما تظهر حاجة
فعلية، ثم توسيع `requireAdmin()` (المركزي الآن أصلًا) ليقرأ هذا العمود ويُعيد الدور مع النتيجة
— نقطة تعديل واحدة بدل تكرار بكل route. لم أنفّذ هذا الآن (لا حاجة فعلية مؤكَّدة بعد).

## E) Staff Login
`/staff/login` — نفس Email OTP وSupabase Auth حرفيًا (عبر `AuthForm` المشترك، `mode="staff"`).
Admin/Teacher يُوجَّهان لمساحتهما. **Parent (أو لا دور) يُحجَب صراحة** برسالة "هذا الدخول لفريق
خُطى فقط" + رابط لـ`/parent` — لا يُستدعى `link-parent` إطلاقًا لهذا المسار. رابط Footer مضاف.

## F) Admin Group API
`requireAdmin()` مركزي (401/403 صريحان) بدل تكرار الفحص. Capacity: عدد صحيح 1–20 فقط. Status:
`open`/`closed` فقط (يرفض أي قيمة أخرى بما فيها `draft`/`full`). صفر service role للمتصفح —
كل الكتابة عبر هذا المسار فقط.

## G) Audit Log
نُفِّذ (كان "فقط إن كان سهلًا") — `admin_actions` يسجّل `capacity_change`،
`registration_status_change`، `teacher_assignment` (قديم/جديد كـjsonb). Best-effort — فشله لا
يُفشِل التعديل الفعلي.

## I) نتائج الاختبارات
**كلها code-review فقط — لا بيئة تشغيل حقيقية هنا (كما في كل جولة سابقة).**
1-5, 7: المنطق مكتوب ومُتحقَّق منه بالقراءة المباشرة للكود يطابق كل سيناريو حرفيًا.
6. Teacher يستدعي Admin API → `requireAdmin()` يبحث في جدول `admins` تحديدًا (لا `teachers`)،
   فأي معلم (غير موجود بجدول admins) يحصل على 403 تلقائيًا بالتصميم — لم يحتج منطقًا إضافيًا.

## tsc / build
**`tsc`**: نُفِّذ فعليًا، **لقيت خطأ syntax حقيقي (JSX مكسور من خطئي الخاص) وصلحته**، ثم خطأين
implicit-any إضافيين (7 معاملات بلا نوع صريح + destructuring واحد) وصلحتهما جميعًا. تأكدت: صفر
خطأ حقيقي متبقٍ بكل الملفات التسعة المتأثرة. **`build`**: فشل (`next: not found`)، نفس قيد
الشبكة الثابت.
