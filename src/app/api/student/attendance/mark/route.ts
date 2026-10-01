import { NextResponse } from "next/server";
import { getActiveStudentSession } from "@/lib/student-mode";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { checkRateLimit, declaredBodyExceeds, rateLimitRejectionResponse, readJsonBodyLimited } from "@/lib/api-rate-limit";

// نسخة مخصَّصة لمساحة الطالب من تسجيل الحضور. لا نعيد استخدام /api/attendance/mark (نسخة ولي
// الأمر) عمدًا — تلك تتحقق فقط أن الطفل تابع لولي الأمر، ما يسمح لطالب A بلمس بيانات أخيه B.
//
// معرفة sessionId وحدها لا تكفي: نتحقق صراحة من السلسلة الكاملة قبل أي كتابة أو إرجاع meeting_url:
//   Student Mode → child_id → اشتراك فعّال → cohort_id → أن الجلسة المطلوبة فعلًا تابعة لهذا الـcohort
export async function POST(req: Request) {
  const session = await getActiveStudentSession();
  if (!session) return NextResponse.json({ error: "لا توجد جلسة طالب نشطة" }, { status: 401 });

  if (declaredBodyExceeds(req, 4 * 1024)) {
    return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  }

  const parsed = await readJsonBodyLimited(req, 4 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  const sessionRowId = typeof parsed.body?.sessionId === "string" ? parsed.body.sessionId.trim() : "";
  if (!sessionRowId || sessionRowId.length > 100) return NextResponse.json({ error: "sessionId مطلوب" }, { status: 400 });

  const studentLimit = await checkRateLimit({ request: req, scope: "student:attendance:mark:session", identifier: session.sessionId, limit: 20, windowSeconds: 300 });
  const studentRejection = rateLimitRejectionResponse(studentLimit);
  if (studentRejection) return studentRejection;

  const admin = createSupabaseAdminClient();

  // 1) اشتراكات الطفل الفعّالة → مجموعاته (cohorts) الفعلية
  const { data: subs } = await admin
    .from("subscriptions")
    .select("cohort_id")
    .eq("child_id", session.childId)
    .eq("status", "active");
  const enrolledCohortIds = new Set((subs ?? []).map((s) => s.cohort_id).filter(Boolean));

  if (enrolledCohortIds.size === 0) {
    return NextResponse.json({ error: "لا يوجد اشتراك فعّال لهذا الطالب" }, { status: 403 });
  }

  // 2) الجلسة المطلوبة يجب أن تتبع فعليًا إحدى هذه المجموعات — وإلا فهي جلسة لا تخص هذا الطالب
  const { data: sessionRow } = await admin
    .from("sessions")
    .select("id, cohort_id, starts_at, ends_at, meeting_url")
    .eq("id", sessionRowId)
    .maybeSingle();

  if (!sessionRow || !enrolledCohortIds.has(sessionRow.cohort_id)) {
    return NextResponse.json({ error: "هذه الجلسة لا تخص مجموعتك" }, { status: 403 });
  }

  const resourceLimit = await checkRateLimit({ request: req, scope: "student:attendance:mark:resource", identifier: sessionRowId, limit: 30, windowSeconds: 300 });
  const resourceRejection = rateLimitRejectionResponse(resourceLimit);
  if (resourceRejection) return resourceRejection;

  const now = new Date();
  const opensAt = new Date(new Date(sessionRow.starts_at).getTime() - 10 * 60 * 1000);
  const closesAt = new Date(sessionRow.ends_at);
  if (now < opensAt || now > closesAt) {
    return NextResponse.json({ error: "الجلسة ليست متاحة للدخول الآن" }, { status: 409 });
  }

  const { error } = await admin
    .from("attendance")
    .upsert(
      { session_id: sessionRowId, child_id: session.childId, status: "present" },
      { onConflict: "session_id,child_id" }
    );
  if (error) {
    console.error("[student-attendance] save failed:", error.message);
    return NextResponse.json({ error: "تعذّر تسجيل الحضور" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, meetingUrl: sessionRow.meeting_url });
}
