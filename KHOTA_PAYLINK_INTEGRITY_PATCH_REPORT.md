# خُطى | KHOTA — Payment Integrity Patch — تقرير التنفيذ

## الملفات المعدَّلة (6)
- **`src/lib/activate-subscription.ts`** — إعادة كتابة كاملة لآلة الحالة: يرفض صراحةً
  `paused`/`cancelled`/`expired`، يُصالِح (reconcile) سجل الدفع إلى `paid` حتى لو كان
  الاشتراك `active` أصلًا، ويقبل الآن `paymentId` اختياريًا — إن وُجد يُحدِّث نفس الصف بدل
  إنشاء صف جديد؛ إن غاب (مسار Dev اليدوي فقط) يُنشئ صفًا كما كان دائمًا، **بلا تغيير سلوك
  لمسار Dev**.
- **`src/lib/paylink-verify.ts`** — إعادة كتابة كاملة: يستخرج `orderNumber` من
  `invoice.gatewayOrderRequest.orderNumber` حصرًا ويعامله كـ`paymentId` لا `subscriptionId`،
  يجلب صف `payments` بـ`id = orderNumber` و`provider = "paylink"`، يتحقق أن `provider_ref`
  يطابق `transactionNo`، يقارن المبلغ مع `payments.amount_sar` (السعر المُجمَّد) كمصدر أساسي،
  ويتحقق من `gatewayOrderRequest.currency = SAR` إن وُجدت. فحص سعر الخطة الحالي أصبح دفاعيًا
  فقط (تسجيل ملاحظة، لا رفض).
- **`src/app/api/payments/paylink/create/route.ts`** — إعادة كتابة كاملة: يرفض بـ409 إن لم
  يكن `subscription.status === "pending_payment"`، يفحص فواتير معلَّقة سابقة قبل إنشاء أي شيء
  جديد (تفصيل أدناه)، ينشئ صف `payments` بحالة `pending` **قبل** استدعاء Paylink ويستخدم
  `payments.id` نفسه كـ`orderNumber`، ثم يُحدِّث نفس الصف (`provider_ref`) بعد نجاح
  `addInvoice` — لا صف ثانٍ أبدًا. فشل `addInvoice` يُعلِّم الصف `failed` فورًا.
- **`src/app/motabaa/enroll/payment/PaymentClient.tsx`** — يتعامل الآن مع استجابة
  `{ alreadyPaid: true }` من `/create` (دفعة سابقة مكتملة فعليًا) بعرض حالة النجاح مباشرة بدل
  تحويل المستخدم لـPaylink مرة أخرى.
- **`src/lib/paylink.ts`** — أُضيف رأس `Accept: application/json` لطلبَي `getInvoice`
  و`addInvoice`. حُذف التعليق الذي يشكّك بأسماء حقول استجابة `addInvoice` — أصبحت مؤكَّدة رسميًا
  كما زوَّدتني.
- **`.env.example`** — أُضيفت أسماء المتغيرات الخمسة فقط، بلا أي قيمة.

## لم يُلمَس (بالتوافق مع طلبك، تحقّق `find` مباشر)
`src/app/api/payments/paylink/webhook/route.ts` و`.../callback/route.ts` — كلاهما يستدعيان
`verifyAndActivatePaylinkPayment(transactionNo)` بنفس التوقيع تمامًا، فاستفادا من كل التحسينات
أعلاه بلا حاجة لأي تعديل فيهما. `src/app/api/payment/confirm/route.ts` (مسار Dev) — يستدعي
الدالة المشتركة بلا تمرير `paymentId`، فيسلك المسار الاحتياطي المحفوظ لسلوكه القديم تمامًا.
`diff` مباشر يؤكّد منطق `PlansSelector.tsx` مطابق تمامًا — صفر لمس لأي schema/RLS/auth/أسعار.

