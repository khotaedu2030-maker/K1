# خُطى | KHOTA — Final Consolidation Patch — تقرير مختصر

## الملفات المعدَّلة (10)
`api/enroll/route.ts` (mismatch البريد 409 + جسر الجوال القديم) • `motabaa/enroll/EnrollForm.tsx`
(فحص تطابق البريد قبل الاستدعاء) • `motabaa/enroll/complete/page.tsx` (useRef guard) •
`api/student-mode/exit/request-otp/route.ts` (`shouldCreateUser:false`) •
`api/payments/paylink/create/route.ts` (مصالحة `checkExistingPending` كاملة + تنقيح الحالة
الغامضة) • `admin/groups/page.tsx` (يعرض الآن `full` القديمة أيضًا) •
`api/admin/cohort-operations/route.ts` (يستدعي RPC الذرّي بدل count+update منفصلَين، +حماية
بروتوكول الرابط، +تحديث sessions عند الحذف أيضًا) • `schema.sql` + migration جديدة + SQL تشخيصي.

## Migrations جديدة (لم تُنفَّذ)
`20260917_seat_hold_alignment_and_atomic_admin_rpc.sql` — يحتوي 3 أجزاء: (أ) دالة مركزية جديدة
`cohort_occupied_seats(uuid)`، (ب) تحديث الدوال الثلاث الحالية لتستخدمها بدل تكرار الشرط،
(ج) RPC إداري ذرّي جديد بالكامل.

## RPC الجديدة
- `cohort_occupied_seats(p_cohort_id)` — الحساب المركزي الوحيد الآن (active، أو pending_payment
  مع الاشتراك حديث خلال 24 ساعة **أو** وجود دفعة Paylink pending حديثة خلال 24 ساعة حتى لو
  الاشتراك نفسه أقدم). `service_role` فقط.
- `admin_update_cohort_operations_atomic(...)` — `SELECT...FOR UPDATE` يقفل صف المجموعة، يحسب
  المحتسَب داخل نفس القفل، يرفض `capacity_below_occupied` إن لزم، ثم يحدِّث capacity/status/
  teacher_id/meeting_url ويُعيد old/new لكل حقل (للـaudit). `service_role` فقط
  (REVOKE من public/anon/authenticated).

## كيف أصبح Admin Capacity Update ذرّيًا فعليًا
كان: JS يحسب `occupied` باستعلام، ثم `update` منفصل — نافذة سباق نظرية بينهما. الآن: استدعاء
RPC واحد فقط من الـroute؛ القفل (`FOR UPDATE`) والحساب والتحديث **كلها داخل نفس المعاملة على
قاعدة البيانات**، لا نافذة سباق ممكنة بين القراءة والكتابة من جهة JavaScript إطلاقًا.

## منطق occupied seats النهائي (موحَّد بمكان واحد فقط)
`active` **أو** (`pending_payment` **و** (الاشتراك حديث خلال 24 ساعة **أو** توجد دفعة Paylink
pending حديثة خلال 24 ساعة لهذا الاشتراك تحديدًا)) — يُطبَّق الآن حرفيًا بنفس الدالة الواحدة في:
الدوال الثلاث القديمة، RPC الإداري الجديد، **و**Admin route (كان يستخدم `.or()` يدويًا مختلفًا
قليلًا عن الدوال — الآن موحَّد 100% عبر استدعاء نفس RPC).

## Paylink reconciliation النهائي
`checkExistingPending`: `provider_ref=null` لم يعد يرجع 503 فورًا — يستدعي
`getTransactionsOfOrderNumber` أولًا. وُجدت معاملة → يحفظ المرجع ويكمل بنفس تدفق
Paid/Pending/Canceled. لم توجد (استعلام ناجح وفارغ) وعمر الدفعة <24h → يبقى pending/503. عمره
≥24h → `failed`. **فشل الاستعلام نفسه** → يبقى pending/503 دائمًا، لا تخمين. نفس المنطق بالضبط
طُبِّق على حالة addInvoice الغامضة (502/503/504/خطأ اتصال) بالمسار الرئيسي — اكتشفت وأصلحت خطأ
تصريح متغيّر مكرَّر (`transaction`/`foundTransactionNo`) أثناء هذا التعديل، عبر `tsc` فعليًا.

## نتيجة tsc
نُفِّذ فعليًا. راجعت الملفات الثمانية المتأثرة تحديدًا — **لقيت خطأ حقيقي واحد** (تصريح متغيّر
مكرَّر من تعديلي الخاص، TS2451) **وصلحته**، تأكدت بعدها صفر خطأ حقيقي متبقٍ. الباقي ضجيج بيئة
موثَّق من كل جولة سابقة.

## نتيجة build
**فشل** — `next: not found`، نفس قيد الشبكة الثابت (لا وصول شبكة في هذه البيئة).

## اختبارات — code-review فقط (لا بيئة تشغيل حقيقية هنا)
1–7, 9–10: منطق مكتوب ومُتحقَّق بالقراءة المباشرة يطابق كل سيناريو. **8**: `requireAdmin()`
يبحث بجدول `admins` تحديدًا — أي معلم (غير موجود هناك) يحصل 403 تلقائيًا بالتصميم، بلا حاجة
لمنطق إضافي. **11-12**: `AuthForm` بـ`mode="staff"` يرفض role="parent"/"none" برسالتين مختلفتين
الآن (البند 11). **13-16**: منطق مكتوب ومُتحقَّق بالقراءة. **17**: الحالة الغامضة الآن لا
تتحول `failed` إلا بعد مصالحة ناجحة تؤكد الغياب فعليًا + عمر ≥24 ساعة — تحققت من الكود مباشرة.

## Migration/SQL يحتاج تنفيذًا يدويًا
`20260917_seat_hold_alignment_and_atomic_admin_rpc.sql` (الوحيدة الجديدة هذه الجولة) —
لم تُنفَّذ، تحتاج تشغيلك المباشر على Supabase. `legacy_full_status_check.sql` تشخيصي فقط،
اختياري التشغيل.
