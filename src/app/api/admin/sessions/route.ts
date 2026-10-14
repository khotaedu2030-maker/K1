import { NextResponse } from "next/server";
import { declaredBodyExceeds, readJsonBodyLimited } from "@/lib/api-rate-limit";
import { requirePermission } from "@/lib/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// تعيين معلم بديل لجلسة واحدة فقط — لا يغيّر cohorts.teacher_id (المعلم الأساسي للمجموعة)
// إطلاقًا، فقط sessions.teacher_id لهذه الجلسة تحديدًا. الجلسات المستقبلية الأخرى لنفس
// المجموعة تبقى بمعلمها الأساسي، والسجلات التاريخية لا تتأثر (نُعدِّل جلسات scheduled مستقبلية
// فقط، لا completed ولا cancelled).
export async function POST(req: Request) {
  const adminCheck = await requirePermission("session.manage");
  if (!adminCheck.ok) return adminCheck.response;

  if (declaredBodyExceeds(req, 16 * 1024)) return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  const parsed = await readJsonBodyLimited(req, 16 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  const body = parsed.body;
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
  const newTeacherId = typeof body?.teacherId === "string" ? body.teacherId.trim() : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

  if (!sessionId || !newTeacherId || !reason || reason.length > 1000) {
    return NextResponse.json({ error: "الجلسة والمعلم الجديد والسبب مطلوبة بقيم صحيحة" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const { data: session, error: sessionError } = await admin
    .from("sessions")
    .select("id, teacher_id, status, starts_at, ends_at, cohort_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) {
    console.error("[admin-sessions] session lookup failed:", sessionError.message);
    return NextResponse.json({ error: "تعذّر التحقق من الجلسة" }, { status: 500 });
  }
  if (!session) return NextResponse.json({ error: "جلسة غير موجودة" }, { status: 404 });
  if (session.status !== "scheduled") {
    return NextResponse.json({ error: "لا يمكن تعديل معلم جلسة غير مجدولة (مكتملة أو ملغاة)" }, { status: 409 });
  }
  if (new Date(session.starts_at) < new Date()) {
    return NextResponse.json({ error: "لا يمكن تعديل معلم جلسة انتهى وقتها بالفعل" }, { status: 409 });
  }

  const { data: teacher, error: teacherError } = await admin.from("teachers").select("id, active").eq("id", newTeacherId).eq("active", true).maybeSingle();
  if (teacherError) {
    console.error("[admin-sessions] teacher lookup failed:", teacherError.message);
    return NextResponse.json({ error: "تعذّر التحقق من المعلم" }, { status: 500 });
  }
  if (!teacher) return NextResponse.json({ error: "المعلم غير موجود أو غير نشط" }, { status: 400 });

  // فحص تعارض موثوق: هل لدى المعلم البديل جلسة أخرى (مجدولة) تتداخل زمنيًا مع نفس الفترة؟
  // نعتمد على sessions.starts_at/ends_at الفعلية (بيانات موثوقة)، لا teacher_availability
  // (جدول تفضيلات عامة أسبوعية، ليس تعارضًا زمنيًا فعليًا مؤكَّدًا لهذه الجلسة تحديدًا).
  if (session.starts_at && session.ends_at) {
    const { data: overlapping, error: overlappingError } = await admin
      .from("sessions")
      .select("id")
      .eq("teacher_id", newTeacherId)
      .eq("status", "scheduled")
      .neq("id", sessionId)
      .lt("starts_at", session.ends_at)
      .gt("ends_at", session.starts_at)
      .limit(1);
    if (overlappingError) {
      console.error("[admin-sessions] overlap lookup failed:", overlappingError.message);
      return NextResponse.json({ error: "تعذّر التحقق من تعارض جدول المعلم" }, { status: 500 });
    }
    if (overlapping && overlapping.length > 0) {
      return NextResponse.json({ error: "هذا المعلم لديه جلسة أخرى متداخلة بنفس التوقيت" }, { status: 409 });
    }
  }

  const oldTeacherId = session.teacher_id;
  const { data: updatedSession, error } = await admin
    .from("sessions")
    .update({ teacher_id: newTeacherId })
    .eq("id", sessionId)
    .eq("status", "scheduled")
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[admin-sessions] فشل تعيين معلم بديل:", error.message);
    return NextResponse.json({ error: "تعذّر حفظ التعديل" }, { status: 500 });
  }
  if (!updatedSession) {
    return NextResponse.json({ error: "تغيّرت حالة الجلسة قبل حفظ التعديل" }, { status: 409 });
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
