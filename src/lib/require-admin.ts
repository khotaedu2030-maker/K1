import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// فحص صلاحية الإدارة المركزي — بدل تكرار getUser() + بحث جدول admins داخل كل route إداري.
// كل admins الحاليين "Full Admin" (الجدول لا يميّز أدوارًا فرعية بعد — راجع التقرير النهائي
// لتوصية تطوير لاحق: super_admin/operations_manager/admin_staff عند الحاجة الفعلية).
export type AdminCheckResult =
  | { ok: true; userId: string; adminId: string; role: string }
  | { ok: false; response: NextResponse };

const ROLE_PERMISSIONS: Record<string, ReadonlySet<string>> = {
  super_admin: new Set([
    "settings.manage", "cohort.manage", "session.manage", "teacher.manage",
    "teacher_application.review", "makeup.manage", "subscription.review", "parent.context.read", "payment.read", "admin.manage",
  ]),
  operations_manager: new Set([
    "cohort.manage", "session.manage", "teacher.manage", "teacher_application.review",
    "makeup.manage", "subscription.review", "parent.context.read",
  ]),
  finance_admin: new Set(["subscription.review", "parent.context.read", "payment.read"]),
  admin_support: new Set(["teacher_application.review", "parent.context.read"]),
};

export function adminRoleHasPermission(role: string | null | undefined, permission: string): boolean {
  return Boolean(role && ROLE_PERMISSIONS[role]?.has(permission));
}

export async function requirePermission(permission: string): Promise<AdminCheckResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  if (!adminRoleHasPermission(admin.role, permission)) {
    return { ok: false, response: NextResponse.json({ error: "ليس لديك صلاحية لهذا الإجراء" }, { status: 403 }) };
  }
  return admin;
}

export async function requireAdmin(): Promise<AdminCheckResult> {
  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 }) };
  }

  const admin = createSupabaseAdminClient();
  const { data: adminRow } = await admin.from("admins").select("id, role").eq("user_id", user.id).eq("active", true).maybeSingle();
  if (!adminRow) {
    return { ok: false, response: NextResponse.json({ error: "هذا الحساب ليس حساب إدارة" }, { status: 403 }) };
  }

  return { ok: true, userId: user.id, adminId: adminRow.id, role: adminRow.role };
}
