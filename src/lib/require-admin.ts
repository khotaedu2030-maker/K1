import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// فحص صلاحية الإدارة المركزي — بدل تكرار getUser() + بحث جدول admins داخل كل route إداري.
// كل admins الحاليين "Full Admin" (الجدول لا يميّز أدوارًا فرعية بعد — راجع التقرير النهائي
// لتوصية تطوير لاحق: super_admin/operations_manager/admin_staff عند الحاجة الفعلية).
export type AdminCheckResult =
  | { ok: true; userId: string; adminId: string }
  | { ok: false; response: NextResponse };

export async function requireAdmin(): Promise<AdminCheckResult> {
  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 }) };
  }

  const admin = createSupabaseAdminClient();
  const { data: adminRow } = await admin.from("admins").select("id").eq("user_id", user.id).maybeSingle();
  if (!adminRow) {
    return { ok: false, response: NextResponse.json({ error: "هذا الحساب ليس حساب إدارة" }, { status: 403 }) };
  }

  return { ok: true, userId: user.id, adminId: adminRow.id };
}
