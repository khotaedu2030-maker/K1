import { NextResponse } from "next/server";
import { isPilotAuthEnabled } from "@/lib/pilot-auth";
import { activateSubscriptionAfterPayment } from "@/lib/activate-subscription";

// ⚠️ نقطة تكامل الدفع الحقيقي — الآن مربوطة بـPaylink فعليًا عبر
// /api/payments/paylink/webhook (راجع ذلك الملف لمنطق التحقق من الدفع الحقيقي).
// هذا المسار هنا يبقى "تأكيد يدوي Dev-only" لأغراض العرض فقط في بيئة التطوير — محجوب صراحة
// في production أدناه. منطق تفعيل الاشتراك نفسه مُستخرَج ومشترك بين الاثنين عبر
// src/lib/activate-subscription.ts، لا تكرار للكود الحسّاس.
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "هذا المسار Dev-only ولا يعمل في الإنتاج. الدفع الحقيقي يمر عبر Webhook موقّع من Paylink." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const { subscriptionId } = body ?? {};

  if (!subscriptionId) {
    return NextResponse.json({ error: "subscriptionId مطلوب" }, { status: 400 });
  }

  const result = await activateSubscriptionAfterPayment(subscriptionId, { provider: "manual-dev" });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  if (result.alreadyActive) {
    return NextResponse.json({ ok: true, alreadyActive: true });
  }

  // كوكي اختيارية: تربط جلسة Pilot اللاحقة بهذا الاشتراك تحديدًا بدل الرجوع إلى "أحدث ولي أمر
  // ضيف" العام — أدق وأضيق نطاقًا. لا قيمة حساسة (معرّف اشتراك فقط).
  const res = NextResponse.json({ ok: true, sessionsCreated: result.sessionsCreated });
  if (isPilotAuthEnabled()) {
    res.cookies.set("khota_pilot_last_subscription", subscriptionId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 30, // 30 دقيقة — نافذة كافية لإكمال رحلة الدفع ثم الدخول التجريبي مباشرة
    });
  }
  return res;
}