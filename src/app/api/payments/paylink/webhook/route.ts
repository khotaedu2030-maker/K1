import { NextResponse } from "next/server";
import { verifyAndActivatePaylinkPayment } from "@/lib/paylink-verify";

// =========================================================================
// Webhook دفع Paylink v2 — /api/payments/paylink/webhook
// =========================================================================
// حقول Payload الرسمية المؤكَّدة (v2): transactionNo, merchantOrderNumber, orderStatus,
// amount, paymentType, apiVersion.
//
// القاعدة الأمنية الجوهرية هنا: بيانات الـwebhook نفسها (orderStatus، amount،
// merchantOrderNumber) تُستخدَم كـ"إشارة" فقط لتحديد أي فاتورة نتحقق منها — لا نثق بها مباشرة
// لتفعيل أي اشتراك. التفعيل الفعلي يمر حصرًا عبر verifyAndActivatePaylinkPayment()، التي
// تُعيد الاستعلام عن الفاتورة مباشرة من Paylink (GET /api/getInvoice/{transactionNo}) بعد
// مصادقة Server-side جديدة، وتتحقق من الحالة والمبلغ ومرجع الاشتراك من تلك الاستجابة
// الموثوقة نفسها، لا من هذا الـPayload.

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export async function POST(req: Request) {
  const expectedSecret = process.env.PAYLINK_WEBHOOK_SECRET;
  if (!expectedSecret) {
    console.error("[paylink-webhook] PAYLINK_WEBHOOK_SECRET غير معرَّف في متغيرات البيئة — تم رفض الطلب.");
    return NextResponse.json({ error: "الخدمة غير مُهيَّأة" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const providedSecret = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!providedSecret || !timingSafeEqual(providedSecret, expectedSecret)) {
    console.error("[paylink-webhook] رفض الطلب — رأس Authorization غير مطابق.");
    return NextResponse.json({ error: "غير مصرَّح" }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    console.error("[paylink-webhook] رفض الطلب — Payload غير صالح أو فارغ.");
    return NextResponse.json({ error: "payload غير صالح" }, { status: 400 });
  }

  // --- Parse v2: الحقول الرسمية المؤكَّدة بالضبط، بلا تخمين أسماء بديلة ---
  const p = payload as Record<string, unknown>;
  const transactionNo = typeof p.transactionNo === "string" ? p.transactionNo : String(p.transactionNo ?? "");
  const merchantOrderNumber = typeof p.merchantOrderNumber === "string" ? p.merchantOrderNumber : String(p.merchantOrderNumber ?? "");
  const orderStatus = typeof p.orderStatus === "string" ? p.orderStatus : String(p.orderStatus ?? "");
  const amount = p.amount;
  const paymentType = typeof p.paymentType === "string" ? p.paymentType : "";
  const apiVersion = typeof p.apiVersion === "string" ? p.apiVersion : "";

  // Fail-closed: payload غير مكتمل — نرفض قبل أي معالجة أخرى.
  if (!transactionNo || !merchantOrderNumber || !orderStatus || amount == null) {
    console.error("[paylink-webhook] رفض — payload v2 غير مكتمل (حقل أساسي مفقود).");
    return NextResponse.json({ error: "payload غير مكتمل" }, { status: 400 });
  }

  console.error(
    `[paylink-webhook] استُلم: transactionNo=${transactionNo} merchantOrderNumber=${merchantOrderNumber} ` +
      `orderStatus=${orderStatus} amount=${amount} paymentType=${paymentType} apiVersion=${apiVersion} — بدء التحقق عبر getInvoice.`
  );

  // merchantOrderNumber هنا إشارة فقط لأي فاتورة نتحقق منها — التحقق الفعلي (الحالة، المبلغ،
  // مرجع الاشتراك) يتم بالكامل داخل verifyAndActivatePaylinkPayment من استجابة getInvoice
  // الموثوقة، لا من هذا الـPayload.
  const result = await verifyAndActivatePaylinkPayment(transactionNo);

  if (!result.ok) {
    // لا نُفعِّل، لكن نُقِرّ بالاستلام (200) لحالات "لم يكتمل الدفع بعد" حتى لا يُعيد Paylink
    // المحاولة بلا داعٍ لشيء ليس خطأً من جانبنا. الأخطاء الحقيقية (Mismatch) تُسجَّل بوضوح.
    if (result.status === 400 && result.error === "الدفع لم يكتمل بعد") {
      return NextResponse.json({ ok: true, ignored: true });
    }
    console.error(`[paylink-webhook] فشل التحقق/التفعيل لـ transactionNo=${transactionNo}: ${result.error}`);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // webhook مكرَّر بعد نجاح سابق → 200 بدون تفعيل مكرَّر (idempotency عبر subscription status +
  // payments.provider_ref، داخل activate-subscription.ts).
  return NextResponse.json({ ok: true, alreadyActive: result.alreadyActive });
}
