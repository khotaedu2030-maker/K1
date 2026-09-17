# خُطى | KHOTA — تكامل Paylink الكامل — تقرير التنفيذ

## الملفات المضافة (5)
- `src/lib/paylink.ts` — أداة خادم فقط: `authenticatePaylink()` (داخلية)، `getPaylinkInvoice()`،
  `createPaylinkInvoice()`. صفر credentials بالكود، كل شيء من متغيرات البيئة الخمسة المطلوبة
  بالضبط: `PAYLINK_API_ID`, `PAYLINK_API_SECRET`, `PAYLINK_BASE_URL`, `PAYLINK_WEBHOOK_SECRET`,
  `NEXT_PUBLIC_SITE_URL` (تحقّقت بـ`grep` مباشر عبر كل الملفات الجديدة — لا متغيّر إضافي).
- `src/lib/paylink-verify.ts` — دالة التحقق المشتركة `verifyAndActivatePaylinkPayment()`،
  يستخدمها كل من الـWebhook وCallback.
- `src/app/api/payments/paylink/create/route.ts`.
- `src/app/api/payments/paylink/callback/route.ts`.
- `KHOTA_PAYLINK_INTEGRATION_REPORT.md` (هذا الملف).

## الملفات المعدَّلة (4)
- `src/app/api/payments/paylink/webhook/route.ts` — أعيدت كتابته بالكامل بحقول v2 الرسمية
  بالضبط (`transactionNo`, `merchantOrderNumber`, `orderStatus`, `amount`, `paymentType`,
  `apiVersion`)، ولم يعد يستخدم أيًّا منها لتفعيل الاشتراك مباشرة — فقط كإشارة لاستدعاء
  `verifyAndActivatePaylinkPayment()`.
- `src/lib/activate-subscription.ts` — أُضيف بارامتر `provider`/`providerRef` (كان
  `"manual-dev"` مُثبَّتًا بالكود سابقًا)، وطبقة idempotency إضافية عبر `provider_ref` قبل
  التحقق من حالة الاشتراك نفسها. لم يتغيّر أي فحص أمان موجود مسبقًا (تطابق الأيام، المقاعد،
  توليد الجلسات) — إضافة فقط.
- `src/app/api/payment/confirm/route.ts` — يستدعي الآن الدالة المشتركة `activateSubscriptionAfterPayment()`
  بدل تكرار نفس الكود. **السلوك الخارجي مطابق تمامًا للأصل** (نفس أشكال الاستجابة، نفس رموز
  الحالة) — تحقّقت بمقارنة مباشرة.
- `src/app/motabaa/enroll/payment/PaymentClient.tsx` + `page.tsx` — زر "الدفع الآن" الحقيقي،
  والزر التجريبي أصبح مشروطًا بـ`process.env.NODE_ENV !== "production"` على مستوى الواجهة أيضًا
  (إضافة لحجبه الأصلي Server-side في `/api/payment/confirm` الذي لم يتغيّر).

## Payload المُرسَل فعليًا في `addInvoice`
```json
{
  "orderNumber": "<subscriptionId>",
  "amount": 529,
  "currency": "SAR",
  "clientName": "<parents.full_name>",
  "clientMobile": "+9665XXXXXXXX",
  "clientEmail": "<parents.email إن وُجد>",
  "products": [{ "title": "خُطى — الأساسية", "price": 529, "qty": 1 }],
  "callBackUrl": "https://www.khota.sa/api/payments/paylink/callback",
  "cancelUrl": "https://www.khota.sa/motabaa/enroll/payment?cancelled=1"
}
```
كل قيمة أعلاه (السعر، الاسم، الجوال) تُجلَب من قاعدة البيانات Server-side بعد التحقق من ملكية
الاشتراك — العميل لا يرسل شيئًا سوى `subscriptionId`.

## كيف يرتبط orderNumber بالـsubscriptionId
**`orderNumber = subscriptionId` مباشرة، حرفيًا، بلا أي تحويل أو جدول ربط.** بما أن
`subscriptionId` أصلًا UUID فريد عالميًا (من Supabase)، استخدامه مباشرة كـ`orderNumber` يحقّق
الربط الكامل **بلا أي تعديل schema** — لا حاجة لجدول وسيط، ولا لعمود جديد. هذا القرار هو ما جعل
الإجابة على "هل احتجت schema change؟" = **لا** (راجع القسم الأخير).

عند التحقق (Webhook أو Callback)، لا نثق بـ`merchantOrderNumber`/`orderNumber` الوارد مباشرة
كدليل — نستخدمه فقط لتحديد أي اشتراك **نتحقق منه**، ثم نُطابقه مع `orderNumber` الفعلي الموجود
داخل استجابة `getInvoice()` الموثوقة من Paylink نفسها قبل أي تفعيل.

