import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
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

  const { data: parent } = await admin.from("parents").select("id").eq("user_id", user.id).maybeSingle();
  if (!parent) return NextResponse.json({ error: "لا يوجد سجل ولي أمر لهذا الحساب" }, { status: 403 });

  const { data: child } = await admin.from("children").select("id, parent_id").eq("id", childId).maybeSingle();
  if (!child || child.parent_id !== parent.id) {
    return NextResponse.json({ error: "هذا الطفل غير تابع لحسابك" }, { status: 403 });
  }

  const { data: activeSub } = await admin
    .from("subscriptions")
    .select("id, cohort_id")
    .eq("child_id", childId)
    .eq("cohort_id", cohortId)
    .eq("status", "active")
    .maybeSingle();
  if (!activeSub) {
    return NextResponse.json({ error: "لا يوجد اشتراك فعّال لطفلك في هذه المجموعة" }, { status: 403 });
  }

  const { data: cohort } = await admin.from("cohorts").select("teacher_id").eq("id", cohortId).maybeSingle();
  if (!cohort?.teacher_id) {
    return NextResponse.json({ error: "لا يوجد معلم مسؤول محدَّد لهذه المجموعة حاليًا" }, { status: 409 });
  }

  const { data: teacher } = await admin.from("teachers").select("user_id").eq("id", cohort.teacher_id).maybeSingle();
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
