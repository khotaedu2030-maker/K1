import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// This records that an administrator reviewed thread ACTIVITY metadata.
// It never modifies messages.read_at or exposes private message contents.
export async function POST() {
  const identity = await requirePermission("messages.metadata.read");
  if (!identity.ok) return identity.response;

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin.from("admin_navigation_seen").upsert({
    admin_id: identity.adminId,
    messages_reviewed_at: now,
    updated_at: now,
  }, { onConflict: "admin_id" });
  if (error) {
    console.error("[admin-badges] review metadata failed", error.code);
    return NextResponse.json({ error: "تعذّر تأكيد مراجعة النشاط" }, { status: 503 });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
