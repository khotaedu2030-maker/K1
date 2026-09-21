import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { adminRoleHasPermission } from "@/lib/require-admin";

export type AdminIdentity = { id: string; user_id: string; full_name: string; role: string };

// نسخة لصفحات Server Component (لا API routes) من نفس فحص requireAdmin() — تُعيد صف الأدمن أو
// null بدل NextResponse، لأن الصفحة تحتاج عرض JSX عند الرفض لا استجابة HTTP خام. نفس مصدر
// الحقيقة (جدول admins عبر user_id) — لا منطق تفويض مختلف أو مُكرَّر.
export async function getAdminIdentity(permission?: string): Promise<AdminIdentity | null> {
  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) return null;

  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("admins").select("id, user_id, full_name, role").eq("user_id", user.id).eq("active", true).maybeSingle();
  if (!data || (permission && !adminRoleHasPermission(data.role, permission))) return null;
  return data;
}
