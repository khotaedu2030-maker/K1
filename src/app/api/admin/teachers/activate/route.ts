import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const ACTIVATION_ERRORS: Record<string, string> = {
  application_not_found: "الطلب غير موجود",
  application_not_accepted: "يجب قبول الطلب قبل التفعيل",
};

export async function POST(req: Request) {
  const adminCheck = await requirePermission("teacher.manage");
  if (!adminCheck.ok) return adminCheck.response;

  const body = await req.json().catch(() => null);
  const applicationId = typeof body?.applicationId === "string" ? body.applicationId.trim() : "";
  if (!applicationId) return NextResponse.json({ error: "معرّف الطلب مطلوب" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("activate_teacher_from_application_atomic", {
    p_application_id: applicationId,
    p_actor: adminCheck.userId,
  });
  if (error) {
    console.error("[admin-teacher-activate] activation RPC failed:", error.message);
    return NextResponse.json({ error: "تعذّر تفعيل المعلم" }, { status: 500 });
  }

  const result = data as { ok?: boolean; error?: string; teacher_id?: string; already_active?: boolean } | null;
  if (!result?.ok) {
    const message = result?.error ? ACTIVATION_ERRORS[result.error] : undefined;
    return NextResponse.json({ error: message ?? "تعذّر تفعيل المعلم" }, { status: result?.error === "application_not_found" ? 404 : 409 });
  }

  const { error: auditError } = await admin.from("admin_actions").insert({
    admin_user_id: adminCheck.userId,
    action: "teacher_activate",
    entity_type: "teacher_application",
    entity_id: applicationId,
    new_value: { teacher_id: result.teacher_id, already_active: result.already_active === true },
  });
  if (auditError) console.error("[admin-teacher-activate] audit logging failed:", auditError.message);

  return NextResponse.json({ ok: true, alreadyActive: result.already_active === true });
}