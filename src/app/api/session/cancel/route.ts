import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { issueMakeupCreditIfEligible } from "@/lib/makeup-credits";

// إلغاء جلسة كاملة (وليس غياب طالب فردي) — من المعلم أو من إدارة خُطى. يمنح رصيد تعويض
// لكل الطلاب المسجَّلين فعليًا حاليًا في هذه المجموعة، بلا أي سقف شهري (مسؤولية خُطى، وليست
// غياب الطالب). آمن للاستدعاء المتكرر: قيد unique(source_session_id, child_id) + ignoreDuplicates
// يمنعان إصدار رصيد مضاعف لو أُعيد الطلب.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const sessionId = body?.sessionId as string | undefined;
  const cancelledBy = body?.cancelledBy as "teacher" | "platform" | undefined;

  if (!sessionId || !cancelledBy) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  const admin = createSupabaseAdminClient();

  const { data: session } = await admin.from("sessions").select("id, teacher_id, cohort_id, status").eq("id", sessionId).maybeSingle();
  if (!session) return NextResponse.json({ error: "جلسة غير موجودة" }, { status: 404 });

  const { data: teacher } = await admin.from("teachers").select("id").eq("user_id", user.id).maybeSingle();
  const { data: admin_ } = await admin.from("admins").select("id").eq("user_id", user.id).maybeSingle();

  const isOwningTeacher = teacher && session.teacher_id === teacher.id;
  const isAdmin = Boolean(admin_);
  if (!isOwningTeacher && !isAdmin) {
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
      issuedBy: user.id,
    });
    if (result.issued) issuedCount++;
  }

  return NextResponse.json({ ok: true, creditsIssued: issuedCount });
}
