import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireTeacher } from "@/lib/require-teacher";
import { issueMakeupCreditIfEligible } from "@/lib/makeup-credits";
import type { AttendanceReason } from "@/lib/policies";
import { getRuntimeSettings } from "@/lib/platform-settings";
import { checkRateLimit, declaredBodyExceeds, rateLimitRejectionResponse } from "@/lib/api-rate-limit";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEntry(value: unknown): Entry | null {
  if (!isRecord(value)) return null;

  const childId = typeof value.childId === "string" ? value.childId.trim() : "";
  if (!childId || childId.length > 100) return null;

  if (!Array.isArray(value.subjectsCompleted) || value.subjectsCompleted.length > 10) return null;
  const subjectsCompleted: string[] = [];
  for (const subject of value.subjectsCompleted) {
    if (typeof subject !== "string") return null;
    const trimmedSubject = subject.trim();
    if (!trimmedSubject || trimmedSubject.length > 100) return null;
    subjectsCompleted.push(trimmedSubject);
  }

  if (!Number.isInteger(value.independenceRating) || (value.independenceRating as number) < 1 || (value.independenceRating as number) > 5) return null;
  if (!Number.isInteger(value.focusRating) || (value.focusRating as number) < 1 || (value.focusRating as number) > 5) return null;
  if (typeof value.tomorrowReadiness !== "string" || value.tomorrowReadiness.length > 200) return null;
  if (typeof value.teacherNote !== "string" || value.teacherNote.length > 2000) return null;
  if (typeof value.needsSpecialist !== "boolean") return null;

  let specialistSubject: string | undefined;
  if (value.specialistSubject !== undefined) {
    if (typeof value.specialistSubject !== "string") return null;
    specialistSubject = value.specialistSubject.trim();
    if (specialistSubject.length > 200) return null;
  }

  if (typeof value.materialsReady !== "boolean") return null;
  if (typeof value.tomorrowTestStatus !== "string" || value.tomorrowTestStatus.length > 500) return null;
  if (typeof value.remainingReview !== "string" || value.remainingReview.length > 500) return null;
  if (value.readinessStatus !== "ready" && value.readinessStatus !== "needs_light_review" && value.readinessStatus !== "needs_attention") return null;
  if (typeof value.attended !== "boolean") return null;

  let absenceReason: AttendanceReason | undefined;
  if (!value.attended) {
    if (value.absenceReason !== "excused" && value.absenceReason !== "unexcused" && value.absenceReason !== "exceptional_approved") return null;
    absenceReason = value.absenceReason;
  }

  return {
    childId,
    subjectsCompleted,
    independenceRating: value.independenceRating as number,
    focusRating: value.focusRating as number,
    tomorrowReadiness: value.tomorrowReadiness,
    teacherNote: value.teacherNote,
    needsSpecialist: value.needsSpecialist,
    ...(specialistSubject !== undefined ? { specialistSubject } : {}),
    materialsReady: value.materialsReady,
    tomorrowTestStatus: value.tomorrowTestStatus,
    remainingReview: value.remainingReview,
    readinessStatus: value.readinessStatus,
    attended: value.attended,
    ...(absenceReason !== undefined ? { absenceReason } : {}),
  };
}

