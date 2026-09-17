# خُطى | KHOTA — Final Launch Journey Audit & Fix — التقرير النهائي

## الملفات المعدَّلة/الجديدة (30)
`login/page.tsx` (Email OTP كامل) • `motabaa/enroll/EnrollForm.tsx` (+email، redirect ذكي
لتسجيل الدخول) • `api/enroll/route.ts` (email كهوية أساسية) • `api/auth/link-parent/route.ts`
(email بدل phone) • `api/auth/resolve-role/route.ts` (جديد) •
`motabaa/enroll/payment/page.tsx` (حارس Auth + ownership) • `PaymentClient.tsx` (أدوات
المطور collapsible) • `api/student-mode/exit/{request-otp,verify}/route.ts` (Email OTP) •
`ExitStudentMode.tsx` • `lib/paylink.ts` (retry hardening) • `scripts/paylink-smoke.mjs` +
`package.json` • `globals.css` (إصلاح الخط الأخضر + admin-table) •
`api/teacher-applications/{route,update-status/route}.ts` (جديد) •
`teach-with-khota/{page,TeacherApplyForm}.tsx` • `admin/teacher-applications/{page,StatusSelect}.tsx`
(جديد) • `api/contact/route.ts` (جديد، DB-first) • `contact/{page,ContactForm}.tsx` •
`privacy/refund-policy/complaints` (روابط /contact الحقيقية بدل "عند تفعيلها") •
`supabase/schema.sql` + 2 migrations جديدة + 3 SQL تشخيصية.

## migrations جديدة (يجب تطبيقها يدويًا)
`20260916_teacher_applications.sql`، `20260916_contact_requests.sql` — كلاهما `create table if
not exists` idempotent، RLS مفعَّلة بلا أي policy عامة (service_role فقط). لا تعديل على أي
جدول موجود.

## سبب Paylink 502 — ما ثبت فعليًا وما لم يثبت
**لم أستطع تشغيل استدعاء حقيقي ضد Paylink من هذه البيئة (لا وصول شبكة هنا إطلاقًا)** — لا
أستطيع الجزم بالسبب الجذري الفعلي للـ502 الذي رأيته أنت أثناء الاختبار. ما نفّذته فعليًا: تصلّب
`authenticatePaylink()` بإعادة محاولة (الأصلية + محاولتين، 300ms/900ms) **فقط** على 502/503/504
(لا إعادة محاولة على 400/401/403)، تسجيل server-side لأول 300 حرف من جسم الاستجابة + الحالة
(بلا أي credential)، ورسالة عربية عامة للمستخدم بدل الحالة الخام. **502 متكرر رغم إعادة
المحاولة يعني الأرجح مشكلة حقيقية في بيئة Paylink Pilot نفسها أو بيانات الاعتماد — لا شيء يمكن
لهذا الكود إصلاحه أبعد من إعادة المحاولة والتسجيل الواضح.**

## نتيجة paylink:smoke
**لم يُشغَّل فعليًا** — يحتاج `.env.local` ببيانات Paylink الحقيقية ووصول شبكة، وكلاهما غير
متاح في هذه البيئة. السكربت جاهز (`npm run paylink:smoke`)، ينتظر تشغيلك الفعلي على جهازك.

## Email OTP flow النهائي
`/login`: بريد فقط → `signInWithOtp({email})` → `verifyOtp({email, token, type:"email"})` →
`/api/auth/link-parent` (يربط بالبريد المُصادَق من الجلسة نفسها، لا من body) →
`/api/auth/resolve-role` → توجيه حسب next الآمن أو الدور الفعلي.

## كيف أصبح enroll → login → payment يعمل
`EnrollForm` يجمع الآن email+phone معًا (كلاهما مطلوب) → `/api/enroll` (email هوية أساسية،
تعامل حذر مع تعارض/تكرار الجوال) → بعد النجاح: فحص جلسة Supabase فعلية؛ غائبة → `/login?next=...&email=...`
(البريد يُملأ تلقائيًا)؛ موجودة → مباشرة للدفع. `payment/page.tsx` نفسه يفحص الجلسة مرة أخرى
server-side (وليس فقط زر الدفع)، ويمنع صراحةً عرض/دفع اشتراك يعود لولي أمر آخر.

## كيف يتم role redirect
`/api/auth/resolve-role` (admin → teacher → parent → none بالترتيب) يُستدعى بعد الربط، والتوجيه
النهائي يستخدم `next` الآمن (مُتحقَّق الصيغة، صفر Open Redirect) إن وُجد، وإلا الصفحة الرئيسية
للدور. **middleware.ts (لم يُلمَس) هو الحارس الفعلي النهائي لأي وصول غير مصرَّح** بصرف النظر عن
وجهة إعادة التوجيه من صفحة الدخول.

