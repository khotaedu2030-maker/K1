import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST() {
  const check = await requireAdmin();
  if (!check.ok) return check.response;

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("admin_actions").insert({
    admin_user_id: check.userId,
    action: "admin_logout",
    entity_type: "admin_session",
    entity_id: check.adminId,
  });
  if (error) console.error("[admin-auth-logout] audit logging failed:", error.message);

  return NextResponse.json({ ok: true });
}