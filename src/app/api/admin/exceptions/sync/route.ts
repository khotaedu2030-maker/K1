import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST() {
  const check = await requirePermission("exception.manage"); if (!check.ok) return check.response;
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("sync_operational_exceptions");
  if (error) { console.error("[admin-exceptions-sync] RPC failed:", error.message); return NextResponse.json({ error: "تعذّر تحديث الفحص" }, { status: 500 }); }
  return NextResponse.json({ ok: true });
}