import { NextResponse } from "next/server";
import { isPilotAuthEnabled } from "@/lib/pilot-auth";
import { activateSubscriptionAfterPayment } from "@/lib/activate-subscription";
import { requirePermission } from "@/lib/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { checkRateLimit, declaredBodyExceeds, rateLimitRejectionResponse, readJsonBodyLimited } from "@/lib/api-rate-limit";

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

  const adminCheck = await requirePermission("subscription.review");
  if (!adminCheck.ok) return adminCheck.response;

  if (declaredBodyExceeds(req, 4 * 1024)) {
    return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  }

  const adminLimit = await checkRateLimit({ request: req, scope: "payment:confirm:admin", identifier: adminCheck.userId, limit: 5, windowSeconds: 600 });
  const adminRejection = rateLimitRejectionResponse(adminLimit);
  if (adminRejection) return adminRejection;

  const parsed = await readJsonBodyLimited(req, 4 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  const subscriptionId = typeof parsed.body?.subscriptionId === "string" ? parsed.body.subscriptionId.trim() : "";

  if (!subscriptionId || subscriptionId.length > 100) {
    return NextResponse.json({ error: "subscriptionId مطلوب" }, { status: 400 });
  }

  // إثبات وجود المورد قبل استهلاك bucket الخاص به. الصلاحية أعلاه إدارية عامة ومتحققة من DB.
  const admin = createSupabaseAdminClient();
  const { data: subscription, error: subscriptionError } = await admin
    .from("subscriptions")
    .select("id")
    .eq("id", subscriptionId)
    .maybeSingle();
  if (subscriptionError) return NextResponse.json({ error: "تعذّر التحقق من الاشتراك" }, { status: 503 });
  if (!subscription) return NextResponse.json({ error: "اشتراك غير موجود" }, { status: 404 });

  // consume_api_rate_limit ذري ومشترك بين كل instances. حدّ واحد يمنع سباق طلبين يدويين
  // متزامنين قبل أن يرى الثاني أن الاشتراك صار active؛ المحاولة اللاحقة تصبح alreadyActive.
  const subscriptionLimit = await checkRateLimit({ request: req, scope: "payment:confirm:subscription", identifier: subscriptionId, limit: 1, windowSeconds: 60 });
  const subscriptionRejection = rateLimitRejectionResponse(subscriptionLimit);
  if (subscriptionRejection) return subscriptionRejection;

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
