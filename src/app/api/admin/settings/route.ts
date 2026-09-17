import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// فقط 4 حقول قابلة للتعديل من هذا المسار حاليًا — الوحيدة المُستهلَكة فعليًا بمنطق تشغيلي
// حقيقي (راجع src/lib/platform-settings.ts + التقرير النهائي). الحقول الأخرى بالجدول
// (pause_min_days، booking_window_days، default_session_duration_minutes، support_email/phone)
// لا تُستقبَل من هذا الـbody إطلاقًا — نجلب قيمها الحالية المخزَّنة ونُمرِّرها كما هي لتوقيع RPC
// الثابت من V1، بلا أي احتمال إعادة تعيين غير مقصودة لقيمة لا تظهر بالنموذج أصلًا.
export async function POST(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const body = await req.json().catch(() => null);
  const makeupLimit = Number(body?.makeupMonthlyLimit);
  const pauseMax = Number(body?.pauseMaxDays);
  const quietStart = typeof body?.quietHoursStart === "string" ? body.quietHoursStart : "";
  const quietEnd = typeof body?.quietHoursEnd === "string" ? body.quietHoursEnd : "";

  if (
    !Number.isInteger(makeupLimit) || makeupLimit < 0 || makeupLimit > 10 ||
    !Number.isInteger(pauseMax) || pauseMax < 1 || pauseMax > 180 ||
    !/^\d{2}:\d{2}$/.test(quietStart) || !/^\d{2}:\d{2}$/.test(quietEnd)
  ) {
    return NextResponse.json({ error: "قيم غير صالحة، راجع الحدود المسموحة لكل حقل" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const { data: current } = await admin
    .from("platform_settings")
    .select("default_session_duration_minutes, pause_min_days, booking_window_days, support_email, support_phone")
    .eq("id", true)
    .maybeSingle();
  if (!current) {
    return NextResponse.json({ error: "الإعدادات غير مُهيَّأة بعد — طبّق migration الإعدادات أولًا" }, { status: 500 });
  }

  const { error } = await admin.rpc("admin_update_platform_settings", {
    p_admin_user_id: adminCheck.userId,
    p_default_session_duration_minutes: current.default_session_duration_minutes,
    p_makeup_monthly_limit: makeupLimit,
    p_pause_min_days: current.pause_min_days,
    p_pause_max_days: pauseMax,
    p_booking_window_days: current.booking_window_days,
    p_quiet_hours_start: quietStart,
    p_quiet_hours_end: quietEnd,
    p_support_email: current.support_email,
    p_support_phone: current.support_phone,
  });
  if (error) {
    console.error("[admin-settings] فشل تحديث الإعدادات:", error.message);
    return NextResponse.json({ error: "تعذّر حفظ الإعدادات" }, { status: 500 });
  }

  const { error: auditError } = await admin.from("admin_actions").insert({
    admin_user_id: adminCheck.userId,
    action: "settings_update",
    entity_type: "platform_settings",
    entity_id: "singleton",
    new_value: { makeupMonthlyLimit: makeupLimit, pauseMaxDays: pauseMax, quietHoursStart: quietStart, quietHoursEnd: quietEnd },
  });
  if (auditError) console.error("[admin-settings] فشل تسجيل admin_actions (غير حاجب):", auditError.message);

  return NextResponse.json({ ok: true });
}
