import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type StaffRole = "admin" | "teacher";

export async function getActiveStaffRole(userId: string): Promise<StaffRole | null> {
  const admin = createSupabaseAdminClient();

  const [{ data: adminRow, error: adminError }, { data: teacherRow, error: teacherError }] = await Promise.all([
    admin.from("admins").select("id").eq("user_id", userId).eq("active", true).maybeSingle(),
    admin.from("teachers").select("id").eq("user_id", userId).eq("active", true).maybeSingle(),
  ]);

  if (adminError) throw new Error(`admin lookup failed: ${adminError.message}`);
  if (teacherError) throw new Error(`teacher lookup failed: ${teacherError.message}`);

  if (adminRow) return "admin";
  if (teacherRow) return "teacher";
  return null;
}
