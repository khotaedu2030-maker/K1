import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_ACTIONS = new Set(["assign", "status", "resolve"]);

export async function POST(req: Request) {
  const check = await requireAdmin(); if (!check.ok) return check.response;
  const body = await req.json().catch(() => null);
  const exceptionId = typeof body?.exceptionId === "string" ? body.exceptionId.trim() : "";
  const action = typeof body?.action === "string" ? body.action : "";
  const assignedTo = typeof body?.assignedTo === "string" ? body.assignedTo.trim() : "";
  const newStatus = typeof body?.newStatus === "string" ? body.newStatus : "";
  const resolutionNote = typeof body?.resolutionNote === "string" ? body.resolutionNote.trim() : "";
  if (!UUID_RE.test(exceptionId) || !VALID_ACTIONS.has(action)) return NextResponse.json({ error: "معرّف الاستثناء والإجراء مطلوبان" }, { status: 400 });
  if (action === "assign" && !UUID_RE.test(assignedTo)) return NextResponse.json({ error: "المسؤول الإداري غير صالح" }, { status: 400 });
  if (action === "status" && newStatus !== "in_review") return NextResponse.json({ error: "حالة مستهدَفة غير صالحة" }, { status: 400 });
  if (action === "resolve" && (resolutionNote.length < 2 || resolutionNote.length > 1000)) return NextResponse.json({ error: "ملاحظة الحل مطلوبة" }, { status: 400 });
  const admin = createSupabaseAdminClient();
  if (action === "assign") { const { data } = await admin.from("admins").select("id").eq("id", assignedTo).eq("active", true).maybeSingle(); if (!data) return NextResponse.json({ error: "حساب إداري غير موجود أو غير نشط" }, { status: 400 }); }
  const { data: rpcResult, error: rpcError } = await admin.rpc("transition_operational_exception_atomic", { p_exception_id: exceptionId, p_action: action, p_actor: check.adminId, p_assigned_to: action === "assign" ? assignedTo : null, p_new_status: action === "status" ? newStatus : null, p_resolution_note: action === "resolve" ? resolutionNote : null });
  if (rpcError) { console.error("[admin-exceptions-transition] RPC failed:", rpcError.message); return NextResponse.json({ error: "تعذّر تنفيذ الإجراء" }, { status: 500 }); }
  const result = rpcResult as { ok: boolean; error?: string; changed?: boolean; old_status?: string; new_status?: string; old_assigned_to?: string | null; new_assigned_to?: string | null };
  if (!result.ok) { const messages: Record<string, string> = { exception_not_found: "استثناء غير موجود", invalid_target_status: "حالة مستهدَفة غير صالحة", already_resolved: "هذا الاستثناء مُغلَق بالفعل", resolution_note_required: "ملاحظة الحل مطلوبة", invalid_action: "إجراء غير معروف" }; return NextResponse.json({ error: messages[result.error ?? ""] ?? "تعذّر تنفيذ الإجراء" }, { status: 409 }); }
  if (result.changed) { const actionNames: Record<string, string> = { assign: "exception_assigned", status: "exception_status_changed", resolve: "exception_resolved" }; const { error } = await admin.from("admin_actions").insert({ admin_user_id: check.userId, action: actionNames[action], entity_type: "operational_exception", entity_id: exceptionId, old_value: action === "assign" ? { assigned_to: result.old_assigned_to } : { status: result.old_status }, new_value: action === "assign" ? { assigned_to: result.new_assigned_to } : { status: result.new_status }, reason: action === "resolve" ? resolutionNote : null }); if (error) console.error("[admin-exceptions-transition] Audit insert failed:", error.message); }
  return NextResponse.json({ ok: true });
}