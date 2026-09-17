import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// تعيين معلم بديل لجلسة واحدة فقط — لا يغيّر cohorts.teacher_id (المعلم الأساسي للمجموعة)
// إطلاقًا، فقط sessions.teacher_id لهذه الجلسة تحديدًا. الجلسات المستقبلية الأخرى لنفس
// المجموعة تبقى بمعلمها الأساسي، والسجلات التاريخية لا تتأثر (نُعدِّل جلسات scheduled مستقبلية
// فقط، لا completed ولا cancelled).
export async function POST(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const body = await req.json().catch(() => null);
  const sessionId = body?.sessionId as string | undefined;
  const newTeacherId = body?.teacherId as string | undefined;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

  if (!sessionId || !newTeacherId || !reason) {
    return NextResponse.json({ error: "الجلسة والمعلم الجديد والسبب مطلوبة" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const { data: session } = await admin
    .from("sessions")
    .select("id, teacher_id, status, starts_at, ends_at, cohort_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "جلسة غير موجودة" }, { status: 404 });
  if (session.status !== "scheduled") {
    return NextResponse.json({ error: "لا يمكن تعديل معلم جلسة غير مجدولة (مكتملة أو ملغاة)" }, { status: 409 });
  }
  if (new Date(session.starts_at) < new Date()) {
    return NextResponse.json({ error: "لا يمكن تعديل معلم جلسة انتهى وقتها بالفعل" }, { status: 409 });
  }

  const { data: teacher } = await admin.from("teachers").select("id, active").eq("id", newTeacherId).eq("active", true).maybeSingle();
  if (!teacher) return NextResponse.json({ error: "المعلم غير موجود أو غير نشط" }, { status: 400 });

  // فحص تعارض موثوق: هل لدى المعلم البديل جلسة أخرى (مجدولة) تتداخل زمنيًا مع نفس الفترة؟
  // نعتمد على sessions.starts_at/ends_at الفعلية (بيانات موثوقة)، لا teacher_availability
  // (جدول تفضيلات عامة أسبوعية، ليس تعارضًا زمنيًا فعليًا مؤكَّدًا لهذه الجلسة تحديدًا).
  if (session.starts_at && session.ends_at) {
    const { data: overlapping } = await admin
      .from("sessions")
      .select("id")
      .eq("teacher_id", newTeacherId)
      .eq("status", "scheduled")
      .neq("id", sessionId)
      .lt("starts_at", session.ends_at)
      .gt("ends_at", session.starts_at)
      .limit(1);
    if (overlapping && overlapping.length > 0) {
      return NextResponse.json({ error: "هذا المعلم لديه جلسة أخرى متداخلة بنفس التوقيت" }, { status: 409 });
    }
  }

  const oldTeacherId = session.teacher_id;
  const { error } = await admin.from("sessions").update({ teacher_id: newTeacherId }).eq("id", sessionId).eq("status", "scheduled");
  if (error) {
    console.error("[admin-sessions] فشل تعيين معلم بديل:", error.message);
    return NextResponse.json({ error: "تعذّر حفظ التعديل" }, { status: 500 });
  }

  const { error: auditError } = await admin.from("admin_actions").insert({
    admin_user_id: adminCheck.userId,
    action: "session_teacher_override",
    entity_type: "session",
    entity_id: sessionId,
    old_value: { teacher_id: oldTeacherId },
    new_value: { teacher_id: newTeacherId },
    reason,
  });
  if (auditError) console.error("[admin-sessions] فشل تسجيل admin_actions (غير حاجب):", auditError.message);

  return NextResponse.json({ ok: true });
}