## Lifecycle الكامل: pending → paid / failed
```
1. POST /create
   └─ subscription.status يجب أن يكون "pending_payment"، وإلا 409 فورًا (بلا إنشاء أي شيء).
   └─ فحص فواتير معلّقة سابقة لنفس الاشتراك (راجع القسم التالي).
   └─ INSERT payments { status: "pending", provider: "paylink", provider_ref: null }
   └─ orderNumber = payments.id (فريد، بلا أي تعديل schema)
   └─ addInvoice(orderNumber, ...) عند Paylink
        ├─ نجاح → UPDATE نفس الصف: provider_ref = transactionNo → إرجاع paymentUrl للعميل
        └─ فشل  → UPDATE نفس الصف: status = "failed" → إرجاع خطأ للعميل (لا يبقى pending بلا داعٍ)

2. المستخدم يُكمل الدفع في واجهة Paylink، ثم:
   ├─ Webhook (v2 payload) يصل بشكل غير متزامن، و/أو
   └─ Callback (المتصفح يُعاد توجيهه) يصل تقريبًا بنفس الوقت
   كلاهما يستدعيان نفس الدالة: verifyAndActivatePaylinkPayment(transactionNo)

3. verifyAndActivatePaylinkPayment(transactionNo):
   └─ GET /api/getInvoice/{transactionNo} (مصادقة جديدة Server-side، لا تخزين Token)
   └─ من استجابة getInvoice نفسها فقط:
        - orderStatus يجب أن يساوي "paid" بالضبط (case-insensitive)، وإلا رفض بلا تفعيل
        - orderNumber (من gatewayOrderRequest) = paymentId → جلب صف payments بـ
          id = orderNumber AND provider = "paylink"
        - تحقّق provider_ref يطابق transactionNo هذا تحديدًا
        - المبلغ يُقارَن مع payments.amount_sar (المُجمَّد وقت إنشاء الفاتورة) — لا سعر الخطة
          الحالي؛ فحص سعر الخطة الحالي دفاعي فقط (لا يرفض دفعًا صحيحًا بسعر قديم مشروع)
        - عملة SAR إن وُجدت بـgatewayOrderRequest

4. activateSubscriptionAfterPayment(subscription_id_من_الصف, { paymentId, providerRef }):
   └─ subscription.status === "paused/cancelled/expired" → رفض 409 صراحةً، لا تفعيل أبدًا
   └─ subscription.status === "active" بالفعل → reconcilePaymentToPaid() (يُصلح الصف لو لم
      يكن paid لأي سبب) → إرجاع alreadyActive فقط، صفر تكرار
   └─ subscription.status === "pending_payment" →
        1. توليد الجلسات (upsert idempotent، آمن تمامًا عند التكرار)
        2. UPDATE subscriptions SET status="active" ... WHERE id=... AND status="pending_payment"
           (تحديث مشروط — يحمي من تفعيل مزدوج عند تزامن حقيقي)
        3. UPDATE payments SET status="paid", paid_at=now() WHERE id = paymentId
           (نفس الصف، لا INSERT جديد أبدًا)
```

## كيف يُمنَع تعدد الفواتير المفتوحة
قبل إنشاء أي شيء جديد في `/create`، يُبحَث عن أحدث صف `payments` بنفس الاشتراك،
`provider="paylink"`, `status="pending"`, و`provider_ref` غير فارغ. إن وُجد:
- **`getInvoice` يُستدعى عليه مباشرة** لمعرفة حالته الفعلية الحالية لدى Paylink، لا حالتنا
  المخزَّنة فقط (قد تكون تغيَّرت منذ آخر مرة تحققنا).
- **لا يزال Pending فعليًا** → يُعاد **نفس** `paymentUrl` من استجابة `getInvoice` للعميل، بلا
  إنشاء فاتورة ثانية إطلاقًا — يمنع العميل من دفع فاتورتين لنفس الاشتراك بالخطأ.
- **أصبح Paid فعليًا** (تم الدفع لكن لم يصل webhook/callback بعد لأي سبب) → تُشغَّل
  `verifyAndActivatePaylinkPayment` فورًا هنا، ويُعاد `{ alreadyPaid: true }` للعميل بدل رابط
  دفع جديد.
- **مُلغاة أو غير قابلة للدفع** → يُعلَّم الصف القديم `failed`، ثم يُكمَل المسار الطبيعي لإنشاء
  محاولة جديدة.

## كيف يُتعامَل مع تزامن Webhook + Callback
كلاهما يستدعيان **بالضبط نفس الدالة** (`verifyAndActivatePaylinkPayment` →
`activateSubscriptionAfterPayment`) بنفس `transactionNo`/`paymentId` — لا مسارين منطقيين
مختلفين يمكن أن يتعارضا. الحماية الفعلية من السباق (Race Condition) طبقتان:
1. **تحديث الاشتراك مشروط**: `UPDATE ... WHERE status="pending_payment"` — أيًّا من الطلبَين
   وصل أولًا "يفوز" بالتحديث الفعلي؛ الآخر لن يُغيِّر شيئًا (الشرط لن يتحقق له) لكنه سيكمل
   بأمان تام لتوليد الجلسات (idempotent أصلًا) ثم تحديث سجل الدفع.
2. **تحديث سجل الدفع لا يخلق تكرارًا أبدًا**: كلا الطلبَين يُحدِّثان **نفس** الصف
   (`payments.id` معروف مسبقًا من `orderNumber`) إلى `paid` — تحديث ثانٍ على نفس الصف بنفس
   القيمة غير ضار.
النتيجة: أيًّا كان ترتيب أو تزامن وصول Webhook وCallback، الاشتراك يُفعَّل **مرة واحدة فقط**،
والجلسات تُولَّد **مرة واحدة فقط**، وسجل الدفع الوحيد المرتبط يُحدَّث بأمان بغض النظر عن عدد
المرات.

## نتائج الاختبارات
`npm install`: فشل (403، لا وصول شبكة، نفس القيد الثابت في هذا المشروع). `npx tsc --noEmit`:
نُفِّذ، راجعت الملفات الستة المتأثرة تحديدًا لأخطاء `TS7006` (implicit-any حقيقي على معاملاتنا)
— **صفر نتيجة**. باقي الأخطاء الظاهرة بيئية بحتة (missing `@types/node`/`server-only`، نفس
النمط المستخدَم بأمان بملفات أخرى من المشروع أصلًا). `npm run build`: فشل (`next: not found`)،
نتيجة مباشرة لفشل التثبيت. **لم يُنفَّذ أي `git push` ولا أي Deploy.**
