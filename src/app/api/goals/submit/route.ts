import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireTeacher } from "@/lib/require-teacher";
import { checkRateLimit, declaredBodyExceeds, rateLimitRejectionResponse, readJsonBodyLimited } from "@/lib/api-rate-limit";
import { supabaseRelationOne, type SupabaseRelation } from "@/lib/supabase-relations";

// إنشاء أو تحديث "خطوة هذا الأسبوع". يقبل goalId لتحديث هدف قائم (حالة/تقدّم)،
// أو بياناته الكاملة لإنشاء هدف جديد.
export async function POST(req: Request) {
  if (declaredBodyExceeds(req, 8 * 1024)) {
    return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  }

  const parsed = await readJsonBodyLimited(req, 8 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  const body = parsed.body;
  const { goalId, childId, weekStart, title, description, category, status, progress } = body ?? {};

  const validStatuses = new Set(["active", "achieved", "partially_achieved", "carried_forward", "cancelled"]);
  const validDateOnly = (value: unknown): value is string => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  };

  const teacherCheck = await requireTeacher();
  if (!teacherCheck.ok) return teacherCheck.response;

  const teacherLimit = await checkRateLimit({ request: req, scope: "goals:submit:teacher", identifier: teacherCheck.userId, limit: 30, windowSeconds: 600 });
  const teacherRejection = rateLimitRejectionResponse(teacherLimit);
  if (teacherRejection) return teacherRejection;

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
    const belongsToTeacher = ((link ?? []) as { cohorts: SupabaseRelation<{ teacher_id: string | null }> }[])
      .some((item) => supabaseRelationOne(item.cohorts)?.teacher_id === teacherCheck.teacherId);
    if (!belongsToTeacher) return NextResponse.json({ error: "هذا الطالب ليس ضمن مجموعاتك" }, { status: 403 });

    const resourceLimit = await checkRateLimit({ request: req, scope: "goals:submit:student", identifier: existing.child_id, limit: 20, windowSeconds: 600 });
    const resourceRejection = rateLimitRejectionResponse(resourceLimit);
    if (resourceRejection) return resourceRejection;

    if (status !== undefined && (typeof status !== "string" || !validStatuses.has(status))) {
      return NextResponse.json({ error: "حالة الهدف غير صالحة" }, { status: 400 });
    }
    if (progress !== undefined && (!Number.isInteger(progress) || progress < 0 || progress > 100)) {
      return NextResponse.json({ error: "نسبة التقدم يجب أن تكون بين 0 و100" }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};
    if (status !== undefined) {
      patch.status = status;
      patch.completed_at = status === "achieved" ? new Date().toISOString() : null;
    }
    if (progress !== undefined) patch.progress = progress;
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "لا توجد بيانات صالحة للتحديث" }, { status: 400 });
    }

    const { error } = await admin.from("weekly_goals").update(patch).eq("id", goalId);
    if (error) {
      console.error("[goals] update failed:", error.message);
      return NextResponse.json({ error: "تعذّر تحديث الهدف" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const normalizedTitle = typeof title === "string" ? title.trim() : "";
  const normalizedDescription = typeof description === "string" ? description.trim() : null;
  const normalizedCategory = typeof category === "string" ? category.trim() : null;
  if (typeof childId !== "string" || !childId || !validDateOnly(weekStart) || !normalizedTitle) {
    return NextResponse.json({ error: "بيانات ناقصة أو غير صالحة لإنشاء هدف جديد" }, { status: 400 });
  }
  if (normalizedTitle.length > 200 || (normalizedDescription?.length ?? 0) > 2000 || (normalizedCategory?.length ?? 0) > 100) {
    return NextResponse.json({ error: "بيانات الهدف تتجاوز الطول المسموح" }, { status: 400 });
  }

  const { data: link } = await admin
    .from("subscriptions")
    .select("child_id, cohorts(teacher_id)")
    .eq("child_id", childId)
    .eq("status", "active");
  const belongsToTeacher = ((link ?? []) as { cohorts: SupabaseRelation<{ teacher_id: string | null }> }[])
    .some((item) => supabaseRelationOne(item.cohorts)?.teacher_id === teacherCheck.teacherId);
  if (!belongsToTeacher) return NextResponse.json({ error: "هذا الطالب ليس ضمن مجموعاتك" }, { status: 403 });

  const resourceLimit = await checkRateLimit({ request: req, scope: "goals:submit:student", identifier: childId, limit: 20, windowSeconds: 600 });
  const resourceRejection = rateLimitRejectionResponse(resourceLimit);
  if (resourceRejection) return resourceRejection;

  const { error } = await admin.from("weekly_goals").insert({
    child_id: childId,
    week_start: weekStart,
    title: normalizedTitle,
    description: normalizedDescription || null,
    category: normalizedCategory || null,
    created_by_teacher_id: teacherCheck.teacherId,
  });
  if (error) {
    console.error("[goals] create failed:", error.message);
    return NextResponse.json({ error: "تعذّر إنشاء الهدف" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
