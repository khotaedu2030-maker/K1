import "server-only";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { STUDENT_SESSION_COOKIE } from "@/lib/student-mode-constants";

export { STUDENT_SESSION_COOKIE };
export { STUDENT_SESSION_TTL_HOURS } from "@/lib/student-mode-constants";

export type ActiveStudentSession = {
  sessionId: string;
  childId: string;
  firstName: string;
  grade: number;
};

// المصدر الوحيد الموثوق لمعرفة "أي طفل" يستخدم المتصفح الآن في مساحة الطالب.
// يُستدعى من كل صفحة /student/* وكل route تحت /api/student/**؛ لا نقرأ childId أبدًا
// من querystring أو من جسم الطلب.
export async function getActiveStudentSession(): Promise<ActiveStudentSession | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(STUDENT_SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) return null;

  const admin = createSupabaseAdminClient();
  const { data: session } = await admin
    .from("student_mode_sessions")
    .select("id, parent_user_id, child_id, active, expires_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session || !session.active) return null;
  if (session.parent_user_id !== user.id) return null; // لا نثق بجلسة تخص مستخدمًا آخر
  if (new Date(session.expires_at).getTime() < Date.now()) return null;

  const { data: child } = await admin
    .from("children")
    .select("first_name, grade")
    .eq("id", session.child_id)
    .maybeSingle();
  if (!child) return null;

  return { sessionId: session.id, childId: session.child_id, firstName: child.first_name, grade: child.grade };
}

export { getToneLevel } from "@/lib/student-mode-constants";
