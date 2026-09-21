import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/require-admin";

// اعتماد/رفض طلب تجميد — للأدمن فقط. تحديث حالة الطلب وتمديد renewal_date (عند الاعتماد)
// ينفَّذان كمعاملة ذرّية واحدة عبر public.review_subscription_pause — لا حالة وسيطة ممكنة
// حيث الطلب "معتمَد" لكن تاريخ التجديد لم يُمدَّد بعد.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const pauseId = body?.pauseId as string | undefined;
  const decision = body?.decision as "approved" | "rejected" | undefined;
  if (!pauseId || !decision) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const admin = createSupabaseAdminClient();

  const { error } = await admin.rpc("review_subscription_pause", {
    p_pause_id: pauseId,
    p_decision: decision,
    p_reviewer: adminCheck.userId,
  });

  if (error) {
    const map: Record<string, string> = {
      pause_not_found: "طلب غير موجود",
      already_reviewed: "تمت مراجعة هذا الطلب مسبقًا",
      subscription_not_found: "اشتراك غير موجود",
      invalid_decision: "قرار غير صالح",
    };
    const known = Object.keys(map).find((k) => error.message.includes(k));
    return NextResponse.json({ error: known ? map[known] : error.message }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
