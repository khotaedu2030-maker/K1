import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// يسجّل حضور الطفل عند ضغط ولي الأمر على "دخول الجلسة الآن".
// معرفة sessionId وحدها لا تكفي: نتحقق من السلسلة الكاملة قبل أي كتابة أو إرجاع meeting_url:
//   Authenticated Parent → Owned Child → Active Subscription → Cohort → أن الجلسة المطلوبة
//   فعليًا تابعة لهذا الـcohort (subscription.cohort_id === session.cohort_id) — وليس فقط
//   "هل الطفل تابع لولي الأمر؟" (كانت هذه فجوة حقيقية: طفل صحيح + جلسة من مجموعة أخرى كانت تُقبل).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { sessionId, childId } = body ?? {};

  if (!sessionId || !childId) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();

  const { data: parent } = await admin.from("parents").select("id").eq("user_id", user.id).maybeSingle();
  if (!parent) {
    return NextResponse.json({ error: "لا يوجد سجل ولي أمر لهذا الحساب" }, { status: 403 });
  }

  const { data: child } = await admin.from("children").select("id, parent_id").eq("id", childId).maybeSingle();
  if (!child || child.parent_id !== parent.id) {
    return NextResponse.json({ error: "هذا الطفل غير تابع لحسابك" }, { status: 403 });
  }

  // اشتراكات الطفل الفعّالة → مجموعاته الفعلية
  const { data: subs } = await admin
    .from("subscriptions")
    .select("cohort_id")
    .eq("child_id", childId)
    .eq("status", "active");
  const enrolledCohortIds = new Set((subs ?? []).map((s) => s.cohort_id).filter(Boolean));

  if (enrolledCohortIds.size === 0) {
    return NextResponse.json({ error: "لا يوجد اشتراك فعّال لهذا الطالب" }, { status: 403 });
  }

  const { data: session } = await admin
    .from("sessions")
    .select("id, cohort_id, starts_at, ends_at, meeting_url")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session || !enrolledCohortIds.has(session.cohort_id)) {
    return NextResponse.json({ error: "هذه الجلسة لا تخص هذا الطالب" }, { status: 403 });
  }

  const now = new Date();
  const opensAt = new Date(new Date(session.starts_at).getTime() - 10 * 60 * 1000);
  const closesAt = new Date(session.ends_at);

  if (now < opensAt || now > closesAt) {
    return NextResponse.json({ error: "الجلسة ليست متاحة للدخول الآن" }, { status: 409 });
  }

  const { error } = await admin
    .from("attendance")
    .upsert({ session_id: sessionId, child_id: childId, status: "present" }, { onConflict: "session_id,child_id" });

  if (error) {
    console.error("[attendance] save failed:", error.message);
    return NextResponse.json({ error: "تعذّر تسجيل الحضور" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, meetingUrl: session.meeting_url });
}
