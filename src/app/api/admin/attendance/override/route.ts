import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_STATUSES = new Set(["present", "absent", "late", "excused"]);

export async function POST(req: Request) {
  const adminCheck = await requirePermission("session.manage");
  if (!adminCheck.ok) return adminCheck.response;

  const body = await req.json().catch(() => null);
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
  const childId = typeof body?.childId === "string" ? body.childId.trim() : "";
  const newStatus = typeof body?.newStatus === "string" ? body.newStatus : "";
  const newReason = typeof body?.newReason === "string" ? body.newReason.trim() : "";
  const overrideReason = typeof body?.overrideReason === "string" ? body.overrideReason.trim() : "";

  if (!UUID_RE.test(sessionId) || !UUID_RE.test(childId) || !VALID_STATUSES.has(newStatus) || overrideReason.length < 2 || overrideReason.length > 500) {
    return NextResponse.json({ error: "معرّف الجلسة/الطالب والحالة الجديدة وسبب التصحيح مطلوبة" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: rpcResult, error: rpcError } = await admin.rpc("admin_override_attendance_atomic", {
    p_session_id: sessionId,
    p_child_id: childId,
    p_new_status: newStatus,
    p_new_reason: newReason || null,
    p_actor: adminCheck.adminId,
    p_override_reason: overrideReason,
  });
  if (rpcError) {
    console.error("[admin-attendance-override] RPC failed:", rpcError.message);
    return NextResponse.json({ error: "تعذّر تنفيذ التصحيح" }, { status: 500 });
  }

  const result = rpcResult as { ok: boolean; error?: string; old_status?: string | null; new_status?: string };
  if (!result.ok) {
    const messages: Record<string, string> = {
      reason_required: "سبب التصحيح مطلوب",
      invalid_status: "حالة غير صالحة",
      session_not_found: "جلسة غير موجودة",
    };
    return NextResponse.json({ error: messages[result.error ?? ""] ?? "تعذّر تنفيذ التصحيح" }, { status: 409 });
  }

  const { error: auditError } = await admin.from("admin_actions").insert({
    admin_user_id: adminCheck.userId,
    action: "attendance_override",
    entity_type: "attendance",
    entity_id: `${sessionId}:${childId}`,
    old_value: { status: result.old_status },
    new_value: { status: result.new_status },
    reason: overrideReason,
  });
  if (auditError) console.error("[admin-attendance-override] Audit insert failed:", auditError.message);

  return NextResponse.json({ ok: true });
}