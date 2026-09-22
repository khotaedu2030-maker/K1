import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_ROLES = new Set(["super_admin", "operations_manager", "finance_admin", "admin_support"]);

export async function POST(req: Request) {
  const check = await requirePermission("admin.manage");
  if (!check.ok) return check.response;
  const body = await req.json().catch(() => null);
  const targetAdminId = typeof body?.targetAdminId === "string" ? body.targetAdminId.trim() : "";
  const newRole = typeof body?.newRole === "string" ? body.newRole : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!UUID_RE.test(targetAdminId) || !VALID_ROLES.has(newRole) || reason.length < 2 || reason.length > 500) return NextResponse.json({ error: "المعرّف والدور الجديد والسبب مطلوبة" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: rpcResult, error: rpcError } = await admin.rpc("admin_change_role_atomic", { p_target_admin_id: targetAdminId, p_new_role: newRole, p_actor: check.adminId, p_reason: reason });
  if (rpcError) { console.error("[admin-users-role] RPC failed:", rpcError.message); return NextResponse.json({ error: "تعذّر تغيير الدور" }, { status: 500 }); }
  const result = rpcResult as { ok: boolean; error?: string; changed?: boolean; old_role?: string; new_role?: string };
  if (!result.ok) {
    const messages: Record<string, string> = { reason_required: "السبب مطلوب", invalid_role: "دور غير صالح", admin_not_found: "حساب إداري غير موجود", last_super_admin_protected: "لا يمكن تغيير دور آخر Super Admin نشط" };
    return NextResponse.json({ error: messages[result.error ?? ""] ?? "تعذّر تغيير الدور" }, { status: 409 });
  }
  if (result.changed) {
    const { error: auditError } = await admin.from("admin_actions").insert({ admin_user_id: check.userId, action: "admin_role_changed", entity_type: "admin", entity_id: targetAdminId, old_value: { role: result.old_role }, new_value: { role: result.new_role }, reason });
    if (auditError) console.error("[admin-users-role] Audit insert failed:", auditError.message);
  }
  return NextResponse.json({ ok: true, changed: !!result.changed });
}