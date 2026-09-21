import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const VALID_STATUSES = ["new", "reviewing", "shortlisted", "rejected", "accepted"];

// Admin guard مركزي server-side — لا يعتمد على أي شيء يُرسَل من العميل سوى applicationId/status.
export async function POST(req: Request) {
  const adminCheck = await requirePermission("teacher_application.review");
  if (!adminCheck.ok) return adminCheck.response;

  const body = await req.json().catch(() => null);
  const applicationId = body?.applicationId as string | undefined;
  const status = body?.status as string | undefined;
  if (!applicationId || !status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("teacher_applications").update({ status }).eq("id", applicationId);
  if (error) {
    console.error("[teacher-applications] status update failed:", error.message);
    return NextResponse.json({ error: "تعذّر تحديث حالة الطلب" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
