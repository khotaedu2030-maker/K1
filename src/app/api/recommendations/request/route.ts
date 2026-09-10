import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// طلب "جلسة تقوية فردية مركّزة" من بطاقة التوصية.
// يتحقق أن التوصية فعلًا تخص طفل ولي الأمر المسجّل دخوله، ثم:
//  1) يسجّل طلبًا في premium_requests (تتابعه لوحة الإدارة ماليًا وتشغيليًا)
//  2) يحوّل حالة التوصية إلى actioned حتى لا تتكرر
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { recommendationId } = body ?? {};
  if (!recommendationId) {
    return NextResponse.json({ error: "recommendationId مطلوب" }, { status: 400 });
  }

  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  const admin = createSupabaseAdminClient();

  const { data: parent } = await admin.from("parents").select("id, full_name, phone").eq("user_id", user.id).maybeSingle();
  if (!parent) return NextResponse.json({ error: "لا يوجد سجل ولي أمر لهذا الحساب" }, { status: 403 });

  const { data: recommendation } = await admin
    .from("recommendations")
    .select("id, subject, reason, child_id, status, children(parent_id, first_name)")
    .eq("id", recommendationId)
    .maybeSingle();

  if (!recommendation || (recommendation as any).children?.parent_id !== parent.id) {
    return NextResponse.json({ error: "توصية غير موجودة أو لا تخص حسابك" }, { status: 403 });
  }

  if (recommendation.status !== "open") {
    return NextResponse.json({ error: "تم التعامل مع هذه التوصية مسبقًا" }, { status: 409 });
  }

  const childName = (recommendation as any).children?.first_name ?? "";

  const { error: insertError } = await admin.from("premium_requests").insert({
    product: "motabaa",
    full_name: parent.full_name,
    phone: parent.phone,
    goal: `جلسة تقوية فردية لـ${childName ? " " + childName : ""} — ${recommendation.subject ?? ""}: ${recommendation.reason}`,
    status: "new",
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const { error: updateError } = await admin
    .from("recommendations")
    .update({ status: "actioned" })
    .eq("id", recommendationId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