## Teacher application flow
نموذج حقيقي → `/api/teacher-applications` (تحقّق كامل، حفظ بـservice_role، RLS بلا policy
عامة) → حالة نجاح محترمة. **Teacher application ≠ teacher access** — لا حساب معلم يُنشأ
تلقائيًا. `/admin/teacher-applications` (اختياري، مُنفَّذ) يعرض الطلبات تحت نفس حارس الأدمن
الحالي بالضبط، مع تغيير الحالة (new/reviewing/shortlisted/rejected/accepted).

## Contact flow
`/contact` → `/api/contact` → **حفظ في `contact_requests` أولًا دائمًا (مصدر الحقيقة)** → إشعار
بريد اختياري عبر Resend (فقط إن وُجد `RESEND_API_KEY`؛ فشله لا يُفشِل الاستجابة إطلاقًا، مُنتظَر
بـ`await` كامل داخل try/catch قبل الرد). منع إرسال مزدوج (فحص `loading`/`done` صريح).

## سبب المجموعة المكتملة — Data أم Business Rule؟
**Business Rule نفسها صحيحة وسليمة تمامًا** (`capacity - count(active + pending_payment)`) —
لم أغيّرها. **الاكتشاف المهم:** اشتراكات `pending_payment` تحجز مقعدًا **للأبد بلا أي انتهاء
صلاحية تلقائي** — أي محاولة تسجيل قديمة مهجورة (ملأ النموذج ثم لم يُكمِل الدفع) تبقى تحتسب ضد
السعة إلى الأبد. **الأرجح أن هذا هو السبب الفعلي**، لكن لم أستطع التأكد من بيانات الإنتاج
الحقيقية من هنا — شغّل `supabase/verification/cohort_capacity_check.sql` (تشخيصي بحت، لم
يُنفَّذ) لتأكيد ذلك بنفسك قبل أي قرار (تنظيف يدوي لاشتراكات pending_payment قديمة فعلًا، أو
احتمالًا مستقبليًا: آلية انتهاء صلاحية تلقائي لـpending_payment — لم أنفّذها الآن، خارج نطاق
هذه الجولة لأنها Business Rule change حقيقي).

## Dead CTAs
صفر متبقٍ — الاثنان الوحيدان المكتشَفان (contact، teach-with-khota) أصبحا يعملان فعليًا هذه
الجولة. مسح برمجي كامل لـFooter/Header/MobileNav/nav-links/sitemap: صفر رابط مكسور.

## نتيجة tsc — بصراحة كاملة
نُفِّذ فعليًا. راجعت كل الملفات الثلاثين المتأثرة تحديدًا — **لقيت ~20 خطأ implicit-any حقيقي
جديد** (معالِجات onChange بلا نوع صريح) **وخطأ منطقي حقيقي واحد** (`context` بعد `redirect()`
لم يُنضَّج نوعه بثقة، على الأرجح بسبب سلسلة أخطاء البيئة نفسها) — **صلحت الاثنين والعشرين
جميعًا**، وتحققت مجددًا: صفر خطأ حقيقي متبقٍ بأي من الملفات الثلاثين. باقي المخرجات (~115 خطأ)
دَين تقني موثَّق من جولات سابقة، موجود حتى بملفات لم تُلمَس هذه الجولة (`MobileNav.tsx` مثلًا).

## نتيجة build
**فشل** — `next: not found`، نتيجة مباشرة لفشل `npm install` بـ403 (لا وصول شبكة، نفس القيد
الثابت في كل جولة من هذا المشروع دون استثناء). **لم يُختبَر build حقيقي هنا في أي وقت من هذا
المشروع بالكامل.**

## G) Manual Supabase Checklist (بلا أي API key هنا)
- **Email provider**: فعّل Authentication → Providers → Email، وتأكد أن Email OTP (Magic
  Link/OTP) مفعَّل تحديدًا، لا كلمة مرور.
- **Custom SMTP عبر Resend**: Authentication → Email Templates → SMTP Settings، فعّل Custom
  SMTP، واستخدم بيانات Resend الخاصة بك (Host/Port/Username/Password من لوحة Resend).
- **Sender**: اضبط عنوان "From" بدومين مُوثَّق فعليًا لديك على Resend (لا يعمل بأي دومين غير
  مُوثَّق).
- **OTP Template**: تأكد أن قالب "Magic Link" أو "OTP" يستخدم `{{ .Token }}` صراحة في نصّه
  (وليس رابطًا فقط) حتى تصل شاشة إدخال الرمز رقمًا فعليًا للمستخدم.

## Blockers متبقية قبل Production
1. **لم يُختبَر أي شيء من هذا حيًّا** — build حقيقي، تدفّق Email OTP فعلي، اختبار Paylink ضد
   `restpilot.paylink.sa` فعليًا — كلها تحتاج بيئتك.
2. سبب 502 الحقيقي لم يُشخَّص جذريًا (فقط صُلِّب الكود ضده) — يحتاج `paylink:smoke` فعليًا على
   جهازك.
3. سبب المجموعة الممتلئة يحتاج تأكيدًا فعليًا عبر SQL التشخيصي على بيانات الإنتاج الحقيقية.
4. **لا Push، لا Deploy** — نفّذته بالضبط كما طُلب.