## كيف يتم التحقق عبر getInvoice (السلسلة الكاملة)
1. Webhook أو Callback يستلم `transactionNo` (من الـpayload الموقَّع أو من رابط العودة).
2. `verifyAndActivatePaylinkPayment(transactionNo)`:
   - مصادقة Server-side جديدة عبر `POST /api/auth` (لا يُعاد استخدام Token قديم).
   - `GET /api/getInvoice/{transactionNo}` بـ`Authorization: Bearer <id_token>`.
   - **من استجابة getInvoice نفسها فقط** (لا من الـwebhook/callback): يتحقق أن
     `invoice.transactionNo === transactionNo` المطلوب، أن `orderStatus` (بعد تطبيع
     lowercase) يساوي `"paid"` بالضبط، أن `orderNumber` (من مستوى الفاتورة أو من
     `gatewayOrderRequest` دفاعيًا) موجود وقابل للربط باشتراك حقيقي.
   - يجلب `plans.price_sar` الفعلي للاشتراك المطابق، ويقارنه بـ`invoice.amount` (سماحية ±0.01
     لفروق التقريب فقط).
   - أي عدم تطابق في أي من هذه الخطوات = رفض كامل، **صفر تفعيل**.

## كيف ضُمِنت idempotency (طبقتان مستقلتان)
1. **عبر حالة الاشتراك نفسها**: إن كان `subscriptions.status === "active"` بالفعل، يُعاد
   `alreadyActive: true` فورًا بلا أي معالجة إضافية (موجود أصلًا من قبل هذه الجولة).
2. **عبر `payments.provider_ref` (جديد هذه الجولة)**: حتى لو لم تتحدَّث حالة الاشتراك لأي سبب
   نادر، يُفحَص وجود صف `payments` بنفس `provider_ref` (رقم عملية Paylink) وحالة `"paid"`
   مسبقًا — إن وُجد، لا مُعالجة مكرَّرة. هذا يحمي تحديدًا من سيناريو "Webhook وCallback يصلان
   لنفس العملية بترتيب غير معروف أو بتكرار" (سلوك شائع وموثَّق لدى مزوّدي الدفع).
نتيجة الاثنتين معًا: أي استدعاء مكرَّر (Webhook مُعاد الإرسال، أو المستخدم يعيد تحميل صفحة
الـCallback يدويًا) يُعيد `200 { ok: true, alreadyActive: true }` بلا توليد جلسات مكرَّرة ولا
تسجيل دفعة ثانية.

## هل clientName/clientMobile موجودان فعلًا؟ لا Blocker
**موجودان فعليًا، بلا اختراع.** تحقّقت من `supabase/schema.sql` مباشرة: `parents.full_name`
و`parents.phone` **حقلان إلزاميان (`not null`)** في قاعدة البيانات — كل ولي أمر مسجَّل يملكهما
بالضرورة. `parents.email` اختياري، ويُرسَل فقط عند وجوده فعليًا. استخدمت `normalizeSaudiPhone()`
الموجودة أصلًا بالمشروع لتحويل الجوال من الصيغة المحلية المخزَّنة (`05XXXXXXXX`) إلى الصيغة
الدولية (`+9665XXXXXXXX`) قبل إرساله لـPaylink. **لا Blocker هنا إطلاقًا.**

## هل احتجت schema change؟ لا
السببان الوحيدان اللذان كانا سيستلزمان تعديل schema هما: (أ) ربط orderNumber بالاشتراك — حُلَّ
بجعل orderNumber = subscriptionId مباشرة (لا حاجة لعمود/جدول جديد)، و(ب) تسجيل transactionNo
كأثر تدقيق قبل التفعيل النهائي — حُلَّ باستخدام عمودي `payments.provider` و`payments.provider_ref`
**الموجودين أصلًا** في الـschema الحالي (لم يُستخدَما بامتلائهما من قبل، لكنهما كانا موجودين).
**صفر migration بهذه الجولة.**

## نقطة صدق مهمة يجب معرفتها قبل التفعيل الفعلي
أسماء حقول استجابة `addInvoice` تحديدًا (`url`، `transactionNo` داخل الاستجابة نفسها — وليس
حقول الطلب الصادر التي أعطيتني إياها بدقة) **لم تُذكَر لي بنفس التأكيد الرسمي** الذي أعطيتني
إياه لحقول auth/getInvoice/webhook. بنيتها على أفضل افتراض معقول (`response.url` كما ذكرت أنت
صراحة بطلب سابق، و`transactionNo` بنفس اسم الحقل المستخدَم بكل مكان آخر بتوثيقك). **يُنصَح
بشدة باختبار فعلي لمسار `/create` كاملًا ضد `https://restpilot.paylink.sa` قبل أي استخدام حقيقي
بالإنتاج** — هذا الجزء تحديدًا هو الأقل يقينًا في التكامل بأكمله.

## نتائج الاختبارات
`npm install`: فشل (403، لا وصول شبكة، نفس القيد الثابت بكل هذا المشروع). `npx tsc --noEmit`:
نُفِّذ، راجعت كل الملفات المتأثرة تحديدًا — كل الأخطاء الظاهرة (`Cannot find name 'process'`،
`Cannot find module 'server-only'`) بيئية بحتة (تحتاج `@types/node` و`server-only` المثبَّتين
فعليًا، وهما نمط مستخدَم بأمان بالفعل بملفات أخرى بالمشروع مثل `supabase-admin.ts`) — **صفر
خطأ كود حقيقي جديد**. `npm run build`: فشل (`next: not found`)، نتيجة مباشرة لفشل التثبيت.
**لم يُنفَّذ أي `git push` ولا أي Deploy.**
