import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const check = await requirePermission("admin.manage");
  if (!check.ok) return check.response;
  const body = await req.json().catch(() => null);
  const targetAdminId = typeof body?.targetAdminId === "string" ? body.targetAdminId.trim() : "";
  const active = body?.active === true;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!UUID_RE.test(targetAdminId) || reason.length < 2 || reason.length > 500) return NextResponse.json({ error: "المعرّف والسبب مطلوبان" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: rpcResult, error: rpcError } = await admin.rpc("admin_set_active_atomic", { p_target_admin_id: targetAdminId, p_active: active, p_actor: check.adminId, p_reason: reason });
  if (rpcError) { console.error("[admin-users-active] RPC failed:", rpcError.message); return NextResponse.json({ error: "تعذّر تنفيذ الإجراء" }, { status: 500 }); }
  const result = rpcResult as { ok: boolean; error?: string; changed?: boolean };
  if (!result.ok) {
    const messages: Record<string, string> = { reason_required: "السبب مطلوب", admin_not_found: "حساب إداري غير موجود", last_super_admin_protected: "لا يمكن تعطيل آخر Super Admin نشط", cannot_deactivate_self: "لا يمكن تعطيل حسابك الخاص" };
    return NextResponse.json({ error: messages[result.error ?? ""] ?? "تعذّر تنفيذ الإجراء" }, { status: 409 });
  }
  if (result.changed) {
    const { error: auditError } = await admin.from("admin_actions").insert({ admin_user_id: check.userId, action: active ? "admin_access_activated" : "admin_access_deactivated", entity_type: "admin", entity_id: targetAdminId, new_value: { active }, reason });
    if (auditError) console.error("[admin-users-active] Audit insert failed:", auditError.message);
  }
  return NextResponse.json({ ok: true, changed: !!result.changed });
}