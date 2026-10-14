import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getActiveStaffRole } from "@/lib/parent-role-boundary";

export type ParentIdentityResult =
  | { ok: true; parentId: string }
  | { ok: false; status: number; error: string };

export async function resolveParentIdentityForUser(userId: string): Promise<ParentIdentityResult> {
  try {
    const staffRole = await getActiveStaffRole(userId);
    if (staffRole) {
      return { ok: false, status: 403, error: "هذا الحساب مخصص لفريق خُطى وليس لحساب ولي أمر." };
    }
  } catch (error) {
    console.error("[parent-identity] staff-role lookup failed:", error);
    return { ok: false, status: 503, error: "تعذّر التحقق من نوع الحساب" };
  }

  const admin = createSupabaseAdminClient();
  const { data: parent, error } = await admin
    .from("parents")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[parent-identity] parent lookup failed:", error.message);
    return { ok: false, status: 503, error: "تعذّر التحقق من حساب ولي الأمر" };
  }
  if (!parent) {
    return { ok: false, status: 403, error: "لا يوجد سجل ولي أمر لهذا الحساب" };
  }

  return { ok: true, parentId: parent.id };
}
