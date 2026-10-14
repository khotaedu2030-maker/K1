import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveParentIdentityForUser } from "@/lib/require-parent";
import { checkRateLimit, declaredBodyExceeds, rateLimitRejectionResponse, readJsonBodyLimited } from "@/lib/api-rate-limit";
import { supabaseRelationOne, type SupabaseRelation } from "@/lib/supabase-relations";

// طلب "جلسة تقوية فردية مركّزة" من بطاقة التوصية.
// يتحقق أن التوصية فعلًا تخص طفل ولي الأمر المسجّل دخوله، ثم:
// تُسجَّل premium_requests وتتحول حالة التوصية إلى actioned ذريًا داخل قاعدة البيانات.
export async function POST(req: Request) {
  if (declaredBodyExceeds(req, 4 * 1024)) {
    return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  }

  const parsed = await readJsonBodyLimited(req, 4 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  const body = parsed.body;
  const recommendationId = typeof body?.recommendationId === "string" ? body.recommendationId.trim() : "";
  if (!recommendationId || recommendationId.length > 100) {
    return NextResponse.json({ error: "recommendationId مطلوب" }, { status: 400 });
  }

  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  const userLimit = await checkRateLimit({ request: req, scope: "recommendations:request:user", identifier: user.id, limit: 10, windowSeconds: 3600 });
  const userRejection = rateLimitRejectionResponse(userLimit);
  if (userRejection) return userRejection;

  const admin = createSupabaseAdminClient();

  const parentIdentity = await resolveParentIdentityForUser(user.id);
  if (!parentIdentity.ok) return NextResponse.json({ error: parentIdentity.error }, { status: parentIdentity.status });
  const { data: parent, error: parentError } = await admin.from("parents").select("id, full_name, phone").eq("id", parentIdentity.parentId).maybeSingle();
  if (parentError) {
    console.error("[recommendations] parent lookup failed:", parentError.message);
    return NextResponse.json({ error: "تعذّر تحميل حساب ولي الأمر" }, { status: 503 });
  }
  if (!parent) return NextResponse.json({ error: "تعذّر تحميل حساب ولي الأمر" }, { status: 503 });

  const { data: recommendation, error: recommendationError } = await admin
    .from("recommendations")
    .select("id, subject, reason, child_id, status, children(parent_id, first_name)")
    .eq("id", recommendationId)
    .maybeSingle();

  if (recommendationError) {
    console.error("[recommendations] recommendation lookup failed:", recommendationError.message);
    return NextResponse.json({ error: "تعذّر التحقق من التوصية" }, { status: 503 });
  }
  if (!recommendation || supabaseRelationOne((recommendation as { children: SupabaseRelation<{ parent_id: string }> }).children)?.parent_id !== parent.id) {
    return NextResponse.json({ error: "توصية غير موجودة أو لا تخص حسابك" }, { status: 403 });
  }

  const recommendationLimit = await checkRateLimit({ request: req, scope: "recommendations:request:recommendation", identifier: recommendationId, limit: 3, windowSeconds: 3600 });
  const recommendationRejection = rateLimitRejectionResponse(recommendationLimit);
  if (recommendationRejection) return recommendationRejection;

  if (recommendation.status !== "open") {
    return NextResponse.json({ error: "تم التعامل مع هذه التوصية مسبقًا" }, { status: 409 });
  }

  const { error: requestError } = await admin.rpc("request_recommendation_session_atomic", {
    p_recommendation_id: recommendationId,
    p_parent_id: parent.id,
  });
  if (requestError) {
    if (requestError.message.includes("recommendation_not_open")) {
      return NextResponse.json({ error: "تم التعامل مع هذه التوصية مسبقًا" }, { status: 409 });
    }
    if (requestError.message.includes("recommendation_not_owned") || requestError.message.includes("recommendation_not_found")) {
      return NextResponse.json({ error: "توصية غير موجودة أو لا تخص حسابك" }, { status: 403 });
    }
    console.error("[recommendations] atomic request failed:", requestError.message);
    return NextResponse.json({ error: "تعذّر حفظ الطلب" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
