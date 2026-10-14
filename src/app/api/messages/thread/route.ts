import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveParentIdentityForUser } from "@/lib/require-parent";
import { checkRateLimit, declaredBodyExceeds, rateLimitRejectionResponse, readJsonBodyLimited } from "@/lib/api-rate-limit";

// إنشاء (أو إيجاد) محادثة مع معلم طفل معيّن. الطفل والمجموعة يُختاران من قوائم تعرض فقط ما
// يملكه ولي الأمر فعليًا — لكن هذا الـ route لا يثق بذلك، ويعيد التحقق الكامل من الصفر:
// Parent (auth) → Child (ملكه) → اشتراك فعّال → Cohort → معلمها. لا بحث حر عن معلمين.
export async function POST(req: Request) {
  if (declaredBodyExceeds(req, 4 * 1024)) {
    return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  }

  const parsed = await readJsonBodyLimited(req, 4 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  const body = parsed.body;
  const childId = typeof body?.childId === "string" ? body.childId.trim() : "";
  const cohortId = typeof body?.cohortId === "string" ? body.cohortId.trim() : "";
  if (!childId || childId.length > 100 || !cohortId || cohortId.length > 100) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  const userLimit = await checkRateLimit({ request: req, scope: "messages:thread:user", identifier: user.id, limit: 10, windowSeconds: 600 });
  const userRejection = rateLimitRejectionResponse(userLimit);
  if (userRejection) return userRejection;

  const admin = createSupabaseAdminClient();

  const parentIdentity = await resolveParentIdentityForUser(user.id);
  if (!parentIdentity.ok) return NextResponse.json({ error: parentIdentity.error }, { status: parentIdentity.status });
  const parent = { id: parentIdentity.parentId };

  const { data: child, error: childError } = await admin.from("children").select("id, parent_id").eq("id", childId).maybeSingle();
  if (childError) {
    console.error("[messages] child lookup failed:", childError.message);
    return NextResponse.json({ error: "تعذّر التحقق من الطفل" }, { status: 503 });
  }
  if (!child || child.parent_id !== parent.id) {
    return NextResponse.json({ error: "هذا الطفل غير تابع لحسابك" }, { status: 403 });
  }

  const { data: activeSub, error: subscriptionError } = await admin
    .from("subscriptions")
    .select("id, cohort_id")
    .eq("child_id", childId)
    .eq("cohort_id", cohortId)
    .eq("status", "active")
    .maybeSingle();
  if (subscriptionError) {
    console.error("[messages] subscription lookup failed:", subscriptionError.message);
    return NextResponse.json({ error: "تعذّر التحقق من اشتراك الطالب" }, { status: 503 });
  }
  if (!activeSub) {
    return NextResponse.json({ error: "لا يوجد اشتراك فعّال لطفلك في هذه المجموعة" }, { status: 403 });
  }

  const { data: cohort, error: cohortError } = await admin.from("cohorts").select("teacher_id").eq("id", cohortId).maybeSingle();
  if (cohortError) {
    console.error("[messages] cohort lookup failed:", cohortError.message);
    return NextResponse.json({ error: "تعذّر التحقق من المجموعة" }, { status: 503 });
  }
  if (!cohort?.teacher_id) {
    return NextResponse.json({ error: "لا يوجد معلم مسؤول محدَّد لهذه المجموعة حاليًا" }, { status: 409 });
  }

  const { data: teacher, error: teacherError } = await admin.from("teachers").select("user_id").eq("id", cohort.teacher_id).maybeSingle();
  if (teacherError) {
    console.error("[messages] teacher lookup failed:", teacherError.message);
    return NextResponse.json({ error: "تعذّر التحقق من حساب المعلم" }, { status: 503 });
  }
  if (!teacher?.user_id) {
    return NextResponse.json({ error: "حساب المعلم غير مفعَّل بعد" }, { status: 409 });
  }

  const { data: thread, error } = await admin
    .from("message_threads")
    .upsert(
      { child_id: childId, parent_user_id: user.id, teacher_user_id: teacher.user_id, cohort_id: cohortId },
      { onConflict: "child_id,teacher_user_id" }
    )
    .select("id")
    .single();
  if (error || !thread) {
    if (error) console.error("[messages] thread create failed:", error.message);
    return NextResponse.json({ error: "تعذّر إنشاء المحادثة" }, { status: 500 });
  }

  return NextResponse.json({ threadId: thread.id });
}
