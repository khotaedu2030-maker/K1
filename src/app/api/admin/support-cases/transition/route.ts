import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_ACTIONS = new Set(["assign", "status", "resolve"]);

export async function POST(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;
  const body = await req.json().catch(() => null);
  const caseId = typeof body?.caseId === "string" ? body.caseId.trim() : "";
  const action = typeof body?.action === "string" ? body.action : "";
  const assignedTo = typeof body?.assignedTo === "string" ? body.assignedTo.trim() : "";
  const newStatus = typeof body?.newStatus === "string" ? body.newStatus : "";
  const resolutionNote = typeof body?.resolutionNote === "string" ? body.resolutionNote.trim() : "";
  if (!UUID_RE.test(caseId) || !VALID_ACTIONS.has(action)) return NextResponse.json({ error: "معرّف الحالة والإجراء مطلوبان" }, { status: 400 });
  if (action === "assign" && !UUID_RE.test(assignedTo)) return NextResponse.json({ error: "المسؤول الإداري غير صالح" }, { status: 400 });
  if (action === "status" && newStatus !== "in_progress") return NextResponse.json({ error: "حالة مستهدَفة غير صالحة" }, { status: 400 });
  if (action === "resolve" && (resolutionNote.length < 2 || resolutionNote.length > 1000)) return NextResponse.json({ error: "ملاحظة الحل مطلوبة" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  if (action === "assign") {
    const { data: adminRow } = await admin.from("admins").select("id").eq("id", assignedTo).eq("active", true).maybeSingle();
    if (!adminRow) return NextResponse.json({ error: "حساب إداري غير موجود أو غير نشط" }, { status: 400 });
  }
  const { data: rpcResult, error: rpcError } = await admin.rpc("transition_support_case_atomic", {
    p_case_id: caseId,
    p_action: action,
    p_actor: adminCheck.adminId,
    p_assigned_to: action === "assign" ? assignedTo : null,
    p_new_status: action === "status" ? newStatus : null,
    p_resolution_note: action === "resolve" ? resolutionNote : null,
  });
  if (rpcError) {
    console.error("[support-cases-transition] RPC failed:", rpcError.message);
    return NextResponse.json({ error: "تعذّر تنفيذ الإجراء" }, { status: 500 });
  }
  const result = rpcResult as { ok: boolean; error?: string; changed?: boolean; old_status?: string; new_status?: string; old_assigned_to?: string | null; new_assigned_to?: string | null };
  if (!result.ok) {
    const messages: Record<string, string> = { case_not_found: "حالة غير موجودة", invalid_target_status: "حالة مستهدَفة غير صالحة", already_resolved: "هذه الحالة مُغلَقة بالفعل", resolution_note_required: "ملاحظة الحل مطلوبة", invalid_action: "إجراء غير معروف" };
    return NextResponse.json({ error: messages[result.error ?? ""] ?? "تعذّر تنفيذ الإجراء" }, { status: 409 });
  }
  if (result.changed) {
    const actionNames: Record<string, string> = { assign: "support_case_assigned", status: "support_case_status_changed", resolve: "support_case_resolved" };
    const { error: auditError } = await admin.from("admin_actions").insert({ admin_user_id: adminCheck.userId, action: actionNames[action], entity_type: "support_case", entity_id: caseId, old_value: action === "assign" ? { assigned_to: result.old_assigned_to } : { status: result.old_status }, new_value: action === "assign" ? { assigned_to: result.new_assigned_to } : { status: result.new_status }, reason: action === "resolve" ? resolutionNote : null });
    if (auditError) console.error("[support-cases-transition] Audit insert failed:", auditError.message);
  }
  return NextResponse.json({ ok: true });
}