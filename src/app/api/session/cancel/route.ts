import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { issueMakeupCreditIfEligible } from "@/lib/makeup-credits";
import { requireAdmin } from "@/lib/require-admin";
import { requireTeacher } from "@/lib/require-teacher";

// إلغاء جلسة كاملة (وليس غياب طالب فردي) — من المعلم أو من إدارة خُطى. يمنح رصيد تعويض
// لكل الطلاب المسجَّلين فعليًا حاليًا في هذه المجموعة، بلا أي سقف شهري (مسؤولية خُطى، وليست
// غياب الطالب). آمن للاستدعاء المتكرر: قيد unique(source_session_id, child_id) + ignoreDuplicates
// يمنعان إصدار رصيد مضاعف لو أُعيد الطلب.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const sessionId = body?.sessionId as string | undefined;
  const cancelledBy = body?.cancelledBy as "teacher" | "platform" | undefined;

  if (!sessionId || (cancelledBy !== "teacher" && cancelledBy !== "platform")) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

  let actorUserId: string;
  let teacherId: string | null = null;
  if (cancelledBy === "teacher") {
    const teacherCheck = await requireTeacher();
    if (!teacherCheck.ok) return teacherCheck.response;
    actorUserId = teacherCheck.userId;
    teacherId = teacherCheck.teacherId;
  } else {
    const adminCheck = await requireAdmin();
    if (!adminCheck.ok) return adminCheck.response;
    actorUserId = adminCheck.userId;
  }

  const admin = createSupabaseAdminClient();

  const { data: session } = await admin.from("sessions").select("id, teacher_id, cohort_id, status").eq("id", sessionId).maybeSingle();
  if (!session) return NextResponse.json({ error: "جلسة غير موجودة" }, { status: 404 });

  if (cancelledBy === "teacher" && session.teacher_id !== teacherId) {
    return NextResponse.json({ error: "غير مصرَّح لك بإلغاء هذه الجلسة" }, { status: 403 });
  }
  if (session.status === "cancelled") {
    return NextResponse.json({ ok: true, alreadyCancelled: true });
  }

  const { error: updateError } = await admin
    .from("sessions")
    .update({ status: "cancelled", cancelled_by: cancelledBy })
    .eq("id", sessionId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const { data: activeSubs } = await admin
    .from("subscriptions")
    .select("id, child_id")
    .eq("cohort_id", session.cohort_id)
    .eq("status", "active");

  let issuedCount = 0;
  for (const sub of activeSubs ?? []) {
    const result = await issueMakeupCreditIfEligible(admin, {
      childId: sub.child_id,
      subscriptionId: sub.id,
      sourceSessionId: sessionId,
      sourceType: cancelledBy === "teacher" ? "teacher_cancellation" : "platform_cancellation",
      issuedBy: actorUserId,
    });
    if (result.issued) issuedCount++;
  }

  return NextResponse.json({ ok: true, creditsIssued: issuedCount });
}
