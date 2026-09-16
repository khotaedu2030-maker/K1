import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveParentContext } from "@/lib/pilot-parent";
import { toPaylinkSaudiMobile } from "@/lib/phone";
import { createPaylinkInvoice, getPaylinkInvoice } from "@/lib/paylink";
import { verifyAndActivatePaylinkPayment } from "@/lib/paylink-verify";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

// يعالج سجل payment "pending" موجود مسبقًا لنفس الاشتراك — يُستدعى من مسارَين: الفحص المسبق
// العادي، ومسار تعارض unique violation (السباق الحقيقي بين طلبَين متزامنَين). لا يُنشئ فاتورة
// جديدة أبدًا بنفسه؛ يُعيد استجابة نهائية دائمًا (paymentUrl/alreadyPaid/خطأ) إلا إذا
// allowContinue=true والفاتورة القديمة تبيّن أنها ملغاة فعليًا — عندها فقط يُعيد null ليكمل
// المستدعي بإنشاء محاولة جديدة بأمان (الصف القديم صار failed).
async function checkExistingPending(
  admin: AdminClient,
  existingPending: { id: string; provider_ref: string | null },
  options: { allowContinue: boolean; nullRefMessage: string }
): Promise<NextResponse | null> {
  if (!existingPending.provider_ref) {
    console.error(
      `[paylink-create] سجل دفع pending (${existingPending.id}) بلا provider_ref؛ يتطلب مصالحة أو انتظار.`
    );
    return NextResponse.json({ error: options.nullRefMessage }, { status: 503 });
  }

  const invoiceCheck = await getPaylinkInvoice(existingPending.provider_ref);
  if (!invoiceCheck.ok) {
    // فشل التحقق من الفاتورة القديمة (اتصال/خطأ من Paylink) — قد تكون لا تزال قابلة للدفع
    // فعليًا. لا نخاطر بإنشاء فاتورة ثانية قد تسمح بدفع مزدوج — نرفض بدل المتابعة بصمت.
    console.error(
      `[paylink-create] فشل التحقق من فاتورة pending سابقة (${existingPending.provider_ref}): ${invoiceCheck.error}`
    );
    return NextResponse.json({ error: "تعذّر التحقق من محاولة دفع سابقة، حاول مرة أخرى" }, { status: 503 });
  }

  const status = String(invoiceCheck.invoice.orderStatus ?? "").trim().toLowerCase();
  if (status === "paid") {
    // دُفعت فعليًا بمحاولة سابقة — نُشغِّل التحقق/التفعيل الآن بدل إنشاء فاتورة مكرَّرة.
    const verifyResult = await verifyAndActivatePaylinkPayment(existingPending.provider_ref);
    if (verifyResult.ok) return NextResponse.json({ alreadyPaid: true });
    return NextResponse.json({ error: verifyResult.error }, { status: verifyResult.status });
  }
  if (status && status !== "paid" && status !== "pending" && status !== "processing") {
    // ملغاة أو غير قابلة للدفع فعليًا لدى Paylink — آمن الآن لتعليمها failed.
    await admin.from("payments").update({ status: "failed" }).eq("id", existingPending.id);
    if (options.allowContinue) return null; // يُكمِل المستدعي لإنشاء محاولة جديدة بأمان.
    return NextResponse.json(
      { error: "انتهت صلاحية محاولة دفع سابقة، حاول مرة أخرى" },
      { status: 503 }
    );
  }
  // لا تزال Pending/Processing فعليًا لدى Paylink — نُعيد نفس رابط الدفع، لا فاتورة جديدة.
  const paymentUrl = invoiceCheck.invoice.url;
  if (typeof paymentUrl === "string" && paymentUrl) {
    return NextResponse.json({ paymentUrl });
  }
  console.error(
    `[paylink-create] الفاتورة السابقة (${existingPending.provider_ref}) لا تزال Pending لدى Paylink لكن بلا رابط دفع صالح بالاستجابة.`
  );
  return NextResponse.json({ error: "تعذّر استكمال محاولة دفع سابقة، تواصل معنا" }, { status: 503 });
}

