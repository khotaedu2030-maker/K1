# خُطى | KHOTA — Pre-Merge Payment Safety Patch — تقرير مختصر

## الملفات المعدَّلة (9)
1. `src/lib/paylink-verify.ts` — `VerifyResult` الناجح يُعيد الآن `subscriptionId`+`paymentId`.
2. `src/app/api/payments/paylink/callback/route.ts` — إعادة كتابة كاملة: ينجح باستخدام
   `result.subscriptionId` الحقيقي (لا `orderNumber`)، وعند الفشل يبحث عن `subscription_id`
   من `payments` بأمان (best-effort UX فقط، غير مُعتمَد للتحقق من الدفع).
3. `src/app/api/payments/paylink/create/route.ts` — `cancelUrl` يحمل `sub=` الآن؛ إعادة كتابة
   منع تعدد الفواتير بالكامل: فشل استعلام pending → 503 (لا فاتورة جديدة)، فشل getInvoice على
   فاتورة سابقة → 503 (لا فاتورة جديدة)، سجل pending بـ`provider_ref=null` → 503 صريح يتطلب
   مصالحة يدوية بدل إنشاء فاتورة فوقه. تعليق تحديث `provider_ref` الفاشل أُصلح ليعكس السلوك
   الجديد بدقة.
4. `src/lib/activate-subscription.ts` — `reconcilePaymentToPaid()` تُعيد الآن
   `{ok:true} | {ok:false,status:503,...}` صريحًا بدل إسقاط الفشل صامتًا؛ كلا موضعَي استدعائها
   (الاشتراك active بالفعل، وبعد التفعيل الجديد) يُعيدان 503 فورًا عند فشل تحديث الدفعة، حتى
   لو الاشتراك نفسه بات active — لضمان أن Webhook يرى استجابة غير-200 ويُعيد Paylink المحاولة.
5. `src/lib/legal-profile.ts` — `providerName: "خُطى"`، `registrationNumber: "FL-586422784"`،
   `businessAddress: "الرياض..."`. `supportEmail` بقي `null` عمدًا (لا يظهر كنص خام بأي صفحة).
   `vatNumber` بقي `null` (دخل أقل من حد التسجيل الإلزامي 300,000 ر.س، كما أفدتني).
6. `src/app/api/contact/route.ts` (جديد) — يُرسِل عبر Resend API (نداء fetch مباشر، بلا حزمة
   جديدة) إلى `khota.edu2030@gmail.com` و`abdullahalmou@hotmail.com` معًا. يتطلب
   `RESEND_API_KEY` (غير معرَّف بعد — **Blocker خارجي**، نفس نمط Paylink).
7. `src/app/contact/ContactForm.tsx` (جديد) — نموذج فعلي يستبدل الزر المعطَّل سابقًا.
8. `src/app/contact/page.tsx` — يستخدم `ContactForm` الجديد.
9. `.env.example` — أُضيف `RESEND_API_KEY`/`CONTACT_FROM_EMAIL`.

## لم يُلمَس (تحقّق `find`/`diff` مباشر)
Schema، RLS، Auth، الأسعار، الخطط، `orderNumber = payments.id`، منطق التحقق عبر `getInvoice` —
كلها كما هي حرفيًا.

## النتيجة

**`npx tsc --noEmit`**: نُفِّذ فعليًا. راجعت كل الملفات التسعة تحديدًا — **صفر خطأ كود حقيقي
جديد**. كل الأخطاء الظاهرة بيئية بحتة (missing `next`/`react`/`process`/`server-only` types)،
نفس الفئة الحاضرة بكل ملف من هذا المشروع، حتى ملفات لم تُلمَس اليوم.

**`npm run build`**: **فشل فعليًا** — `next: not found`. السبب المباشر: `npm install` فشل
بـ`403 Forbidden` على `registry.npmjs.org` (لا وصول شبكة في هذه البيئة، القيد نفسه الحاضر في
كل جولة من هذا المشروع بلا استثناء). **أقول لك هذا بصراحة كما طلبت: الـdependencies غير
موجودة هنا فعليًا، وأنا لا أعتبر هذه المراجعة "ناجحة" بمعنى build حقيقي — هذا يحتاج تأكيدك على
جهازك أو CI حقيقي قبل أي دمج.**

## بلوكر خارجي واحد صريح
نموذج التواصل مبني وسليم منطقيًا لكنه **لن يعمل فعليًا حتى تضبط `RESEND_API_KEY`** بـVercel
(حساب Resend مجاني كافٍ للبداية). بدونه، أي محاولة إرسال سترجع خطأً واضحًا للمستخدم (لن تفشل
صامتًا وتدّعي نجاحًا).
