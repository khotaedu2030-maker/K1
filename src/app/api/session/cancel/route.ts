import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { issueMakeupCreditIfEligible } from "@/lib/makeup-credits";
import { requirePermission } from "@/lib/require-admin";
import { requireTeacher } from "@/lib/require-teacher";
import { checkRateLimit, declaredBodyExceeds, rateLimitRejectionResponse, readJsonBodyLimited } from "@/lib/api-rate-limit";

// إلغاء جلسة كاملة (وليس غياب طالب فردي) — من المعلم أو من إدارة خُطى. يمنح رصيد تعويض
// لكل الطلاب المسجَّلين فعليًا حاليًا في هذه المجموعة، بلا أي سقف شهري (مسؤولية خُطى، وليست
// غياب الطالب). آمن للاستدعاء المتكرر: قيد unique(source_session_id, child_id) + ignoreDuplicates
// يمنعان إصدار رصيد مضاعف لو أُعيد الطلب.
export async function POST(req: Request) {
  if (declaredBodyExceeds(req, 4 * 1024)) {
    return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  }

  const parsed = await readJsonBodyLimited(req, 4 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  const sessionId = typeof parsed.body?.sessionId === "string" ? parsed.body.sessionId.trim() : "";
  const cancelledBy = parsed.body?.cancelledBy as "teacher" | "platform" | undefined;

  if (!sessionId || sessionId.length > 100 || (cancelledBy !== "teacher" && cancelledBy !== "platform")) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

  let actorUserId: string;
  let teacherId: string | null = null;
  if (cancelledBy === "teacher") {
    const teacherCheck = await requireTeacher();
    if (!teacherCheck.ok) return teacherCheck.response;
    actorUserId = teacherCheck.userId;
    teacherId = teacherCheck.teacherId;
  } else {
    const adminCheck = await requirePermission("session.manage");
    if (!adminCheck.ok) return adminCheck.response;
    actorUserId = adminCheck.userId;
  }

  const actorLimit = await checkRateLimit({ request: req, scope: "session:cancel:user", identifier: actorUserId, limit: 10, windowSeconds: 600 });
  const actorRejection = rateLimitRejectionResponse(actorLimit);
  if (actorRejection) return actorRejection;

  const admin = createSupabaseAdminClient();

  const { data: session } = await admin.from("sessions").select("id, teacher_id, cohort_id, status, cancelled_by").eq("id", sessionId).maybeSingle();
  if (!session) return NextResponse.json({ error: "جلسة غير موجودة" }, { status: 404 });

  if (cancelledBy === "teacher" && session.teacher_id !== teacherId) {
    return NextResponse.json({ error: "غير مصرَّح لك بإلغاء هذه الجلسة" }, { status: 403 });
  }

  const sessionLimit = await checkRateLimit({ request: req, scope: "session:cancel:session", identifier: sessionId, limit: 3, windowSeconds: 600 });
  const sessionRejection = rateLimitRejectionResponse(sessionLimit);
  if (sessionRejection) return sessionRejection;

  const alreadyCancelled = session.status === "cancelled";
  if (!alreadyCancelled && session.status !== "scheduled") {
    return NextResponse.json({ error: "لا يمكن إلغاء جلسة غير مجدولة" }, { status: 409 });
  }

  const effectiveCancelledBy =
    (alreadyCancelled && (session.cancelled_by === "teacher" || session.cancelled_by === "platform"))
      ? session.cancelled_by
      : cancelledBy;

  const { data: activeSubs, error: activeSubsError } = await admin
    .from("subscriptions")
    .select("id, child_id")
    .eq("cohort_id", session.cohort_id)
    .eq("status", "active");
  if (activeSubsError) {
    console.error("[session-cancel] active subscriptions query failed:", activeSubsError.message);
    return NextResponse.json({ error: "تعذّر التحقق من الطلاب المستحقين للتعويض" }, { status: 500 });
  }

  let issuedCount = 0;
  for (const sub of activeSubs ?? []) {
    const result = await issueMakeupCreditIfEligible(admin, {
      childId: sub.child_id,
      subscriptionId: sub.id,
      sourceSessionId: sessionId,
      sourceType: effectiveCancelledBy === "teacher" ? "teacher_cancellation" : "platform_cancellation",
      issuedBy: actorUserId,
    });
    if ("error" in result) {
      return NextResponse.json({ error: "تعذّر إصدار رصيد التعويض، حاول مرة أخرى" }, { status: 500 });
    }
    if (result.issued) issuedCount++;
  }

  if (!alreadyCancelled) {
    const { error: updateError } = await admin
      .from("sessions")
      .update({ status: "cancelled", cancelled_by: cancelledBy })
      .eq("id", sessionId);
    if (updateError) {
      console.error("[session-cancel] update failed:", updateError.message);
      return NextResponse.json({ error: "تعذّر إلغاء الجلسة" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, creditsIssued: issuedCount, ...(alreadyCancelled ? { alreadyCancelled: true } : {}) });
}