// العميل يرسل subscriptionId فقط — لا مبلغ، لا اسم خطة، لا أي بيانات سعر من المتصفح. كل ما
// يُرسَل فعليًا لـPaylink (المبلغ، اسم الخطة، بيانات ولي الأمر) يُجلَب من قاعدة البيانات
// server-side حصرًا، بعد التحقق أن هذا الاشتراك يعود فعليًا لولي الأمر الحالي.
export async function POST(req: Request) {
  const context = await resolveParentContext();
  if (!context) {
    return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const subscriptionId = body?.subscriptionId;
  if (!subscriptionId || typeof subscriptionId !== "string") {
    return NextResponse.json({ error: "subscriptionId مطلوب" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("id, parent_id, plan_id, status")
    .eq("id", subscriptionId)
    .maybeSingle();

  if (!subscription) {
    return NextResponse.json({ error: "اشتراك غير موجود" }, { status: 404 });
  }
  if (subscription.parent_id !== context.parentId) {
    console.error(`[paylink-create] محاولة وصول غير مصرَّح: parent=${context.parentId} لاشتراك يعود لـ ${subscription.parent_id}`);
    return NextResponse.json({ error: "اشتراك غير موجود" }, { status: 404 });
  }
  // لا يُسمَح بإنشاء محاولة دفع جديدة إلا من حالة pending_payment تحديدًا — أي حالة أخرى (بما
  // فيها active) تُرفَض بلا إنشاء أي فاتورة جديدة.
  if (subscription.status !== "pending_payment") {
    return NextResponse.json({ error: "لا يمكن بدء دفع جديد لهذا الاشتراك في حالته الحالية" }, { status: 409 });
  }

  const { data: plan } = await admin
    .from("plans")
    .select("name, price_sar")
    .eq("id", subscription.plan_id)
    .maybeSingle();

  if (!plan || plan.price_sar == null) {
    return NextResponse.json({ error: "تعذّر تحديد سعر الخطة" }, { status: 500 });
  }

  const { data: parent } = await admin
    .from("parents")
    .select("full_name, phone, email")
    .eq("id", context.parentId)
    .maybeSingle();

  if (!parent?.full_name || !parent?.phone) {
    console.error(`[paylink-create] بيانات ولي الأمر ناقصة (الاسم/الجوال) للمعرّف ${context.parentId}`);
    return NextResponse.json({ error: "بيانات ولي الأمر غير مكتملة" }, { status: 500 });
  }

  let clientMobile: string;
  try {
    clientMobile = toPaylinkSaudiMobile(parent.phone);
  } catch {
    console.error(`[paylink-create] رقم جوال غير صالح لولي الأمر ${context.parentId}`);
    return NextResponse.json({ error: "رقم جوال ولي الأمر غير صالح" }, { status: 500 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    console.error("[paylink-create] NEXT_PUBLIC_SITE_URL غير معرَّف في متغيرات البيئة.");
    return NextResponse.json({ error: "الخدمة غير مُهيَّأة" }, { status: 500 });
  }

  // ---------------------------------------------------------------------
  // منع تعدد الفواتير المفتوحة: هل توجد محاولة دفع "pending" سابقة لنفس الاشتراك؟
  // Fail-closed بالكامل: أي فشل مؤقت هنا (استعلام قاعدة البيانات، أو الاتصال بـPaylink)
  // يمنع إنشاء فاتورة جديدة فورًا (503) بدل المخاطرة بفاتورتين مفتوحتين لنفس الاشتراك —
  // وهو ما قد يسمح بدفع مزدوج فعلي، حتى لو كان معنى ذلك أن المستخدم يحتاج المحاولة لاحقًا.
  // ---------------------------------------------------------------------
  const { data: existingPendingRows, error: existingPendingError } = await admin
    .from("payments")
    .select("id, provider_ref")
    .eq("subscription_id", subscription.id)
    .eq("provider", "paylink")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1);

  if (existingPendingError) {
    console.error(`[paylink-create] فشل استعلام البحث عن دفعة pending سابقة للاشتراك ${subscription.id}:`, existingPendingError.message);
    return NextResponse.json({ error: "خطأ مؤقت، حاول مرة أخرى خلال دقائق" }, { status: 503 });
  }

  const existingPending = existingPendingRows?.[0] ?? null;

  if (existingPending) {
    const result = await checkExistingPending(admin, existingPending, {
      allowContinue: true,
      nullRefMessage: "توجد محاولة دفع سابقة قيد المعالجة لهذا الاشتراك. حاول مرة أخرى خلال دقائق، أو تواصل معنا إذا استمرت المشكلة.",
    });
    if (result) return result;
    // result === null: الفاتورة القديمة تبيّن أنها ملغاة، عُلِّمت failed، نُكمل لإنشاء محاولة جديدة أدناه.
  }

  // ---------------------------------------------------------------------
  // إنشاء سجل الدفع أولًا (pending) — معرّفه (payments.id) هو orderNumber الذي يُرسَل لـPaylink.
  // هذا يضمن مرجعًا فريدًا لكل محاولة دفع بلا أي تعديل schema.
  // ---------------------------------------------------------------------
  const { data: newPayment, error: pendingError } = await admin
    .from("payments")
    .insert({
      subscription_id: subscription.id,
      parent_id: context.parentId,
      amount_sar: plan.price_sar,
      status: "pending",
      provider: "paylink",
      provider_ref: null,
    })
    .select("id")
    .single();

  if (pendingError) {
    if (pendingError.code === "23505") {
      // Race Condition حقيقي: طلب متزامن آخر أنشأ سجل pending لنفس الاشتراك بين فحصنا المسبق
      // أعلاه وهذا الإدراج (الفهرس الفريد الجزئي uq_paylink_one_pending_per_subscription منع
      // الإدراج المزدوج فعليًا). لا نُنشئ سجل payment ثانٍ إطلاقًا — نُعيد الاستعلام عن السجل
      // الموجود فعليًا ونتعامل معه بنفس المنطق أعلاه، بلا محاولة إعادة إدراج تلقائية بهذا الطلب.
      console.error(`[paylink-create] Unique violation عند إنشاء payment pending للاشتراك ${subscription.id} — سباق حقيقي، جارٍ إعادة الفحص.`);
      const { data: conflictRows, error: conflictError } = await admin
        .from("payments")
        .select("id, provider_ref")
        .eq("subscription_id", subscription.id)
        .eq("provider", "paylink")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1);

      const conflictingPending = conflictRows?.[0] ?? null;
      if (conflictError || !conflictingPending) {
        console.error(`[paylink-create] تعذّر إعادة إيجاد السجل المتعارض بعد unique violation للاشتراك ${subscription.id}:`, conflictError?.message);
        return NextResponse.json({ error: "عملية الدفع قيد التجهيز، حاول بعد لحظات" }, { status: 503 });
      }

      const result = await checkExistingPending(admin, conflictingPending, {
        allowContinue: false, // لا إعادة إدراج تلقائية بهذا الطلب نفسه حتى لو تبيّنت ملغاة.
        nullRefMessage: "عملية الدفع قيد التجهيز، حاول بعد لحظات",
      });
      // allowContinue=false يضمن استجابة دائمًا هنا، لكن نتعامل مع null احتياطًا فقط.
      return result ?? NextResponse.json({ error: "عملية الدفع قيد التجهيز، حاول بعد لحظات" }, { status: 503 });
    }

    console.error(`[paylink-create] فشل إنشاء سجل payment pending للاشتراك ${subscription.id}:`, pendingError.message);
    return NextResponse.json({ error: "تعذّر بدء عملية الدفع" }, { status: 500 });
  }
  if (!newPayment) {
    console.error(`[paylink-create] إدراج payment pending للاشتراك ${subscription.id} لم يُرجِع صفًا رغم عدم وجود خطأ.`);
    return NextResponse.json({ error: "تعذّر بدء عملية الدفع" }, { status: 500 });
  }

  const orderNumber = newPayment.id;

  const invoiceResult = await createPaylinkInvoice({
    orderNumber,
    amount: Number(plan.price_sar),
    clientName: parent.full_name,
    clientMobile,
    clientEmail: parent.email ?? null,
    productTitle: `خُطى — ${plan.name}`,
    callBackUrl: `${siteUrl}/api/payments/paylink/callback`,
    cancelUrl: `${siteUrl}/motabaa/enroll/payment?sub=${encodeURIComponent(subscription.id)}&cancelled=1`,
  });

  if (!invoiceResult.ok) {
    // لا نترك السجل pending بلا داعٍ — نُعلِّمه failed فورًا.
    await admin.from("payments").update({ status: "failed" }).eq("id", newPayment.id);
    return NextResponse.json({ error: invoiceResult.error }, { status: 502 });
  }

  // تحديث السجل نفسه بـprovider_ref — لا إنشاء سجل جديد إطلاقًا.
  const { error: updateRefError } = await admin
    .from("payments")
    .update({ provider_ref: invoiceResult.transactionNo })
    .eq("id", newPayment.id);
  if (updateRefError) {
    // فشل حفظ provider_ref رغم نجاح addInvoice فعليًا لدى Paylink — الفاتورة حقيقية وقابلة
    // للدفع، لذا لا نمنع هذا الطلب الحالي من إكمال الدفع (نُعيد paymentUrl أدناه بأي حال).
    // لكن أي محاولة لاحقة (/create مرة أخرى لهذا الاشتراك) ستجد هذا الصف بحالة pending
    // وprovider_ref=null، وستُرفَض تلقائيًا (فحص "منع تعدد الفواتير" أعلاه) بدل إنشاء فاتورة
    // ثانية فوقها — هذا يتطلب مصالحة يدوية لهذا الصف تحديدًا (تحديث provider_ref يدويًا بمعرفة
    // transactionNo من لوحة Paylink) قبل أي محاولة دفع جديدة لهذا الاشتراك.
    console.error(
      `[paylink-create] فشل تحديث provider_ref لسجل الدفع ${newPayment.id} (transactionNo=${invoiceResult.transactionNo}) — يتطلب مصالحة يدوية.`,
      updateRefError.message
    );
  }

  return NextResponse.json({ paymentUrl: invoiceResult.paymentUrl });
}
