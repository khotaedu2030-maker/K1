# خُطى | KHOTA — Final Launch Blocker Patch — تقرير مختصر

## الملفات المعدَّلة (14)
`login/page.tsx` (resolve-role أولًا + isAllowedNextForRole) • `api/enroll/route.ts`
(يتطلب Auth حقيقية، user.email هو الهوية الموثوقة) • `motabaa/enroll/EnrollForm.tsx`
(sessionStorage بدل استدعاء مباشر بلا جلسة) • `motabaa/enroll/complete/page.tsx` (جديد) •
`api/payments/paylink/create/route.ts` (انتهاء 24h + مصالحة الحالة الغامضة) • `lib/paylink.ts`
(`ambiguous` flag + `getPaylinkTransactionsByOrderNumber`) • `api/teacher-applications/route.ts`
(تحصين URL/رقم/بريد) • `globals.css` (حذف `.plan-tile.on::after`) • `parent/page.tsx`
(نص البريد) • `.env.example` (أضفت RESEND_API_KEY/CONTACT_FROM_EMAIL الناقصين فعليًا) •
`schema.sql` + migration جديدة + 2 SQL تشخيصي/تنظيف.

## migrations يجب تطبيقها يدويًا
`20260916_pending_payment_24h_expiry.sql` فقط (تعديل 3 دوال SQL موجودة، بلا تغيير جداول/بيانات).

## login flow: parent/teacher/admin
`resolve-role` يُستدعى **أولًا دائمًا** بعد verifyOtp. Admin/Teacher: **لا يُستدعى link-parent
إطلاقًا**، `next` يُقبَل فقط إن بدأ بـ`/admin` أو `/teacher` على التوالي. Parent: link-parent
يُستدعى للتنظيف فقط (best-effort، لا يحجب الدخول عند فشله). None: next=`/motabaa/enroll/complete`
يُقبَل مباشرة بلا link-parent؛ غير ذلك محاولة link-parent، وفشلها يعرض
"لا يوجد اشتراك مرتبط بهذا البريد. ابدأ التسجيل أولًا." حرفيًا.

## seat reservation بعد Email verification فقط
`/api/enroll` يتطلب الآن `getUser()` حقيقي (401 بدونه) — **لا يمكن لمستخدم غير متحقق حجز مقعد
بعد الآن**. `EnrollForm` يخزّن البيانات بـ`sessionStorage` ويمرّ بـ`/login` أولًا إن لم توجد
جلسة؛ `/motabaa/enroll/complete` يستدعي `/api/enroll` فعليًا بعد نجاح OTP فقط.

## نتيجة capacity expiry
الدوال الثلاث (`cohort_available_seats`، `public_cohorts_catalog`، `enroll_subscription_atomic`)
تحتسب الآن `active` أو `pending_payment` خلال آخر 24 ساعة فقط. `/create` يفحص
`subscription.created_at`، ويُعلِّم `expired` + يرفض 409 برسالة "انتهت صلاحية محاولة التسجيل..."
حرفيًا إن كان أقدم. **لم أُشغِّل هذا حيًّا** — لا بيئة قاعدة بيانات هنا.

## نتيجة Paylink reconciliation
`ambiguous:true` فقط على 502/503/504/خطأ اتصال (لا 400/401/403). عند الغموض:
`getPaylinkTransactionsByOrderNumber` → إن وُجدت معاملة، `getInvoice` → Paid يُفعِّل، Pending
يُعيد نفس الرابط، غير ذلك `failed`. صفر فاتورة ثانية قبل حسم المصالحة. **لم أُختبَر هذا ضد
Paylink حقيقي — لا بيانات اعتماد هنا.**

## الخط الأخضر
`.plan-tile.on::after` **حُذِف بالكامل** كما طُلب حرفيًا — التمييز الآن border/shadow/transform
فقط. `:focus-visible` سليم بلا تغيير.

## نتيجة tsc
نُفِّذ فعليًا. راجعت الملفات الـ14 المتأثرة تحديدًا — **صفر خطأ حقيقي جديد** (فحصت TS7006/
TS18047/TS2345/TS2322 تحديدًا، صفر نتيجة). الباقي (TS2307/TS2875/TS7026/TS2591/TS2882) ضجيج
بيئة موثَّق من كل جولة سابقة بهذا المشروع.

## نتيجة build
**فشل** — `next: not found`، نتيجة مباشرة لفشل `npm install` بـ403 (لا وصول شبكة هنا، القيد
الثابت في كل هذا المشروع).

## نتيجة paylink:smoke
**لم يُشغَّل فعليًا** — `.env.local` غير موجود في هذه البيئة إطلاقًا (لم يوجد أبدًا هنا). فشل
قبل حتى محاولة الاتصال. **لا أعتبره ناجحًا** كما طلبت — يحتاج تشغيلك الفعلي على جهازك ببيانات
Paylink الحقيقية.
