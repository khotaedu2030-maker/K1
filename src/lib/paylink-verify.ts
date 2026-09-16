import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getPaylinkInvoice } from "@/lib/paylink";
import { activateSubscriptionAfterPayment } from "@/lib/activate-subscription";

export type VerifyResult =
  | { ok: true; alreadyActive: boolean; subscriptionId: string; paymentId: string }
  | { ok: false; status: number; error: string };

// المصدر الوحيد للحقيقة بشأن "هل هذا الدفع مؤكَّد فعليًا؟" — يُستدعى من الـWebhook ومن
// Callback المتصفح كليهما. لا يثق أبدًا بحالة/مبلغ/مرجع يُدَّعى من الطرف المستدعي (Payload
// الـwebhook أو query params من المتصفح) — يعيد التحقق دائمًا مباشرة من Paylink عبر getInvoice
// قبل أي تفعيل.
export async function verifyAndActivatePaylinkPayment(transactionNo: string): Promise<VerifyResult> {
  if (!transactionNo) return { ok: false, status: 400, error: "transactionNo مفقود" };

  const invoiceResult = await getPaylinkInvoice(transactionNo);
  if (!invoiceResult.ok) {
    return { ok: false, status: 502, error: invoiceResult.error };
  }
  const invoice = invoiceResult.invoice;

  const invoiceTransactionNo = String(invoice.transactionNo ?? "");
  const orderStatus = String(invoice.orderStatus ?? "").trim().toLowerCase();
  const amountRaw = invoice.amount;

  // orderNumber هنا هو paymentId (معرّف صف payments)، وليس subscriptionId — أُنشئ هكذا في
  // /api/payments/paylink/create تحديدًا لضمان مرجع فريد لكل محاولة دفع بلا تعديل schema.
  const gatewayRequest = (invoice.gatewayOrderRequest ?? {}) as Record<string, unknown>;
  const orderNumber = String(gatewayRequest.orderNumber ?? "");
  const gatewayCurrency = typeof gatewayRequest.currency === "string" ? gatewayRequest.currency.trim().toUpperCase() : null;

  if (!invoiceTransactionNo || invoiceTransactionNo !== transactionNo) {
    console.error(`[paylink-verify] عدم تطابق transactionNo — طلبنا ${transactionNo}، استلمنا ${invoiceTransactionNo || "لا شيء"}.`);
    return { ok: false, status: 400, error: "بيانات الفاتورة غير متطابقة" };
  }
  if (orderStatus !== "paid") {
    // ليست حالة خطأ بالضرورة (قد تكون Pending) — فقط لا تفعيل حتى تصبح Paid فعليًا.
    return { ok: false, status: 400, error: "الدفع لم يكتمل بعد" };
  }
  if (!orderNumber) {
    console.error(`[paylink-verify] الفاتورة ${transactionNo} بلا gatewayOrderRequest.orderNumber قابل للتحقق منه.`);
    return { ok: false, status: 400, error: "لا يمكن تحديد سجل الدفع المرتبط بهذه الفاتورة" };
  }
  if (gatewayCurrency && gatewayCurrency !== "SAR") {
    console.error(`[paylink-verify] عملة غير متوقَّعة (${gatewayCurrency}) للفاتورة ${transactionNo}.`);
    return { ok: false, status: 400, error: "عملة غير متوقَّعة" };
  }

  const paymentId = orderNumber;
  const supabase = createSupabaseAdminClient();

  const { data: paymentRow, error: paymentFetchError } = await supabase
    .from("payments")
    .select("id, subscription_id, amount_sar, provider, provider_ref, status")
    .eq("id", paymentId)
    .eq("provider", "paylink")
    .maybeSingle();

  if (paymentFetchError) {
    // خطأ استعلام فعلي (انقطاع اتصال مؤقت بقاعدة البيانات مثلًا) — هذا مختلف جوهريًا عن "لا
    // يوجد سجل بهذا المعرّف". لا نُرجِع 404 (يعني نهائيًا "غير موجود ولا فائدة من إعادة
    // المحاولة") لخطأ قد يزول عند إعادة المحاولة — نُرجِع 503 ليعرف المستدعي (Webhook/Callback)
    // أن هذا فشل مؤقت يستحق إعادة المحاولة لاحقًا.
    console.error(`[paylink-verify] خطأ استعلام مؤقت أثناء جلب سجل الدفع ${paymentId}:`, paymentFetchError.message);
    return { ok: false, status: 503, error: "خطأ مؤقت، يُعاد المحاولة تلقائيًا" };
  }
  if (!paymentRow) {
    console.error(`[paylink-verify] لا يوجد سجل دفع بمعرّف ${paymentId} (orderNumber من الفاتورة ${transactionNo}).`);
    return { ok: false, status: 404, error: "سجل الدفع غير موجود" };
  }

  // provider_ref يجب أن يطابق transactionNo هذا تحديدًا — يمنع خلط عملية بأخرى إن وُجد أي
  // تكرار أو إعادة استخدام غير متوقَّعة لنفس paymentId.
  if (paymentRow.provider_ref && paymentRow.provider_ref !== transactionNo) {
    console.error(
      `[paylink-verify] عدم تطابق provider_ref لسجل الدفع ${paymentId}: مسجَّل ${paymentRow.provider_ref}، الفاتورة الحالية ${transactionNo}.`
    );
    return { ok: false, status: 400, error: "بيانات الدفع غير متطابقة" };
  }

  // المصدر الأساسي للمقارنة: السعر المُجمَّد وقت إنشاء الفاتورة (payments.amount_sar) — وليس
  // سعر الخطة الحالي، الذي قد يتغيّر لاحقًا لأسباب لا علاقة لها بهذه العملية تحديدًا.
  const amountSar = typeof amountRaw === "number" ? amountRaw : Number(amountRaw);
  if (!Number.isFinite(amountSar) || Math.abs(Number(paymentRow.amount_sar) - amountSar) > 0.01) {
    console.error(
      `[paylink-verify] عدم تطابق المبلغ لسجل الدفع ${paymentId}: الفاتورة ${amountSar}، السعر المُجمَّد وقت الفاتورة ${paymentRow.amount_sar}.`
    );
    return { ok: false, status: 400, error: "المبلغ لا يطابق سعر الاشتراك عند إنشاء الفاتورة" };
  }

  // فحص دفاعي إضافي (لا يُسقِط دفعًا صحيحًا): إن اختلف سعر الخطة الحالي عن المبلغ المُجمَّد،
  // نُسجِّل ملاحظة فقط للمراجعة اليدوية لاحقًا — لا نرفض عملية دفع صحيحة تمت بسعر قديم مشروع.
  const { data: subscriptionForPlanCheck } = await supabase
    .from("subscriptions")
    .select("plan_id")
    .eq("id", paymentRow.subscription_id)
    .maybeSingle();
  if (subscriptionForPlanCheck?.plan_id) {
    const { data: currentPlan } = await supabase
      .from("plans")
      .select("price_sar")
      .eq("id", subscriptionForPlanCheck.plan_id)
      .maybeSingle();
    if (currentPlan?.price_sar != null && Math.abs(Number(currentPlan.price_sar) - amountSar) > 0.01) {
      console.error(
        `[paylink-verify] ملاحظة (غير حاجبة): سعر الخطة الحالي (${currentPlan.price_sar}) يختلف عن المبلغ المدفوع فعليًا (${amountSar}) للاشتراك ${paymentRow.subscription_id} — قد يكون السعر تغيَّر بعد إنشاء الفاتورة.`
      );
    }
  }

  const result = await activateSubscriptionAfterPayment(paymentRow.subscription_id, {
    provider: "paylink",
    providerRef: transactionNo,
    paymentId: paymentRow.id,
  });
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }
  return { ok: true, alreadyActive: result.alreadyActive, subscriptionId: paymentRow.subscription_id, paymentId: paymentRow.id };
}
