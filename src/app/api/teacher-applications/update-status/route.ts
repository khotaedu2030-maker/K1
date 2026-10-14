import { NextResponse } from "next/server";
import { declaredBodyExceeds, readJsonBodyLimited } from "@/lib/api-rate-limit";
import { requirePermission } from "@/lib/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const VALID_STATUSES = ["new", "reviewing", "shortlisted", "rejected", "accepted"];

// Admin guard مركزي server-side — لا يعتمد على أي شيء يُرسَل من العميل سوى applicationId/status.
export async function POST(req: Request) {
  const adminCheck = await requirePermission("teacher_application.review");
  if (!adminCheck.ok) return adminCheck.response;

  if (declaredBodyExceeds(req, 8 * 1024)) return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  const parsed = await readJsonBodyLimited(req, 8 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  const body = parsed.body;
  const applicationId = typeof body?.applicationId === "string" ? body.applicationId.trim() : "";
  const status = typeof body?.status === "string" ? body.status.trim() : "";
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(applicationId) || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: updated, error } = await admin
    .from("teacher_applications")
    .update({ status })
    .eq("id", applicationId)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[teacher-applications] status update failed:", error.message);
    return NextResponse.json({ error: "تعذّر تحديث حالة الطلب" }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: "طلب المعلم غير موجود" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
