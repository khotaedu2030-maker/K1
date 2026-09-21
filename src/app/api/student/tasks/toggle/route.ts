import { NextResponse } from "next/server";
import { getActiveStudentSession } from "@/lib/student-mode";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// الطالب يستطيع فقط تبديل حالة "أنجزتها/لم أنجزها" — لا يستطيع تعديل العنوان أو المادة أو
// أي حقل آخر، ولا يستطيع لمس مهمة لا تخص طفل الجلسة الحالية (childId يُشتق من الجلسة، لا من الطلب).
export async function POST(req: Request) {
  const session = await getActiveStudentSession();
  if (!session) return NextResponse.json({ error: "لا توجد جلسة طالب نشطة" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const taskId = body?.taskId as string | undefined;
  if (!taskId) return NextResponse.json({ error: "taskId مطلوب" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: task } = await admin.from("daily_tasks").select("id, child_id, status").eq("id", taskId).maybeSingle();

  if (!task || task.child_id !== session.childId) {
    return NextResponse.json({ error: "هذه المهمة غير متاحة" }, { status: 403 });
  }
  if (task.status === "needs_review") {
    return NextResponse.json({ error: "هذه المهمة يراجعها المعلم" }, { status: 409 });
  }

  const nextStatus = task.status === "done" ? "pending" : "done";
  const { error } = await admin.from("daily_tasks").update({ status: nextStatus }).eq("id", taskId);
  if (error) {
    console.error("[student-tasks] update failed:", error.message);
    return NextResponse.json({ error: "تعذّر تحديث المهمة" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: nextStatus });
}
