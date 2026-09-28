import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { adminRoleHasPermission } from "@/lib/admin-permissions";

// فحص صلاحية الإدارة المركزي — بدل تكرار getUser() + بحث جدول admins داخل كل route إداري.
// مصدر الحقيقة الوحيد لأدوار/صلاحيات الإدارة هو src/lib/admin-permissions.ts (يستهلكه أيضًا
// admin-identity.ts وAdminShell)، لا تعريف مكرَّر هنا.
export type AdminCheckResult =
  | { ok: true; userId: string; adminId: string; role: string }
  | { ok: false; response: NextResponse };

export { adminRoleHasPermission };

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
