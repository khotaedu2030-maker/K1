import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// Guard مركزي وقابل لإعادة الاستخدام: يُعاد استدعاؤه في كل عملية حساسة (فتح محادثة، جلب رسائل،
// إرسال، تحديد كمقروء) — لا يكفي أن تكون طرفًا أصليًا في المحادثة وقت إنشائها؛ العلاقة يجب أن
// تكون لا تزال قائمة فعليًا وقت كل عملية.
export type ThreadAuthResult =
  | { ok: true; role: "parent" | "teacher"; canWrite: boolean; childId: string }
  | { ok: false; status: number; error: string };

export async function authorizeMessageThreadAccess(userId: string, threadId: string): Promise<ThreadAuthResult> {
  const admin = createSupabaseAdminClient();

  const { data: thread } = await admin
    .from("message_threads")
    .select("id, child_id, parent_user_id, teacher_user_id")
    .eq("id", threadId)
    .maybeSingle();

  if (!thread) return { ok: false, status: 404, error: "محادثة غير موجودة" };

  if (thread.parent_user_id === userId) {
    // "ولي الأمر" هنا يجب أن يكون لا يزال ولي أمر هذا الطفل فعليًا (وليس مجرد كونه طرفًا تاريخيًا)
    const { data: parent } = await admin.from("parents").select("id").eq("user_id", userId).maybeSingle();
    const { data: child } = await admin.from("children").select("parent_id").eq("id", thread.child_id).maybeSingle();
    const stillOwnsChild = Boolean(parent && child && child.parent_id === parent.id);
    return { ok: true, role: "parent", canWrite: stillOwnsChild, childId: thread.child_id };
  }

  if (thread.teacher_user_id === userId) {
    // "المعلم" يجب أن يكون لا يزال معلم إحدى المجموعات التي للطفل فيها اشتراك فعّال حاليًا —
    // ينتهي هذا تلقائيًا عند انتهاء الاشتراك، انتقال الطفل لمجموعة أخرى، أو تغيّر معلم المجموعة.
    const { data: teacher } = await admin.from("teachers").select("id").eq("user_id", userId).maybeSingle();
    let stillTeaches = false;
    if (teacher) {
      const { data: activeLinks } = await admin
        .from("subscriptions")
        .select("id, cohorts(teacher_id)")
        .eq("child_id", thread.child_id)
        .eq("status", "active");
      stillTeaches = (activeLinks ?? []).some((l: any) => l.cohorts?.teacher_id === teacher.id);
    }
    return { ok: true, role: "teacher", canWrite: stillTeaches, childId: thread.child_id };
  }

  return { ok: false, status: 403, error: "أنت لست طرفًا في هذه المحادثة" };
}

export const THREAD_CLOSED_MESSAGE = "هذه المحادثة مغلقة لأن ارتباط الطالب بهذه المجموعة انتهى.";
