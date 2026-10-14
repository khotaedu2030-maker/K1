import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveParentIdentityForUser } from "@/lib/require-parent";
import { checkRateLimit, declaredBodyExceeds, rateLimitRejectionResponse, readJsonBodyLimited } from "@/lib/api-rate-limit";

// حجز جلسة تعويضية برصيد قائم. الحماية من الاستخدام المزدوج (ضغط متكرر أو طلبات متزامنة)
// تتم داخل دالة قاعدة البيانات public.redeem_makeup_credit عبر row-lock حقيقي (for update) —
// وليس فقط بفحص الحالة هنا قبل الكتابة (Race Condition-safe بالتصميم).
export async function POST(req: Request) {
  if (declaredBodyExceeds(req, 4 * 1024)) {
    return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  }

  const parsed = await readJsonBodyLimited(req, 4 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  const body = parsed.body;
  const creditId = typeof body?.creditId === "string" ? body.creditId.trim() : "";
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
  if (!creditId || creditId.length > 100 || !sessionId || sessionId.length > 100) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  const userLimit = await checkRateLimit({ request: req, scope: "makeup:redeem:user", identifier: user.id, limit: 10, windowSeconds: 600 });
  const userRejection = rateLimitRejectionResponse(userLimit);
  if (userRejection) return userRejection;

  const admin = createSupabaseAdminClient();

  const parentIdentity = await resolveParentIdentityForUser(user.id);
  if (!parentIdentity.ok) return NextResponse.json({ error: parentIdentity.error }, { status: parentIdentity.status });
  const parent = { id: parentIdentity.parentId };

  const { data: credit, error: creditError } = await admin.from("makeup_credits").select("child_id").eq("id", creditId).maybeSingle();
  if (creditError) {
    console.error("[makeup] credit lookup failed:", creditError.message);
    return NextResponse.json({ error: "تعذّر التحقق من الرصيد" }, { status: 503 });
  }
  if (!credit) return NextResponse.json({ error: "رصيد غير موجود" }, { status: 404 });

  const { data: child, error: childError } = await admin.from("children").select("parent_id").eq("id", credit.child_id).maybeSingle();
  if (childError) {
    console.error("[makeup] credit child lookup failed:", childError.message);
    return NextResponse.json({ error: "تعذّر التحقق من ملكية الرصيد" }, { status: 503 });
  }
  if (!child || child.parent_id !== parent.id) {
    return NextResponse.json({ error: "هذا الرصيد لا يخص أبناءك" }, { status: 403 });
  }

  const creditLimit = await checkRateLimit({ request: req, scope: "makeup:redeem:credit", identifier: creditId, limit: 5, windowSeconds: 600 });
  const creditRejection = rateLimitRejectionResponse(creditLimit);
  if (creditRejection) return creditRejection;

  const { error } = await admin.rpc("redeem_makeup_credit", {
    p_credit_id: creditId,
    p_session_id: sessionId,
    p_child_id: credit.child_id,
  });

  if (error) {
    const map: Record<string, string> = {
      credit_not_found: "رصيد غير موجود",
      credit_not_owned: "هذا الرصيد لا يخصك",
      credit_not_available: "هذا الرصيد غير متاح للاستخدام (استُخدم أو أُلغي مسبقًا)",
      credit_expired: "انتهت صلاحية هذا الرصيد",
      session_not_found: "جلسة غير موجودة",
      session_not_eligible: "هذه الجلسة غير مؤهَّلة للتعويض",
      session_not_bookable: "لا يمكن حجز هذه الجلسة حاليًا",
      session_full: "اكتمل عدد المقاعد في هذه الجلسة",
    };
    const known = Object.keys(map).find((k) => error.message.includes(k));
    console.error("[makeup] redeem failed:", error.message);
    return NextResponse.json({ error: known ? map[known] : "تعذّر استخدام رصيد التعويض" }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
