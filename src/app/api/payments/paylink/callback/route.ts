import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { verifyAndActivatePaylinkPayment } from "@/lib/paylink-verify";

// Paylink يعيد المستخدم هنا بعد محاولة الدفع، مع orderNumber (= payments.id، وليس
// subscriptionId) و transactionNo في الرابط. هذا الـcallback من المتصفح لا يُعتبَر أبدًا دليل
// دفع بحد ذاته — نفس دالة التحقق المستخدَمة في الـwebhook (verifyAndActivatePaylinkPayment)
// تُستدعى هنا أيضًا، فتُعيد الاستعلام عن الفاتورة مباشرة من Paylink قبل أي تفعيل.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderNumber = url.searchParams.get("orderNumber") ?? ""; // = payments.id
  const transactionNo = url.searchParams.get("transactionNo") ?? "";

  const paymentPageUrl = new URL("/motabaa/enroll/payment", url.origin);

  if (!transactionNo) {
    console.error("[paylink-callback] وصول بلا transactionNo — إعادة توجيه بحالة فشل.");
    await appendSubIfResolvable(paymentPageUrl, orderNumber);
    paymentPageUrl.searchParams.set("failed", "1");
    return NextResponse.redirect(paymentPageUrl);
  }

  const result = await verifyAndActivatePaylinkPayment(transactionNo);

  if (!result.ok) {
    console.error(`[paylink-callback] فشل التحقق/التفعيل لـ transactionNo=${transactionNo}: ${result.error}`);
    // orderNumber هنا paymentId — لا نثق به كدليل دفع (التحقق فشل أصلًا)، نستخدمه فقط لمحاولة
    // إيجاد subscriptionId المرتبط لغرض تجربة المستخدم (رجوعه لصفحة الدفع الصحيحة)، بأمان.
    await appendSubIfResolvable(paymentPageUrl, orderNumber);
    paymentPageUrl.searchParams.set("failed", "1");
    return NextResponse.redirect(paymentPageUrl);
  }

  // نجاح مؤكَّد فعليًا عبر verifyAndActivatePaylinkPayment — نستخدم subscriptionId الحقيقي
  // العائد منها مباشرة، لا orderNumber (الذي هو paymentId، ليس ما تتوقعه صفحة الدفع).
  paymentPageUrl.searchParams.set("sub", result.subscriptionId);
  paymentPageUrl.searchParams.set("paid", "1");
  return NextResponse.redirect(paymentPageUrl);
}

// محاولة آمنة (best-effort) لإيجاد subscriptionId من paymentId لغرض تجربة المستخدم فقط عند
// الفشل — لا تُستخدَم هذه النتيجة أبدًا كدليل دفع أو لأي تفعيل، فقط لبناء رابط عودة صحيح.
async function appendSubIfResolvable(target: URL, paymentId: string) {
  if (!paymentId) return;
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("payments")
      .select("subscription_id")
      .eq("id", paymentId)
      .eq("provider", "paylink")
      .maybeSingle();
    if (data?.subscription_id) {
      target.searchParams.set("sub", data.subscription_id);
    }
  } catch (err) {
    console.error("[paylink-callback] تعذّر إيجاد subscriptionId من paymentId لغرض تجربة المستخدم فقط:", err instanceof Error ? err.message : err);
  }
}
