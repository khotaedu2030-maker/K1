import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_PRIORITIES = new Set(["normal", "high"]);

export async function POST(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;
  const body = await req.json().catch(() => null);
  const contactRequestId = typeof body?.contactRequestId === "string" ? body.contactRequestId.trim() : "";
  const category = typeof body?.category === "string" ? body.category.trim() : "";
  const priority = typeof body?.priority === "string" ? body.priority : "normal";
  if (!UUID_RE.test(contactRequestId) || category.length < 2 || category.length > 100 || !VALID_PRIORITIES.has(priority)) return NextResponse.json({ error: "بيانات رسالة التواصل غير صالحة" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: rpcResult, error: rpcError } = await admin.rpc("convert_contact_request_to_support_case_atomic", { p_contact_request_id: contactRequestId, p_category: category, p_priority: priority, p_actor: adminCheck.adminId });
  if (rpcError) {
    console.error("[support-cases-convert] RPC failed:", rpcError.message);
    return NextResponse.json({ error: "تعذّر التحويل" }, { status: 500 });
  }
  const result = rpcResult as { ok: boolean; error?: string; already_converted?: boolean; case_id?: string };
  if (!result.ok) return NextResponse.json({ error: result.error === "contact_request_not_found" ? "رسالة غير موجودة" : "تعذّر التحويل" }, { status: 409 });
  if (!result.already_converted && result.case_id) {
    const { error: auditError } = await admin.from("admin_actions").insert({ admin_user_id: adminCheck.userId, action: "contact_request_converted", entity_type: "support_case", entity_id: result.case_id, new_value: { contact_request_id: contactRequestId, category, priority } });
    if (auditError) console.error("[support-cases-convert] Audit insert failed:", auditError.message);
  }
  return NextResponse.json({ ok: true, caseId: result.case_id, alreadyConverted: result.already_converted });
}