// يحفظ تقرير الجلسة الكامل لكل طلاب الجلسة دفعة واحدة، ويفعّل التوصية تلقائيًا عند الحاجة.
// هذا هو تنفيذ خطوة "Report" من منهجية KHOTA Method (Scan → Prioritize → Guide → Reinforce → Prepare → Report):
// المعلم يوثّق الجلسة ويغلق الحلقة مع ولي الأمر، وحقول Tomorrow Ready أدناه هي خطوة "Prepare".
// يتحقق أولًا أن الحساب المسجّل دخوله هو فعلًا معلم هذه الجلسة تحديدًا قبل أي كتابة.
export async function POST(req: Request) {
  if (declaredBodyExceeds(req, 64 * 1024)) {
    return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  }

  const body = await req.json().catch(() => null);
  const sessionId = isRecord(body) && typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId || sessionId.length > 100 || !isRecord(body) || !Array.isArray(body.entries) || body.entries.length < 1 || body.entries.length > 20) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  const parsedEntries = body.entries.map(parseEntry);
  if (parsedEntries.some((entry) => entry === null)) {
    return NextResponse.json({ error: "بيانات التقرير غير صحيحة" }, { status: 400 });
  }
  const entries = parsedEntries as Entry[];
  const submittedChildIds = new Set(entries.map((entry) => entry.childId));
  if (submittedChildIds.size !== entries.length) {
    return NextResponse.json({ error: "لا يمكن تكرار الطالب في التقرير" }, { status: 400 });
  }

  const teacherCheck = await requireTeacher();
  if (!teacherCheck.ok) return teacherCheck.response;

  const teacherLimit = await checkRateLimit({ request: req, scope: "session-report:teacher", identifier: teacherCheck.userId, limit: 10, windowSeconds: 600 });
  const teacherRejection = rateLimitRejectionResponse(teacherLimit);
  if (teacherRejection) return teacherRejection;

  const admin = createSupabaseAdminClient();

  const { data: session } = await admin.from("sessions").select("id, teacher_id, cohort_id, status, ends_at").eq("id", sessionId).maybeSingle();
  if (!session || session.teacher_id !== teacherCheck.teacherId) {
    return NextResponse.json({ error: "هذه الجلسة لا تخص حسابك" }, { status: 403 });
  }
  if (session.status === "cancelled") {
    return NextResponse.json({ error: "لا يمكن إرسال تقرير لجلسة ملغاة" }, { status: 409 });
  }

  const sessionLimit = await checkRateLimit({ request: req, scope: "session-report:session", identifier: sessionId, limit: 5, windowSeconds: 600 });
  const sessionRejection = rateLimitRejectionResponse(sessionLimit);
  if (sessionRejection) return sessionRejection;

  const { data: activeSubscriptions, error: subscriptionsError } = await admin
    .from("subscriptions")
    .select("child_id")
    .eq("cohort_id", session.cohort_id)
    .eq("status", "active");
  if (subscriptionsError) {
    console.error("[session-report] active cohort lookup failed:", subscriptionsError.message);
    return NextResponse.json({ error: "تعذّر التحقق من طلاب المجموعة" }, { status: 503 });
  }

  const activeChildIds = new Set((activeSubscriptions ?? []).map((subscription) => subscription.child_id));
  const sameChildSet = submittedChildIds.size === activeChildIds.size && [...submittedChildIds].every((childId) => activeChildIds.has(childId));
  if (!sameChildSet) {
    return NextResponse.json({ error: "تغيّرت قائمة طلاب المجموعة. حدّث الصفحة وحاول مرة أخرى." }, { status: 409 });
  }

  const settings = await getRuntimeSettings();
  if (session.ends_at && Date.now() > new Date(session.ends_at).getTime() + settings.attendanceLockHours * 60 * 60 * 1000) {
    return NextResponse.json({ error: "انتهت مهلة تعديل حضور هذه الجلسة" }, { status: 409 });
  }

  const pulseRows = entries.map((e) => ({
    session_id: sessionId,
    child_id: e.childId,
    teacher_id: teacherCheck.teacherId,
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
  if (pulseError) {
    console.error("[session-report] pulse save failed:", pulseError.message);
    return NextResponse.json({ error: "تعذّر حفظ تقرير الجلسة" }, { status: 500 });
  }

  const recommendationRows = entries
    .filter((e) => e.needsSpecialist)
    .map((e) => ({
      child_id: e.childId,
      teacher_id: teacherCheck.teacherId,
      subject: e.specialistSubject ?? null,
      reason: e.teacherNote || "لاحظ المعلم أن الطالب يحتاج دعمًا إضافيًا في هذه الجلسة.",
      status: "open",
      source_session_id: sessionId,
    }));

  if (recommendationRows.length > 0) {
    const { error: recError } = await admin.from("recommendations").upsert(recommendationRows, {
      onConflict: "source_session_id,child_id",
      ignoreDuplicates: true,
    });
    if (recError) {
      console.error("[session-report] recommendation save failed:", recError.message);
      return NextResponse.json({ error: "تعذّر حفظ توصية الجلسة" }, { status: 500 });
    }
  }

  const { error: sessionUpdateError } = await admin
    .from("sessions")
    .update({ status: "completed" })
    .eq("id", sessionId);
  if (sessionUpdateError) {
    console.error("[session-report] session update failed:", sessionUpdateError.message);
    return NextResponse.json({ error: "تعذّر إكمال الجلسة" }, { status: 500 });
  }

  // ---------- الحضور الفعلي (Absence Policy) ----------
  // تقرير المعلم هو المرجع النهائي للحضور — يؤكد أو يصحح ما سجّله الطالب بنفسه عبر "دخول الجلسة".
  // الغياب المبرَّر فقط (وليس كل غياب تلقائيًا) قد يولّد رصيدًا تعويضيًا، وفق السياسة المركزية
  // في src/lib/policies.ts — ليست قاعدة موزّعة هنا.
  const attendanceRows = entries.map((e) => ({
    session_id: sessionId,
    child_id: e.childId,
    status: e.attended ? "present" : "absent",
    reason: !e.attended ? e.absenceReason ?? "unexcused" : null,
    marked_by: teacherCheck.teacherId,
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
      issuedBy: teacherCheck.userId,
    });
  }

  // إعادة استخدام بيانات التقرير نفسها لتغذية Checklist الطالب (Phase 3A) — بلا أي واجهة معلم
  // جديدة: المواد المُنجزة اليوم تصبح مهام "مكتملة"، ومراجعة الغد المتبقية (Tomorrow Ready)
  // تصبح مهمة "معلَّقة" بتاريخ استحقاق غد — هذا هو نفس ما كتبه المعلم أصلًا، لا بيانات جديدة.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const taskRows: { child_id: string; session_id: string; source_key: string; title: string; subject: string | null; status: string; due_date: string | null }[] = [];
  for (const e of entries) {
    for (const subject of e.subjectsCompleted) {
      taskRows.push({ child_id: e.childId, session_id: sessionId, source_key: `subject:${subject.toLowerCase()}`, title: `مراجعة ${subject}`, subject, status: "done", due_date: null });
    }
    if (e.remainingReview) {
      taskRows.push({ child_id: e.childId, session_id: sessionId, source_key: "remaining-review", title: e.remainingReview, subject: null, status: "pending", due_date: tomorrowStr });
    }
  }
  if (taskRows.length > 0) {
    await admin.from("daily_tasks").upsert(taskRows, {
      onConflict: "session_id,child_id,source_key",
      ignoreDuplicates: true,
    }); // لا نُفشل الطلب كله إن تعذّر هذا الجزء الثانوي
  }

  return NextResponse.json({ ok: true, recommendationsCreated: recommendationRows.length });
}
