import "server-only";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { isPilotAuthEnabled, verifyPilotSessionParentId, PILOT_SESSION_COOKIE } from "@/lib/pilot-auth";
import { getActiveStaffRole } from "@/lib/parent-role-boundary";

export type ParentContext = { parentId: string; fullName: string; isPilot: boolean };

// المرجع الوحيد لتحديد "من هو ولي الأمر الحالي" في صفحات /parent التي تدعم Pilot Mode.
// المسار الحقيقي (جلسة Supabase Auth فعلية) لم يتغيّر إطلاقًا وله الأولوية دائمًا.
// مسار Pilot لا يعمل إلا إذا: لا توجد جلسة Supabase حقيقية + isPilotAuthEnabled() + كوكي
// Pilot موقَّعة وصالحة فعليًا — وليس أي شرط منها وحده.
export async function resolveParentContext(): Promise<ParentContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    try {
      if (await getActiveStaffRole(user.id)) return null;
    } catch (error) {
      console.error("[parent-context] staff-role lookup failed:", error);
      return null;
    }

    const { data: parent } = await supabase
      .from("parents")
      .select("id, full_name")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!parent) return null;
    return { parentId: parent.id, fullName: parent.full_name, isPilot: false };
  }

  if (!isPilotAuthEnabled()) return null;

  const cookieStore = await cookies();
  const token = cookieStore.get(PILOT_SESSION_COOKIE)?.value;
  const parentId = await verifyPilotSessionParentId(token);
  if (!parentId) return null;

  const admin = createSupabaseAdminClient();
  const { data: pilotParent, error } = await admin
    .from("parents")
    .select("id, full_name, user_id")
    .eq("id", parentId)
    .is("user_id", null)
    .maybeSingle();
  if (error) {
    console.error("[pilot-parent] dedicated demo parent lookup failed:", error.message);
    return null;
  }

  // No fallback to the most recently created parent, and no unbound subscription
  // cookie: the signed pilot token identifies this parent exclusively.
  if (!pilotParent) return null;
  return { parentId: pilotParent.id, fullName: pilotParent.full_name, isPilot: true };
}
