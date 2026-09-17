import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getRuntimeSettings } from "@/lib/platform-settings";

// طلب تجميد اشتراك — Workflow بحالة صريحة (requested → approved/rejected)، وليس تعديلًا مباشرًا
// لولي الأمر على الاشتراك. كل قواعد الأهلية من src/lib/policies.ts فقط.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const subscriptionId = body?.subscriptionId as string | undefined;
  const startDate = body?.startDate as string | undefined;
  const endDate = body?.endDate as string | undefined;
  const reason = body?.reason as string | undefined;

  if (!subscriptionId || !startDate || !endDate) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  const admin = createSupabaseAdminClient();

  const { data: parent } = await admin.from("parents").select("id").eq("user_id", user.id).maybeSingle();
  if (!parent) return NextResponse.json({ error: "لا يوجد سجل ولي أمر لهذا الحساب" }, { status: 403 });

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("id, parent_id, status")
    .eq("id", subscriptionId)
    .maybeSingle();
  if (!subscription || subscription.parent_id !== parent.id) {
    return NextResponse.json({ error: "هذا الاشتراك لا يخصك" }, { status: 403 });
  }
  if (subscription.status !== "active") {
    return NextResponse.json({ error: "لا يمكن تجميد اشتراك غير فعّال" }, { status: 409 });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (start < today) {
    return NextResponse.json({ error: "لا يمكن طلب تجميد بأثر رجعي" }, { status: 400 });
  }
  if (end < start) {
    return NextResponse.json({ error: "تاريخ النهاية قبل تاريخ البداية" }, { status: 400 });
  }
  const durationDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  // الحد الأقصى الفعلي: platform_settings.pause_max_days إن كانت الهجرة مُطبَّقة، وإلا
  // الافتراضي المطابق لـPAUSE_POLICY.MAX_PAUSE_DAYS الحالي.
  const settings = await getRuntimeSettings();
  if (durationDays > settings.pauseMaxDays) {
    return NextResponse.json({ error: `أقصى مدة تجميد ${settings.pauseMaxDays} أيام` }, { status: 400 });
  }

  const { data: existingPauses } = await admin
    .from("subscription_pauses")
    .select("start_date, end_date")
    .eq("subscription_id", subscriptionId)
    .in("status", ["requested", "approved", "active"]);

  const overlaps = (existingPauses ?? []).some((p: { start_date: string; end_date: string }) => {
    const pStart = new Date(p.start_date);
    const pEnd = new Date(p.end_date);
    return start <= pEnd && end >= pStart;
  });
  if (overlaps) {
    return NextResponse.json({ error: "يوجد طلب تجميد آخر متداخل مع هذه الفترة" }, { status: 409 });
  }

  const { error } = await admin.from("subscription_pauses").insert({
    subscription_id: subscriptionId,
    requested_by: user.id,
    start_date: startDate,
    end_date: endDate,
    reason: reason ?? null,
    status: "requested",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
