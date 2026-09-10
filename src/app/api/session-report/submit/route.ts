import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { issueMakeupCreditIfEligible } from "@/lib/makeup-credits";
import type { AttendanceReason } from "@/lib/policies";

type Entry = {
  childId: string;
  subjectsCompleted: string[];
  independenceRating: number;
  focusRating: number;
  tomorrowReadiness: string;
  teacherNote: string;
  needsSpecialist: boolean;
  specialistSubject?: string;
  // Tomorrow Ready (خطوة Prepare من KHOTA Method)
  materialsReady: boolean;
  tomorrowTestStatus: string;
  remainingReview: string;
  readinessStatus: "ready" | "needs_light_review" | "needs_attention";
  // الحضور الفعلي — المعلم هو المرجع الأخير (يؤكد أو يصحح ما سجّله الطالب بنفسه عبر "دخول الجلسة")
  attended: boolean;
  absenceReason?: AttendanceReason;
};

// يحفظ تقرير الجلسة الكامل لكل طلاب الجلسة دفعة واحدة، ويفعّل التوصية تلقائيًا عند الحاجة.
// هذا هو تنفيذ خطوة "Report" من منهجية KHOTA Method (Scan → Prioritize → Guide → Reinforce → Prepare → Report):
// المعلم يوثّق الجلسة ويغلق الحلقة مع ولي الأمر، وحقول Tomorrow Ready أدناه هي خطوة "Prepare".
// يتحقق أولًا أن الحساب المسجّل دخوله هو فعلًا معلم هذه الجلسة تحديدًا قبل أي كتابة.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const sessionId = body?.sessionId as string | undefined;
  const entries = (body?.entries ?? []) as Entry[];

  if (!sessionId || entries.length === 0) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  const admin = createSupabaseAdminClient();

  const { data: teacher } = await admin.from("teachers").select("id").eq("user_id", user.id).maybeSingle();
  if (!teacher) return NextResponse.json({ error: "هذا الحساب ليس حساب معلم" }, { status: 403 });

  const { data: session } = await admin.from("sessions").select("id, teacher_id, cohort_id, status").eq("id", sessionId).maybeSingle();
  if (!session || session.teacher_id !== teacher.id) {
    return NextResponse.json({ error: "هذه الجلسة لا تخص حسابك" }, { status: 403 });
  }

  const pulseRows = entries.map((e) => ({
    session_id: sessionId,
    child_id: e.childId,
    teacher_id: teacher.id,
    tasks_completed: e.subjectsCompleted,
    independence_rating: e.independenceRating,
    focus_rating: e.focusRating,
    tomorrow_readiness: e.tomorrowReadiness,
    teacher_note: e.teacherNote,
    needs_specialist: e.needsSpecialist,
    focus_subject: e.specialistSubject ?? null,
    materials_ready: e.materialsReady,
    tomorrow_test_status: e.tomorrowTestStatus || null,
    remaining_review: e.remainingReview || null,
    readiness_status: e.readinessStatus,
  }));

  const { error: pulseError } = await admin
    .from("daily_pulse_reports")
    .upsert(pulseRows, { onConflict: "session_id,child_id" });
  if (pulseError) return NextResponse.json({ error: pulseError.message }, { status: 500 });

  const recommendationRows = entries
    .filter((e) => e.needsSpecialist)
    .map((e) => ({
      child_id: e.childId,
      teacher_id: teacher.id,
      subject: e.specialistSubject ?? null,
      reason: e.teacherNote || "لاحظ المعلم أن الطالب يحتاج دعمًا إضافيًا في هذه الجلسة.",
      status: "open",
    }));

  if (recommendationRows.length > 0) {
    const { error: recError } = await admin.from("recommendations").insert(recommendationRows);
    if (recError) return NextResponse.json({ error: recError.message }, { status: 500 });
  }

  const { error: sessionUpdateError } = await admin
    .from("sessions")
    .update({ status: "completed" })
    .eq("id", sessionId);
  if (sessionUpdateError) return NextResponse.json({ error: sessionUpdateError.message }, { status: 500 });

  // ---------- الحضور الفعلي (Absence Policy) ----------
  // تقرير المعلم هو المرجع النهائي للحضور — يؤكد أو يصحح ما سجّله الطالب بنفسه عبر "دخول الجلسة".
  // الغياب المبرَّر فقط (وليس كل غياب تلقائيًا) قد يولّد رصيدًا تعويضيًا، وفق السياسة المركزية
  // في src/lib/policies.ts — ليست قاعدة موزّعة هنا.
  const attendanceRows = entries.map((e) => ({
    session_id: sessionId,
    child_id: e.childId,
    status: e.attended ? "present" : "absent",
    reason: !e.attended ? e.absenceReason ?? "unexcused" : null,
    marked_by: teacher.id,
  }));
  await admin.from("attendance").upsert(attendanceRows, { onConflict: "session_id,child_id" });

  for (const e of entries) {
    if (e.attended) continue;

    const { data: activeSub } = await admin
      .from("subscriptions")
      .select("id")
      .eq("child_id", e.childId)
      .eq("cohort_id", session.cohort_id)
      .eq("status", "active")
      .maybeSingle();

    await issueMakeupCreditIfEligible(admin, {
      childId: e.childId,
      subscriptionId: activeSub?.id ?? null,
      sourceSessionId: sessionId,
      sourceType: "student_absence",
      reason: e.absenceReason ?? "unexcused",
      issuedBy: user.id,
    });
  }

  // إعادة استخدام بيانات التقرير نفسها لتغذية Checklist الطالب (Phase 3A) — بلا أي واجهة معلم
  // جديدة: المواد المُنجزة اليوم تصبح مهام "مكتملة"، ومراجعة الغد المتبقية (Tomorrow Ready)
  // تصبح مهمة "معلَّقة" بتاريخ استحقاق غد — هذا هو نفس ما كتبه المعلم أصلًا، لا بيانات جديدة.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const taskRows: { child_id: string; session_id: string; title: string; subject: string | null; status: string; due_date: string | null }[] = [];
  for (const e of entries) {
    for (const subject of e.subjectsCompleted) {
      taskRows.push({ child_id: e.childId, session_id: sessionId, title: `مراجعة ${subject}`, subject, status: "done", due_date: null });
    }
    if (e.remainingReview) {
      taskRows.push({ child_id: e.childId, session_id: sessionId, title: e.remainingReview, subject: null, status: "pending", due_date: tomorrowStr });
    }
  }
  if (taskRows.length > 0) {
    await admin.from("daily_tasks").insert(taskRows); // لا نُفشل الطلب كله إن تعذّر هذا الجزء الثانوي
  }

  return NextResponse.json({ ok: true, recommendationsCreated: recommendationRows.length });
}
