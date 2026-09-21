import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireTeacher } from "@/lib/require-teacher";

// إنشاء أو تحديث "خطوة هذا الأسبوع". يقبل goalId لتحديث هدف قائم (حالة/تقدّم)،
// أو بياناته الكاملة لإنشاء هدف جديد.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { goalId, childId, weekStart, title, description, category, status, progress } = body ?? {};

  const teacherCheck = await requireTeacher();
  if (!teacherCheck.ok) return teacherCheck.response;

  const admin = createSupabaseAdminClient();

  if (goalId) {
    // تحديث هدف قائم — تحقق أولًا أنه يخص طالبًا تابعًا لهذا المعلم
    const { data: existing } = await admin
      .from("weekly_goals")
      .select("child_id")
      .eq("id", goalId)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: "هدف غير موجود" }, { status: 404 });

    const { data: link } = await admin
      .from("subscriptions")
      .select("child_id, cohorts(teacher_id)")
      .eq("child_id", existing.child_id)
      .eq("status", "active");
    const belongsToTeacher = (link ?? []).some((l: any) => l.cohorts?.teacher_id === teacherCheck.teacherId);
    if (!belongsToTeacher) return NextResponse.json({ error: "هذا الطالب ليس ضمن مجموعاتك" }, { status: 403 });

    const patch: Record<string, unknown> = {};
    if (status) {
      patch.status = status;
      if (status === "achieved") patch.completed_at = new Date().toISOString();
    }
    if (typeof progress === "number") patch.progress = progress;

    const { error } = await admin.from("weekly_goals").update(patch).eq("id", goalId);
    if (error) {
      console.error("[goals] update failed:", error.message);
      return NextResponse.json({ error: "تعذّر تحديث الهدف" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (!childId || !weekStart || !title) {
    return NextResponse.json({ error: "بيانات ناقصة لإنشاء هدف جديد" }, { status: 400 });
  }

  const { data: link } = await admin
    .from("subscriptions")
    .select("child_id, cohorts(teacher_id)")
    .eq("child_id", childId)
    .eq("status", "active");
  const belongsToTeacher = (link ?? []).some((l: any) => l.cohorts?.teacher_id === teacherCheck.teacherId);
  if (!belongsToTeacher) return NextResponse.json({ error: "هذا الطالب ليس ضمن مجموعاتك" }, { status: 403 });

  const { error } = await admin.from("weekly_goals").insert({
    child_id: childId,
    week_start: weekStart,
    title,
    description: description ?? null,
    category: category ?? null,
    created_by_teacher_id: teacherCheck.teacherId,
  });
  if (error) {
    console.error("[goals] create failed:", error.message);
    return NextResponse.json({ error: "تعذّر إنشاء الهدف" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
